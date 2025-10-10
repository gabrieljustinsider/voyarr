import os
import sys

# Configure test database in memory
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_sso?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import database
from main import app
from database import SessionLocal, get_db
from models import Base, User, SsoLink
from routers.auth import get_current_user

# Set up test DB
test_engine = create_engine(
    "sqlite:///file:testdb_sso?mode=memory&cache=shared",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal

class MockUser:
    id = "usr_sso_test_42"
    username = "sso_user"
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
    # Create test user WITH a password hash
    user = User(
        id="usr_sso_test_42",
        username="sso_user",
        role="admin",
        password_hash="dummy_password_hash",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.close()
    
    yield
    app.dependency_overrides = orig_overrides


def test_sso_linking_and_login():
    # 1. Links should be empty initially
    links_res = client.get("/auth/sso/links")
    assert links_res.status_code == 200
    assert len(links_res.json()) == 0
    
    # 2. Link Google Account
    link_payload = {
        "provider": "google",
        "provider_user_id": "google_123456789",
        "email": "user@gmail.com",
        "token": "google_mock_token"
    }
    link_res = client.post("/auth/sso/link", json=link_payload)
    assert link_res.status_code == 200
    assert "linked successfully" in link_res.json()["message"]
    
    # 3. Check listed links
    links_res2 = client.get("/auth/sso/links")
    assert len(links_res2.json()) == 1
    assert links_res2.json()[0]["provider"] == "google"
    assert links_res2.json()[0]["email"] == "user@gmail.com"
    
    # 4. Attempt to link the same SSO to another user (should fail)
    # Mock a different user in context
    class MockOtherUser:
        id = "usr_sso_other"
        username = "other_sso_user"
        role = "user"
        is_active = True
        password_hash = "other_hash"
    
    app.dependency_overrides[get_current_user] = lambda: MockOtherUser()
    
    link_other_res = client.post("/auth/sso/link", json=link_payload)
    assert link_other_res.status_code == 400
    assert "already linked to another" in link_other_res.json()["detail"]
    
    # Restore original mock user override
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    # 5. SSO Login
    login_payload = {
        "provider": "google",
        "provider_user_id": "google_123456789",
        "token": "google_mock_token"
    }
    login_res = client.post("/auth/sso/login", json=login_payload)
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()
    assert login_res.json()["username"] == "sso_user"
    
    # 6. Link GitHub
    link_payload_github = {
        "provider": "github",
        "provider_user_id": "github_987654321",
        "email": "user@github.com",
    }
    client.post("/auth/sso/link", json=link_payload_github)
    
    links_res3 = client.get("/auth/sso/links")
    assert len(links_res3.json()) == 2
    
    # 7. Unlink Google
    unlink_res = client.post("/auth/sso/unlink/google")
    assert unlink_res.status_code == 200
    assert "unlinked successfully" in unlink_res.json()["message"]
    
    # 8. Test Lockout Safeguard
    # Let's temporarily strip the password hash of the mock user to simulate an SSO-only user,
    # and make sure they have no passkeys.
    db = TestSessionLocal()
    user_db = db.query(User).filter(User.id == "usr_sso_test_42").first()
    user_db.password_hash = ""  # Strip password
    db.commit()
    db.close()
    
    # Force MockUser in route context to have no password
    mock_user.password_hash = ""
    
    # Now try unlinking the last SSO provider (GitHub)
    # This should fail with 400 Bad Request safeguard!
    unlink_last_res = client.post("/auth/sso/unlink/github")
    assert unlink_last_res.status_code == 400
    assert "Cannot unlink the last authentication method" in unlink_last_res.json()["detail"]
    
    # Clean up user password hash just in case
    db = TestSessionLocal()
    user_db = db.query(User).filter(User.id == "usr_sso_test_42").first()
    user_db.password_hash = "dummy_password_hash"
    db.commit()
    db.close()
