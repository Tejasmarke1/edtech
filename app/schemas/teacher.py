"""Teacher profile, subject master, video demo schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


# ---------- Teacher Profile ----------
class TeacherProfileUpdate(BaseModel):
    bio: str | None = Field(None, max_length=1000)
    per_30_mins_charges: int | None = Field(None, ge=0)
    group_per_student_charges: int | None = Field(None, ge=0)
    upi_id: str | None = Field(None, max_length=255)


class TeacherProfileRead(BaseModel):
    user_name: str
    bio: str | None = None
    per_30_mins_charges: int | None = None
    group_per_student_charges: int | None = None
    upi_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Subject Master List ----------
class AddSubjectRequest(BaseModel):
    sub_id: str = Field(..., max_length=255)


class TeacherSubjectRead(BaseModel):
    id: str
    user_name: str
    sub_id: str
    subject_name: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Video Demo ----------
class AddVideoRequest(BaseModel):
    video_url: str = Field(..., max_length=500)
    duration_seconds: int = Field(..., gt=0, le=600, description="Max 600s (10 min)")


class TeacherVideoRead(BaseModel):
    id: str
    user_name: str
    sub_id: str
    video_url: str
    duration_seconds: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TeacherVideoAccessRead(BaseModel):
    id: str
    video_url: str
