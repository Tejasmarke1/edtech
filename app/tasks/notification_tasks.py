"""Celery notification tasks — email, push, in-app."""

from app.tasks import celery_app


@celery_app.task(name="send_notification")
def send_notification(user_id: int, message: str, channel: str = "in_app"):
    """Placeholder — dispatch a notification to a user."""
    # TODO: implement email / push / in-app logic
    print(f"[Notification] user={user_id} channel={channel} msg={message}")
    return {"status": "sent", "user_id": user_id}
