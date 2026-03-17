"""Session service — scheduling, acceptance, status management, Jitsi rooms."""

import uuid

from sqlalchemy.orm import Session

from app.models.enrollment import EnrollmentStatus
from app.models.notification import NotificationType
from app.models.session import SessionSchedule, SessionStatus, SessionType
from app.models.user import User, UserRole
from app.repositories import availability_repo, enrollment_repo, session_repo, teacher_repo
from app.schemas.session import EnrollmentRead, GroupSessionCreate, ProposeTimeRequest, SessionRead, SessionRequest
from app.services import notification_service
from app.utils.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.utils.jitsi import build_meeting_url, create_jitsi_token, generate_room_name
from app.utils.pagination import Page


# ---------- helpers ----------
def _generate_meeting_link() -> tuple[str, str]:
    """Return (room_name, meeting_link) for a new Jitsi room."""
    room_name = generate_room_name()
    return room_name, build_meeting_url(room_name)


def _ensure_teacher_owns_session(session: SessionSchedule, user: User) -> None:
    if session.teacher_id != user.user_name:
        raise NotFoundError("Session not found")


def _ensure_student_owns_session(session: SessionSchedule, user: User) -> None:
    if session.student_id != user.user_name:
        raise NotFoundError("Session not found")


def _get_session_or_404(db: Session, session_id: str) -> SessionSchedule:
    session = session_repo.get_session_by_id(db, session_id)
    if not session:
        raise NotFoundError("Session not found")
    return session


# ---------- Student: request session ----------
def request_session(db: Session, student: User, payload: SessionRequest) -> SessionSchedule:
    # Validate teacher exists
    teacher = db.query(User).filter(
        User.user_name == payload.teacher_id, User.role == UserRole.teacher
    ).first()
    if not teacher:
        raise NotFoundError("Teacher not found")

    # Validate subject entry exists and is active
    entry = teacher_repo.get_subject_entry_by_id(db, payload.subject_master_id)
    if not entry or entry.user_name != payload.teacher_id or not entry.is_active:
        raise NotFoundError("Teacher does not teach this subject")

    # Validate slot exists, is active, and belongs to the teacher
    slot = availability_repo.get_slot_by_id(db, payload.slot_id)
    if not slot or slot.user_name != payload.teacher_id or not slot.is_active:
        raise NotFoundError("Availability slot not found for this teacher")

    # Prevent double-booking: same teacher + slot + date
    if session_repo.has_conflicting_session(
        db, payload.teacher_id, payload.slot_id, payload.session_date
    ):
        raise BadRequestError(
            "This teacher is already booked for the selected slot and date"
        )

    room_name, meeting_link = _generate_meeting_link()

    new_session = session_repo.create_session(
        db,
        teacher_id=payload.teacher_id,
        student_id=student.user_name,
        subject_master_id=payload.subject_master_id,
        slot_id=payload.slot_id,
        session_date=payload.session_date,
        topic_description=payload.topic_description,
        meeting_link=meeting_link,
        room_name=room_name,
    )

    notification_service.create_notification(
        db,
        user_name=payload.teacher_id,
        type=NotificationType.session_request,
        title="New Session Request",
        message=f"Student {student.user_name} has requested a session.",
        reference_id=new_session.id,
    )

    return new_session


# ---------- List my sessions ----------
def get_my_sessions(
    db: Session,
    user: User,
    *,
    status: SessionStatus | None = None,
    skip: int = 0,
    limit: int = 20,
) -> Page[SessionRead]:
    items, total = session_repo.get_sessions_for_user(
        db, user.user_name, status=status, skip=skip, limit=limit
    )
    return Page(
        items=[SessionRead.model_validate(s) for s in items],
        total=total,
        skip=skip,
        limit=limit,
    )


# ---------- Teacher: accept ----------
def accept_session(db: Session, teacher: User, session_id: str) -> SessionSchedule:
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_owns_session(session, teacher)

    if session.status not in (SessionStatus.requested, SessionStatus.rescheduled):
        raise BadRequestError(
            f"Cannot accept a session with status '{session.status.value}'"
        )

    session_repo.update_session_status(db, session, SessionStatus.accepted)

    notification_service.create_notification(
        db,
        user_name=session.student_id,
        type=NotificationType.session_accepted,
        title="Session Accepted",
        message=f"Teacher {teacher.user_name} accepted your session request.",
        reference_id=session.id,
    )

    return session


# ---------- Teacher: reject ----------
def reject_session(db: Session, teacher: User, session_id: str) -> SessionSchedule:
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_owns_session(session, teacher)

    if session.status != SessionStatus.requested:
        raise BadRequestError(
            f"Cannot reject a session with status '{session.status.value}'"
        )

    session_repo.update_session_status(db, session, SessionStatus.rejected)

    notification_service.create_notification(
        db,
        user_name=session.student_id,
        type=NotificationType.session_rejected,
        title="Session Rejected",
        message=f"Teacher {teacher.user_name} is not available for your session.",
        reference_id=session.id,
    )

    return session


# ---------- Teacher: propose substitute time ----------
def propose_time(
    db: Session, teacher: User, session_id: str, payload: ProposeTimeRequest
) -> SessionSchedule:
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_owns_session(session, teacher)

    if session.status != SessionStatus.requested:
        raise BadRequestError(
            f"Cannot propose time for a session with status '{session.status.value}'"
        )

    # Validate the new slot belongs to teacher and is active
    slot = availability_repo.get_slot_by_id(db, payload.slot_id)
    if not slot or slot.user_name != teacher.user_name or not slot.is_active:
        raise NotFoundError("Availability slot not found")

    # Prevent double-booking on the proposed new time
    if session_repo.has_conflicting_session(
        db, teacher.user_name, payload.slot_id, payload.session_date,
        exclude_session_id=session.id,
    ):
        raise BadRequestError(
            "You are already booked for the selected slot and date"
        )

    session_repo.update_session_fields(db, session, {
        "slot_id": payload.slot_id,
        "session_date": payload.session_date,
        "status": SessionStatus.rescheduled,
    })

    notification_service.create_notification(
        db,
        user_name=session.student_id,
        type=NotificationType.substitute_proposed,
        title="New Time Proposed",
        message=f"Teacher {teacher.user_name} proposed a different time for your session.",
        reference_id=session.id,
    )

    return session


# ---------- Student: accept substitute ----------
def accept_substitute(db: Session, student: User, session_id: str) -> SessionSchedule:
    session = _get_session_or_404(db, session_id)
    _ensure_student_owns_session(session, student)

    if session.status != SessionStatus.rescheduled:
        raise BadRequestError(
            f"Cannot accept substitute for a session with status '{session.status.value}'"
        )

    session_repo.update_session_status(db, session, SessionStatus.accepted)

    notification_service.create_notification(
        db,
        user_name=session.teacher_id,
        type=NotificationType.session_accepted,
        title="Substitute Time Accepted",
        message=f"Student {student.user_name} accepted the proposed time.",
        reference_id=session.id,
    )

    return session


# ---------- Student: reject substitute ----------
def reject_substitute(db: Session, student: User, session_id: str) -> SessionSchedule:
    session = _get_session_or_404(db, session_id)
    _ensure_student_owns_session(session, student)

    if session.status != SessionStatus.rescheduled:
        raise BadRequestError(
            f"Cannot reject substitute for a session with status '{session.status.value}'"
        )

    session_repo.update_session_status(db, session, SessionStatus.cancelled)

    notification_service.create_notification(
        db,
        user_name=session.teacher_id,
        type=NotificationType.session_rejected,
        title="Substitute Time Rejected",
        message=f"Student {student.user_name} rejected the proposed time.",
        reference_id=session.id,
    )

    return session


# ---------- Student: cancel session ----------
def cancel_session(db: Session, student: User, session_id: str) -> SessionSchedule:
    session = _get_session_or_404(db, session_id)
    _ensure_student_owns_session(session, student)

    cancellable = (SessionStatus.requested, SessionStatus.rescheduled)
    if session.status not in cancellable:
        raise BadRequestError(
            f"Cannot cancel a session with status '{session.status.value}'"
        )

    session_repo.update_session_status(db, session, SessionStatus.cancelled)

    notification_service.create_notification(
        db,
        user_name=session.teacher_id,
        type=NotificationType.session_rejected,
        title="Session Cancelled",
        message=f"Student {student.user_name} cancelled the session request.",
        reference_id=session.id,
    )

    return session


# ---------- Both: get meeting link (join) ----------
def get_meeting_link(db: Session, user: User, session_id: str) -> dict:
    session = _get_session_or_404(db, session_id)

    is_teacher = session.teacher_id == user.user_name

    if session.session_type == SessionType.group:
        # For group sessions: check teacher or active enrollment
        if not is_teacher:
            enrollment = enrollment_repo.get_enrollment(db, session.id, user.user_name)
            if not enrollment or enrollment.status != EnrollmentStatus.enrolled:
                raise NotFoundError("Session not found")
    else:
        if not is_teacher and session.student_id != user.user_name:
            raise NotFoundError("Session not found")

    if session.status != SessionStatus.accepted:
        raise BadRequestError("Meeting link is only available for accepted sessions")

    if not session.meeting_link or not session.room_name:
        raise BadRequestError("No meeting room created for this session")

    display = user.profile.full_name if user.profile and user.profile.full_name else user.user_name
    token = create_jitsi_token(
        room_name=session.room_name,
        user_name=user.user_name,
        display_name=display,
        email=user.user_name,
        is_moderator=is_teacher,
    )

    return {
        "session_id": session.id,
        "meeting_link": session.meeting_link,
        "jwt_token": token,
        "room_name": session.room_name,
    }


# ---------- Teacher / Student: create room ----------
def create_room(db: Session, user: User, session_id: str) -> dict:
    session = _get_session_or_404(db, session_id)

    is_teacher = session.teacher_id == user.user_name

    if session.session_type == SessionType.group:
        if not is_teacher:
            enrollment = enrollment_repo.get_enrollment(db, session.id, user.user_name)
            if not enrollment or enrollment.status != EnrollmentStatus.enrolled:
                raise NotFoundError("Session not found")
    else:
        if not is_teacher and session.student_id != user.user_name:
            raise NotFoundError("Session not found")

    if session.status != SessionStatus.accepted:
        raise BadRequestError("Room can only be created for accepted sessions")

    room_name, meeting_link = _generate_meeting_link()

    session_repo.update_session_fields(db, session, {
        "room_name": room_name,
        "meeting_link": meeting_link,
    })

    display = user.profile.full_name if user.profile and user.profile.full_name else user.user_name
    token = create_jitsi_token(
        room_name=room_name,
        user_name=user.user_name,
        display_name=display,
        email=user.user_name,
        is_moderator=is_teacher,
    )

    return {
        "session_id": session.id,
        "meeting_link": meeting_link,
        "jwt_token": token,
        "room_name": room_name,
    }


# ---------- Teacher: complete session ----------
def complete_session(db: Session, teacher: User, session_id: str) -> SessionSchedule:
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_owns_session(session, teacher)

    if session.status != SessionStatus.accepted:
        raise BadRequestError(
            f"Cannot complete a session with status '{session.status.value}'"
        )

    session_repo.update_session_status(db, session, SessionStatus.completed)

    if session.session_type == SessionType.group:
        # Notify all enrolled students
        for enrollment in enrollment_repo.get_enrollments_for_session(db, session.id):
            notification_service.create_notification(
                db,
                user_name=enrollment.student_id,
                type=NotificationType.session_completed,
                title="Session Completed",
                message=f"Your group session with {teacher.user_name} has been completed.",
                reference_id=session.id,
            )
    else:
        if session.student_id:
            notification_service.create_notification(
                db,
                user_name=session.student_id,
                type=NotificationType.session_completed,
                title="Session Completed",
                message=f"Your session with {teacher.user_name} has been marked as completed.",
                reference_id=session.id,
            )

    return session


# ===================== GROUP SESSION FUNCTIONS =====================

# ---------- Teacher: create group session ----------
def create_group_session(
    db: Session, teacher: User, payload: GroupSessionCreate
) -> SessionSchedule:
    # Validate subject entry exists and is active
    entry = teacher_repo.get_subject_entry_by_id(db, payload.subject_master_id)
    if not entry or entry.user_name != teacher.user_name or not entry.is_active:
        raise NotFoundError("Teacher does not teach this subject")

    # Validate slot belongs to teacher and is active
    slot = availability_repo.get_slot_by_id(db, payload.slot_id)
    if not slot or slot.user_name != teacher.user_name or not slot.is_active:
        raise NotFoundError("Availability slot not found for this teacher")

    # Prevent duplicate group session at same slot+date
    if session_repo.has_conflicting_session(
        db, teacher.user_name, payload.slot_id, payload.session_date
    ):
        raise BadRequestError(
            "You already have a session scheduled for the selected slot and date"
        )

    room_name, meeting_link = _generate_meeting_link()

    new_session = session_repo.create_group_session(
        db,
        teacher_id=teacher.user_name,
        subject_master_id=payload.subject_master_id,
        slot_id=payload.slot_id,
        session_date=payload.session_date,
        max_students=payload.max_students,
        topic_description=payload.topic_description,
        meeting_link=meeting_link,
        room_name=room_name,
    )

    return new_session


# ---------- Student: enroll in group session ----------
def enroll_in_session(
    db: Session, student: User, session_id: str
) -> "SessionEnrollment":  # type: ignore[name-defined]

    session = _get_session_or_404(db, session_id)

    if session.session_type != SessionType.group:
        raise BadRequestError("Enrollment is only available for group sessions")

    if session.status != SessionStatus.open:
        raise BadRequestError(
            f"Cannot enroll in a session with status '{session.status.value}'"
        )

    # Check not already enrolled
    existing = enrollment_repo.get_enrollment(db, session_id, student.user_name)
    if existing and existing.status == EnrollmentStatus.enrolled:
        raise BadRequestError("You are already enrolled in this session")

    # Check capacity
    current_count = enrollment_repo.get_active_enrollment_count(db, session_id)
    if session.max_students and current_count >= session.max_students:
        raise BadRequestError("This session is full")

    # Check student time conflict
    if enrollment_repo.student_has_time_conflict(
        db, student.user_name, session.slot_id, session.session_date
    ):
        raise BadRequestError(
            "You already have an enrollment for the same slot and date"
        )

    if existing:
        # Re-enroll after previous cancellation
        existing.status = EnrollmentStatus.enrolled
        db.flush()
        enrollment = existing
    else:
        enrollment = enrollment_repo.create_enrollment(db, session_id, student.user_name)

    notification_service.create_notification(
        db,
        user_name=session.teacher_id,
        type=NotificationType.session_request,
        title="New Student Enrolled",
        message=f"Student {student.user_name} enrolled in your group session.",
        reference_id=session.id,
    )

    return enrollment


# ---------- Student: cancel group enrollment ----------
def cancel_group_enrollment(db: Session, student: User, session_id: str) -> dict:
    session = _get_session_or_404(db, session_id)

    if session.session_type != SessionType.group:
        raise BadRequestError("This action is only valid for group sessions")

    if session.status not in (SessionStatus.open, SessionStatus.accepted):
        raise BadRequestError(
            f"Cannot cancel enrollment for a session with status '{session.status.value}'"
        )

    enrollment = enrollment_repo.get_enrollment(db, session_id, student.user_name)
    if not enrollment or enrollment.status != EnrollmentStatus.enrolled:
        raise BadRequestError("You are not enrolled in this session")

    enrollment_repo.cancel_enrollment(db, enrollment)

    notification_service.create_notification(
        db,
        user_name=session.teacher_id,
        type=NotificationType.general,
        title="Enrollment Cancelled",
        message=f"Student {student.user_name} cancelled their enrollment.",
        reference_id=session.id,
    )

    return {"message": "Enrollment cancelled successfully"}


# ---------- Teacher/Student: view enrollments ----------
def get_session_enrollments(
    db: Session, user: User, session_id: str
) -> list[EnrollmentRead]:
    session = _get_session_or_404(db, session_id)

    if session.session_type != SessionType.group:
        raise BadRequestError("Enrollments are only available for group sessions")

    # Only teacher or enrolled student can view
    is_teacher = session.teacher_id == user.user_name
    if not is_teacher:
        enrollment = enrollment_repo.get_enrollment(db, session_id, user.user_name)
        if not enrollment or enrollment.status != EnrollmentStatus.enrolled:
            raise NotFoundError("Session not found")

    enrollments = enrollment_repo.get_enrollments_for_session(db, session_id)
    return [EnrollmentRead.model_validate(e) for e in enrollments]


# ---------- Student: browse open group sessions ----------
def get_open_group_sessions(
    db: Session,
    *,
    subject_id: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> Page[SessionRead]:
    items, total = session_repo.get_open_group_sessions(
        db, subject_id=subject_id, skip=skip, limit=limit
    )
    return Page(
        items=[SessionRead.model_validate(s) for s in items],
        total=total,
        skip=skip,
        limit=limit,
    )


# ---------- Teacher: start group session (Open → Accepted) ----------
def start_group_session(db: Session, teacher: User, session_id: str) -> SessionSchedule:
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_owns_session(session, teacher)

    if session.session_type != SessionType.group:
        raise BadRequestError("This action is only valid for group sessions")

    if session.status != SessionStatus.open:
        raise BadRequestError(
            f"Cannot start a session with status '{session.status.value}'"
        )

    session_repo.update_session_status(db, session, SessionStatus.accepted)

    # Notify all enrolled students
    for enrollment in enrollment_repo.get_enrollments_for_session(db, session.id):
        notification_service.create_notification(
            db,
            user_name=enrollment.student_id,
            type=NotificationType.session_accepted,
            title="Group Session Starting",
            message=f"Teacher {teacher.user_name} has started the group session. Join now!",
            reference_id=session.id,
        )

    return session
