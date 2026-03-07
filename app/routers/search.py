"""Search router — search teachers by topic, view teacher detail."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.search import TeacherDetailRead, TeacherSearchResult
from app.services import search_service

router = APIRouter()


@router.get("", response_model=list[TeacherSearchResult])
def search_teachers(
    topic: str = Query(..., min_length=1, description="Subject/topic keyword"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return search_service.search_teachers(db, topic)


@router.get(
    "/teachers/{teacher_id}/detail",
    response_model=TeacherDetailRead,
)
def get_teacher_detail(
    teacher_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return search_service.get_teacher_public_detail(db, teacher_id)
