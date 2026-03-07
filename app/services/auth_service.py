"""Auth service — registration, login, JWT token management."""

import redis
from jose import JWTError
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.repositories import user_repo
from app.schemas.auth import RegisterRequest, TokenResponse
from app.utils.exceptions import BadRequestError, ConflictError, UnauthorizedError
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

# ---------- Redis client for refresh-token revocation ----------
_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
_REFRESH_PREFIX = "refresh:"


def _store_refresh_token(user_name: str, token: str) -> None:
    """Store refresh token in Redis with TTL matching token expiry."""
    key = f"{_REFRESH_PREFIX}{user_name}"
    _redis.setex(key, settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, token)


def _get_stored_refresh_token(user_name: str) -> str | None:
    return _redis.get(f"{_REFRESH_PREFIX}{user_name}")


def _delete_refresh_token(user_name: str) -> None:
    _redis.delete(f"{_REFRESH_PREFIX}{user_name}")


# ---------- Public API ----------
def register(db: Session, payload: RegisterRequest) -> User:
    """Register a new user (student or teacher)."""
    existing = user_repo.get_user_by_username(db, payload.user_name)
    if existing:
        raise ConflictError("User with this email already exists")

    hashed = hash_password(payload.password)
    user = user_repo.create_user(db, payload.user_name, hashed, payload.role)
    user_repo.create_user_profile(db, payload.user_name, payload.full_name)
    return user


def login(db: Session, user_name: str, password: str) -> TokenResponse:
    """Authenticate user and return access + refresh tokens."""
    user = user_repo.get_user_by_username(db, user_name)
    if not user or not verify_password(password, user.password):
        raise UnauthorizedError("Invalid email or password")

    token_data = {"sub": user.user_name, "role": user.role.value}
    access = create_access_token(token_data)
    refresh = create_refresh_token(token_data)

    _store_refresh_token(user.user_name, refresh)

    return TokenResponse(access_token=access, refresh_token=refresh)


def refresh_access_token(refresh_token: str) -> TokenResponse:
    """Validate refresh token and issue new token pair."""
    try:
        payload = decode_token(refresh_token)
    except JWTError:
        raise UnauthorizedError("Invalid or expired refresh token")

    if payload.get("type") != "refresh":
        raise BadRequestError("Token is not a refresh token")

    user_name: str | None = payload.get("sub")
    if not user_name:
        raise UnauthorizedError("Invalid refresh token")

    stored = _get_stored_refresh_token(user_name)
    if stored != refresh_token:
        _delete_refresh_token(user_name)
        raise UnauthorizedError("Refresh token has been revoked")

    token_data = {"sub": user_name, "role": payload.get("role")}
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    _store_refresh_token(user_name, new_refresh)

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)
