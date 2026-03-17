"""Payment service — payment orders, webhooks, wallet operations, withdrawals."""

import hashlib

from sqlalchemy.orm import Session

from app.config import settings
from app.models.notification import NotificationType
from app.models.payment import PaymentEventStatus, PaymentGateway, PaymentStatus
from app.models.session import SessionSchedule, SessionStatus, SessionType
from app.models.user import User
from app.repositories import payment_repo, session_repo, teacher_repo, wallet_repo
from app.services import notification_service
from app.services.payment_gateway_service import GatewayOrderRequest, get_gateway_client
from app.utils.payment import (
    calculate_commission,
    calculate_payment_breakdown,
    get_commission_percent,
    get_platform_charge_per_user,
)
from app.utils.exceptions import BadRequestError, NotFoundError


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

    data = payload.get("data") or {}
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
        payload=payload,
        transaction_id=tx.id if tx else None,
    )

    if not tx:
        payment_repo.update_event_status(db, event, PaymentEventStatus.ignored)
        return {
            "event_id": event.event_id,
            "transaction_id": None,
            "event_status": event.status.value,
            "transaction_status": None,
        }

    if parsed.event_type == "payment.captured":
        if tx.status != PaymentStatus.captured:
            payment_repo.update_transaction_status(
                db,
                tx,
                PaymentStatus.captured,
                gateway_payment_id=str(payment_id) if payment_id else None,
                gateway_signature=signature,
                gateway_metadata=payload,
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
        payment_repo.update_event_status(db, event, PaymentEventStatus.processed)
    elif parsed.event_type == "payment.failed":
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


def get_monthly_earnings(db: Session, user: User, year: int, month: int) -> dict:
    """Get earnings breakdown for a specific month."""
    return payment_repo.get_monthly_captured_earnings(db, user.user_name, year, month)


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
        "processed_at": withdrawal.processed_at.isoformat() if withdrawal.processed_at else None,
    }
