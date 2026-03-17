"""Wallet repository — DB queries for teacher_wallet & withdrawal."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import extract, func
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
    withdrawal = Withdrawal(
        id=str(uuid.uuid4()),
        teacher_id=teacher_id,
        amount=amount,
        status=WithdrawalStatus.requested,
        request_at=datetime.now(timezone.utc),
    )
    db.add(withdrawal)
    db.flush()
    return withdrawal


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
    else:
        withdrawal.status = WithdrawalStatus.failed
        # Refund balance (locked to prevent races)
        wallet = get_or_create_wallet(db, withdrawal.teacher_id, lock=True)
        wallet.current_balance += withdrawal.amount
        wallet.total_withdraw -= withdrawal.amount
    withdrawal.processed_at = datetime.now(timezone.utc)
    db.flush()
    return withdrawal
