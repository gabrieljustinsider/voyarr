import os

# Configure test database in memory
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_auth_policies?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import database
from main import app
from database import get_db
from models import Base, User, Settings
from routers.auth import get_current_user

# Set up test DB
test_engine = create_engine(
    "sqlite:///file:testdb_auth_policies?mode=memory&cache=shared",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal


class MockUser:
    id = "usr_policy_test_42"
    username = "policy_user"
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

    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    db = TestSessionLocal()
    user = User(
        id="usr_policy_test_42",
        username="policy_user",
        role="admin",
        password_hash="dummy_password_hash",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.close()

    yield
    app.dependency_overrides = orig_overrides


# ─── GET /auth/config ────────────────────────────────────────────────────────


def test_auth_config_defaults():
    """GET /auth/config returns correct defaults when no settings exist."""
    response = client.get("/auth/config")
    assert response.status_code == 200
    data = response.json()
    assert data["passkeys_enabled"] is True
    assert data["sso_enabled"] is False
    assert data["oidc_enabled"] is False
    assert data["auth_bypass_enabled"] is False
    assert data["auth_bypass_proxy_header_enabled"] is False


def test_auth_config_custom():
    """GET /auth/config reflects inserted settings rows."""
    db = TestSessionLocal()
    db.add(Settings(key="passkeys_enabled", value="false"))
    db.add(Settings(key="sso_enabled", value="true"))
    db.add(Settings(key="oidc_enabled", value="true"))
    db.add(Settings(key="auth_bypass_enabled", value="true"))
    db.add(Settings(key="auth_bypass_proxy_header_enabled", value="true"))
    db.commit()
    db.close()

    response = client.get("/auth/config")
    assert response.status_code == 200
    data = response.json()
    assert data["passkeys_enabled"] is False
    assert data["sso_enabled"] is True
    assert data["oidc_enabled"] is True
    assert data["auth_bypass_enabled"] is True
    assert data["auth_bypass_proxy_header_enabled"] is True


# ─── SSO Policy Guard ────────────────────────────────────────────────────────


def test_sso_disabled_blocks_link():
    """POST /auth/sso/link returns 400 when sso_enabled is not set (default disabled)."""
    payload = {
        "provider": "google",
        "provider_user_id": "google_111",
        "email": "test@gmail.com",
    }
    response = client.post("/auth/sso/link", json=payload)
    assert response.status_code == 400
    assert "disabled" in response.json()["detail"].lower()


def test_sso_enabled_allows_link():
    """POST /auth/sso/link works when sso_enabled is set to true."""
    db = TestSessionLocal()
    db.add(Settings(key="sso_enabled", value="true"))
    db.commit()
    db.close()

    payload = {
        "provider": "google",
        "provider_user_id": "google_222",
        "email": "test@gmail.com",
    }
    response = client.post("/auth/sso/link", json=payload)
    assert response.status_code == 200
    assert "linked successfully" in response.json()["message"]


# ─── Passkeys Policy Guard ──────────────────────────────────────────────────


def test_passkeys_disabled_blocks_register():
    """POST /auth/passkeys/register/options returns 400 when passkeys_enabled is false."""
    db = TestSessionLocal()
    db.add(Settings(key="passkeys_enabled", value="false"))
    db.commit()
    db.close()

    response = client.post("/auth/passkeys/register/options")
    assert response.status_code == 400
    assert "disabled" in response.json()["detail"].lower()


# ─── POST /auth/autologin ────────────────────────────────────────────────────


def test_autologin_no_bypass():
    """POST /auth/autologin returns 401 when bypass is disabled (default)."""
    response = client.post("/auth/autologin")
    assert response.status_code == 401
    assert "criteria not met" in response.json()["detail"].lower()


def test_autologin_subnet_match():
    """POST /auth/autologin succeeds from a trusted IP within the configured subnet."""
    db = TestSessionLocal()
    db.add(Settings(key="auth_bypass_enabled", value="true"))
    db.add(Settings(key="auth_bypass_subnets", value="127.0.0.0/8"))
    db.add(Settings(key="auth_bypass_default_user", value="policy_user"))
    db.commit()
    db.close()

    response = client.post(
        "/auth/autologin",
        headers={"X-Forwarded-For": "127.0.0.1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["method"] == "trusted_subnet"
    assert data["username"] == "policy_user"
    assert "access_token" in data


def test_autologin_subnet_no_match():
    """POST /auth/autologin fails from an IP outside the trusted subnet."""
    db = TestSessionLocal()
    db.add(Settings(key="auth_bypass_enabled", value="true"))
    db.add(Settings(key="auth_bypass_subnets", value="10.0.0.0/8"))
    db.add(Settings(key="auth_bypass_default_user", value="policy_user"))
    db.commit()
    db.close()

    response = client.post(
        "/auth/autologin",
        headers={"X-Forwarded-For": "192.168.1.50"},
    )
    assert response.status_code == 401
    assert "criteria not met" in response.json()["detail"].lower()


def test_autologin_proxy_header():
    """POST /auth/autologin succeeds with matching proxy header and auto-provisions user."""
    db = TestSessionLocal()
    db.add(Settings(key="auth_bypass_proxy_header_enabled", value="true"))
    db.add(Settings(key="auth_bypass_proxy_header_name", value="Remote-User"))
    db.commit()
    db.close()

    response = client.post(
        "/auth/autologin",
        headers={"Remote-User": "policy_user"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["method"] == "proxy_header"
    assert data["username"] == "policy_user"
    assert "access_token" in data
