"""Notification model."""

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class NotificationType(str, enum.Enum):
    session_request = "session_request"
    session_accepted = "session_accepted"
    session_rejected = "session_rejected"
    session_completed = "session_completed"
    substitute_proposed = "substitute_proposed"
    rating_reminder = "rating_reminder"
    payment_received = "payment_received"
    withdrawal_processed = "withdrawal_processed"
    general = "general"


class Notification(TimestampMixin, Base):
    """In-app notifications for users."""

    __tablename__ = "notification"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_name: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(255))

    user: Mapped["User"] = relationship(backref="notifications")

    def __repr__(self) -> str:
        return f"<Notification {self.id} type={self.type.value}>"
