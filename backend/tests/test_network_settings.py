import os

os.environ["DATABASE_URL"] = "sqlite:///file:testdb_network?mode=memory&cache=shared"

import database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from sqlalchemy.pool import StaticPool

test_engine = create_engine(
    "sqlite:///file:testdb_network?mode=memory&cache=shared",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

from models import Base, Settings, Vault
from utils import initialize_network_settings
import db_utils
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app
from dependencies import verify_api_key

# Override auth dependency to allow testing router directly in a clean fixture
@pytest.fixture(autouse=True)
def setup_dependencies():
    orig_overrides = dict(app.dependency_overrides)
    app.dependency_overrides[verify_api_key] = lambda: {"type": "mock", "user": "admin"}
    yield
    app.dependency_overrides = orig_overrides

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    database.engine = test_engine
    database.SessionLocal = TestSessionLocal
    db_utils.SessionLocal = TestSessionLocal
    Base.metadata.create_all(bind=test_engine)
    # Clear tables to avoid conflicts
    with db_utils.get_db_session() as db:
        db.query(Settings).delete()
        db.query(Vault).delete()
        db.commit()
    # Clear environment variables in case they leak
    os.environ.pop("HTTP_PROXY", None)
    os.environ.pop("HTTPS_PROXY", None)
    os.environ.pop("ALL_PROXY", None)
    os.environ.pop("GLOBAL_PROXY_URL", None)
    os.environ.pop("GLOBAL_PROXY_ENABLED", None)
    os.environ.pop("DEFAULT_USER_AGENT", None)
    yield


def test_initialize_network_settings_disabled():
    # Setup db with proxy disabled but user agent set
    with db_utils.get_db_session() as db:
        db.add(Settings(key="global_proxy_enabled", value="false"))
        db.add(Settings(key="global_user_agent", value="TestAgent/1.0"))
        db.commit()

    initialize_network_settings()

    assert "HTTP_PROXY" not in os.environ
    assert os.getenv("DEFAULT_USER_AGENT") == "TestAgent/1.0"


def test_initialize_network_settings_enabled_plain():
    # Setup db with proxy enabled but stored in plain Settings (fallback check)
    with db_utils.get_db_session() as db:
        db.add(Settings(key="global_proxy_enabled", value="true"))
        db.add(Settings(key="global_proxy_url", value="http://12.34.56.78:3128"))
        db.commit()

    initialize_network_settings()

    assert os.getenv("HTTP_PROXY") == "http://12.34.56.78:3128"
    assert os.getenv("GLOBAL_PROXY_ENABLED") == "true"


@patch("security.decrypt_data")
def test_initialize_network_settings_enabled_secure(mock_decrypt):
    mock_decrypt.return_value = "socks5://user:pass@12.34.56.78:1080"

    with db_utils.get_db_session() as db:
        db.add(Settings(key="global_proxy_enabled", value="true"))
        # Add secure vault item
        db.add(
            Vault(
                entity_type="global_setting",
                entity_id=0,
                key="global_proxy_url",
                encrypted_value="encrypted_data",
            )
        )
        db.commit()

    initialize_network_settings()

    assert os.getenv("HTTP_PROXY") == "socks5://user:pass@12.34.56.78:1080"
    assert os.getenv("GLOBAL_PROXY_ENABLED") == "true"


@patch("requests.Session.get")
def test_network_diagnostic_online(mock_get):
    # Mock responses
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"ip": "192.168.1.1"}
    mock_get.return_value = mock_response

    response = client.get("/settings/network/diagnostic")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["public_ip"] == "192.168.1.1"
    assert data["proxy_configured"] is False


@patch("requests.Session.get")
def test_network_diagnostic_offline(mock_get):
    # Mock connection failure
    mock_get.side_effect = Exception("Connection timed out")

    response = client.get("/settings/network/diagnostic")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "offline"
    assert "timed out" in data["error"].lower()


def test_celery_prerun_signal_network_settings():
    from celery_app import on_task_prerun

    with db_utils.get_db_session() as db:
        db.add(Settings(key="global_proxy_enabled", value="true"))
        db.add(Settings(key="global_proxy_url", value="http://12.34.56.78:3128"))
        db.commit()

    # Clear before call
    os.environ.pop("HTTP_PROXY", None)

    # Trigger signal handler
    on_task_prerun(sender=None, task_id="test-task-id", task=None)

    assert os.getenv("HTTP_PROXY") == "http://12.34.56.78:3128"
