"""SQLAlchemy engine and session factory (sync — psycopg2)."""

from datetime import datetime

from sqlalchemy import create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.config import settings

# ---------- Engine ----------
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # SQL logging in dev
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# ---------- Session factory ----------
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# ---------- Declarative Base ----------
class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


# ---------- Timestamp Mixin ----------
class TimestampMixin:
    """Adds created_at / updated_at columns to any model."""

    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
