"""Session repository — DB queries for session_schedule."""

import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.enrollment import EnrollmentStatus, SessionEnrollment
from app.models.session import SessionSchedule, SessionStatus, SessionType


def create_session(
    db: Session,
    *,
    teacher_id: str,
    student_id: str,
    subject_master_id: str,
    slot_id: str,
    session_date,
    topic_description: str | None = None,
    meeting_link: str | None = None,
    room_name: str | None = None,
) -> SessionSchedule:
    session = SessionSchedule(
        id=str(uuid.uuid4()),
        session_type=SessionType.individual,
        teacher_id=teacher_id,
        student_id=student_id,
        subject_master_id=subject_master_id,
        slot_id=slot_id,
        session_date=session_date,
        topic_description=topic_description,
        status=SessionStatus.requested,
        meeting_link=meeting_link,
        room_name=room_name,
    )
    db.add(session)
    db.flush()
    return session


def create_group_session(
    db: Session,
    *,
    teacher_id: str,
    subject_master_id: str,
    slot_id: str,
    session_date,
    max_students: int,
    topic_description: str | None = None,
    meeting_link: str | None = None,
    room_name: str | None = None,
) -> SessionSchedule:
    session = SessionSchedule(
        id=str(uuid.uuid4()),
        session_type=SessionType.group,
        teacher_id=teacher_id,
        student_id=None,
        subject_master_id=subject_master_id,
        slot_id=slot_id,
        session_date=session_date,
        topic_description=topic_description,
        status=SessionStatus.open,
        max_students=max_students,
        meeting_link=meeting_link,
        room_name=room_name,
    )
    db.add(session)
    db.flush()
    return session


def get_session_by_id(db: Session, session_id: str) -> SessionSchedule | None:
    return db.query(SessionSchedule).filter(SessionSchedule.id == session_id).first()


def get_sessions_for_user(
    db: Session,
    user_name: str,
    *,
    status: SessionStatus | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[SessionSchedule], int]:
    """Return sessions where user is teacher, individual student, or group enrollee."""
    enrolled_session_ids = (
        select(SessionEnrollment.session_id)
        .where(
            SessionEnrollment.student_id == user_name,
            SessionEnrollment.status == EnrollmentStatus.enrolled,
        )
    )
    base = db.query(SessionSchedule).filter(
        or_(
            SessionSchedule.teacher_id == user_name,
            SessionSchedule.student_id == user_name,
            SessionSchedule.id.in_(enrolled_session_ids),
        )
    )
    if status is not None:
        base = base.filter(SessionSchedule.status == status)
    total = base.count()
    items = (
        base.order_by(SessionSchedule.session_date.desc(), SessionSchedule.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, total


def get_open_group_sessions(
    db: Session,
    *,
    subject_id: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[SessionSchedule], int]:
    """Return all open group sessions, optionally filtered by subject."""
    base = db.query(SessionSchedule).filter(
        SessionSchedule.session_type == SessionType.group,
        SessionSchedule.status == SessionStatus.open,
    )
    if subject_id:
        from app.models.teacher import TeacherSubjectMasterList
        base = base.join(
            TeacherSubjectMasterList,
            SessionSchedule.subject_master_id == TeacherSubjectMasterList.id,
        ).filter(TeacherSubjectMasterList.sub_id == subject_id)
    total = base.count()
    items = (
        base.order_by(SessionSchedule.session_date.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, total


def update_session_status(
    db: Session, session: SessionSchedule, status: SessionStatus
) -> SessionSchedule:
    session.status = status
    db.flush()
    return session


def update_session_fields(
    db: Session, session: SessionSchedule, data: dict
) -> SessionSchedule:
    for key, value in data.items():
        setattr(session, key, value)
    db.flush()
    return session


def has_conflicting_session(
    db: Session,
    teacher_id: str,
    slot_id: str,
    session_date,
    *,
    exclude_session_id: str | None = None,
) -> bool:
    """Return True if an active session already exists for this teacher/slot/date."""
    active_statuses = (
        SessionStatus.requested,
        SessionStatus.accepted,
        SessionStatus.rescheduled,
    )
    q = db.query(SessionSchedule).filter(
        SessionSchedule.teacher_id == teacher_id,
        SessionSchedule.slot_id == slot_id,
        SessionSchedule.session_date == session_date,
        SessionSchedule.status.in_(active_statuses),
    )
    if exclude_session_id:
        q = q.filter(SessionSchedule.id != exclude_session_id)
    return q.first() is not None
