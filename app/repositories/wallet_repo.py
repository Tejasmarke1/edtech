"""Wallet repository — DB queries for teacher_wallet & withdrawal."""

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.wallet import TeacherWallet, Withdrawal, WithdrawalStatus


def get_or_create_wallet(db: Session, teacher_id: str) -> TeacherWallet:
    wallet = db.query(TeacherWallet).filter(TeacherWallet.teacher_id == teacher_id).first()
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


def get_withdrawals(db: Session, teacher_id: str) -> list[Withdrawal]:
    return (
        db.query(Withdrawal)
        .filter(Withdrawal.teacher_id == teacher_id)
        .order_by(Withdrawal.request_at.desc())
        .all()
    )
