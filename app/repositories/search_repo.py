"""Search repository — DB queries for teacher search."""

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.availability import AvailabilitySlot
from app.models.rating import Rating
from app.models.session import SessionSchedule
from app.models.subject import Subject
from app.models.teacher import TeacherProfile, TeacherSubjectMasterList, TeacherVideoDemo
from app.models.user import User, UserProfile, UserRole


def search_teachers_by_topic(
    db: Session, topic: str, *, skip: int = 0, limit: int = 20
) -> tuple[list[dict], int]:
    """Return teachers who teach a subject matching the topic keyword.

    Returns (results, total_count) to support pagination.
    """
    # Find subjects matching the topic (case-insensitive ILIKE)
    pattern = f"%{topic}%"
    matching_subjects = (
        db.query(Subject.sub_id)
        .filter(Subject.name.ilike(pattern))
        .subquery()
    )

    # Find distinct teacher user_names with active entries for those subjects
    base_query = (
        db.query(TeacherSubjectMasterList.user_name)
        .filter(
            TeacherSubjectMasterList.sub_id.in_(
                db.query(matching_subjects.c.sub_id)
            ),
            TeacherSubjectMasterList.is_active.is_(True),
        )
        .distinct()
    )

    total = base_query.count()
    if total == 0:
        return [], 0

    teacher_usernames = (
        base_query
        .order_by(TeacherSubjectMasterList.user_name)
        .offset(skip)
        .limit(limit)
        .all()
    )
    usernames = [row[0] for row in teacher_usernames]

    results = [_build_teacher_summary(db, uname) for uname in usernames]
    return results, total


def get_teacher_detail(db: Session, teacher_username: str) -> dict | None:
    """Return full detail for a single teacher."""
    user = (
        db.query(User)
        .filter(User.user_name == teacher_username, User.role == UserRole.teacher)
        .first()
    )
    if user is None:
        return None

    profile = db.query(UserProfile).filter(UserProfile.user_name == teacher_username).first()
    teacher_profile = db.query(TeacherProfile).filter(TeacherProfile.user_name == teacher_username).first()

    subjects = (
        db.query(TeacherSubjectMasterList)
        .options(joinedload(TeacherSubjectMasterList.subject))
        .filter(
            TeacherSubjectMasterList.user_name == teacher_username,
            TeacherSubjectMasterList.is_active.is_(True),
        )
        .all()
    )

    videos = (
        db.query(TeacherVideoDemo)
        .filter(TeacherVideoDemo.user_name == teacher_username)
        .all()
    )

    availability = (
        db.query(AvailabilitySlot)
        .filter(
            AvailabilitySlot.user_name == teacher_username,
            AvailabilitySlot.is_active.is_(True),
        )
        .all()
    )

    rating_avg = _get_teacher_rating_avg(db, teacher_username)

    return {
        "user_name": teacher_username,
        "full_name": profile.full_name if profile else None,
        "bio": teacher_profile.bio if teacher_profile else None,
        "per_30_mins_charges": teacher_profile.per_30_mins_charges if teacher_profile else None,
        "rating_avg": rating_avg,
        "subjects": [
            {
                "id": s.id,
                "sub_id": s.sub_id,
                "subject_name": s.subject.name if s.subject else s.sub_id,
            }
            for s in subjects
        ],
        "videos": [
            {
                "id": v.id,
                "sub_id": v.sub_id,
                "video_url": v.video_url,
                "duration_seconds": v.duration_seconds,
            }
            for v in videos
        ],
        "availability": [
            {
                "id": a.id,
                "day_of_week": a.day_of_week,
                "start_time": a.start_time,
                "end_time": a.end_time,
            }
            for a in availability
        ],
        "created_at": user.created_at,
    }


def _build_teacher_summary(db: Session, user_name: str) -> dict:
    """Build a search result dict for one teacher."""
    profile = db.query(UserProfile).filter(UserProfile.user_name == user_name).first()
    teacher_profile = db.query(TeacherProfile).filter(TeacherProfile.user_name == user_name).first()

    subjects = (
        db.query(TeacherSubjectMasterList)
        .options(joinedload(TeacherSubjectMasterList.subject))
        .filter(
            TeacherSubjectMasterList.user_name == user_name,
            TeacherSubjectMasterList.is_active.is_(True),
        )
        .all()
    )

    rating_avg = _get_teacher_rating_avg(db, user_name)

    return {
        "user_name": user_name,
        "full_name": profile.full_name if profile else None,
        "bio": teacher_profile.bio if teacher_profile else None,
        "per_30_mins_charges": teacher_profile.per_30_mins_charges if teacher_profile else None,
        "rating_avg": rating_avg,
        "subjects": [
            {
                "id": s.id,
                "sub_id": s.sub_id,
                "subject_name": s.subject.name if s.subject else s.sub_id,
            }
            for s in subjects
        ],
    }


def _get_teacher_rating_avg(db: Session, teacher_username: str) -> float | None:
    """Calculate average rating for a teacher across completed sessions."""
    avg = (
        db.query(func.avg(Rating.stars))
        .join(SessionSchedule, Rating.session_id == SessionSchedule.id)
        .filter(SessionSchedule.teacher_id == teacher_username)
        .scalar()
    )
    return round(float(avg), 2) if avg is not None else None
