"""Availability slot schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.availability import DayOfWeek


class AvailabilitySlotCreate(BaseModel):
    day_of_week: DayOfWeek
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="HH:MM format")
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="HH:MM format")


class AvailabilitySlotUpdate(BaseModel):
    day_of_week: DayOfWeek | None = None
    start_time: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")
    end_time: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")
    is_active: bool | None = None


class AvailabilitySlotRead(BaseModel):
    id: str
    user_name: str
    day_of_week: DayOfWeek
    start_time: str
    end_time: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
