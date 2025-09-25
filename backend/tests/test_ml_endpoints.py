import sys
from unittest.mock import MagicMock

# Initial module mocking before any imports to prevent ModuleNotFoundError
mocked_names = ['services.scraper', 'croniter', 'cv2', 'numpy', 'face_recognition', 'sklearn', 'sklearn.cluster']
orig_modules = {}
for name in mocked_names:
    orig_modules[name] = sys.modules.get(name)
    sys.modules[name] = MagicMock()

import os

# Environment variables for tests
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_ml?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

import database
import db_utils
from main import app

from models import LibraryEntry, Provider, Base
from database import get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Explicitly import ml_tasks and ai_tasks to avoid patching issues

@pytest.fixture(scope="module", autouse=True)
def cleanup_mock_modules():
    yield
    # Restore original modules to prevent polluting other test suites
    for name in mocked_names:
        if orig_modules[name] is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = orig_modules[name]

test_engine = create_engine(
    "sqlite:///file:testdb_ml?mode=memory&cache=shared",
    connect_args={"check_same_thread": False}
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

client = TestClient(app)
headers = {"X-Voyarr-Api-Key": "test_master_key"}


@pytest.fixture(autouse=True)
def setup_db_and_dependencies(tmp_path):
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
    app.dependency_overrides[get_db] = override_get_db
    
    # Override MASTER_KEY environment variable for the test to pass RBAC
    os.environ["MASTER_KEY"] = "test_master_key"
    
    # Re-create all tables in this test's unique cache database
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    db = TestSessionLocal()
    provider = Provider(id=1, name="Test Provider", base_url="http://test.com")
    db.add(provider)
    db.commit()

    # Create dummy video file path using pytest's temp directory
    test_file = tmp_path / "test_video.mp4"
    test_file.write_text("dummy video content")
    
    entry = LibraryEntry(
        id=1,
        provider_id=1,
        title="Test Video",
        file_path=str(test_file),
        entry_metadata={"facial_clusters": {"Person_0": [1.5, 3.0]}},
        performers=["Actor 1"]
    )
    db.add(entry)
    db.commit()
    
    # Create dummy faces directory and a representative thumbnail
    faces_dir = tmp_path / ".faces_1"
    faces_dir.mkdir()
    thumb_file = faces_dir / "Person_0.jpg"
    thumb_file.write_text("dummy image data")
    
    db.close()
    
    yield
    
    # Clean up / Restore
    app.dependency_overrides = orig_overrides
    database.engine = orig_engine
    database.SessionLocal = orig_sessionlocal
    if orig_db_utils_sessionlocal is not None:
        db_utils.SessionLocal = orig_db_utils_sessionlocal


@patch("celery.app.task.Task.delay")
def test_trigger_auto_chaptering(mock_delay):
    mock_delay.return_value.id = "mock_task_123"
    response = client.post("/chapters/library/1/auto-chapter", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"message": "Auto-chaptering task queued", "task_id": "mock_task_123"}
    mock_delay.assert_called_once_with(1)


@patch("tasks.ml_tasks.cluster_faces_task.delay")
def test_trigger_facial_clustering(mock_delay):
    mock_delay.return_value.id = "mock_task_456"
    response = client.post("/library/1/cluster-faces", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"message": "Facial clustering task queued", "task_id": "mock_task_456"}
    mock_delay.assert_called_once_with(1)


def test_get_facial_clusters():
    response = client.get("/library/1/facial-clusters", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"Person_0": [1.5, 3.0]}


def test_get_facial_cluster_thumbnail():
    response = client.get("/library/1/facial-clusters/Person_0/thumbnail", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.content == b"dummy image data"


def test_rename_facial_cluster():
    payload = {"new_name": "John Doe"}
    response = client.post("/library/1/facial-clusters/Person_0/rename", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.json() == {"message": "Cluster renamed successfully", "new_name": "John Doe"}
    
    # Verify the actual metadata was updated via the GET endpoint
    verify_resp = client.get("/library/1/facial-clusters", headers=headers)
    assert verify_resp.json() == {"John Doe": [1.5, 3.0]}