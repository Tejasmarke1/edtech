"""Auth router — login, register, token refresh."""

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import RefreshRequest, RegisterRequest, RegisterResponse, TokenResponse
from app.schemas.user import UserRead
from app.services import auth_service

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new student or teacher account."""
    user = auth_service.register(db, payload)
    return RegisterResponse(user_name=user.user_name, role=user.role)


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate and return JWT access + refresh tokens."""
    return auth_service.login(db, form_data.username, form_data.password)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest):
    """Exchange a valid refresh token for a new token pair."""
    return auth_service.refresh_access_token(payload.refresh_token)


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user
