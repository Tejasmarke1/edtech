"""Jitsi Meet JWT token generation and room utilities."""

import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.config import settings


def generate_room_name() -> str:
    """Return a unique, URL-safe room identifier."""
    return uuid.uuid4().hex[:12]


def build_meeting_url(room_name: str) -> str:
    """Construct the full Jitsi meeting URL for a room."""
    return f"{settings.JITSI_URL}/{room_name}"


def create_jitsi_token(
    *,
    room_name: str,
    user_name: str,
    display_name: str,
    email: str = "",
    is_moderator: bool = False,
    expires_minutes: int = 120,
) -> str:
    """Create a signed JWT for Jitsi Meet room access.

    The token follows the Jitsi JWT spec:
    https://github.com/jitsi/lib-jitsi-meet/blob/master/doc/tokens.md
    """
    now = datetime.now(timezone.utc)
    payload = {
        "iss": settings.JITSI_APP_ID,
        "sub": settings.JITSI_DOMAIN,
        "aud": settings.JITSI_APP_ID,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
        "room": room_name,
        "context": {
            "user": {
                "id": user_name,
                "name": display_name,
                "email": email,
            },
        },
        "moderator": is_moderator,
    }
    return jwt.encode(payload, settings.JITSI_SECRET, algorithm="HS256")
