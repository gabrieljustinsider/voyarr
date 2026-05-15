import os
import sys

# Environment variables for tests
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_discord?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

from unittest.mock import patch, MagicMock

# Save original modules before mocking to avoid side-effects
orig_modules = {}
for name in ["services.scraper", "nacl", "nacl.signing", "nacl.exceptions", "croniter"]:
    orig_modules[name] = sys.modules.get(name)
    sys.modules[name] = MagicMock()

import database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

test_engine = create_engine(
    "sqlite:///file:testdb_discord?mode=memory&cache=shared",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal

import db_utils

db_utils.SessionLocal = TestSessionLocal

import pytest
from fastapi.testclient import TestClient

from main import app
from database import get_db
from models import Base


@pytest.fixture(scope="module", autouse=True)
def restore_modules():
    yield
    # Restore original modules to prevent polluting other test suites
    for name, orig in orig_modules.items():
        if orig is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = orig


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db_and_dependencies():
    # Save original globals and overrides
    orig_overrides = dict(app.dependency_overrides)
    orig_engine = database.engine
    orig_sessionlocal = database.SessionLocal
    orig_db_utils_sessionlocal = getattr(db_utils, "SessionLocal", None)

    # Patch database engine/SessionLocal
    database.engine = test_engine
    database.SessionLocal = TestSessionLocal
    db_utils.SessionLocal = TestSessionLocal

    # Apply local dependency overrides
    app.dependency_overrides[get_db] = override_get_db

    # Re-create all tables in this test's unique cache database
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    # Seed global settings to enable scraping during Discord command tests
    from models import Settings
    db = TestSessionLocal()
    db.add(Settings(key="scraping_enabled", value="true"))
    db.commit()
    db.close()

    yield

    # Clean up / Restore
    app.dependency_overrides = orig_overrides
    database.engine = orig_engine
    database.SessionLocal = orig_sessionlocal
    if orig_db_utils_sessionlocal is not None:
        db_utils.SessionLocal = orig_db_utils_sessionlocal


@patch("routers.discord.verify_signature")
@patch("routers.discord.is_user_authorized")
def test_discord_interaction_ping(mock_auth, mock_verify):
    mock_verify.return_value = True
    response = client.post("/discord/interactions", json={"type": 1})
    assert response.status_code == 200
    assert response.json() == {"type": 1}


@patch("routers.discord.verify_signature")
@patch("routers.discord.is_user_authorized")
def test_discord_interaction_unauthorized(mock_auth, mock_verify):
    mock_verify.return_value = True
    mock_auth.return_value = False

    response = client.post(
        "/discord/interactions",
        json={
            "type": 2,
            "member": {"user": {"id": "12345", "username": "bad_user"}},
            "data": {"name": "search", "options": [{"name": "query", "value": "test"}]},
        },
    )

    assert response.status_code == 200
    assert "not authorized" in response.json()["data"]["content"]


@patch("routers.discord.verify_signature")
@patch("routers.discord.is_user_authorized")
@patch("routers.discord.get_user_role_from_discord")
@patch("celery.app.task.Task.delay")
def test_discord_interaction_scrape_authorized(
    mock_delay, mock_role, mock_auth, mock_verify
):
    mock_verify.return_value = True
    mock_auth.return_value = True
    mock_role.return_value = "admin"
    mock_delay.return_value = MagicMock(id="mock-task-123")

    response = client.post(
        "/discord/interactions",
        json={
            "type": 2,
            "member": {"user": {"id": "99999", "username": "good_user"}},
            "data": {
                "name": "scrape",
                "options": [
                    {"name": "url", "value": "http://example.com/video"},
                    {"name": "recipe_id", "value": "1"},
                ],
            },
        },
    )

    assert response.status_code == 200
    assert "Scrape job initiated" in response.json()["data"]["content"]
    mock_delay.assert_called_once()
