"""Pytest configuration and shared fixtures.

Uses an in-memory SQLite database so tests run locally without Docker/Postgres.
Redis calls in auth_service are patched globally.
"""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.dependencies import get_db
from app.main import app

# ---------- SQLite in-memory engine ----------
engine_test = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(engine_test, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSessionLocal = sessionmaker(
    bind=engine_test, autocommit=False, autoflush=False
)


# ---------- Mock Redis used by auth_service ----------
@pytest.fixture(autouse=True)
def _mock_redis():
    """Prevent real Redis connections during tests."""
    store: dict[str, str] = {}
    mock = MagicMock()
    mock.setex.side_effect = lambda k, _ttl, v: store.__setitem__(k, v)
    mock.get.side_effect = lambda k: store.get(k)
    mock.delete.side_effect = lambda k: store.pop(k, None)
    with patch("app.services.auth_service._redis", mock):
        yield


@pytest.fixture(autouse=True)
def setup_db():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide a transactional DB session for tests."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Provide a sync HTTP test client with DB override."""

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as tc:
        yield tc

    app.dependency_overrides.clear()
