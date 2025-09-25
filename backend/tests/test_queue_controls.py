import os
import sys
import signal

# Environment variables for tests
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_queue?mode=memory&cache=shared"
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
    "sqlite:///file:testdb_queue?mode=memory&cache=shared",
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
from models import Base, User, DownloadQueue, TranscodingQueue, LiveStream, LibraryEntry, Provider, DownloadPreference, MediaEntry
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
    # 1. Seed Provider
    provider = Provider(id=1, name="Test Provider", base_url="http://example.com")
    db.add(provider)
    
    # 2. Seed Download Preference
    pref = DownloadPreference(provider_id=1, preferred_resolution="1080p", append_metadata=False)
    db.add(pref)
    
    # 3. Seed default admin User
    user = User(id=42, username="admin_user", role="admin", password_hash="dummy_hash")
    db.add(user)
    
    # 4. Seed default MediaEntry (needed for DownloadQueue)
    media_entry = MediaEntry(
        id=1,
        provider_id=1,
        title="Test Download Video",
        ohash="123456789abcdef1"
    )
    db.add(media_entry)
    
    # 5. Seed default LibraryEntry
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


# ----------------- DOWNLOADS QUEUE TESTS -----------------

@patch("celery_app.celery_app.control.revoke")
def test_download_pause_resume_cancel(mock_revoke):
    db = SessionLocal()
    dq = DownloadQueue(id=1, media_entry_id=1, url="http://example.com/v.mp4", status="running", celery_task_id="celery-123")
    db.add(dq)
    db.commit()
    db.close()
    
    # 1. Pause
    response = client.post("/progress/1/pause")
    assert response.status_code == 200
    assert response.json()["message"] == "Download paused"
    mock_revoke.assert_called_once_with("celery-123", terminate=True, signal="SIGTERM")
    
    # Check DB state
    db = SessionLocal()
    dq = db.query(DownloadQueue).filter_by(id=1).first()
    assert dq.status == "paused"
    db.close()
    
    # 2. Resume
    mock_revoke.reset_mock()
    with patch("celery.app.task.Task.delay") as mock_delay:
        mock_delay.return_value = MagicMock(id="new-celery-456")
        response = client.post("/progress/1/resume")
        assert response.status_code == 200
        assert response.json()["message"] == "Download resumed"
        assert response.json()["celery_task_id"] == "new-celery-456"
        mock_delay.assert_called_once()
        
    db = SessionLocal()
    dq = db.query(DownloadQueue).filter_by(id=1).first()
    assert dq.status == "pending"
    assert dq.celery_task_id == "new-celery-456"
    db.close()
    
    # 3. Cancel
    response = client.post("/progress/1/cancel")
    assert response.status_code == 200
    assert response.json()["message"] == "Download cancelled"
    mock_revoke.assert_called_once_with("new-celery-456", terminate=True, signal="SIGTERM")
    
    db = SessionLocal()
    dq = db.query(DownloadQueue).filter_by(id=1).first()
    assert dq.status == "cancelled"
    db.close()


def test_download_priority():
    db = SessionLocal()
    dq = DownloadQueue(id=1, media_entry_id=1, url="http://example.com/v.mp4", status="running", priority=5)
    db.add(dq)
    db.commit()
    db.close()
    
    # 1. Priority Up
    response = client.post("/progress/1/priority/up")
    assert response.status_code == 200
    assert response.json()["priority"] == 6
    
    # 2. Priority Down
    response = client.post("/progress/1/priority/down")
    assert response.status_code == 200
    assert response.json()["priority"] == 5


# ----------------- TRANSCODE QUEUE TESTS -----------------

@patch("os.kill")
@patch("celery_app.celery_app.control.revoke")
def test_transcode_pause_resume_cancel(mock_revoke, mock_kill):
    db = SessionLocal()
    tq = TranscodingQueue(id=1, library_entry_id=1, target_codec="h265", status="running", pid=1234, celery_task_id="celery-t-123")
    db.add(tq)
    db.commit()
    db.close()
    
    # 1. Pause
    response = client.post("/transcode/1/pause")
    assert response.status_code == 200
    assert "paused successfully" in response.json()["message"]
    mock_kill.assert_called_once_with(1234, signal.SIGSTOP)
    
    db = SessionLocal()
    tq = db.query(TranscodingQueue).filter_by(id=1).first()
    assert tq.status == "paused"
    db.close()
    
    # 2. Resume
    mock_kill.reset_mock()
    response = client.post("/transcode/1/resume")
    assert response.status_code == 200
    assert "resumed successfully" in response.json()["message"]
    mock_kill.assert_called_once_with(1234, signal.SIGCONT)
    
    db = SessionLocal()
    tq = db.query(TranscodingQueue).filter_by(id=1).first()
    assert tq.status == "running"
    db.close()
    
    # 3. Cancel
    mock_kill.reset_mock()
    response = client.post("/transcode/1/cancel")
    assert response.status_code == 200
    assert response.json()["message"] == "Transcoding job cancelled"
    mock_kill.assert_called_once_with(1234, signal.SIGKILL)
    mock_revoke.assert_called_once_with("celery-t-123", terminate=True, signal="SIGKILL")
    
    db = SessionLocal()
    tq = db.query(TranscodingQueue).filter_by(id=1).first()
    assert tq.status == "cancelled"
    db.close()


def test_transcode_priority():
    db = SessionLocal()
    tq = TranscodingQueue(id=1, library_entry_id=1, target_codec="h265", status="pending", priority=1)
    db.add(tq)
    db.commit()
    db.close()
    
    # 1. Priority Up
    response = client.post("/transcode/1/priority/up")
    assert response.status_code == 200
    assert response.json()["priority"] == 2
    
    # 2. Priority Down
    response = client.post("/transcode/1/priority/down")
    assert response.status_code == 200
    assert response.json()["priority"] == 1


# ----------------- LIVE STREAMS CAPTURE TESTS -----------------

@patch("os.kill")
@patch("celery_app.celery_app.control.revoke")
def test_live_stream_pause_resume_stop(mock_revoke, mock_kill):
    db = SessionLocal()
    ls = LiveStream(id=1, name="Chaturbate Stream", url="http://cb.com/model", status="recording", pid=5678, current_task_id="celery-l-123")
    db.add(ls)
    db.commit()
    db.close()
    
    # 1. Pause
    response = client.post("/live-streams/1/pause")
    assert response.status_code == 200
    assert response.json()["status"] == "paused"
    mock_kill.assert_called_once_with(5678, signal.SIGSTOP)
    
    db = SessionLocal()
    ls = db.query(LiveStream).filter_by(id=1).first()
    assert ls.status == "paused"
    db.close()
    
    # 2. Resume
    mock_kill.reset_mock()
    response = client.post("/live-streams/1/resume")
    assert response.status_code == 200
    assert response.json()["status"] == "recording"
    mock_kill.assert_called_once_with(5678, signal.SIGCONT)
    
    db = SessionLocal()
    ls = db.query(LiveStream).filter_by(id=1).first()
    assert ls.status == "recording"
    db.close()
    
    # 3. Stop (Cancel)
    mock_kill.reset_mock()
    response = client.post("/live-streams/1/stop")
    assert response.status_code == 200
    assert response.json()["status"] == "idle"
    mock_kill.assert_called_once_with(5678, signal.SIGKILL)
    mock_revoke.assert_called_once_with("celery-l-123", terminate=True, signal="SIGKILL")
    
    db = SessionLocal()
    ls = db.query(LiveStream).filter_by(id=1).first()
    assert ls.status == "idle"
    assert ls.pid is None
    assert ls.current_task_id is None
    db.close()
