"""Teacher router — profile, subjects, videos, availability, earnings."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_teacher
from app.models.user import User
from app.schemas.availability import AvailabilitySlotCreate, AvailabilitySlotRead, AvailabilitySlotUpdate
from app.schemas.teacher import (
    AddSubjectRequest,
    AddVideoRequest,
    TeacherProfileRead,
    TeacherProfileUpdate,
    TeacherSubjectRead,
    TeacherVideoRead,
)
from app.schemas.wallet import WalletRead, WithdrawalRead, WithdrawalRequest
from app.services import teacher_service
from app.utils.pagination import Page, PaginationParams

router = APIRouter()


# ==================== Profile ====================
@router.get("/profile", response_model=TeacherProfileRead)
def get_profile(
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    return teacher_service.get_profile(db, user)


@router.put("/profile", response_model=TeacherProfileRead)
def update_profile(
    payload: TeacherProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    return teacher_service.update_profile(db, user, payload)


# ==================== Subjects ====================
@router.get("/subjects", response_model=list[TeacherSubjectRead])
def get_subjects(
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    entries = teacher_service.get_subjects(db, user)
    return [
        TeacherSubjectRead(
            id=e.id,
            user_name=e.user_name,
            sub_id=e.sub_id,
            subject_name=e.subject.name if e.subject else None,
            is_active=e.is_active,
            created_at=e.created_at,
        )
        for e in entries
    ]


@router.post("/subjects", response_model=TeacherSubjectRead, status_code=201)
def add_subject(
    payload: AddSubjectRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    entry = teacher_service.add_subject(db, user, payload)
    return TeacherSubjectRead(
        id=entry.id,
        user_name=entry.user_name,
        sub_id=entry.sub_id,
        subject_name=entry.subject.name if entry.subject else None,
        is_active=entry.is_active,
        created_at=entry.created_at,
    )


@router.delete("/subjects/{entry_id}", response_model=TeacherSubjectRead)
def remove_subject(
    entry_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    entry = teacher_service.remove_subject(db, user, entry_id)
    return TeacherSubjectRead(
        id=entry.id,
        user_name=entry.user_name,
        sub_id=entry.sub_id,
        subject_name=entry.subject.name if entry.subject else None,
        is_active=entry.is_active,
        created_at=entry.created_at,
    )


# ==================== Videos ====================
@router.get("/subjects/{sub_id}/videos", response_model=list[TeacherVideoRead])
def get_videos(
    sub_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    return teacher_service.get_videos(db, user, sub_id)


@router.post("/subjects/{sub_id}/videos", response_model=TeacherVideoRead, status_code=201)
def add_video(
    sub_id: str,
    payload: AddVideoRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    return teacher_service.add_video(db, user, sub_id, payload)


# ==================== Availability ====================
@router.get("/availability", response_model=Page[AvailabilitySlotRead])
def get_availability(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    return teacher_service.get_availability(
        db, user, skip=pagination.skip, limit=pagination.limit
    )


@router.post("/availability", response_model=AvailabilitySlotRead, status_code=201)
def add_availability_slot(
    payload: AvailabilitySlotCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    return teacher_service.add_availability_slot(db, user, payload)


@router.put("/availability/{slot_id}", response_model=AvailabilitySlotRead)
def update_availability_slot(
    slot_id: str,
    payload: AvailabilitySlotUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    return teacher_service.update_availability_slot(db, user, slot_id, payload)


@router.delete("/availability/{slot_id}", status_code=204)
def delete_availability_slot(
    slot_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    teacher_service.delete_availability_slot(db, user, slot_id)


# ==================== Earnings & Withdrawals ====================
@router.get("/earnings", response_model=WalletRead)
def get_earnings(
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    return teacher_service.get_earnings(db, user)


@router.post("/withdrawals", response_model=WithdrawalRead, status_code=201)
def request_withdrawal(
    payload: WithdrawalRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    return teacher_service.request_withdrawal(db, user, payload)


@router.get("/withdrawals", response_model=Page[WithdrawalRead])
def get_withdrawals(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    return teacher_service.get_withdrawal_history(
        db, user, skip=pagination.skip, limit=pagination.limit
    )
