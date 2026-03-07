"""User repository — DB queries for user & user_profile tables."""

from sqlalchemy.orm import Session

from app.models.user import User, UserProfile, UserRole


def get_user_by_username(db: Session, user_name: str) -> User | None:
    return db.query(User).filter(User.user_name == user_name).first()


def create_user(
    db: Session,
    user_name: str,
    hashed_password: str,
    role: UserRole,
) -> User:
    user = User(
        user_name=user_name,
        password=hashed_password,
        role=role,
        is_verified=False,
    )
    db.add(user)
    db.flush()
    return user


def create_user_profile(
    db: Session,
    user_name: str,
    full_name: str | None = None,
) -> UserProfile:
    profile = UserProfile(user_name=user_name, full_name=full_name)
    db.add(profile)
    db.flush()
    return profile


def get_user_profile(db: Session, user_name: str) -> UserProfile | None:
    return db.query(UserProfile).filter(UserProfile.user_name == user_name).first()


def update_user_profile(db: Session, profile: UserProfile, data: dict) -> UserProfile:
    for key, value in data.items():
        if value is not None:
            setattr(profile, key, value)
    db.flush()
    return profile
