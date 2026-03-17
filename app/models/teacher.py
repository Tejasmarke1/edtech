"""TeacherProfile, TeacherSubjectMasterList, TeacherVideoDemo models."""

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class TeacherProfile(TimestampMixin, Base):
    """Teacher-specific details — 1:1 with User (role=teacher)."""

    __tablename__ = "teacher_profile"

    user_name: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        primary_key=True,
    )
    bio: Mapped[str | None] = mapped_column(String(1000))
    per_30_mins_charges: Mapped[int | None] = mapped_column(Integer)
    group_per_student_charges: Mapped[int | None] = mapped_column(Integer)
    upi_id: Mapped[str | None] = mapped_column(String(255))

    user: Mapped["User"] = relationship(back_populates="teacher_profile")

    def __repr__(self) -> str:
        return f"<TeacherProfile {self.user_name}>"


class TeacherSubjectMasterList(TimestampMixin, Base):
    """Subjects a teacher is SME in (max 5 active per teacher)."""

    __tablename__ = "teacher_subject_master_list"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_name: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )
    sub_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("subject.sub_id", ondelete="CASCADE"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="subject_master_list")
    subject: Mapped["Subject"] = relationship(back_populates="teacher_entries")
    sessions: Mapped[list["SessionSchedule"]] = relationship(
        back_populates="subject_master",
    )

    def __repr__(self) -> str:
        return f"<TeacherSubjectMasterList {self.id} teacher={self.user_name}>"


class TeacherVideoDemo(TimestampMixin, Base):
    """Teaching demo videos uploaded by a teacher."""

    __tablename__ = "teacher_video_demo"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_name: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )
    sub_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("subject.sub_id", ondelete="CASCADE"),
        nullable=False,
    )
    video_url: Mapped[str] = mapped_column(String(500), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)

    user: Mapped["User"] = relationship(back_populates="video_demos")
    subject: Mapped["Subject"] = relationship(back_populates="video_demos")

    def __repr__(self) -> str:
        return f"<TeacherVideoDemo {self.id}>"
