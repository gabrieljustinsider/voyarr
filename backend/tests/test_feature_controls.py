import os

# Configure test database in memory
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_feature_controls?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import database
from main import app
from database import get_db
from models import Base, User, Settings, AdminLog, LibraryEntry
from dependencies import verify_api_key
test_engine = create_engine(
    "sqlite:///file:testdb_feature_controls?mode=memory&cache=shared",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal

client = TestClient(app)

# Track mock active user
active_auth_info = {"type": "master_key"}


def override_verify_api_key():
    return active_auth_info


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db_and_dependencies():
    orig_overrides = dict(app.dependency_overrides)
    orig_engine = database.engine
    orig_sessionlocal = database.SessionLocal

    database.engine = test_engine
    database.SessionLocal = TestSessionLocal

    app.dependency_overrides[verify_api_key] = override_verify_api_key
    app.dependency_overrides[get_db] = override_get_db

    # Execute schema setup & custom migrations
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    from db_utils import run_schema_migrations
    run_schema_migrations(test_engine)

    from unittest.mock import patch, MagicMock
    with patch("celery.app.task.Task.delay") as mock_delay:
        mock_delay.return_value = MagicMock(id="mock-task-id")
        yield

    app.dependency_overrides = orig_overrides
    database.engine = orig_engine
    database.SessionLocal = orig_sessionlocal


def test_user_creation_default_permissions():
    """Verify that a newly registered user gets correct default permissions."""
    db = TestSessionLocal()
    # Streaming: True, Scraping: False, Ripping: False by default
    user = User(
        id="usr_test_user_99",
        username="test_perm_user",
        password_hash="hashed_pw",
        role="user"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    perms = user.permissions
    assert perms["can_stream"] is True
    assert perms["can_scrape"] is False
    assert perms["can_rip"] is False
    db.close()


def test_global_feature_controls_blocking():
    """Verify that globally disabling a feature blocks everyone, including admins."""
    global active_auth_info
    db = TestSessionLocal()

    # 1. Disable scraping globally
    setting = Settings(key="scraping_enabled", value="false")
    db.add(setting)
    db.commit()

    # 2. Try scraping as Master Key (super admin)
    active_auth_info = {"type": "master_key"}
    response = client.post("/external-api/scrape", json={"url": "https://example.com/item", "recipe_id": 1})
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]

    # 3. Enable scraping globally, verify it is allowed
    setting.value = "true"
    db.commit()

    response = client.post("/external-api/scrape", json={"url": "https://example.com/item", "recipe_id": 1})
    # Since SSRF or recipe validation fails, we should expect either 200 or SSRF block (e.g. 200 or 400), but NOT 403
    assert response.status_code != 403

    db.close()


def test_granular_per_user_permissions():
    """Verify that per-user override permissions are checked correctly."""
    global active_auth_info
    db = TestSessionLocal()

    # Create a normal user with scraping disabled, but ripping enabled
    user = User(
        id="usr_normal_1",
        username="normal_user",
        password_hash="hashed_pw",
        role="user",
        permissions={"can_stream": True, "can_scrape": False, "can_rip": True}
    )
    db.add(user)

    # Enable all global settings
    db.add(Settings(key="scraping_enabled", value="true"))
    db.add(Settings(key="ripping_enabled", value="true"))
    db.commit()

    # Set auth context to this user
    active_auth_info = {"type": "jwt", "user": "normal_user", "role": "user"}

    # 1. Try scraping (should be blocked since can_scrape is False)
    response = client.post("/external-api/scrape", json={"url": "https://example.com/item", "recipe_id": 1})
    assert response.status_code == 403

    # 2. Try ripping / start download (should be allowed since can_rip is True)
    # Since provider doesn't exist, it should return 404, but NOT 403!
    response = client.post("/download/start", json={"provider_id": 1, "url": "https://example.com/item"})
    assert response.status_code == 404

    # 3. Grant scraping to this user, verify allowed
    user.permissions = {"can_stream": True, "can_scrape": True, "can_rip": True}
    db.commit()

    response = client.post("/external-api/scrape", json={"url": "https://example.com/item", "recipe_id": 1})
    assert response.status_code != 403

    db.close()


def test_admin_logs_creation_and_listing():
    """Verify that admin actions log beautiful entries and are fetchable."""
    global active_auth_info
    db = TestSessionLocal()

    # Enable master key access
    active_auth_info = {"type": "master_key"}

    # 1. Create a user
    user = User(
        id="usr_normal_2",
        username="another_user",
        password_hash="hashed_pw",
        role="user"
    )
    db.add(user)
    db.commit()
    db.close()

    # 2. Update permissions via the admin route
    payload = {
        "role": "user",
        "permissions": {"can_stream": True, "can_scrape": True, "can_rip": True}
    }
    response = client.put("/auth/users/usr_normal_2/permissions", json=payload)
    assert response.status_code == 200

    # 3. Verify admin log was created
    db = TestSessionLocal()
    log = db.query(AdminLog).filter(AdminLog.action == "update_user_permissions").first()
    assert log is not None
    assert log.admin_username == "Master Key"
    assert log.details["target_username"] == "another_user"
    assert log.details["new_permissions"]["can_scrape"] is True
    db.close()

    # 4. Fetch logs through API
    response = client.get("/auth/admin-logs")
    assert response.status_code == 200
    logs = response.json()
    assert len(logs) > 0
    assert logs[0]["action"] == "update_user_permissions"
    assert logs[0]["admin_username"] == "Master Key"


def test_library_scheme_and_metadata_filters():
    """Verify that get_library_entries supports filtering by adheres_to_naming_scheme, has_metadata_match, has_chapters, and has_facial_clusters."""
    global active_auth_info
    db = TestSessionLocal()

    # Create dummy library entries with varying attributes
    entry1 = LibraryEntry(
        provider_id=1,
        title="Valid video",
        file_path="/media/valid.mp4",
        adheres_to_naming_scheme=True,
        has_metadata_match=True,
        has_chapters=True,
        has_facial_clusters=True,
    )
    entry2 = LibraryEntry(
        provider_id=1,
        title="Invalid video",
        file_path="/media/invalid.mp4",
        adheres_to_naming_scheme=False,
        has_metadata_match=False,
        has_chapters=False,
        has_facial_clusters=False,
    )
    db.add(entry1)
    db.add(entry2)
    db.commit()
    db.close()

    active_auth_info = {"type": "master_key"}

    # 1. Filter by adheres_to_naming_scheme=True
    resp = client.get("/library/?adheres_to_naming_scheme=true")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["title"] == "Valid video"

    # 2. Filter by adheres_to_naming_scheme=False
    resp = client.get("/library/?adheres_to_naming_scheme=false")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["title"] == "Invalid video"

    # 3. Filter by has_metadata_match=True
    resp = client.get("/library/?has_metadata_match=true")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # 4. Filter by has_chapters=True
    resp = client.get("/library/?has_chapters=true")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


