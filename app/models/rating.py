"""Rating model."""

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class Rating(TimestampMixin, Base):
    """Post-session rating (1–5 stars)."""

    __tablename__ = "rating"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("session_schedule.id", ondelete="CASCADE"),
        nullable=False,
    )
    rated_by: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.user_name", ondelete="CASCADE"),
        nullable=False,
    )
    stars: Mapped[int] = mapped_column(Integer, nullable=False)
    review_text: Mapped[str | None] = mapped_column(Text)

    session: Mapped["SessionSchedule"] = relationship(back_populates="ratings")
    rater: Mapped["User"] = relationship(back_populates="ratings_given")

    def __repr__(self) -> str:
        return f"<Rating {self.id} stars={self.stars}>"
