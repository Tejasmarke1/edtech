"""Rating schemas."""

from datetime import date, datetime

from pydantic import BaseModel, Field


class RatingCreate(BaseModel):
    session_id: str
    stars: int = Field(..., ge=1, le=5)
    review_text: str | None = Field(None, max_length=2000)


class RatingRead(BaseModel):
    id: str
    session_id: str
    rated_by: str
    stars: int
    review_text: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PendingRatingRead(BaseModel):
    """A completed session that the current user hasn't rated yet."""

    session_id: str
    teacher_id: str
    student_id: str
    session_date: date
    topic_description: str | None = None


class RatingHistoryItem(BaseModel):
    session_id: str
    counterpart_user_name: str | None = None
    stars: int
    review_text: str | None = None
    session_date: date
    topic_description: str | None = None
    created_at: datetime
    direction: str


class RatingHistoryRead(BaseModel):
    given: list[RatingHistoryItem]
    received: list[RatingHistoryItem]
