"""Notification schemas."""

from datetime import datetime

from pydantic import BaseModel

from app.models.notification import NotificationType


class NotificationRead(BaseModel):
    id: str
    user_name: str
    type: NotificationType
    title: str
    message: str
    is_read: bool
    reference_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountRead(BaseModel):
    count: int
