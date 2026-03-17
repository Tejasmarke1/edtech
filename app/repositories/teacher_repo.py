"""Teacher repository — DB queries for teacher_profile, teacher_subject_master_list, teacher_video_demo."""

import uuid

from sqlalchemy.orm import Session

from app.models.teacher import TeacherProfile, TeacherSubjectMasterList, TeacherVideoDemo


# ---------- Teacher Profile ----------
def get_teacher_profile(db: Session, user_name: str) -> TeacherProfile | None:
    return db.query(TeacherProfile).filter(TeacherProfile.user_name == user_name).first()


def create_teacher_profile(db: Session, user_name: str) -> TeacherProfile:
    profile = TeacherProfile(user_name=user_name)
    db.add(profile)
    db.flush()
    return profile


def update_teacher_profile(db: Session, profile: TeacherProfile, data: dict) -> TeacherProfile:
    for key, value in data.items():
        if value is not None:
            setattr(profile, key, value)
    db.flush()
    return profile


# ---------- Teacher Subject Master List ----------
def get_active_subjects(db: Session, user_name: str) -> list[TeacherSubjectMasterList]:
    return (
        db.query(TeacherSubjectMasterList)
        .filter(
            TeacherSubjectMasterList.user_name == user_name,
            TeacherSubjectMasterList.is_active.is_(True),
        )
        .all()
    )


def get_subject_entry(db: Session, user_name: str, sub_id: str) -> TeacherSubjectMasterList | None:
    return (
        db.query(TeacherSubjectMasterList)
        .filter(
            TeacherSubjectMasterList.user_name == user_name,
            TeacherSubjectMasterList.sub_id == sub_id,
        )
        .first()
    )


def get_subject_entry_by_id(db: Session, entry_id: str) -> TeacherSubjectMasterList | None:
    return db.query(TeacherSubjectMasterList).filter(TeacherSubjectMasterList.id == entry_id).first()


def add_subject_entry(db: Session, user_name: str, sub_id: str) -> TeacherSubjectMasterList:
    entry = TeacherSubjectMasterList(
        id=str(uuid.uuid4()),
        user_name=user_name,
        sub_id=sub_id,
        is_active=True,
    )
    db.add(entry)
    db.flush()
    return entry


def deactivate_subject_entry(db: Session, entry: TeacherSubjectMasterList) -> TeacherSubjectMasterList:
    entry.is_active = False
    db.flush()
    return entry


# ---------- Video Demos ----------
def get_videos_for_subject(db: Session, user_name: str, sub_id: str) -> list[TeacherVideoDemo]:
    return (
        db.query(TeacherVideoDemo)
        .filter(
            TeacherVideoDemo.user_name == user_name,
            TeacherVideoDemo.sub_id == sub_id,
        )
        .all()
    )


def get_video_by_id(db: Session, video_id: str) -> TeacherVideoDemo | None:
    return db.query(TeacherVideoDemo).filter(TeacherVideoDemo.id == video_id).first()


def add_video_demo(db: Session, user_name: str, sub_id: str, video_url: str, duration_seconds: int) -> TeacherVideoDemo:
    video = TeacherVideoDemo(
        id=str(uuid.uuid4()),
        user_name=user_name,
        sub_id=sub_id,
        video_url=video_url,
        duration_seconds=duration_seconds,
    )
    db.add(video)
    db.flush()
    return video
