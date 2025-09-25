import os
import sys

# Crucial environment variables for tests
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_personalization?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

# Mock out complex or unnecessary external submodules before import
from unittest.mock import MagicMock, patch

# Save original modules before mocking to avoid side-effects
orig_modules = {}
for name in ['services.scraper', 'croniter']:
    orig_modules[name] = sys.modules.get(name)
    sys.modules[name] = MagicMock()

# Load database and patch it IMMEDIATELY
import database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

test_engine = create_engine(
    "sqlite:///file:testdb_personalization?mode=memory&cache=shared",
    connect_args={"check_same_thread": False}
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal

# Patch db_utils too
import db_utils
db_utils.SessionLocal = TestSessionLocal

import pytest
from fastapi.testclient import TestClient

# Real imports from our backend codebase
from main import app
from database import SessionLocal, get_db
from models import Base, User, LibraryEntry, Favorite, UserVideoStats, LiveStream, Vault, Provider
from routers.auth import get_current_user
from dependencies import verify_api_key

# Restore original modules to prevent polluting other test suites
for name, orig in orig_modules.items():
    if orig is None:
        sys.modules.pop(name, None)
    else:
        sys.modules[name] = orig

# Mock user object for tests
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
    # 1. Seed a Provider (needed for LibraryEntry)
    provider = Provider(id=1, name="Test Provider", base_url="http://example.com")
    db.add(provider)
    
    # 2. Seed default admin User
    user = User(id=42, username="admin_user", role="admin", password_hash="dummy_hash")
    db.add(user)
    
    # 3. Seed default LibraryEntry
    entry = LibraryEntry(
        id=1,
        provider_id=1,
        title="Test Video",
        file_path="/path/to/video.mp4",
        ohash="123456789abcdef0"
    )
    db.add(entry)
    
    db.commit()
    db.close()
    
    yield
    
    # Clean up / Restore
    app.dependency_overrides = orig_overrides
    database.engine = orig_engine
    database.SessionLocal = orig_sessionlocal
    if orig_db_utils_sessionlocal is not None:
        db_utils.SessionLocal = orig_db_utils_sessionlocal

# ----------------- FAVORITES TESTS -----------------

def test_favorites_toggle():
    # 1. Toggle ON (not currently favorited)
    response = client.post("/favorites/toggle", json={"item_type": "scene", "item_id": "1"})
    assert response.status_code == 200
    assert response.json()["favorited"] is True
    assert "Added to favorites." in response.json()["message"]
    
    # Check that it is actually in the db
    db = SessionLocal()
    fav = db.query(Favorite).filter_by(user_id=42, item_type="scene", item_id="1").first()
    assert fav is not None
    db.close()

    # 2. Toggle OFF (already favorited)
    response = client.post("/favorites/toggle", json={"item_type": "scene", "item_id": "1"})
    assert response.status_code == 200
    assert response.json()["favorited"] is False
    assert "Removed from favorites." in response.json()["message"]

    # Check that it is deleted from the db
    db = SessionLocal()
    fav = db.query(Favorite).filter_by(user_id=42, item_type="scene", item_id="1").first()
    assert fav is None
    db.close()

    # 3. Invalid item type
    response = client.post("/favorites/toggle", json={"item_type": "invalid_type", "item_id": "1"})
    assert response.status_code == 400


def test_get_favorites():
    db = SessionLocal()
    db.add(Favorite(user_id=42, item_type="scene", item_id="101"))
    db.add(Favorite(user_id=42, item_type="performer", item_id="Jane Doe"))
    db.add(Favorite(user_id=42, item_type="studio", item_id="Evil Corp"))
    db.commit()
    db.close()

    response = client.get("/favorites")
    assert response.status_code == 200
    res_data = response.json()
    assert "101" in res_data["scene"]
    assert "Jane Doe" in res_data["performer"]
    assert "Evil Corp" in res_data["studio"]

# ----------------- USER STATS TESTS -----------------

def test_user_stats_play():
    # 1. Entry not found
    response = client.post("/user/stats/play", json={"library_entry_id": 999, "duration": 300, "completed": True})
    assert response.status_code == 404

    # 2. Correct play logging
    response = client.post("/user/stats/play", json={"library_entry_id": 1, "duration": 300, "completed": True})
    assert response.status_code == 200
    assert response.json()["play_count"] == 1
    assert response.json()["climax_count"] == 0

    # Play again
    response = client.post("/user/stats/play", json={"library_entry_id": 1, "duration": 300, "completed": True})
    assert response.status_code == 200
    assert response.json()["play_count"] == 2


def test_user_stats_climax():
    # 1. Entry not found
    response = client.post("/user/stats/climax", json={"library_entry_id": 999})
    assert response.status_code == 404

    # 2. Correct climax increment
    response = client.post("/user/stats/climax", json={"library_entry_id": 1})
    assert response.status_code == 200
    assert response.json()["climax_count"] == 1

    response = client.post("/user/stats/climax", json={"library_entry_id": 1})
    assert response.status_code == 200
    assert response.json()["climax_count"] == 2


def test_user_stats_video():
    db = SessionLocal()
    db.add(UserVideoStats(user_id=42, library_entry_id=1, play_count=8, climax_count=4))
    db.commit()
    db.close()

    response = client.get("/user/stats/video/1")
    assert response.status_code == 200
    assert response.json()["play_count"] == 8
    assert response.json()["climax_count"] == 4


def test_user_stats_preferences():
    # 1. Get default preferences (auto-creates if missing)
    response = client.get("/user/stats/preferences")
    assert response.status_code == 200
    assert response.json()["theme"] == "dark"

    # 2. Save custom preferences
    response = client.post("/user/stats/preferences", json={"theme": "midnight_cyber", "ui_config": {"showLive": True}})
    assert response.status_code == 200
    assert response.json()["theme"] == "midnight_cyber"
    assert response.json()["ui_config"] == {"showLive": True}

    # 3. Retrieve custom preferences
    response = client.get("/user/stats/preferences")
    assert response.status_code == 200
    assert response.json()["theme"] == "midnight_cyber"

# ----------------- STUDIOS CRUD TESTS -----------------

def test_studios_crud():
    # 1. Create a Network Studio
    response = client.post("/studios", json={
        "name": "Studio A",
        "logo_url": "http://example.com/logoA.png",
        "url": "http://example.com/A",
        "details": "Details A",
        "tags": ["network", "hd"],
        "is_network": True
    })
    assert response.status_code == 201
    assert response.json()["name"] == "Studio A"
    assert response.json()["is_network"] is True
    parent_id = response.json()["id"]

    # 2. Create a Sub-studio linked to Network Studio
    response = client.post("/studios", json={
        "name": "Studio B",
        "logo_url": "http://example.com/logoB.png",
        "url": "http://example.com/B",
        "details": "Details B",
        "tags": ["sub"],
        "is_network": False,
        "parent_id": parent_id
    })
    assert response.status_code == 201
    assert response.json()["name"] == "Studio B"
    assert response.json()["parent_id"] == parent_id

    # 3. List Studios
    response = client.get("/studios")
    assert response.status_code == 200
    assert len(response.json()) == 2

    # 4. Update Studio
    response = client.put(f"/studios/{parent_id}", json={
        "name": "Studio A Updated",
        "logo_url": "http://example.com/logoA.png",
        "url": "http://example.com/A",
        "details": "Details A Updated",
        "tags": ["network", "4k"],
        "is_network": True
    })
    assert response.status_code == 200
    assert response.json()["name"] == "Studio A Updated"

    # 5. Delete Studio
    response = client.delete(f"/studios/{parent_id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Studio profile deleted successfully."

# ----------------- ANALYTICS TESTS -----------------

def test_analytics_dashboard():
    # Add play history and stats
    db = SessionLocal()
    db.add(UserVideoStats(user_id=42, library_entry_id=1, play_count=10, climax_count=5))
    from models import UserHistory
    import datetime
    db.add(UserHistory(user_id=42, library_entry_id=1, duration=500, completed=True, watched_at=datetime.datetime.utcnow()))
    db.commit()
    db.close()

    response = client.get("/analytics/dashboard")
    assert response.status_code == 200
    assert "metrics" in response.json()
    assert response.json()["metrics"]["total_plays"] == 10
    assert response.json()["metrics"]["total_climax_count"] == 5


def test_analytics_report():
    response = client.get("/analytics/report")
    assert response.status_code == 200
    assert "video_stats_breakdown" in response.json()
    assert "recent_watch_logs" in response.json()

# ----------------- LIVE STREAMS CRUD & RECORD TESTS -----------------

def test_live_streams_crud_and_record():
    # 1. Create Live Stream
    response = client.post("/live-streams", json={"name": "CB Stream", "url": "https://chaturbate.com/some_girl"})
    assert response.status_code == 201
    assert response.json()["name"] == "CB Stream"
    assert response.json()["status"] == "idle"
    stream_id = response.json()["id"]

    # 2. Get Live Streams
    response = client.get("/live-streams")
    assert response.status_code == 200
    assert len(response.json()) == 1

    # 3. Update Live Stream
    response = client.put(f"/live-streams/{stream_id}", json={"name": "CB Stream Updated", "url": "https://chaturbate.com/some_girl_new"})
    assert response.status_code == 200
    assert response.json()["name"] == "CB Stream Updated"

    # 4. Trigger Recording
    with patch("celery.app.task.Task.delay") as mock_delay:
        mock_delay.return_value = MagicMock(id="celery-task-id-123")
        response = client.post(f"/live-streams/{stream_id}/record")
        assert response.status_code == 200
        assert response.json()["message"] == "Background recording task spawned successfully."
        assert response.json()["task_id"] == "celery-task-id-123"
        mock_delay.assert_called_once()

    # 5. Stop Recording
    with patch("celery.app.control.Control.revoke") as mock_revoke:
        # Update stream status in database to recording
        db = SessionLocal()
        stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
        stream.status = "recording"
        stream.current_task_id = "celery-task-id-123"
        db.commit()
        db.close()

        response = client.post(f"/live-streams/{stream_id}/stop")
        assert response.status_code == 200
        assert response.json()["message"] == "Recording stop signal dispatched successfully."
        mock_revoke.assert_called_once_with("celery-task-id-123", terminate=True, signal="SIGKILL")

    # 6. Delete Live Stream
    response = client.delete(f"/live-streams/{stream_id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Live stream monitor config deleted successfully."


def test_live_stream_auth_and_stream():
    # 1. Create Live Stream
    response = client.post("/live-streams", json={"name": "CB Stream", "url": "https://chaturbate.com/some_girl"})
    assert response.status_code == 201
    stream_id = response.json()["id"]

    # 2. Get Auth Status (Vault secrets exist check - initially none)
    response = client.get(f"/live-streams/{stream_id}/auth")
    assert response.status_code == 200
    assert response.json()["has_cookies"] is False
    assert response.json()["has_headers"] is False

    # 3. Save Auth Secrets
    response = client.post(f"/live-streams/{stream_id}/auth", json={"cookies": "session=abc", "headers": "X-Auth=123"})
    assert response.status_code == 200
    assert "successfully saved" in response.json()["message"].lower()

    # Check Vault has them
    db = SessionLocal()
    cookies_vault = db.query(Vault).filter_by(entity_type="live_stream_auth", entity_id=stream_id, key="cookies").first()
    assert cookies_vault is not None
    db.close()

    # Check Auth Status again
    response = client.get(f"/live-streams/{stream_id}/auth")
    assert response.status_code == 200
    assert response.json()["has_cookies"] is True
    assert response.json()["has_headers"] is True

    # 4. Stream URL Resolution proxy
    with patch("routers.live_streams.shutil.which") as mock_which, patch("routers.live_streams.subprocess.run") as mock_run:
        mock_which.return_value = "/usr/local/bin/streamlink"
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="https://hls-edge-server.example.com/playlist.m3u8\n"
        )
        response = client.get(f"/live-streams/{stream_id}/stream")
        assert response.status_code == 200
        assert response.json()["stream_url"] == "https://hls-edge-server.example.com/playlist.m3u8"

# ----------------- STASH STATS SYNC TEST -----------------

@patch("routers.external_api.requests.post")
def test_stash_stats_sync(mock_requests_post):
    # Seed local stats (plays is higher locally, climax is higher in stash)
    db = SessionLocal()
    db.add(UserVideoStats(user_id=42, library_entry_id=1, play_count=5, climax_count=1))
    db.commit()
    db.close()

    # Mock Stash GraphQL response
    mock_stash_graphql_response = MagicMock()
    mock_stash_graphql_response.status_code = 200
    mock_stash_graphql_response.json.return_value = {
        "data": {
            "findScenes": {
                "scenes": [
                    {
                        "id": "stash-scene-999",
                        "title": "Test Video",
                        "play_count": 3,
                        "o_counter": 2,
                        "last_played_at": "2026-05-20T18:00:00Z"
                    }
                ]
            }
        }
    }
    mock_requests_post.return_value = mock_stash_graphql_response

    # Call stash sync endpoint
    response = client.post("/external-api/stash/sync-stats", json={
        "stash_url": "http://example.com:9000",
        "stash_api_key": "dummy_stash_key"
    })

    assert response.status_code == 200
    assert response.json()["synced_count"] == 1
    assert response.json()["updated_local"] == 1
    assert response.json()["updated_stash"] == 1

    # Local stats should have been merged to maximums
    db = SessionLocal()
    stats = db.query(UserVideoStats).filter_by(user_id=42, library_entry_id=1).first()
    assert stats is not None
    assert stats.play_count == 5
    assert stats.climax_count == 2
    db.close()
