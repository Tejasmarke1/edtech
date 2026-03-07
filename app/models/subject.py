"""Subject master model."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class Subject(TimestampMixin, Base):
    """Master list of subjects available on the platform."""

    __tablename__ = "subject"

    sub_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    teacher_entries: Mapped[list["TeacherSubjectMasterList"]] = relationship(
        back_populates="subject",
    )
    video_demos: Mapped[list["TeacherVideoDemo"]] = relationship(
        back_populates="subject",
    )

    def __repr__(self) -> str:
        return f"<Subject {self.sub_id} name={self.name}>"
