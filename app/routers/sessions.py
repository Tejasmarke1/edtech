"""Session router — schedule, accept, reject, join."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_student, require_teacher
from app.models.session import SessionStatus
from app.models.user import User
from app.schemas.session import (
    EnrollmentRead,
    GroupSessionCreate,
    MeetingLinkRead,
    ProposeTimeRequest,
    SessionRead,
    SessionRequest,
)
from app.services import session_service
from app.utils.pagination import Page, PaginationParams

router = APIRouter()


# ============================================================
#  INDIVIDUAL SESSION ENDPOINTS (unchanged)
# ============================================================

@router.post("/request", response_model=SessionRead, status_code=201)
def request_session(
    payload: SessionRequest,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    return session_service.request_session(db, student, payload)


@router.get("/my", response_model=Page[SessionRead])
def get_my_sessions(
    status: SessionStatus | None = Query(None, description="Filter by session status"),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return session_service.get_my_sessions(
        db, user, status=status, skip=pagination.skip, limit=pagination.limit
    )


@router.put("/{session_id}/accept", response_model=SessionRead)
def accept_session(
    session_id: str,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    return session_service.accept_session(db, teacher, session_id)


@router.put("/{session_id}/reject", response_model=SessionRead)
def reject_session(
    session_id: str,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    return session_service.reject_session(db, teacher, session_id)


@router.put("/{session_id}/propose-time", response_model=SessionRead)
def propose_time(
    session_id: str,
    payload: ProposeTimeRequest,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    return session_service.propose_time(db, teacher, session_id, payload)


@router.put("/{session_id}/accept-substitute", response_model=SessionRead)
def accept_substitute(
    session_id: str,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    return session_service.accept_substitute(db, student, session_id)


@router.put("/{session_id}/reject-substitute", response_model=SessionRead)
def reject_substitute(
    session_id: str,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    return session_service.reject_substitute(db, student, session_id)


@router.put("/{session_id}/cancel", response_model=SessionRead)
def cancel_session(
    session_id: str,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    return session_service.cancel_session(db, student, session_id)


@router.get("/{session_id}/join", response_model=MeetingLinkRead)
def join_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return session_service.get_meeting_link(db, user, session_id)


@router.post("/{session_id}/create-room", response_model=MeetingLinkRead, status_code=201)
def create_room(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return session_service.create_room(db, user, session_id)


@router.put("/{session_id}/complete", response_model=SessionRead)
def complete_session(
    session_id: str,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    return session_service.complete_session(db, teacher, session_id)


# ============================================================
#  GROUP SESSION ENDPOINTS
# ============================================================

@router.post("/group", response_model=SessionRead, status_code=201)
def create_group_session(
    payload: GroupSessionCreate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    """Teacher publishes a new open group session."""
    return session_service.create_group_session(db, teacher, payload)


@router.get("/group/available", response_model=Page[SessionRead])
def get_available_group_sessions(
    subject_id: str | None = Query(None, description="Filter by subject ID"),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Browse all open group sessions, optionally filtered by subject."""
    return session_service.get_open_group_sessions(
        db,
        subject_id=subject_id,
        skip=pagination.skip,
        limit=pagination.limit,
    )


@router.put("/{session_id}/start", response_model=SessionRead)
def start_group_session(
    session_id: str,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    """Teacher starts the group session: moves status from Open → Accepted."""
    return session_service.start_group_session(db, teacher, session_id)


@router.post("/{session_id}/enroll", response_model=EnrollmentRead, status_code=201)
def enroll_in_session(
    session_id: str,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    """Student enrolls in an open group session."""
    return session_service.enroll_in_session(db, student, session_id)


@router.delete("/{session_id}/enroll", status_code=200)
def cancel_enrollment(
    session_id: str,
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    """Student cancels their enrollment in a group session."""
    return session_service.cancel_group_enrollment(db, student, session_id)


@router.get("/{session_id}/enrollments", response_model=list[EnrollmentRead])
def get_enrollments(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Teacher or enrolled student views all enrollments for a group session."""
    return session_service.get_session_enrollments(db, user, session_id)

