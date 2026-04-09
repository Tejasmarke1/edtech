"""Application settings loaded from environment variables."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration — values are read from .env at startup."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---------- App ----------
    APP_NAME: str = Field(...)
    APP_ENV: str = Field(...)
    APP_PORT: int = Field(...)
    DEBUG: bool = Field(...)

    # ---------- PostgreSQL ----------
    POSTGRES_USER: str = Field(...)
    POSTGRES_PASSWORD: str = Field(...)
    POSTGRES_DB: str = Field(...)
    POSTGRES_HOST: str = Field(...)
    POSTGRES_PORT: int = Field(...)
    DATABASE_URL: str = Field(...)

    # ---------- Redis ----------
    REDIS_HOST: str = Field(...)
    REDIS_PORT: int = Field(...)
    REDIS_URL: str = Field(...)

    # ---------- JWT / Auth ----------
    SECRET_KEY: str = Field(...)
    ALGORITHM: str = Field(...)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(...)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(...)

    # ---------- Payments ----------
    # Fixed charge paid by each user consuming the platform (student/enrollee). 
    PLATFORM_CHARGE_PER_USER: int = Field(...)
    # Percentage deducted from teacher earnings on each successful transaction.
    COMMISSION_PERCENT: float = Field(...)
    # Per-session-type overrides (defaults match legacy values).
    PLATFORM_CHARGE_PER_USER_INDIVIDUAL: int = Field(...)
    PLATFORM_CHARGE_PER_USER_GROUP: int = Field(...)
    COMMISSION_PERCENT_INDIVIDUAL: float = Field(...)
    COMMISSION_PERCENT_GROUP: float = Field(...)
    PAYMENT_GATEWAY: str = Field(...)
    PAYMENT_CURRENCY: str = Field(...)
    PAYMENT_GATEWAY_KEY_ID: str = Field(...)
    PAYMENT_GATEWAY_KEY_SECRET: str = Field(...)
    PAYMENT_WEBHOOK_SECRET: str = Field(...)

    # ---------- Jitsi ----------
    JITSI_URL: str = Field(...)
    JITSI_APP_ID: str = Field(...)
    JITSI_SECRET: str = Field(...)
    JITSI_DOMAIN: str = Field(...)

    # ---------- CORS ----------
    CORS_ORIGINS: list[str] = Field(...)

    # ---------- Media Uploads ----------
    PUBLIC_BASE_URL: str = Field("http://localhost:8000")
    UPLOAD_URL_EXPIRES_SECONDS: int = Field(900)
    MAX_VIDEO_UPLOAD_SIZE_MB: int = Field(200)

    # ---------- S3 Uploads ----------
    S3_BUCKET_NAME: str = Field("")
    S3_REGION: str = Field("us-east-1")
    S3_ENDPOINT_URL: str | None = Field(None)
    S3_PUBLIC_BASE_URL: str | None = Field(None)
    S3_OBJECT_PUBLIC: bool = Field(True)
    AWS_ACCESS_KEY_ID: str | None = Field(None)
    AWS_SECRET_ACCESS_KEY: str | None = Field(None)
    AWS_SESSION_TOKEN: str | None = Field(None)


# Singleton — import this wherever settings are needed.
settings = Settings()
