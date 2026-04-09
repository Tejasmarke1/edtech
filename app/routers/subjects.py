"""Subject router - read subject master list."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.repositories import subject_repo
from app.schemas.subject import SubjectRead

router = APIRouter()


@router.get("", response_model=list[SubjectRead])
def list_subjects(db: Session = Depends(get_db)):
    """Return all subject master entries sorted by name."""
    return subject_repo.get_all_subjects(db)
