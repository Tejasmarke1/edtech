"""Session enrollment repository — DB queries for session_enrollment."""

import uuid

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.enrollment import EnrollmentStatus, SessionEnrollment
from app.models.session import SessionSchedule, SessionStatus


def get_enrollment(
    db: Session, session_id: str, student_id: str
) -> SessionEnrollment | None:
    return (
        db.query(SessionEnrollment)
        .filter(
            SessionEnrollment.session_id == session_id,
            SessionEnrollment.student_id == student_id,
        )
        .first()
    )


def get_active_enrollment_count(db: Session, session_id: str) -> int:
    """Count students currently enrolled (status=enrolled)."""
    return (
        db.query(SessionEnrollment)
        .filter(
            SessionEnrollment.session_id == session_id,
            SessionEnrollment.status == EnrollmentStatus.enrolled,
        )
        .count()
    )


def create_enrollment(
    db: Session, session_id: str, student_id: str
) -> SessionEnrollment:
    enrollment = SessionEnrollment(
        id=str(uuid.uuid4()),
        session_id=session_id,
        student_id=student_id,
        status=EnrollmentStatus.enrolled,
    )
    db.add(enrollment)
    db.flush()
    return enrollment


def cancel_enrollment(
    db: Session, enrollment: SessionEnrollment
) -> SessionEnrollment:
    enrollment.status = EnrollmentStatus.cancelled
    db.flush()
    return enrollment


def get_enrollments_for_session(
    db: Session, session_id: str
) -> list[SessionEnrollment]:
    """Return all active enrollments for a session."""
    return (
        db.query(SessionEnrollment)
        .filter(
            SessionEnrollment.session_id == session_id,
            SessionEnrollment.status == EnrollmentStatus.enrolled,
        )
        .all()
    )


def student_has_time_conflict(
    db: Session,
    student_id: str,
    slot_id: str,
    session_date,
    exclude_session_id: str | None = None,
) -> bool:
    """Check if a student is already enrolled in another accepted group session
    at the same slot and date."""
    q = (
        db.query(SessionEnrollment)
        .join(SessionSchedule, SessionEnrollment.session_id == SessionSchedule.id)
        .filter(
            SessionEnrollment.student_id == student_id,
            SessionEnrollment.status == EnrollmentStatus.enrolled,
            SessionSchedule.slot_id == slot_id,
            SessionSchedule.session_date == session_date,
            SessionSchedule.status.in_(
                (SessionStatus.open, SessionStatus.accepted)
            ),
        )
    )
    if exclude_session_id:
        q = q.filter(SessionEnrollment.session_id != exclude_session_id)
    return q.first() is not None
