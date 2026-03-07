"""Student profile schemas."""

from datetime import date

from pydantic import BaseModel, Field

from app.models.user import Gender


class StudentProfileUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=255)
    dob: date | None = None
    gender: Gender | None = None


class StudentProfileRead(BaseModel):
    user_name: str
    full_name: str | None = None
    dob: date | None = None
    gender: Gender | None = None

    model_config = {"from_attributes": True}
