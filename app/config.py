"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration — values are read from .env at startup."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---------- App ----------
    APP_NAME: str = "edtech-doubt-resolution"
    APP_ENV: str = "development"
    APP_PORT: int = 8000
    DEBUG: bool = True

    # ---------- PostgreSQL ----------
    POSTGRES_USER: str = "edtech"
    POSTGRES_PASSWORD: str = "edtech_secret"
    POSTGRES_DB: str = "edtech_db"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = (
        "postgresql://edtech:edtech_secret@postgres:5432/edtech_db"
    )

    # ---------- Redis ----------
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_URL: str = "redis://redis:6379/0"

    # ---------- JWT / Auth ----------
    SECRET_KEY: str = "change-me-to-a-random-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ---------- CORS ----------
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]


# Singleton — import this wherever settings are needed.
settings = Settings()
