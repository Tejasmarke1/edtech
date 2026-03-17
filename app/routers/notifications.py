"""Notification router."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.notification import NotificationRead, UnreadCountRead
from app.services import notification_service
from app.utils.pagination import Page, PaginationParams

router = APIRouter()


@router.get("", response_model=Page[NotificationRead])
def list_notifications(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return notification_service.get_notifications(
        db, user.user_name, skip=pagination.skip, limit=pagination.limit
    )


@router.put("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return notification_service.mark_as_read(db, user.user_name, notification_id)


@router.get("/unread-count", response_model=UnreadCountRead)
def get_unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    count = notification_service.get_unread_count(db, user.user_name)
    return UnreadCountRead(count=count)
