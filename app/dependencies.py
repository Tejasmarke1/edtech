"""Shared FastAPI dependencies (DI)."""

from collections.abc import Generator

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.utils.exceptions import ForbiddenError, UnauthorizedError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ---------- DB session ----------
def get_db() -> Generator[Session, None, None]:
    """Yield a DB session and ensure it's closed afterwards."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ---------- Current user ----------
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT and return the authenticated user row."""
    from jose import jwt

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_name: str | None = payload.get("sub")
        if user_name is None:
            raise UnauthorizedError()
    except JWTError:
        raise UnauthorizedError()

    user = db.query(User).filter(User.user_name == user_name).first()
    if user is None:
        raise UnauthorizedError("User no longer exists")
    return user


# ---------- Role-based guards ----------
def require_teacher(current_user: User = Depends(get_current_user)) -> User:
    """Ensure the current user has the 'teacher' role."""
    if current_user.role != UserRole.teacher:
        raise ForbiddenError("Teacher access required")
    return current_user


def require_student(current_user: User = Depends(get_current_user)) -> User:
    """Ensure the current user has the 'student' role."""
    if current_user.role != UserRole.student:
        raise ForbiddenError("Student access required")
    return current_user

    # Lazy import to avoid circular dependency
    from app.repositories.user_repo import get_user_by_id  # noqa: E402

    user = get_user_by_id(db, int(user_id))
    if user is None:
        raise credentials_exception
    return user
