"""Teacher service — profile CRUD, subject management, video demos."""

from sqlalchemy.orm import Session

from app.models.teacher import TeacherProfile, TeacherSubjectMasterList, TeacherVideoDemo
from app.models.user import User
from app.repositories import availability_repo, subject_repo, teacher_repo, wallet_repo
from app.schemas.availability import AvailabilitySlotCreate, AvailabilitySlotUpdate
from app.schemas.teacher import AddSubjectRequest, AddVideoRequest, TeacherProfileUpdate, TeacherVideoAccessRead
from app.schemas.wallet import WithdrawalRequest
from app.utils.exceptions import BadRequestError, ForbiddenError, NotFoundError

MAX_ACTIVE_SUBJECTS = 5
MAX_VIDEOS_PER_SUBJECT = 2
MAX_VIDEO_DURATION = 600  # 10 minutes in seconds


# ---------- Profile ----------
def get_profile(db: Session, user: User) -> TeacherProfile:
    profile = teacher_repo.get_teacher_profile(db, user.user_name)
    if not profile:
        profile = teacher_repo.create_teacher_profile(db, user.user_name)
    return profile


def update_profile(db: Session, user: User, payload: TeacherProfileUpdate) -> TeacherProfile:
    profile = get_profile(db, user)
    data = payload.model_dump(exclude_unset=True)
    return teacher_repo.update_teacher_profile(db, profile, data)


# ---------- Subjects ----------
def get_subjects(db: Session, user: User) -> list[TeacherSubjectMasterList]:
    return teacher_repo.get_active_subjects(db, user.user_name)


def add_subject(db: Session, user: User, payload: AddSubjectRequest) -> TeacherSubjectMasterList:
    # Validate subject exists
    subject = subject_repo.get_subject_by_id(db, payload.sub_id)
    if not subject:
        raise NotFoundError(f"Subject '{payload.sub_id}' not found")

    # Check for existing entry (active or inactive)
    existing = teacher_repo.get_subject_entry(db, user.user_name, payload.sub_id)
    if existing and existing.is_active:
        raise BadRequestError("Subject already added")
    if existing and not existing.is_active:
        # Reactivate
        active_count = len(teacher_repo.get_active_subjects(db, user.user_name))
        if active_count >= MAX_ACTIVE_SUBJECTS:
            raise BadRequestError(f"Maximum {MAX_ACTIVE_SUBJECTS} active subjects allowed")
        existing.is_active = True
        db.flush()
        return existing

    # Check max active subjects
    active_count = len(teacher_repo.get_active_subjects(db, user.user_name))
    if active_count >= MAX_ACTIVE_SUBJECTS:
        raise BadRequestError(f"Maximum {MAX_ACTIVE_SUBJECTS} active subjects allowed")

    return teacher_repo.add_subject_entry(db, user.user_name, payload.sub_id)


def remove_subject(db: Session, user: User, entry_id: str) -> TeacherSubjectMasterList:
    entry = teacher_repo.get_subject_entry_by_id(db, entry_id)
    if not entry or entry.user_name != user.user_name:
        raise NotFoundError("Subject entry not found")
    return teacher_repo.deactivate_subject_entry(db, entry)


# ---------- Videos ----------
def get_videos(db: Session, user: User, sub_id: str) -> list[TeacherVideoDemo]:
    entry = teacher_repo.get_subject_entry(db, user.user_name, sub_id)
    if not entry or not entry.is_active:
        raise NotFoundError("Subject not in your active list")
    return teacher_repo.get_videos_for_subject(db, user.user_name, sub_id)


def add_video(db: Session, user: User, sub_id: str, payload: AddVideoRequest) -> TeacherVideoDemo:
    # Validate subject is in teacher's active list
    entry = teacher_repo.get_subject_entry(db, user.user_name, sub_id)
    if not entry or not entry.is_active:
        raise NotFoundError("Subject not in your active list")

    existing_videos = teacher_repo.get_videos_for_subject(db, user.user_name, sub_id)

    if len(existing_videos) >= MAX_VIDEOS_PER_SUBJECT:
        raise BadRequestError(f"Maximum {MAX_VIDEOS_PER_SUBJECT} videos per subject")

    if payload.duration_seconds > MAX_VIDEO_DURATION:
        raise BadRequestError(f"Video cannot exceed {MAX_VIDEO_DURATION} seconds (10 min)")

    return teacher_repo.add_video_demo(
        db, user.user_name, sub_id, payload.video_url, payload.duration_seconds
    )


def get_video_access_url(db: Session, user: User, video_id: str) -> TeacherVideoAccessRead:
    video = teacher_repo.get_video_by_id(db, video_id)
    if not video:
        raise NotFoundError("Video not found")
    if video.user_name != user.user_name:
        raise ForbiddenError("You cannot access this video")
    return TeacherVideoAccessRead(id=video.id, video_url=video.video_url)


# ---------- Availability ----------
def get_availability(db: Session, user: User, *, skip: int = 0, limit: int = 20):
    items, total = availability_repo.get_slots_for_teacher(
        db, user.user_name, skip=skip, limit=limit
    )
    from app.utils.pagination import Page
    from app.schemas.availability import AvailabilitySlotRead
    return Page(
        items=[AvailabilitySlotRead.model_validate(s) for s in items],
        total=total,
        skip=skip,
        limit=limit,
    )


def add_availability_slot(db: Session, user: User, payload: AvailabilitySlotCreate):
    return availability_repo.create_slot(
        db, user.user_name, payload.day_of_week, payload.start_time, payload.end_time
    )


def update_availability_slot(db: Session, user: User, slot_id: str, payload: AvailabilitySlotUpdate):
    slot = availability_repo.get_slot_by_id(db, slot_id)
    if not slot or slot.user_name != user.user_name:
        raise NotFoundError("Availability slot not found")
    data = payload.model_dump(exclude_unset=True)
    return availability_repo.update_slot(db, slot, data)


def delete_availability_slot(db: Session, user: User, slot_id: str):
    slot = availability_repo.get_slot_by_id(db, slot_id)
    if not slot or slot.user_name != user.user_name:
        raise NotFoundError("Availability slot not found")
    availability_repo.delete_slot(db, slot)


# ---------- Earnings & Withdrawals ----------
def get_earnings(db: Session, user: User):
    return wallet_repo.get_or_create_wallet(db, user.user_name)


def get_monthly_earnings(db: Session, user: User, year: int, month: int) -> dict:
    return wallet_repo.get_monthly_earnings(db, user.user_name, year, month)


def request_withdrawal(db: Session, user: User, payload: WithdrawalRequest):
    # Lock wallet row to prevent concurrent overdraw
    wallet = wallet_repo.get_or_create_wallet(db, user.user_name, lock=True)
    if payload.amount > wallet.current_balance:
        raise BadRequestError(
            f"Insufficient balance. Available: {wallet.current_balance}"
        )
    # Deduct from wallet
    wallet.current_balance -= payload.amount
    wallet.total_withdraw += payload.amount
    db.flush()

    return wallet_repo.create_withdrawal(db, user.user_name, payload.amount)


def get_withdrawal_history(db: Session, user: User, *, skip: int = 0, limit: int = 20):
    items, total = wallet_repo.get_withdrawals(
        db, user.user_name, skip=skip, limit=limit
    )
    from app.utils.pagination import Page
    from app.schemas.wallet import WithdrawalRead
    return Page(
        items=[WithdrawalRead.model_validate(w) for w in items],
        total=total,
        skip=skip,
        limit=limit,
    )
