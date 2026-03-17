"""Rating router — post-session ratings."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.rating import PendingRatingRead, RatingCreate, RatingRead
from app.services import rating_service

router = APIRouter()


@router.post("", response_model=RatingRead, status_code=201)
def submit_rating(
    payload: RatingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return rating_service.submit_rating(db, user, payload)


@router.get("/pending", response_model=list[PendingRatingRead])
def get_pending_ratings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return rating_service.get_pending_ratings(db, user)
