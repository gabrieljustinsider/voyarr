import os
import sys

# Environment variables for tests
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_notifications?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

from unittest.mock import MagicMock, patch

# Save original modules before mocking to avoid side-effects
orig_modules = {}
for name in ['services.scraper', 'croniter']:
    orig_modules[name] = sys.modules.get(name)
    sys.modules[name] = MagicMock()

import database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

test_engine = create_engine(
    "sqlite:///file:testdb_notifications?mode=memory&cache=shared",
    connect_args={"check_same_thread": False}
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal

import db_utils
db_utils.SessionLocal = TestSessionLocal

import pytest
from fastapi.testclient import TestClient

from main import app
from database import SessionLocal, get_db
from models import Base, User, NotificationLog
from routers.auth import get_current_user
from dependencies import verify_api_key

# Restore original modules to prevent polluting other test suites
for name, orig in orig_modules.items():
    if orig is None:
        sys.modules.pop(name, None)
    else:
        sys.modules[name] = orig

class MockUser:
    id = 42
    username = "admin_user"
    role = "admin"
    is_active = True

mock_user = MockUser()

def override_get_current_user():
    return mock_user

def override_verify_api_key():
    return {"type": "mock", "user": "admin_user", "role": "admin"}

def override_get_db():
    db = SessionLocal()
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
    orig_db_utils_sessionlocal = getattr(db_utils, 'SessionLocal', None)
    
    # Patch database engine/SessionLocal
    database.engine = test_engine
    database.SessionLocal = TestSessionLocal
    db_utils.SessionLocal = TestSessionLocal
    
    # Apply local dependency overrides
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[verify_api_key] = override_verify_api_key
    app.dependency_overrides[get_db] = override_get_db
    
    # Re-create all tables in this test's unique cache database
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    db = TestSessionLocal()
    # Seed default admin User
    user = User(id=42, username="admin_user", role="admin", password_hash="dummy_hash")
    db.add(user)
    db.commit()
    db.close()
    
    yield
    
    # Clean up / Restore
    app.dependency_overrides = orig_overrides
    database.engine = orig_engine
    database.SessionLocal = orig_sessionlocal
    if orig_db_utils_sessionlocal is not None:
        db_utils.SessionLocal = orig_db_utils_sessionlocal


# ----------------- NOTIFICATION PREFERENCES TESTS -----------------

def test_get_preferences_defaults():
    # If no preferences exist, should return defaults
    response = client.get("/notifications/preferences")
    assert response.status_code == 200
    res_data = response.json()
    assert len(res_data) == 4
    
    # All default "toast" dispatch methods should be enabled, "discord_dm" disabled by default
    toast_prefs = [p for p in res_data if p["dispatch_method"] == "toast"]
    discord_prefs = [p for p in res_data if p["dispatch_method"] == "discord_dm"]
    
    assert len(toast_prefs) == 2
    assert len(discord_prefs) == 2
    for p in toast_prefs:
        assert p["enabled"] is True
    for p in discord_prefs:
        assert p["enabled"] is False


def test_update_preferences():
    # Create or update notification preferences
    payload = [
        {"event_type": "task_completed", "dispatch_method": "toast", "enabled": False},
        {"event_type": "favorite_updated", "dispatch_method": "discord_dm", "enabled": True}
    ]
    response = client.post("/notifications/preferences", json=payload)
    assert response.status_code == 200
    assert "Notification preferences updated successfully." in response.json()["message"]
    
    # Fetch preferences and verify
    response = client.get("/notifications/preferences")
    assert response.status_code == 200
    res_data = response.json()
    
    task_completed_toast = next(p for p in res_data if p["event_type"] == "task_completed" and p["dispatch_method"] == "toast")
    favorite_updated_dm = next(p for p in res_data if p["event_type"] == "favorite_updated" and p["dispatch_method"] == "discord_dm")
    
    assert task_completed_toast["enabled"] is False
    assert favorite_updated_dm["enabled"] is True


# ----------------- NOTIFICATION RULES TESTS (ADMIN RBAC) -----------------

def test_get_rules_rbac():
    # If not admin, should raise 403. Let's toggle role temporarily
    mock_user.role = "user"
    response = client.get("/notifications/rules")
    assert response.status_code == 403
    assert "RBAC Forbidden" in response.json()["detail"]
    
    mock_user.role = "admin"
    response = client.get("/notifications/rules")
    assert response.status_code == 200
    assert len(response.json()) == 0


def test_create_and_delete_rule():
    mock_user.role = "admin"
    payload = {
        "event_type": "task_completed",
        "discord_channel_id": "1234567890",
        "webhook_url": "https://discord.com/api/webhooks/123",
        "is_active": True
    }
    response = client.post("/notifications/rules", json=payload)
    assert response.status_code == 200
    assert "Notification rule saved successfully." in response.json()["message"]
    rule_id = response.json()["rule"]["id"]
    
    # Get rules
    response = client.get("/notifications/rules")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["discord_channel_id"] == "1234567890"
    
    # Try deleting it
    response = client.delete(f"/notifications/rules/{rule_id}")
    assert response.status_code == 200
    assert "Notification rule deleted successfully." in response.json()["message"]
    
    # Verify it is gone
    response = client.get("/notifications/rules")
    assert response.status_code == 200
    assert len(response.json()) == 0


def test_delete_rule_not_found():
    mock_user.role = "admin"
    response = client.delete("/notifications/rules/999")
    assert response.status_code == 404


# ----------------- NOTIFICATION LOGS & READ STATUS TESTS -----------------

def test_notification_history_and_read():
    db = SessionLocal()
    # Add some notification logs
    log1 = NotificationLog(user_id=42, event_type="task_completed", title="Task Finished", message="Your download finished", read=False)
    log2 = NotificationLog(user_id=42, event_type="favorite_updated", title="Favorite Match", message="New movie match found", read=False)
    db.add_all([log1, log2])
    db.commit()
    db.refresh(log1)
    db.refresh(log2)
    db.close()
    
    # Get history
    response = client.get("/notifications/history")
    assert response.status_code == 200
    res_data = response.json()
    assert len(res_data) == 2
    assert res_data[0]["title"] in ["Task Finished", "Favorite Match"]
    assert res_data[0]["read"] is False
    
    # Mark specific notification as read
    response = client.post("/notifications/read", json={"notification_ids": [log1.id]})
    assert response.status_code == 200
    
    # Verify status
    response = client.get("/notifications/history")
    assert response.status_code == 200
    res_data = response.json()
    p1 = next(n for n in res_data if n["id"] == log1.id)
    p2 = next(n for n in res_data if n["id"] == log2.id)
    assert p1["read"] is True
    assert p2["read"] is False
    
    # Mark all as read
    response = client.post("/notifications/read", json={})
    assert response.status_code == 200
    
    # Verify all are read
    response = client.get("/notifications/history")
    assert response.status_code == 200
    res_data = response.json()
    assert all(n["read"] is True for n in res_data)


# ----------------- NOTIFICATION SERVICE TESTS -----------------

@patch("redis.Redis.from_url")
def test_notification_service_publish_toast(mock_redis_url):
    mock_redis = MagicMock()
    mock_redis_url.return_value = mock_redis
    
    from services.notification_service import NotificationService
    
    payload = {"title": "Hello"}
    NotificationService.publish_toast(payload)
    mock_redis.publish.assert_called_once()


@patch("requests.post")
def test_notification_service_discord_webhook(mock_post):
    mock_resp = MagicMock()
    mock_resp.status_code = 204
    mock_post.return_value = mock_resp
    
    from services.notification_service import NotificationService
    NotificationService.send_discord_webhook("http://mock-webhook", "Test Message")
    mock_post.assert_called_once_with("http://mock-webhook", json={"content": "Test Message"}, timeout=5)
