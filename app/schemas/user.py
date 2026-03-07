"""User & UserProfile schemas."""

from datetime import date, datetime

from pydantic import BaseModel

from app.models.user import Gender, UserRole


class UserProfileRead(BaseModel):
    user_name: str
    full_name: str | None = None
    dob: date | None = None
    gender: Gender | None = None

    model_config = {"from_attributes": True}


class UserRead(BaseModel):
    user_name: str
    is_verified: bool
    role: UserRole
    created_at: datetime
    profile: UserProfileRead | None = None

    model_config = {"from_attributes": True}
