"""Rating service — post-session rating business logic."""

from sqlalchemy.orm import Session

from app.models.enrollment import EnrollmentStatus
from app.models.notification import NotificationType
from app.models.session import SessionStatus, SessionType
from app.models.user import User, UserRole
from app.repositories import enrollment_repo, rating_repo, session_repo
from app.schemas.rating import (
    PendingRatingRead,
    RatingCreate,
    RatingHistoryItem,
    RatingHistoryRead,
)
from app.services import notification_service
from app.utils.exceptions import BadRequestError, NotFoundError


def submit_rating(db: Session, user: User, payload: RatingCreate):
    session = session_repo.get_session_by_id(db, payload.session_id)
    if not session:
        raise NotFoundError("Session not found")

    if session.status != SessionStatus.completed:
        raise BadRequestError("Can only rate completed sessions")

    if user.role != UserRole.student:
        raise BadRequestError("Only students can submit ratings")

    # Student must be a valid participant of this completed session.
    if session.session_type == SessionType.group:
        enrollment = enrollment_repo.get_enrollment(db, session.id, user.user_name)
        if not enrollment or enrollment.status != EnrollmentStatus.enrolled:
            raise NotFoundError("Session not found")
    elif session.student_id != user.user_name:
        raise NotFoundError("Session not found")

    # Prevent duplicate rating
    existing = rating_repo.get_rating_by_user_and_session(
        db, user.user_name, payload.session_id
    )
    if existing:
        raise BadRequestError("You have already rated this session")

    rating = rating_repo.create_rating(
        db,
        session_id=payload.session_id,
        rated_by=user.user_name,
        stars=payload.stars,
        review_text=payload.review_text,
    )

    # Notify teacher when student submits a rating.
    other_user = session.teacher_id
    notification_service.create_notification(
        db,
        user_name=other_user,
        type=NotificationType.rating_reminder,
        title="New Rating Received",
        message=f"{user.user_name} rated your session with {payload.stars} star(s).",
        reference_id=session.id,
    )

    return rating


def get_pending_ratings(db: Session, user: User) -> list[PendingRatingRead]:
    sessions = rating_repo.get_pending_sessions_for_rating(db, user.user_name)
    return [
        PendingRatingRead(
            session_id=s.id,
            teacher_id=s.teacher_id,
            student_id=s.student_id,
            session_date=s.session_date,
            topic_description=s.topic_description,
        )
        for s in sessions
    ]


def get_rating_history(db: Session, user: User) -> RatingHistoryRead:
    given_ratings = rating_repo.get_ratings_given_by_user(db, user.user_name)
    received_ratings = rating_repo.get_ratings_received_by_user(db, user.user_name)

    def _map_rating(rating, direction: str) -> RatingHistoryItem:
        session = rating.session
        counterpart = (
            session.student_id
            if user.user_name == session.teacher_id
            else session.teacher_id
        )
        return RatingHistoryItem(
            session_id=rating.session_id,
            counterpart_user_name=counterpart,
            stars=rating.stars,
            review_text=rating.review_text,
            session_date=session.session_date,
            topic_description=session.topic_description,
            created_at=rating.created_at,
            direction=direction,
        )

    return RatingHistoryRead(
        given=[_map_rating(rating, "given") for rating in given_ratings],
        received=[_map_rating(rating, "received") for rating in received_ratings],
    )
