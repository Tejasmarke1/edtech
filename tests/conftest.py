"""Pytest configuration and shared fixtures."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.database import Base
from app.dependencies import get_db
from app.main import app

# Use a separate test database (append _test to the DB name).
TEST_DATABASE_URL = settings.DATABASE_URL.replace(
    f"/{settings.POSTGRES_DB}", f"/{settings.POSTGRES_DB}_test"
)

engine_test = create_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = sessionmaker(
    bind=engine_test, autocommit=False, autoflush=False
)


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
