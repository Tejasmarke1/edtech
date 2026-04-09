"""FastAPI application entry-point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


# ---------- Lifespan (startup / shutdown) ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # — Startup —
    yield
    # — Shutdown —
    from app.database import engine

    engine.dispose()


# ---------- App factory ----------
app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Health check ----------
@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}


# ---------- Router registration ----------
# Each router is included under the /api/v1 prefix.
from app.routers import (  # noqa: E402
    auth,
    notifications,
    payments,
    ratings,
    search,
    sessions,
    subjects,
    students,
    teachers,
)

API_V1 = "/api/v1"

app.include_router(auth.router, prefix=f"{API_V1}/auth", tags=["Auth"])
app.include_router(subjects.router, prefix=f"{API_V1}/subjects", tags=["Subjects"])
app.include_router(teachers.router, prefix=f"{API_V1}/teachers", tags=["Teachers"])
app.include_router(students.router, prefix=f"{API_V1}/students", tags=["Students"])
app.include_router(sessions.router, prefix=f"{API_V1}/sessions", tags=["Sessions"])
app.include_router(search.router, prefix=f"{API_V1}/search", tags=["Search"])
app.include_router(ratings.router, prefix=f"{API_V1}/ratings", tags=["Ratings"])
app.include_router(payments.router, prefix=f"{API_V1}/payments", tags=["Payments"])
app.include_router(
    notifications.router, prefix=f"{API_V1}/notifications", tags=["Notifications"]
)
