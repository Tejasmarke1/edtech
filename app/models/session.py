"""SessionSchedule model."""

import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class SessionStatus(str, enum.Enum):
    requested = "Requested"
    accepted = "Accepted"
    rejected = "Rejected"
    rescheduled = "Rescheduled"
    completed = "Completed"
    cancelled = "Cancelled"
    open = "Open"  # Group sessions start as Open


class SessionType(str, enum.Enum):
    individual = "individual"
    group = "group"


class SessionSchedule(TimestampMixin, Base):
    """Scheduled doubt-resolution sessions."""

    __tablename__ = "session_schedule"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    session_type: Mapped[SessionType] = mapped_column(
        Enum(SessionType, name="session_type"),
        default=SessionType.individual,
        nullable=False,
    )
    teacher_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )
    # Nullable: populated for individual sessions; NULL for group sessions
    student_id: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=True,
    )
    subject_master_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("teacher_subject_master_list.id", ondelete="CASCADE"),
        nullable=False,
    )
    topic_description: Mapped[str | None] = mapped_column(Text)
    slot_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("availability_slots.id", ondelete="CASCADE"),
        nullable=False,
    )
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status"),
        default=SessionStatus.requested,
        nullable=False,
    )
    max_students: Mapped[int | None] = mapped_column(Integer, nullable=True)
    meeting_link: Mapped[str | None] = mapped_column(String(500))
    room_name: Mapped[str | None] = mapped_column(String(100))

    teacher: Mapped["User"] = relationship(
        back_populates="teacher_sessions", foreign_keys=[teacher_id]
    )
    student: Mapped["User"] = relationship(
        back_populates="student_sessions", foreign_keys=[student_id]
    )
    subject_master: Mapped["TeacherSubjectMasterList"] = relationship(
        back_populates="sessions"
    )
    slot: Mapped["AvailabilitySlot"] = relationship(back_populates="sessions")
    ratings: Mapped[list["Rating"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    enrollments: Mapped[list["SessionEnrollment"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    payment_transactions: Mapped[list["PaymentTransaction"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<SessionSchedule {self.id} type={self.session_type.value} status={self.status.value}>"
