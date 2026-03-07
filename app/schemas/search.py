"""Search & teacher-detail response schemas."""

from datetime import datetime

from pydantic import BaseModel

from app.models.availability import DayOfWeek


# ---------- Nested read models for teacher detail ----------
class SubjectBrief(BaseModel):
    id: str
    sub_id: str
    subject_name: str

    model_config = {"from_attributes": True}


class VideoBrief(BaseModel):
    id: str
    sub_id: str
    video_url: str
    duration_seconds: int

    model_config = {"from_attributes": True}


class AvailabilityBrief(BaseModel):
    id: str
    day_of_week: DayOfWeek
    start_time: str
    end_time: str

    model_config = {"from_attributes": True}


# ---------- Search result (one per teacher) ----------
class TeacherSearchResult(BaseModel):
    user_name: str
    full_name: str | None = None
    bio: str | None = None
    per_30_mins_charges: int | None = None
    rating_avg: float | None = None
    subjects: list[SubjectBrief] = []

    model_config = {"from_attributes": True}


# ---------- Full teacher detail ----------
class TeacherDetailRead(BaseModel):
    user_name: str
    full_name: str | None = None
    bio: str | None = None
    per_30_mins_charges: int | None = None
    rating_avg: float | None = None
    subjects: list[SubjectBrief] = []
    videos: list[VideoBrief] = []
    availability: list[AvailabilityBrief] = []
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
