"""AvailabilitySlot model."""

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class DayOfWeek(str, enum.Enum):
    mon = "mon"
    tue = "tue"
    wed = "wed"
    thu = "thu"
    fri = "fri"
    sat = "sat"
    sun = "sun"


class AvailabilitySlot(TimestampMixin, Base):
    """Teacher availability windows."""

    __tablename__ = "availability_slots"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_name: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )
    day_of_week: Mapped[DayOfWeek] = mapped_column(
        Enum(DayOfWeek, name="day_of_week"), nullable=False
    )
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="availability_slots")
    sessions: Mapped[list["SessionSchedule"]] = relationship(
        back_populates="slot",
    )

    def __repr__(self) -> str:
        return f"<AvailabilitySlot {self.id} {self.day_of_week.value} {self.start_time}-{self.end_time}>"
