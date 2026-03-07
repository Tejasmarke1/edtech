"""Student router — profile."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_student
from app.models.user import User
from app.schemas.student import StudentProfileRead, StudentProfileUpdate
from app.services import student_service

router = APIRouter()


@router.get("/profile", response_model=StudentProfileRead)
def get_profile(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return student_service.get_profile(db, current_user)


@router.put("/profile", response_model=StudentProfileRead)
def update_profile(
    data: StudentProfileUpdate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    return student_service.update_profile(db, current_user, data)
