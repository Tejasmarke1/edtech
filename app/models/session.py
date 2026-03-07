"""SessionSchedule model."""

import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class SessionStatus(str, enum.Enum):
    requested = "Requested"
    accepted = "Accepted"
    rejected = "Rejected"
    rescheduled = "Rescheduled"
    completed = "Completed"
    cancelled = "Cancelled"


class SessionSchedule(TimestampMixin, Base):
    """Scheduled doubt-resolution sessions."""

    __tablename__ = "session_schedule"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    teacher_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
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
    meeting_link: Mapped[str | None] = mapped_column(String(500))

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

    def __repr__(self) -> str:
        return f"<SessionSchedule {self.id} status={self.status.value}>"
