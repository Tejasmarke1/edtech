"""Payment domain models for gateway transactions and webhook events."""

import enum

from sqlalchemy import Enum, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class PaymentGateway(str, enum.Enum):
    mock = "mock"
    razorpay = "razorpay"
    stripe = "stripe"


class PaymentStatus(str, enum.Enum):
    created = "created"
    authorized = "authorized"
    captured = "captured"
    failed = "failed"
    refunded = "refunded"


class PaymentEventStatus(str, enum.Enum):
    received = "received"
    processed = "processed"
    ignored = "ignored"
    failed = "failed"


class PaymentTransaction(TimestampMixin, Base):
    """Tracks one payment transaction tied to a session."""

    __tablename__ = "payment_transaction"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("session_schedule.id", ondelete="CASCADE"),
        nullable=False,
    )
    payer_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )
    payee_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )

    gross_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    platform_charge: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    commission_charge: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    net_payout: Mapped[int] = mapped_column(Integer, nullable=False)
    total_payable: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)

    gateway: Mapped[PaymentGateway] = mapped_column(
        Enum(PaymentGateway, name="payment_gateway"),
        default=PaymentGateway.mock,
        nullable=False,
    )
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"),
        default=PaymentStatus.created,
        nullable=False,
    )
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    gateway_order_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    gateway_payment_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    gateway_signature: Mapped[str | None] = mapped_column(String(500))
    gateway_metadata: Mapped[dict | None] = mapped_column(JSON)

    session: Mapped["SessionSchedule"] = relationship(back_populates="payment_transactions")
    payer: Mapped["User"] = relationship(foreign_keys=[payer_id])
    payee: Mapped["User"] = relationship(foreign_keys=[payee_id])
    events: Mapped[list["PaymentEvent"]] = relationship(
        back_populates="transaction", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("gateway", "gateway_order_id", name="uq_payment_gateway_order"),
        UniqueConstraint("gateway", "gateway_payment_id", name="uq_payment_gateway_payment"),
    )


class PaymentEvent(TimestampMixin, Base):
    """Stores webhook callbacks and processing state for idempotency/audit."""

    __tablename__ = "payment_event"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    gateway: Mapped[PaymentGateway] = mapped_column(
        Enum(PaymentGateway, name="payment_gateway"),
        nullable=False,
    )
    event_id: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[PaymentEventStatus] = mapped_column(
        Enum(PaymentEventStatus, name="payment_event_status"),
        default=PaymentEventStatus.received,
        nullable=False,
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    transaction_id: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("payment_transaction.id", ondelete="SET NULL"),
    )
    processing_error: Mapped[str | None] = mapped_column(String(1000))

    transaction: Mapped["PaymentTransaction | None"] = relationship(back_populates="events")

    __table_args__ = (
        UniqueConstraint("gateway", "event_id", name="uq_payment_gateway_event_id"),
    )
