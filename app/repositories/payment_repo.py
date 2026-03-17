"""Payment repository — DB operations for transactions and webhook events."""

import uuid

from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.models.payment import (
    PaymentEvent,
    PaymentEventStatus,
    PaymentGateway,
    PaymentStatus,
    PaymentTransaction,
)


def create_transaction(
    db: Session,
    *,
    session_id: str,
    payer_id: str,
    payee_id: str,
    gross_amount: int,
    platform_charge: int,
    commission_charge: int,
    net_payout: int,
    total_payable: int,
    currency: str,
    gateway: PaymentGateway,
    idempotency_key: str,
    gateway_order_id: str | None = None,
    gateway_metadata: dict | None = None,
) -> PaymentTransaction:
    tx = PaymentTransaction(
        id=str(uuid.uuid4()),
        session_id=session_id,
        payer_id=payer_id,
        payee_id=payee_id,
        gross_amount=gross_amount,
        platform_charge=platform_charge,
        commission_charge=commission_charge,
        net_payout=net_payout,
        total_payable=total_payable,
        currency=currency,
        gateway=gateway,
        status=PaymentStatus.created,
        idempotency_key=idempotency_key,
        gateway_order_id=gateway_order_id,
        gateway_metadata=gateway_metadata,
    )
    db.add(tx)
    db.flush()
    return tx


def get_transaction_by_id(db: Session, transaction_id: str) -> PaymentTransaction | None:
    return (
        db.query(PaymentTransaction)
        .filter(PaymentTransaction.id == transaction_id)
        .first()
    )


def get_transaction_by_idempotency_key(
    db: Session, idempotency_key: str
) -> PaymentTransaction | None:
    return (
        db.query(PaymentTransaction)
        .filter(PaymentTransaction.idempotency_key == idempotency_key)
        .first()
    )


def get_transaction_by_gateway_order_id(
    db: Session, gateway: PaymentGateway, gateway_order_id: str
) -> PaymentTransaction | None:
    return (
        db.query(PaymentTransaction)
        .filter(
            PaymentTransaction.gateway == gateway,
            PaymentTransaction.gateway_order_id == gateway_order_id,
        )
        .first()
    )


def update_transaction_status(
    db: Session,
    tx: PaymentTransaction,
    status: PaymentStatus,
    *,
    gateway_payment_id: str | None = None,
    gateway_signature: str | None = None,
    gateway_metadata: dict | None = None,
) -> PaymentTransaction:
    tx.status = status
    if gateway_payment_id:
        tx.gateway_payment_id = gateway_payment_id
    if gateway_signature:
        tx.gateway_signature = gateway_signature
    if gateway_metadata is not None:
        tx.gateway_metadata = gateway_metadata
    db.flush()
    return tx


def create_event(
    db: Session,
    *,
    gateway: PaymentGateway,
    event_id: str,
    event_type: str,
    payload: dict,
    transaction_id: str | None = None,
) -> PaymentEvent:
    event = PaymentEvent(
        id=str(uuid.uuid4()),
        gateway=gateway,
        event_id=event_id,
        event_type=event_type,
        status=PaymentEventStatus.received,
        payload=payload,
        transaction_id=transaction_id,
    )
    db.add(event)
    db.flush()
    return event


def get_event_by_gateway_event_id(
    db: Session, gateway: PaymentGateway, event_id: str
) -> PaymentEvent | None:
    return (
        db.query(PaymentEvent)
        .filter(
            PaymentEvent.gateway == gateway,
            PaymentEvent.event_id == event_id,
        )
        .first()
    )


def update_event_status(
    db: Session,
    event: PaymentEvent,
    status: PaymentEventStatus,
    *,
    processing_error: str | None = None,
) -> PaymentEvent:
    event.status = status
    event.processing_error = processing_error
    db.flush()
    return event


def get_monthly_captured_earnings(
    db: Session, payee_id: str, year: int, month: int
) -> dict:
    items = (
        db.query(PaymentTransaction)
        .filter(
            PaymentTransaction.payee_id == payee_id,
            PaymentTransaction.status == PaymentStatus.captured,
            extract("year", PaymentTransaction.created_at) == year,
            extract("month", PaymentTransaction.created_at) == month,
        )
        .all()
    )
    return {
        "year": year,
        "month": month,
        "sessions_completed": len(items),
        "amount_earned": sum(i.net_payout for i in items),
    }
