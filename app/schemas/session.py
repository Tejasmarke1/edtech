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
    slot_id: str | None = None
    session_date: date | None = None
    custom_start_at: datetime | None = None
    duration_minutes: int | None = Field(
        60,
        ge=15,
        le=480,
        description="Class duration in minutes when custom_start_at is provided",
    )
    max_students: int = Field(..., ge=2, le=100, description="Maximum students allowed")
    topic_description: str | None = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_session_date(self):
        # Two accepted modes:
        # 1) Existing slot-based: slot_id + session_date
        # 2) Custom schedule: custom_start_at (+ optional duration_minutes)
        if self.custom_start_at is not None:
            now = datetime.now()
            if self.custom_start_at < now:
                raise ValueError("custom_start_at cannot be in the past")
            if self.duration_minutes is None:
                raise ValueError("duration_minutes is required when custom_start_at is provided")
            return self

        if not self.slot_id:
            raise ValueError("slot_id is required when custom_start_at is not provided")
        if not self.session_date:
            raise ValueError("session_date is required when custom_start_at is not provided")

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
    teacher_name: str | None = None
    student_id: str | None = None  # None for group sessions
    subject_master_id: str
    subject_name: str | None = None
    topic_description: str | None = None
    slot_id: str
    slot_start_time: str | None = None
    slot_end_time: str | None = None
    session_date: date
    status: SessionStatus
    session_type: SessionType = SessionType.individual
    max_students: int | None = None
    enrolled_count: int | None = None
    seats_left: int | None = None
    is_enrolled: bool = False
    group_per_student_charges: int | None = None
    meeting_link: str | None = None
    payment_status: str | None = None
    is_paid: bool = False
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
