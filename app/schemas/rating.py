"""Rating schemas."""

from datetime import datetime

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
    session_date: datetime
    topic_description: str | None = None
