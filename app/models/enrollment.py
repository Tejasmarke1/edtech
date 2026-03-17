"""SessionEnrollment model — tracks students enrolled in group sessions."""

import enum

from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class EnrollmentStatus(str, enum.Enum):
    enrolled = "enrolled"
    cancelled = "cancelled"


class SessionEnrollment(TimestampMixin, Base):
    """Records each student's enrollment in a group session."""

    __tablename__ = "session_enrollment"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("session_schedule.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[EnrollmentStatus] = mapped_column(
        Enum(EnrollmentStatus, name="enrollment_status"),
        default=EnrollmentStatus.enrolled,
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_enrollment_session_student"),
    )

    session: Mapped["SessionSchedule"] = relationship(back_populates="enrollments")
    student: Mapped["User"] = relationship(back_populates="group_enrollments")

    def __repr__(self) -> str:
        return f"<SessionEnrollment session={self.session_id} student={self.student_id} status={self.status.value}>"
