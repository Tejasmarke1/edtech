"""Payment service — payment orders, webhooks, wallet operations, withdrawals."""

import hashlib
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.notification import NotificationType
from app.models.payment import PaymentEventStatus, PaymentGateway, PaymentStatus
from app.models.session import SessionSchedule, SessionStatus, SessionType
from app.models.user import User
from app.models.wallet import WithdrawalStatus
from app.repositories import payment_repo, session_repo, teacher_repo, wallet_repo
from app.services import notification_service
from app.services.payment_gateway_service import (
    GatewayOrderRequest,
    GatewayPayoutRequest,
    RazorpayGatewayClient,
    get_gateway_client,
)
from app.utils.payment import (
    calculate_commission,
    calculate_payment_breakdown,
    get_commission_percent,
    get_platform_charge_per_user,
)
from app.utils.exceptions import BadRequestError, NotFoundError
from app.utils.pagination import Page


def _build_idempotency_key(*, session_id: str, payer_id: str, amount: int) -> str:
    raw = f"{session_id}:{payer_id}:{amount}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def initialize_payment_transaction(
    db: Session,
    *,
    session: SessionSchedule,
    payer_id: str,
    payee_id: str,
    gross_amount: int,
    platform_charge: int,
    commission_charge: int,
    net_payout: int,
    total_payable: int,
) -> dict:
    """Phase 1 scaffold: create transaction + gateway order metadata."""
    if total_payable <= 0:
        raise BadRequestError("Total payable must be greater than zero")

    idempotency_key = _build_idempotency_key(
        session_id=session.id,
        payer_id=payer_id,
        amount=total_payable,
    )
    existing = payment_repo.get_transaction_by_idempotency_key(db, idempotency_key)
    if existing:
        return {
            "transaction_id": existing.id,
            "session_id": existing.session_id,
            "status": existing.status.value,
            "gateway": existing.gateway.value,
            "gateway_order_id": existing.gateway_order_id,
            "amount": existing.total_payable,
            "currency": existing.currency,
        }

    gateway_name = settings.PAYMENT_GATEWAY
    gateway_client = get_gateway_client(gateway_name)
    order = gateway_client.create_order(
        GatewayOrderRequest(
            amount=total_payable,
            currency=settings.PAYMENT_CURRENCY,
            reference_id=session.id,
            notes={"payer_id": payer_id, "payee_id": payee_id},
        )
    )

    tx = payment_repo.create_transaction(
        db,
        session_id=session.id,
        payer_id=payer_id,
        payee_id=payee_id,
        gross_amount=gross_amount,
        platform_charge=platform_charge,
        commission_charge=commission_charge,
        net_payout=net_payout,
        total_payable=total_payable,
        currency=order.currency,
        gateway=PaymentGateway(order.gateway.value),
        idempotency_key=idempotency_key,
        gateway_order_id=order.order_id,
        gateway_metadata=order.raw,
    )

    return {
        "transaction_id": tx.id,
        "session_id": tx.session_id,
        "payer_id": tx.payer_id,
        "payee_id": tx.payee_id,
        "status": tx.status.value,
        "gateway": tx.gateway.value,
        "gateway_order_id": tx.gateway_order_id,
        "gross_amount": tx.gross_amount,
        "platform_charge": tx.platform_charge,
        "commission_charge": tx.commission_charge,
        "net_payout": tx.net_payout,
        "amount": tx.total_payable,
        "currency": tx.currency,
    }


def _finalize_captured_transaction(
    db: Session,
    tx,
    *,
    gateway_payment_id: str | None,
    gateway_signature: str | None,
    gateway_metadata: dict | None,
) -> None:
    if tx.status != PaymentStatus.captured:
        payment_repo.update_transaction_status(
            db,
            tx,
            PaymentStatus.captured,
            gateway_payment_id=gateway_payment_id,
            gateway_signature=gateway_signature,
            gateway_metadata=gateway_metadata,
        )
        wallet = wallet_repo.get_or_create_wallet(db, tx.payee_id, lock=True)
        wallet.total_earned += tx.net_payout
        wallet.current_balance += tx.net_payout
        db.flush()
        notification_service.create_notification(
            db,
            user_name=tx.payee_id,
            type=NotificationType.payment_received,
            title="Payment Captured",
            message=f"₹{tx.net_payout} credited for transaction {tx.id}.",
            reference_id=tx.session_id,
        )


def _compute_breakdown_for_user(
    db: Session, *, session: SessionSchedule, user: User
) -> dict:
    from app.repositories import enrollment_repo

    if session.status not in (SessionStatus.accepted, SessionStatus.completed):
        raise BadRequestError("Order can only be created for accepted/completed sessions")

    teacher_profile = teacher_repo.get_teacher_profile(db, session.teacher_id)
    if not teacher_profile:
        raise BadRequestError("Teacher profile missing")

    if session.session_type == SessionType.group:
        enrollment = enrollment_repo.get_enrollment(db, session.id, user.user_name)
        if not enrollment or enrollment.status.value != "enrolled":
            raise NotFoundError("Session not found")
        gross_amount = teacher_profile.group_per_student_charges or 0
        session_type = "group"
        payer_id = user.user_name
    else:
        if session.student_id != user.user_name:
            raise NotFoundError("Session not found")
        gross_amount = teacher_profile.per_30_mins_charges or 0
        session_type = "individual"
        payer_id = user.user_name

    breakdown = calculate_payment_breakdown(
        gross_amount,
        payer_count=1,
        platform_charge_per_payer=get_platform_charge_per_user(session_type),
        commission_percent=get_commission_percent(session_type),
    )
    if breakdown["total_payable"] <= 0:
        raise BadRequestError("Invalid pricing for this session")

    return {
        "session_type": session_type,
        "payer_id": payer_id,
        "payee_id": session.teacher_id,
        "breakdown": breakdown,
    }


def create_payment_order(db: Session, user: User, session_id: str) -> dict:
    session = session_repo.get_session_by_id(db, session_id)
    if not session:
        raise NotFoundError("Session not found")

    computed = _compute_breakdown_for_user(db, session=session, user=user)
    captured_tx = payment_repo.get_captured_transaction_for_session_payer(
        db,
        session_id=session.id,
        payer_id=computed["payer_id"],
    )
    if captured_tx:
        raise BadRequestError("Payment already captured for this session")

    latest_tx = payment_repo.get_latest_transaction_for_session_payer(
        db,
        session_id=session.id,
        payer_id=computed["payer_id"],
    )
    if latest_tx and latest_tx.status in (PaymentStatus.created, PaymentStatus.authorized):
        return {
            "transaction_id": latest_tx.id,
            "gateway": latest_tx.gateway.value,
            "gateway_order_id": latest_tx.gateway_order_id,
            "status": latest_tx.status.value,
            "session_id": latest_tx.session_id,
            "session_type": computed["session_type"],
            "payer_id": latest_tx.payer_id,
            "payee_id": latest_tx.payee_id,
            "gross_amount": latest_tx.gross_amount,
            "platform_charge": latest_tx.platform_charge,
            "commission_charge": latest_tx.commission_charge,
            "net_payout": latest_tx.net_payout,
            "total_payable": latest_tx.total_payable,
            "currency": latest_tx.currency,
        }

    breakdown = computed["breakdown"]
    tx = initialize_payment_transaction(
        db,
        session=session,
        payer_id=computed["payer_id"],
        payee_id=computed["payee_id"],
        gross_amount=breakdown["gross_amount"],
        platform_charge=breakdown["platform_charge"],
        commission_charge=breakdown["commission_charge"],
        net_payout=breakdown["teacher_payout"],
        total_payable=breakdown["total_payable"],
    )
    return {
        "transaction_id": tx["transaction_id"],
        "gateway": tx["gateway"],
        "gateway_order_id": tx["gateway_order_id"],
        "status": tx["status"],
        "session_id": tx["session_id"],
        "session_type": computed["session_type"],
        "payer_id": tx["payer_id"],
        "payee_id": tx["payee_id"],
        "gross_amount": breakdown["gross_amount"],
        "platform_charge": breakdown["platform_charge"],
        "commission_charge": breakdown["commission_charge"],
        "net_payout": breakdown["teacher_payout"],
        "total_payable": tx["amount"],
        "currency": tx["currency"],
    }


def get_payment_transaction(db: Session, user: User, transaction_id: str) -> dict:
    tx = payment_repo.get_transaction_by_id(db, transaction_id)
    if not tx:
        raise NotFoundError("Transaction not found")
    if user.user_name not in (tx.payer_id, tx.payee_id):
        raise NotFoundError("Transaction not found")
    return {
        "transaction_id": tx.id,
        "gateway": tx.gateway.value,
        "gateway_order_id": tx.gateway_order_id,
        "gateway_payment_id": tx.gateway_payment_id,
        "status": tx.status.value,
        "session_id": tx.session_id,
        "payer_id": tx.payer_id,
        "payee_id": tx.payee_id,
        "gross_amount": tx.gross_amount,
        "platform_charge": tx.platform_charge,
        "commission_charge": tx.commission_charge,
        "net_payout": tx.net_payout,
        "total_payable": tx.total_payable,
        "currency": tx.currency,
    }


def list_payment_transactions(
    db: Session, user: User, *, skip: int = 0, limit: int = 20
) -> Page[dict]:
    items, total = payment_repo.get_transactions_for_user(
        db, user.user_name, skip=skip, limit=limit
    )
    mapped = [
        {
            "transaction_id": tx.id,
            "gateway": tx.gateway.value,
            "gateway_order_id": tx.gateway_order_id,
            "gateway_payment_id": tx.gateway_payment_id,
            "status": tx.status.value,
            "session_id": tx.session_id,
            "payer_id": tx.payer_id,
            "payee_id": tx.payee_id,
            "gross_amount": tx.gross_amount,
            "platform_charge": tx.platform_charge,
            "commission_charge": tx.commission_charge,
            "net_payout": tx.net_payout,
            "total_payable": tx.total_payable,
            "currency": tx.currency,
        }
        for tx in items
    ]
    return Page(items=mapped, total=total, skip=skip, limit=limit)


def process_webhook(
    db: Session,
    *,
    provider: str,
    payload: dict,
    raw_body: bytes,
    signature: str,
) -> dict:
    client = get_gateway_client(provider)
    if not client.verify_webhook_signature(raw_body, signature):
        raise BadRequestError("Invalid webhook signature")

    parsed = client.parse_webhook(payload)
    existing = payment_repo.get_event_by_gateway_event_id(db, parsed.gateway, parsed.event_id)
    if existing:
        tx_status = existing.transaction.status.value if existing.transaction else None
        return {
            "event_id": existing.event_id,
            "transaction_id": existing.transaction_id,
            "event_status": "duplicate",
            "transaction_status": tx_status,
        }

    normalized_payload = parsed.payload or {}
    data = normalized_payload.get("data") or {}
    order_id = data.get("order_id")
    payment_id = data.get("payment_id")
    tx = None
    if order_id:
        tx = payment_repo.get_transaction_by_gateway_order_id(db, parsed.gateway, str(order_id))

    event = payment_repo.create_event(
        db,
        gateway=parsed.gateway,
        event_id=parsed.event_id,
        event_type=parsed.event_type,
        payload=normalized_payload,
        transaction_id=tx.id if tx else None,
    )

    if not tx:
        if parsed.event_type.startswith("payout."):
            payment_repo.update_event_status(db, event, PaymentEventStatus.processed)
            return _process_withdrawal_webhook(db, parsed, event)
        payment_repo.update_event_status(db, event, PaymentEventStatus.ignored)
        return {
            "event_id": event.event_id,
            "transaction_id": None,
            "event_status": event.status.value,
            "transaction_status": None,
        }

    if parsed.event_type.startswith("payout."):
        payment_repo.update_event_status(db, event, PaymentEventStatus.processed)
        return _process_withdrawal_webhook(db, parsed, event)

    if parsed.event_type == "payment.captured":
        if parsed.gateway == PaymentGateway.razorpay:
            amount_subunits = data.get("amount_subunits")
            currency = str(data.get("currency") or "").upper()
            if amount_subunits is None or currency == "":
                raise BadRequestError("Missing amount/currency in Razorpay webhook payload")
            expected_amount_subunits = tx.total_payable * 100
            if int(amount_subunits) != expected_amount_subunits:
                raise BadRequestError("Webhook amount does not match transaction")
            if currency != tx.currency.upper():
                raise BadRequestError("Webhook currency does not match transaction")

        _finalize_captured_transaction(
            db,
            tx,
            gateway_payment_id=str(payment_id) if payment_id else None,
            gateway_signature=signature,
            gateway_metadata=payload,
        )
        payment_repo.update_event_status(db, event, PaymentEventStatus.processed)
    elif parsed.event_type == "payment.failed":
        if tx.status == PaymentStatus.captured:
            payment_repo.update_event_status(
                db,
                event,
                PaymentEventStatus.ignored,
                processing_error="Ignoring failed event for already captured transaction",
            )
            return {
                "event_id": event.event_id,
                "transaction_id": tx.id,
                "event_status": event.status.value,
                "transaction_status": tx.status.value,
            }

        payment_repo.update_transaction_status(
            db,
            tx,
            PaymentStatus.failed,
            gateway_payment_id=str(payment_id) if payment_id else None,
            gateway_signature=signature,
            gateway_metadata=payload,
        )
        payment_repo.update_event_status(db, event, PaymentEventStatus.processed)
    else:
        payment_repo.update_event_status(db, event, PaymentEventStatus.ignored)

    return {
        "event_id": event.event_id,
        "transaction_id": tx.id,
        "event_status": event.status.value,
        "transaction_status": tx.status.value,
    }


def verify_checkout_payment(
    db: Session,
    *,
    provider: str,
    gateway_order_id: str,
    gateway_payment_id: str,
    signature: str,
) -> dict:
    client = get_gateway_client(provider)
    if not gateway_order_id.strip() or not gateway_payment_id.strip():
        raise BadRequestError("Gateway order id and payment id are required")

    tx = payment_repo.get_transaction_by_gateway_order_id(
        db, client.gateway, gateway_order_id.strip()
    )
    if not tx:
        raise NotFoundError("Transaction not found")

    if tx.gateway_payment_id and tx.gateway_payment_id != gateway_payment_id:
        raise BadRequestError("Checkout payment id does not match the transaction")

    if not client.verify_checkout_signature(
        gateway_order_id.strip(), gateway_payment_id.strip(), signature
    ):
        raise BadRequestError("Invalid checkout signature")

    if tx.status != PaymentStatus.captured:
        _finalize_captured_transaction(
            db,
            tx,
            gateway_payment_id=gateway_payment_id.strip(),
            gateway_signature=signature,
            gateway_metadata={
                "source": "checkout_verification",
                "provider": client.gateway.value,
                "gateway_order_id": gateway_order_id.strip(),
                "gateway_payment_id": gateway_payment_id.strip(),
            },
        )
        verification_status = "verified"
    else:
        verification_status = "already_verified"

    return {
        "transaction_id": tx.id,
        "session_id": tx.session_id,
        "gateway": tx.gateway.value,
        "gateway_order_id": tx.gateway_order_id,
        "gateway_payment_id": tx.gateway_payment_id,
        "verification_status": verification_status,
        "transaction_status": tx.status.value,
    }


def _map_payout_status(gateway_status: str, event_type: str) -> WithdrawalStatus:
    normalized_status = str(gateway_status or "").strip().lower()
    normalized_event = str(event_type or "").strip().lower()

    if normalized_status in ("queued", "pending", "processing"):
        return WithdrawalStatus.processing
    if normalized_status in ("processed", "success") or normalized_event == "payout.processed":
        return WithdrawalStatus.success
    if normalized_status in ("failed", "reversed", "cancelled") or normalized_event in (
        "payout.failed",
        "payout.reversed",
        "payout.cancelled",
    ):
        return WithdrawalStatus.failed
    return WithdrawalStatus.processing


def _process_withdrawal_webhook(db: Session, parsed, event) -> dict:
    payload = parsed.payload or {}
    data = payload.get("data") or {}
    payout_id = str(data.get("payout_id") or "").strip()
    if not payout_id:
        return {
            "event_id": event.event_id,
            "transaction_id": None,
            "event_status": event.status.value,
            "transaction_status": None,
        }

    withdrawal = wallet_repo.get_withdrawal_by_gateway_payout_id(db, payout_id)
    if not withdrawal:
        payment_repo.update_event_status(db, event, PaymentEventStatus.ignored)
        return {
            "event_id": event.event_id,
            "transaction_id": None,
            "event_status": event.status.value,
            "transaction_status": None,
        }

    next_status = _map_payout_status(str(data.get("status") or ""), parsed.event_type)
    if next_status == WithdrawalStatus.success:
        wallet_repo.finalize_withdrawal_success(db, withdrawal, gateway_metadata=payload)
        notification_service.create_notification(
            db,
            user_name=withdrawal.teacher_id,
            type=NotificationType.withdrawal_processed,
            title="Withdrawal Success",
            message=f"Your withdrawal of ₹{withdrawal.amount} has been processed successfully.",
            reference_id=withdrawal.id,
        )
    elif next_status == WithdrawalStatus.failed:
        reason = str(data.get("failure_reason") or "Payout failed")
        wallet_repo.finalize_withdrawal_failed(
            db,
            withdrawal,
            reason=reason,
            gateway_metadata=payload,
        )
        notification_service.create_notification(
            db,
            user_name=withdrawal.teacher_id,
            type=NotificationType.withdrawal_processed,
            title="Withdrawal Failed",
            message=f"Your withdrawal of ₹{withdrawal.amount} failed and amount was refunded.",
            reference_id=withdrawal.id,
        )
    else:
        wallet_repo.mark_withdrawal_processing(
            db,
            withdrawal,
            gateway=parsed.gateway.value,
            gateway_contact_id=withdrawal.gateway_contact_id,
            gateway_fund_account_id=withdrawal.gateway_fund_account_id,
            gateway_payout_id=withdrawal.gateway_payout_id or payout_id,
            gateway_metadata=payload,
        )

    return {
        "event_id": event.event_id,
        "transaction_id": None,
        "event_status": event.status.value,
        "transaction_status": withdrawal.status.value,
    }


def get_monthly_earnings(db: Session, user: User, year: int, month: int) -> dict:
    """Get earnings breakdown for a specific month."""
    return payment_repo.get_monthly_captured_earnings(db, user.user_name, year, month)


def request_withdrawal_payout(db: Session, user: User, *, amount: int) -> dict:
    teacher_profile = teacher_repo.get_teacher_profile(db, user.user_name)
    if not teacher_profile:
        raise BadRequestError("Teacher profile not found")

    # Preserve backward compatibility for non-Razorpay flows used in tests/mock mode.
    if (
        settings.PAYMENT_GATEWAY == PaymentGateway.razorpay.value
        and not (teacher_profile.upi_id or "").strip()
    ):
        raise BadRequestError("Please configure UPI ID before requesting withdrawal")

    active = wallet_repo.get_active_withdrawal_for_amount(db, user.user_name, amount)
    if active:
        return active

    wallet = wallet_repo.get_or_create_wallet(db, user.user_name, lock=True)
    if amount > wallet.current_balance:
        raise BadRequestError(f"Insufficient balance. Available: {wallet.current_balance}")

    wallet.current_balance -= amount
    wallet.total_withdraw += amount
    db.flush()

    withdrawal = wallet_repo.create_withdrawal(db, user.user_name, amount)
    _attempt_withdrawal_payout(db, withdrawal, user)
    return withdrawal


def _attempt_withdrawal_payout(db: Session, withdrawal, user: User | None = None) -> None:
    if settings.PAYMENT_GATEWAY != PaymentGateway.razorpay.value:
        return

    if withdrawal.status not in (WithdrawalStatus.requested, WithdrawalStatus.processing):
        return

    client = get_gateway_client(settings.PAYMENT_GATEWAY)
    if not isinstance(client, RazorpayGatewayClient):
        return

    teacher_profile = teacher_repo.get_teacher_profile(db, withdrawal.teacher_id)
    upi_id = (teacher_profile.upi_id or "").strip() if teacher_profile else ""
    if not upi_id:
        wallet_repo.mark_withdrawal_requested_error(
            db,
            withdrawal,
            gateway=PaymentGateway.razorpay.value,
            gateway_contact_id=withdrawal.gateway_contact_id,
            gateway_fund_account_id=withdrawal.gateway_fund_account_id,
            last_error="Missing UPI ID for payout",
        )
        return

    name = (user.user_name if user else withdrawal.teacher_id) or withdrawal.teacher_id
    email = (user.user_name if user else withdrawal.teacher_id) or withdrawal.teacher_id

    try:
        contact_id = withdrawal.gateway_contact_id
        fund_account_id = withdrawal.gateway_fund_account_id
        if not contact_id or not fund_account_id:
            previous_contact, previous_fund = wallet_repo.get_latest_gateway_accounts(db, withdrawal.teacher_id)
            contact_id = contact_id or previous_contact
            fund_account_id = fund_account_id or previous_fund

        if not contact_id:
            contact_id = client.create_contact(
                name=name,
                email=email,
                phone=None,
                notes={"teacher_id": withdrawal.teacher_id},
            )

        if not fund_account_id:
            fund_account_id = client.create_upi_fund_account(
                contact_id=contact_id,
                upi_id=upi_id,
                account_holder_name=name,
            )

        payout = client.create_payout(
            GatewayPayoutRequest(
                amount=withdrawal.amount,
                currency=settings.PAYMENT_CURRENCY,
                reference_id=withdrawal.id,
                fund_account_id=fund_account_id,
                mode="UPI",
                narration=f"Withdrawal {withdrawal.id[:8]}",
                notes={"teacher_id": withdrawal.teacher_id, "withdrawal_id": withdrawal.id},
                idempotency_key=withdrawal.idempotency_key,
            )
        )

        wallet_repo.mark_withdrawal_processing(
            db,
            withdrawal,
            gateway=payout.gateway.value,
            gateway_contact_id=contact_id,
            gateway_fund_account_id=fund_account_id,
            gateway_payout_id=payout.payout_id,
            gateway_metadata=payout.raw,
        )
    except Exception as error:
        wallet_repo.mark_withdrawal_requested_error(
            db,
            withdrawal,
            gateway=PaymentGateway.razorpay.value,
            gateway_contact_id=withdrawal.gateway_contact_id,
            gateway_fund_account_id=withdrawal.gateway_fund_account_id,
            last_error=str(error),
        )


def reconcile_withdrawals(
    db: Session,
    *,
    older_than_minutes: int = 15,
    retry_requested_limit: int = 20,
    processing_limit: int = 50,
) -> dict:
    retried_requested = 0
    finalized_success = 0
    finalized_failed = 0

    requested = wallet_repo.list_requested_withdrawals(db, limit=retry_requested_limit)
    for withdrawal in requested:
        before_payout_id = withdrawal.gateway_payout_id
        _attempt_withdrawal_payout(db, withdrawal)
        if withdrawal.gateway_payout_id and withdrawal.gateway_payout_id != before_payout_id:
            retried_requested += 1

    processing_items = wallet_repo.list_stuck_processing_withdrawals(
        db,
        older_than_minutes=older_than_minutes,
        limit=processing_limit,
    )
    client = get_gateway_client(settings.PAYMENT_GATEWAY)
    if isinstance(client, RazorpayGatewayClient):
        for withdrawal in processing_items:
            try:
                payout = client.get_payout(withdrawal.gateway_payout_id)
                next_status = _map_payout_status(payout.status, "")
                if next_status == WithdrawalStatus.success:
                    wallet_repo.finalize_withdrawal_success(db, withdrawal, gateway_metadata=payout.raw)
                    finalized_success += 1
                elif next_status == WithdrawalStatus.failed:
                    wallet_repo.finalize_withdrawal_failed(
                        db,
                        withdrawal,
                        reason=str(payout.raw.get("failure_reason") or "Payout failed during reconciliation"),
                        gateway_metadata=payout.raw,
                    )
                    finalized_failed += 1
            except Exception:
                continue

    return {
        "scanned_requested": len(requested),
        "retried_requested": retried_requested,
        "scanned_processing": len(processing_items),
        "finalized_success": finalized_success,
        "finalized_failed": finalized_failed,
    }


def process_withdrawal_status(
    db: Session, withdrawal_id: str, success: bool
) -> dict:
    """Admin/mock gateway marks a withdrawal as success or failed."""
    withdrawal = wallet_repo.process_withdrawal(db, withdrawal_id, success)
    if not withdrawal:
        raise NotFoundError("Withdrawal not found")

    status_label = "success" if success else "failed"
    notification_service.create_notification(
        db,
        user_name=withdrawal.teacher_id,
        type=NotificationType.withdrawal_processed,
        title=f"Withdrawal {status_label.title()}",
        message=f"Your withdrawal of ₹{withdrawal.amount} has been {status_label}.",
        reference_id=withdrawal.id,
    )

    return {
        "id": withdrawal.id,
        "teacher_id": withdrawal.teacher_id,
        "amount": withdrawal.amount,
        "status": withdrawal.status.value,
        "gateway_payout_id": withdrawal.gateway_payout_id,
        "processed_at": withdrawal.processed_at.isoformat() if withdrawal.processed_at else None,
    }
