"""Subject repository — DB queries for subjects."""

from sqlalchemy.orm import Session

from app.models.subject import Subject


def get_subject_by_id(db: Session, sub_id: str) -> Subject | None:
    return db.query(Subject).filter(Subject.sub_id == sub_id).first()


def get_all_subjects(db: Session) -> list[Subject]:
    return db.query(Subject).order_by(Subject.name).all()
