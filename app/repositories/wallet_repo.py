"""Wallet repository — DB queries for teacher_wallet & withdrawal."""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import extract, func, or_
from sqlalchemy.orm import Session

from app.models.enrollment import EnrollmentStatus, SessionEnrollment
from app.models.session import SessionSchedule, SessionStatus
from app.models.teacher import TeacherProfile
from app.models.wallet import TeacherWallet, Withdrawal, WithdrawalStatus
from app.utils.payment import calculate_teacher_payout, get_commission_percent


def get_or_create_wallet(
    db: Session, teacher_id: str, *, lock: bool = False
) -> TeacherWallet:
    """Fetch (or create) the teacher wallet.

    Pass ``lock=True`` to acquire a row-level lock (SELECT ... FOR UPDATE)
    so that concurrent transactions wait instead of racing.
    """
    q = db.query(TeacherWallet).filter(TeacherWallet.teacher_id == teacher_id)
    if lock:
        q = q.with_for_update()
    wallet = q.first()
    if not wallet:
        wallet = TeacherWallet(
            id=str(uuid.uuid4()),
            teacher_id=teacher_id,
            total_earned=0,
            total_withdraw=0,
            current_balance=0,
        )
        db.add(wallet)
        db.flush()
    return wallet


def create_withdrawal(db: Session, teacher_id: str, amount: int) -> Withdrawal:
    idempotency_key = hashlib.sha256(
        f"withdrawal:{teacher_id}:{amount}:{datetime.now(timezone.utc).isoformat()}".encode("utf-8")
    ).hexdigest()
    withdrawal = Withdrawal(
        id=str(uuid.uuid4()),
        teacher_id=teacher_id,
        amount=amount,
        status=WithdrawalStatus.requested,
        request_at=datetime.now(timezone.utc),
        idempotency_key=idempotency_key,
    )
    db.add(withdrawal)
    db.flush()
    return withdrawal


def get_withdrawal_by_id(db: Session, withdrawal_id: str) -> Withdrawal | None:
    return db.query(Withdrawal).filter(Withdrawal.id == withdrawal_id).first()


def get_withdrawal_by_idempotency_key(db: Session, idempotency_key: str) -> Withdrawal | None:
    return db.query(Withdrawal).filter(Withdrawal.idempotency_key == idempotency_key).first()


def get_withdrawal_by_gateway_payout_id(db: Session, gateway_payout_id: str) -> Withdrawal | None:
    return (
        db.query(Withdrawal)
        .filter(Withdrawal.gateway_payout_id == gateway_payout_id)
        .first()
    )


def get_latest_gateway_accounts(db: Session, teacher_id: str) -> tuple[str | None, str | None]:
    latest = (
        db.query(Withdrawal)
        .filter(
            Withdrawal.teacher_id == teacher_id,
            or_(
                Withdrawal.gateway_contact_id.isnot(None),
                Withdrawal.gateway_fund_account_id.isnot(None),
            ),
        )
        .order_by(Withdrawal.updated_at.desc())
        .first()
    )
    if not latest:
        return None, None
    return latest.gateway_contact_id, latest.gateway_fund_account_id


def get_active_withdrawal_for_amount(
    db: Session,
    teacher_id: str,
    amount: int,
) -> Withdrawal | None:
    return (
        db.query(Withdrawal)
        .filter(
            Withdrawal.teacher_id == teacher_id,
            Withdrawal.amount == amount,
            Withdrawal.status.in_([WithdrawalStatus.requested, WithdrawalStatus.processing]),
        )
        .order_by(Withdrawal.request_at.desc())
        .first()
    )


def get_withdrawals(
    db: Session, teacher_id: str, *, skip: int = 0, limit: int = 20
) -> tuple[list[Withdrawal], int]:
    base = db.query(Withdrawal).filter(Withdrawal.teacher_id == teacher_id)
    total = base.count()
    items = (
        base
        .order_by(Withdrawal.request_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, total


def get_monthly_earnings(
    db: Session, teacher_id: str, year: int, month: int
) -> dict:
    """Return monthly net earnings credited to teacher after commission."""
    from app.models.session import SessionType

    profile = (
        db.query(TeacherProfile)
        .filter(TeacherProfile.user_name == teacher_id)
        .first()
    )
    sessions = (
        db.query(SessionSchedule)
        .filter(
            SessionSchedule.teacher_id == teacher_id,
            SessionSchedule.status == SessionStatus.completed,
            extract("year", SessionSchedule.session_date) == year,
            extract("month", SessionSchedule.session_date) == month,
        )
        .all()
    )

    amount_earned = 0
    for session in sessions:
        if session.session_type == SessionType.group:
            rate = profile.group_per_student_charges if profile else 0
            enrolled_count = (
                db.query(SessionEnrollment)
                .filter(
                    SessionEnrollment.session_id == session.id,
                    SessionEnrollment.status == EnrollmentStatus.enrolled,
                )
                .count()
            )
            gross_amount = (rate or 0) * enrolled_count
            commission_percent = get_commission_percent("group")
        else:
            gross_amount = profile.per_30_mins_charges if profile else 0
            commission_percent = get_commission_percent("individual")

        amount_earned += calculate_teacher_payout(
            gross_amount or 0,
            commission_percent,
        )

    return {
        "year": year,
        "month": month,
        "sessions_completed": len(sessions),
        "amount_earned": amount_earned,
    }


def process_withdrawal(db: Session, withdrawal_id: str, success: bool) -> Withdrawal | None:
    """Mark a withdrawal as success or failed (admin/mock gateway)."""
    withdrawal = db.query(Withdrawal).filter(Withdrawal.id == withdrawal_id).first()
    if not withdrawal:
        return None
    if success:
        withdrawal.status = WithdrawalStatus.success
        withdrawal.last_error = None
    else:
        withdrawal.status = WithdrawalStatus.failed
        # Refund balance (locked to prevent races)
        wallet = get_or_create_wallet(db, withdrawal.teacher_id, lock=True)
        wallet.current_balance += withdrawal.amount
        wallet.total_withdraw -= withdrawal.amount
        withdrawal.last_error = "Marked failed by manual process"
    withdrawal.processed_at = datetime.now(timezone.utc)
    db.flush()
    return withdrawal


def mark_withdrawal_processing(
    db: Session,
    withdrawal: Withdrawal,
    *,
    gateway: str,
    gateway_contact_id: str | None,
    gateway_fund_account_id: str | None,
    gateway_payout_id: str,
    gateway_metadata: dict | None,
) -> Withdrawal:
    withdrawal.status = WithdrawalStatus.processing
    withdrawal.gateway = gateway
    withdrawal.gateway_contact_id = gateway_contact_id
    withdrawal.gateway_fund_account_id = gateway_fund_account_id
    withdrawal.gateway_payout_id = gateway_payout_id
    withdrawal.gateway_metadata = gateway_metadata
    withdrawal.last_error = None
    db.flush()
    return withdrawal


def mark_withdrawal_requested_error(
    db: Session,
    withdrawal: Withdrawal,
    *,
    gateway: str,
    gateway_contact_id: str | None,
    gateway_fund_account_id: str | None,
    last_error: str,
) -> Withdrawal:
    withdrawal.status = WithdrawalStatus.requested
    withdrawal.gateway = gateway
    withdrawal.gateway_contact_id = gateway_contact_id
    withdrawal.gateway_fund_account_id = gateway_fund_account_id
    withdrawal.last_error = last_error
    db.flush()
    return withdrawal


def finalize_withdrawal_success(
    db: Session,
    withdrawal: Withdrawal,
    *,
    gateway_metadata: dict | None = None,
) -> Withdrawal:
    # Idempotent success transition.
    if withdrawal.status == WithdrawalStatus.success:
        return withdrawal

    if withdrawal.status == WithdrawalStatus.failed:
        wallet = get_or_create_wallet(db, withdrawal.teacher_id, lock=True)
        wallet.current_balance -= withdrawal.amount
        wallet.total_withdraw += withdrawal.amount

    withdrawal.status = WithdrawalStatus.success
    withdrawal.processed_at = datetime.now(timezone.utc)
    withdrawal.last_error = None
    if gateway_metadata is not None:
        withdrawal.gateway_metadata = gateway_metadata
    db.flush()
    return withdrawal


def finalize_withdrawal_failed(
    db: Session,
    withdrawal: Withdrawal,
    *,
    reason: str,
    gateway_metadata: dict | None = None,
) -> Withdrawal:
    # Idempotent failure transition with single refund.
    if withdrawal.status == WithdrawalStatus.failed:
        return withdrawal

    if withdrawal.status in (WithdrawalStatus.requested, WithdrawalStatus.processing):
        wallet = get_or_create_wallet(db, withdrawal.teacher_id, lock=True)
        wallet.current_balance += withdrawal.amount
        wallet.total_withdraw -= withdrawal.amount

    withdrawal.status = WithdrawalStatus.failed
    withdrawal.processed_at = datetime.now(timezone.utc)
    withdrawal.last_error = reason
    if gateway_metadata is not None:
        withdrawal.gateway_metadata = gateway_metadata
    db.flush()
    return withdrawal


def list_requested_withdrawals(db: Session, *, limit: int = 20) -> list[Withdrawal]:
    return (
        db.query(Withdrawal)
        .filter(Withdrawal.status == WithdrawalStatus.requested)
        .order_by(Withdrawal.request_at.asc())
        .limit(limit)
        .all()
    )


def list_stuck_processing_withdrawals(
    db: Session,
    *,
    older_than_minutes: int,
    limit: int = 50,
) -> list[Withdrawal]:
    threshold = datetime.now(timezone.utc) - timedelta(minutes=max(older_than_minutes, 1))
    return (
        db.query(Withdrawal)
        .filter(
            Withdrawal.status == WithdrawalStatus.processing,
            Withdrawal.updated_at <= threshold,
            Withdrawal.gateway_payout_id.isnot(None),
        )
        .order_by(Withdrawal.updated_at.asc())
        .limit(limit)
        .all()
    )
