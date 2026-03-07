"""Student service — profile CRUD."""

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user_repo import get_user_profile, update_user_profile
from app.schemas.student import StudentProfileRead, StudentProfileUpdate
from app.utils.exceptions import NotFoundError


def get_profile(db: Session, current_user: User) -> StudentProfileRead:
    profile = get_user_profile(db, current_user.user_name)
    if profile is None:
        raise NotFoundError("Student profile not found")
    return StudentProfileRead.model_validate(profile)


def update_profile(
    db: Session, current_user: User, data: StudentProfileUpdate
) -> StudentProfileRead:
    profile = get_user_profile(db, current_user.user_name)
    if profile is None:
        raise NotFoundError("Student profile not found")
    updated = update_user_profile(db, profile, data.model_dump(exclude_unset=True))
    return StudentProfileRead.model_validate(updated)
