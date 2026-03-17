"""Rating repository — DB queries for ratings."""

import uuid

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.rating import Rating
from app.models.session import SessionSchedule, SessionStatus


def create_rating(
    db: Session,
    *,
    session_id: str,
    rated_by: str,
    stars: int,
    review_text: str | None = None,
) -> Rating:
    rating = Rating(
        id=str(uuid.uuid4()),
        session_id=session_id,
        rated_by=rated_by,
        stars=stars,
        review_text=review_text,
    )
    db.add(rating)
    db.flush()
    return rating


def get_rating_by_user_and_session(
    db: Session, user_name: str, session_id: str
) -> Rating | None:
    return (
        db.query(Rating)
        .filter(Rating.session_id == session_id, Rating.rated_by == user_name)
        .first()
    )


def get_pending_sessions_for_rating(
    db: Session, user_name: str
) -> list[SessionSchedule]:
    """Return completed sessions where the user participated but hasn't rated yet."""
    rated_session_ids = (
        db.query(Rating.session_id)
        .filter(Rating.rated_by == user_name)
        .subquery()
    )

    return (
        db.query(SessionSchedule)
        .filter(
            SessionSchedule.status == SessionStatus.completed,
            or_(
                SessionSchedule.teacher_id == user_name,
                SessionSchedule.student_id == user_name,
            ),
            SessionSchedule.id.notin_(db.query(rated_session_ids.c.session_id)),
        )
        .order_by(SessionSchedule.session_date.desc())
        .all()
    )
