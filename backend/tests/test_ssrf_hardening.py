import os

# Configure test database in memory
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_ssrf?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import database
from main import app
from database import get_db
from models import Base, Provider, Webhook, LiveStream, SiteRecipe
from routers.auth import get_current_user
from utils import validate_url_ssrf
from services.webhook_service import WebhookService

from sqlalchemy.pool import StaticPool

# Set up test DB
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal


class MockUser:
    id = "usr_ssrf_test_42"
    username = "ssrf_admin"
    role = "admin"
    is_active = True
    password_hash = "dummy_password_hash"


mock_user = MockUser()


def override_get_current_user():
    return mock_user


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db_and_dependencies():
    orig_overrides = dict(app.dependency_overrides)
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db

    import database
    import db_utils

    orig_engine = database.engine
    orig_sessionlocal = database.SessionLocal
    orig_db_utils_sessionlocal = getattr(db_utils, "SessionLocal", None)

    # Force environmental MASTER_KEY for this test suite
    orig_master_key = os.environ.get("MASTER_KEY")
    os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"

    database.engine = test_engine
    database.SessionLocal = TestSessionLocal
    db_utils.SessionLocal = TestSessionLocal

    # Dynamically override any get_db or get_current_user dependencies on all routes
    for route in app.routes:
        if hasattr(route, "dependant") and route.dependant:
            for dep in route.dependant.dependencies:
                if dep.call and hasattr(dep.call, "__name__"):
                    if dep.call.__name__ == "get_db":
                        app.dependency_overrides[dep.call] = override_get_db
                    elif dep.call.__name__ == "get_current_user":
                        app.dependency_overrides[dep.call] = override_get_current_user

    # Create tables
    Base.metadata.create_all(bind=test_engine)

    # Seed master credentials & providers
    db = TestSessionLocal()
    db.query(Webhook).delete()
    db.query(LiveStream).delete()
    db.query(Provider).delete()
    db.query(SiteRecipe).delete()
    
    provider = Provider(id=1, name="Test Provider", base_url="https://example.com")
    db.add(provider)
    db.commit()

    recipe = SiteRecipe(id=1, provider_id=1, css_selectors={})
    db.add(recipe)
    
    from models import Settings
    db.add(Settings(key="scraping_enabled", value="true"))
    db.commit()

    yield

    db.close()
    # Clean up tables
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides = orig_overrides
    database.engine = orig_engine
    database.SessionLocal = orig_sessionlocal
    if orig_db_utils_sessionlocal is not None:
        db_utils.SessionLocal = orig_db_utils_sessionlocal

    if orig_master_key is not None:
        os.environ["MASTER_KEY"] = orig_master_key
    else:
        os.environ.pop("MASTER_KEY", None)


# ==============================================================================
# 1. Direct Utility Tests
# ==============================================================================

def test_validate_url_ssrf_allowed(monkeypatch):
    import socket
    # Mock socket.getaddrinfo to resolve these test hosts to a public IP
    def mock_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if host in ["google.com", "github.com", "example.com"]:
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 80))]
        raise socket.gaierror(-2, "Name or service not known")
    monkeypatch.setattr(socket, "getaddrinfo", mock_getaddrinfo)

    # Public domains should pass
    validate_url_ssrf("https://google.com")
    validate_url_ssrf("https://github.com")
    validate_url_ssrf("http://example.com/some/path")


def test_validate_url_ssrf_blocked_loopbacks():
    # loopback IPs and hosts should be blocked
    with pytest.raises(HTTPException) as exc:
        validate_url_ssrf("http://127.0.0.1")
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        validate_url_ssrf("https://localhost:8000/endpoint")
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        validate_url_ssrf("http://[::1]")
    assert exc.value.status_code == 400


def test_validate_url_ssrf_blocked_private_subnets():
    # RFC 1918 private subnets should be blocked
    with pytest.raises(HTTPException) as exc:
        validate_url_ssrf("http://192.168.1.1")
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        validate_url_ssrf("http://10.0.0.1/admin")
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        validate_url_ssrf("http://172.16.0.1")
    assert exc.value.status_code == 400


def test_validate_url_ssrf_blocked_metadata_endpoint():
    # Link-local / Cloud Metadata IPs should be blocked
    with pytest.raises(HTTPException) as exc:
        validate_url_ssrf("http://169.254.169.254/latest/meta-data/")
    assert exc.value.status_code == 400


# ==============================================================================
# 2. Webhooks Route & Service Boundary Tests
# ==============================================================================

def test_webhook_creation_allowed():
    headers = {"X-Voyarr-Api-Key": "test_master_key_1234567890_abcdef"}
    payload = {"name": "Public Slack Webhook", "url": "https://hooks.slack.com/services/test"}
    resp = client.post("/webhooks/", json=payload, headers=headers)
    assert resp.status_code == 200


def test_webhook_creation_blocked():
    headers = {"X-Voyarr-Api-Key": "test_master_key_1234567890_abcdef"}
    payload = {"name": "Malicious Local Webhook", "url": "http://127.0.0.1:8000/settings"}
    resp = client.post("/webhooks/", json=payload, headers=headers)
    assert resp.status_code == 400
    assert "Disallowed internal IP" in resp.json()["detail"]


def test_webhook_trigger_ssrf_protection(mocker):
    # Add a webhook with an internal loopback URL to the DB manually (bypassing validation on creation)
    db = TestSessionLocal()
    wh = Webhook(name="Sneaky Webhook", url="http://localhost:8000/destruct", is_active=True)
    db.add(wh)
    db.commit()
    db.close()

    mock_post = mocker.patch("requests.post")
    mock_logger = mocker.patch("services.webhook_service.logger.warning")

    # Trigger webhook service
    WebhookService.trigger("media.added", {"title": "Test Title"})

    # Requests should NOT have been made and the warning logger should have been fired
    mock_post.assert_not_called()
    mock_logger.assert_called_once()
    assert "SSRF blocked" in mock_logger.call_args[0][0]


# ==============================================================================
# 3. Live Stream Route SSRF Boundary Tests
# ==============================================================================

def test_live_stream_creation_allowed():
    headers = {"X-Voyarr-Api-Key": "test_master_key_1234567890_abcdef"}
    payload = {"name": "Public RTMP Stream", "url": "rtmp://publicstream.com/live"}
    resp = client.post("/live-streams/", json=payload, headers=headers)
    assert resp.status_code == 201

    payload_http = {"name": "Public HTTP Stream", "url": "https://stream.public.com/hls.m3u8"}
    resp = client.post("/live-streams/", json=payload_http, headers=headers)
    assert resp.status_code == 201


def test_live_stream_creation_blocked():
    headers = {"X-Voyarr-Api-Key": "test_master_key_1234567890_abcdef"}
    payload = {"name": "Malicious Internal Stream", "url": "http://192.168.0.10:8000/stream.m3u8"}
    resp = client.post("/live-streams/", json=payload, headers=headers)
    assert resp.status_code == 400
    assert "Disallowed internal IP" in resp.json()["detail"]


def test_live_stream_update_blocked():
    db = TestSessionLocal()
    stream = LiveStream(id=1, name="Safe Stream", url="https://example.com/safe.m3u8", status="idle")
    db.add(stream)
    db.commit()
    db.close()

    headers = {"X-Voyarr-Api-Key": "test_master_key_1234567890_abcdef"}
    payload = {"name": "Renamed Stream", "url": "http://127.0.0.1:80/stream.m3u8"}
    resp = client.put("/live-streams/1", json=payload, headers=headers)
    assert resp.status_code == 400
    assert "Disallowed internal IP" in resp.json()["detail"]


# ==============================================================================
# 4. Scraper Test Route SSRF Boundary Tests
# ==============================================================================

def test_scraper_test_allowed():
    headers = {"X-Voyarr-Api-Key": "test_master_key_1234567890_abcdef"}
    payload = {"url": "https://my-media-source.com/video123", "provider_id": 1}
    resp = client.post("/scraper/test", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


def test_scraper_test_blocked():
    headers = {"X-Voyarr-Api-Key": "test_master_key_1234567890_abcdef"}
    payload = {"url": "http://169.254.169.254/latest/meta-data/", "provider_id": 1}
    resp = client.post("/scraper/test", json=payload, headers=headers)
    assert resp.status_code == 400
    assert "Disallowed internal IP" in resp.json()["detail"]
