"""Rating service — post-session rating business logic."""

from sqlalchemy.orm import Session

from app.models.notification import NotificationType
from app.models.session import SessionStatus
from app.models.user import User
from app.repositories import rating_repo, session_repo
from app.schemas.rating import PendingRatingRead, RatingCreate
from app.services import notification_service
from app.utils.exceptions import BadRequestError, NotFoundError


def submit_rating(db: Session, user: User, payload: RatingCreate):
    session = session_repo.get_session_by_id(db, payload.session_id)
    if not session:
        raise NotFoundError("Session not found")

    if session.status != SessionStatus.completed:
        raise BadRequestError("Can only rate completed sessions")

    # User must be a participant
    if session.teacher_id != user.user_name and session.student_id != user.user_name:
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

    # Notify the other party
    other_user = (
        session.student_id
        if user.user_name == session.teacher_id
        else session.teacher_id
    )
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
