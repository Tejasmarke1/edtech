"""Search service — full-text / filtered teacher search."""

from sqlalchemy.orm import Session

from app.repositories.search_repo import get_teacher_detail, search_teachers_by_topic
from app.schemas.search import TeacherDetailRead, TeacherSearchResult
from app.utils.exceptions import NotFoundError


def search_teachers(db: Session, topic: str) -> list[TeacherSearchResult]:
    results = search_teachers_by_topic(db, topic)
    return [TeacherSearchResult(**r) for r in results]


def get_teacher_public_detail(db: Session, teacher_id: str) -> TeacherDetailRead:
    detail = get_teacher_detail(db, teacher_id)
    if detail is None:
        raise NotFoundError("Teacher not found")
    return TeacherDetailRead(**detail)
