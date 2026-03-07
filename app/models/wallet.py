"""TeacherWallet & Withdrawal models."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class WithdrawalStatus(str, enum.Enum):
    requested = "requested"
    success = "success"
    failed = "failed"


class TeacherWallet(TimestampMixin, Base):
    """Teacher earnings ledger — 1:1 with User (role=teacher)."""

    __tablename__ = "teacher_wallet"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    teacher_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    total_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_withdraw: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    teacher: Mapped["User"] = relationship(back_populates="wallet")

    def __repr__(self) -> str:
        return f"<TeacherWallet {self.id} balance={self.current_balance}>"


class Withdrawal(TimestampMixin, Base):
    """Withdrawal requests from teacher wallet."""

    __tablename__ = "withdrawal"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    teacher_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[WithdrawalStatus] = mapped_column(
        Enum(WithdrawalStatus, name="withdrawal_status"),
        default=WithdrawalStatus.requested,
        nullable=False,
    )
    request_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime)

    teacher: Mapped["User"] = relationship(back_populates="withdrawals")

    def __repr__(self) -> str:
        return f"<Withdrawal {self.id} status={self.status.value}>"
