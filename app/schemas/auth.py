"""Auth schemas (login, register, token)."""

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


# ---------- Register ----------
class RegisterRequest(BaseModel):
    user_name: EmailStr = Field(..., description="Email used as unique user ID")
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole
    full_name: str | None = Field(None, max_length=255)


class RegisterResponse(BaseModel):
    user_name: str
    role: UserRole
    message: str = "Registration successful"


# ---------- Token ----------
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
