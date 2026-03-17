"""Notification service — create and store in-app notifications."""

import uuid

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.schemas.notification import NotificationRead
from app.utils.exceptions import NotFoundError
from app.utils.pagination import Page


def create_notification(
    db: Session,
    *,
    user_name: str,
    type: NotificationType,
    title: str,
    message: str,
    reference_id: str | None = None,
) -> Notification:
    notification = Notification(
        id=str(uuid.uuid4()),
        user_name=user_name,
        type=type,
        title=title,
        message=message,
        is_read=False,
        reference_id=reference_id,
    )
    db.add(notification)
    db.flush()
    return notification


def get_notifications(
    db: Session,
    user_name: str,
    *,
    skip: int = 0,
    limit: int = 20,
) -> Page[NotificationRead]:
    base = db.query(Notification).filter(Notification.user_name == user_name)
    total = base.count()
    items = (
        base.order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return Page(
        items=[NotificationRead.model_validate(n) for n in items],
        total=total,
        skip=skip,
        limit=limit,
    )


def mark_as_read(db: Session, user_name: str, notification_id: str) -> Notification:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_name == user_name)
        .first()
    )
    if not notification:
        raise NotFoundError("Notification not found")
    notification.is_read = True
    db.flush()
    return notification


def get_unread_count(db: Session, user_name: str) -> int:
    return (
        db.query(Notification)
        .filter(
            Notification.user_name == user_name,
            Notification.is_read.is_(False),
        )
        .count()
    )
