"""Session schedule schemas."""

from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.session import SessionStatus, SessionType


def _check_not_past_date(v: date) -> date:
    """Raise if the session_date is in the past."""
    if v < date.today():
        raise ValueError("session_date cannot be in the past")
    return v


# ---------- Request schemas ----------
class SessionRequest(BaseModel):
    """Student requests a new individual session."""

    teacher_id: str
    subject_master_id: str
    slot_id: str
    session_date: date
    topic_description: str | None = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_session_date(self):
        _check_not_past_date(self.session_date)
        return self


class GroupSessionCreate(BaseModel):
    """Teacher creates a new group session."""

    subject_master_id: str
    slot_id: str
    session_date: date
    max_students: int = Field(..., ge=2, le=100, description="Maximum students allowed")
    topic_description: str | None = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_session_date(self):
        _check_not_past_date(self.session_date)
        return self


class ProposeTimeRequest(BaseModel):
    """Teacher proposes an alternative time slot."""

    slot_id: str
    session_date: date

    @model_validator(mode="after")
    def validate_session_date(self):
        _check_not_past_date(self.session_date)
        return self


# ---------- Response schemas ----------
class SessionRead(BaseModel):
    id: str
    teacher_id: str
    student_id: str | None = None  # None for group sessions
    subject_master_id: str
    topic_description: str | None = None
    slot_id: str
    session_date: date
    status: SessionStatus
    session_type: SessionType = SessionType.individual
    max_students: int | None = None
    meeting_link: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EnrollmentRead(BaseModel):
    id: str
    session_id: str
    student_id: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MeetingLinkRead(BaseModel):
    session_id: str
    meeting_link: str
    jwt_token: str
    room_name: str
