"""User & UserProfile models."""

import enum
from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class User(TimestampMixin, Base):
    """Core authentication table — PK is user_name (email)."""

    __tablename__ = "user"

    user_name: Mapped[str] = mapped_column(String(255), primary_key=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False
    )

    # --- relationships ---
    profile: Mapped["UserProfile"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    teacher_profile: Mapped["TeacherProfile"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        foreign_keys="TeacherProfile.user_name",
    )
    subject_master_list: Mapped[list["TeacherSubjectMasterList"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="TeacherSubjectMasterList.user_name",
    )
    video_demos: Mapped[list["TeacherVideoDemo"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="TeacherVideoDemo.user_name",
    )
    availability_slots: Mapped[list["AvailabilitySlot"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="AvailabilitySlot.user_name",
    )
    teacher_sessions: Mapped[list["SessionSchedule"]] = relationship(
        back_populates="teacher",
        foreign_keys="SessionSchedule.teacher_id",
    )
    student_sessions: Mapped[list["SessionSchedule"]] = relationship(
        back_populates="student",
        foreign_keys="SessionSchedule.student_id",
    )
    ratings_given: Mapped[list["Rating"]] = relationship(
        back_populates="rater",
        foreign_keys="Rating.rated_by",
    )
    wallet: Mapped["TeacherWallet"] = relationship(
        back_populates="teacher",
        uselist=False,
        cascade="all, delete-orphan",
        foreign_keys="TeacherWallet.teacher_id",
    )
    withdrawals: Mapped[list["Withdrawal"]] = relationship(
        back_populates="teacher",
        cascade="all, delete-orphan",
        foreign_keys="Withdrawal.teacher_id",
    )

    def __repr__(self) -> str:
        return f"<User {self.user_name} role={self.role.value}>"


class UserProfile(TimestampMixin, Base):
    """Extended user details — 1:1 with User."""

    __tablename__ = "user_profile"

    user_name: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        primary_key=True,
    )
    full_name: Mapped[str | None] = mapped_column(String(255))
    dob: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[Gender | None] = mapped_column(Enum(Gender, name="gender"))

    user: Mapped["User"] = relationship(back_populates="profile")

    def __repr__(self) -> str:
        return f"<UserProfile {self.user_name}>"
