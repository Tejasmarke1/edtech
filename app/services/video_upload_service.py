"""Temporary video upload session service for teacher demo uploads."""

from __future__ import annotations

from functools import lru_cache
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import re
import uuid
from urllib.parse import urlparse

import boto3

from app.config import settings
from app.models.user import User
from app.utils.exceptions import BadRequestError, ForbiddenError, NotFoundError


@dataclass
class UploadSession:
    upload_id: str
    user_name: str
    upload_url: str
    file_url: str
    object_key: str
    content_type: str
    expires_at: datetime
    uploaded: bool = False


_UPLOAD_SESSIONS: dict[str, UploadSession] = {}


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _sanitize_filename(filename: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename.strip())
    if not clean:
        clean = "demo_video.mp4"
    return clean[:120]


@lru_cache(maxsize=1)
def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.S3_REGION,
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        aws_session_token=settings.AWS_SESSION_TOKEN,
    )


def _build_object_url(object_key: str) -> str:
    if settings.S3_PUBLIC_BASE_URL:
        return f"{settings.S3_PUBLIC_BASE_URL.rstrip('/')}/{object_key}"
    return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.S3_REGION}.amazonaws.com/{object_key}"


def _extract_object_key(file_url: str) -> str | None:
    if not file_url:
        return None

    if settings.S3_PUBLIC_BASE_URL:
        public_base = settings.S3_PUBLIC_BASE_URL.rstrip("/")
        if file_url.startswith(f"{public_base}/"):
            return file_url[len(public_base) + 1:]

    try:
        parsed = urlparse(file_url)
    except Exception:
        return None

    path = parsed.path.lstrip("/")
    if not path:
        return None

    host = (parsed.netloc or "").lower()
    bucket = (settings.S3_BUCKET_NAME or "").lower()

    # Virtual-hosted style: <bucket>.s3.../key
    if bucket and host.startswith(f"{bucket}."):
        return path

    # Path-style fallback: /<bucket>/key
    if bucket and path.startswith(f"{bucket}/"):
        return path[len(bucket) + 1:]

    # Last-resort: known prefix in this app
    idx = path.find("teacher-videos/")
    if idx >= 0:
        return path[idx:]

    return None


def resolve_playback_url(file_url: str) -> str:
    if not file_url:
        return file_url

    if settings.S3_OBJECT_PUBLIC:
        return file_url

    object_key = _extract_object_key(file_url)
    if not object_key or not settings.S3_BUCKET_NAME:
        return file_url

    return _s3_client().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": object_key,
        },
        ExpiresIn=settings.UPLOAD_URL_EXPIRES_SECONDS,
    )


def _cleanup_expired_sessions() -> None:
    now = _now_utc()
    expired = [session_id for session_id, session in _UPLOAD_SESSIONS.items() if session.expires_at <= now]
    for session_id in expired:
        _UPLOAD_SESSIONS.pop(session_id, None)


def create_upload_session(user: User, filename: str, content_type: str):
    """Create an upload session and return upload + public URLs."""
    _cleanup_expired_sessions()

    if not settings.S3_BUCKET_NAME:
        raise BadRequestError("S3_BUCKET_NAME is not configured")

    content_type = (content_type or "").lower().strip()
    if not content_type.startswith("video/"):
        raise BadRequestError("Only video content types are allowed")

    upload_id = str(uuid.uuid4())
    safe_name = _sanitize_filename(filename)
    object_key = f"teacher-videos/{user.user_name}/{upload_id}_{safe_name}"

    expires_at = _now_utc() + timedelta(seconds=settings.UPLOAD_URL_EXPIRES_SECONDS)
    upload_url = f"{settings.PUBLIC_BASE_URL}/api/v1/teachers/uploads/{upload_id}/binary"
    file_url = _build_object_url(object_key)

    _UPLOAD_SESSIONS[upload_id] = UploadSession(
        upload_id=upload_id,
        user_name=user.user_name,
        upload_url=upload_url,
        file_url=file_url,
        object_key=object_key,
        content_type=content_type,
        expires_at=expires_at,
    )

    return {
        "upload_id": upload_id,
        "upload_url": upload_url,
        "file_url": file_url,
        "storage_provider": "s3",
        "expires_in_seconds": settings.UPLOAD_URL_EXPIRES_SECONDS,
    }


def upload_binary(upload_id: str, user: User, payload: bytes, content_type: str | None = None) -> None:
    """Accept raw video bytes for an existing upload session."""
    _cleanup_expired_sessions()

    session = _UPLOAD_SESSIONS.get(upload_id)
    if not session:
        raise NotFoundError("Upload session not found or expired")
    if session.user_name != user.user_name:
        raise ForbiddenError("Upload session belongs to a different user")
    if session.expires_at <= _now_utc():
        _UPLOAD_SESSIONS.pop(upload_id, None)
        raise BadRequestError("Upload session has expired")
    if not payload:
        raise BadRequestError("Upload payload is empty")

    payload_size_mb = len(payload) / (1024 * 1024)
    if payload_size_mb > settings.MAX_VIDEO_UPLOAD_SIZE_MB:
        raise BadRequestError(
            f"Video file exceeds max size of {settings.MAX_VIDEO_UPLOAD_SIZE_MB} MB"
        )

    declared_content_type = (content_type or session.content_type).lower()
    if not declared_content_type.startswith("video/"):
        raise BadRequestError("Invalid content type. Expected a video MIME type")

    put_args = {
        "Bucket": settings.S3_BUCKET_NAME,
        "Key": session.object_key,
        "Body": payload,
        "ContentType": declared_content_type,
    }
    if settings.S3_OBJECT_PUBLIC:
        put_args["ACL"] = "public-read"
    _s3_client().put_object(**put_args)

    session.uploaded = True
    session.content_type = declared_content_type


def finalize_upload(upload_id: str, user: User):
    """Finalize session and return public file URL."""
    _cleanup_expired_sessions()

    session = _UPLOAD_SESSIONS.get(upload_id)
    if not session:
        raise NotFoundError("Upload session not found or expired")
    if session.user_name != user.user_name:
        raise ForbiddenError("Upload session belongs to a different user")
    if not session.uploaded:
        raise BadRequestError("No uploaded file found for this upload session")

    _UPLOAD_SESSIONS.pop(upload_id, None)
    return {
        "upload_id": upload_id,
        "file_url": session.file_url,
    }
