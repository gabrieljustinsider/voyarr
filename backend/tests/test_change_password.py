import os

# Configure test database in memory
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_change_password?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import database
from main import app
from database import get_db
from models import Base, User
from routers.auth import get_current_user
from security import get_password_hash, verify_password

# Set up test DB
test_engine = create_engine(
    "sqlite:///file:testdb_change_password?mode=memory&cache=shared",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal

client = TestClient(app)

# Global test user reference for current user override
test_user_instance = None

def override_get_current_user():
    if test_user_instance is None:
        raise Exception("Test user not initialized")
    return test_user_instance

def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def setup_db_and_dependencies():
    global test_user_instance
    Base.metadata.create_all(bind=test_engine)
    
    # Initialize a test user in DB
    db = TestSessionLocal()
    hashed = get_password_hash("old_password_123!")
    user = User(
        username="change_password_tester",
        password_hash=hashed,
        role="user",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    test_user_instance = user
    db.close()

    orig_overrides = dict(app.dependency_overrides)
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db
    
    yield
    
    app.dependency_overrides = orig_overrides
    Base.metadata.drop_all(bind=test_engine)

def test_change_password_success():
    """Verify that a user can change their password successfully when providing the correct current password."""
    payload = {
        "current_password": "old_password_123!",
        "new_password": "new_secure_password_567!@#"
    }
    response = client.post("/auth/change-password", json=payload)
    assert response.status_code == 200
    assert response.json()["message"] == "Password changed successfully"

    # Query the user from the DB and verify their password hash is updated
    db = TestSessionLocal()
    user = db.query(User).filter(User.username == "change_password_tester").first()
    assert user is not None
    assert verify_password("new_secure_password_567!@#", str(user.password_hash)) is True
    assert verify_password("old_password_123!", str(user.password_hash)) is False
    db.close()

def test_change_password_incorrect_current():
    """Verify that password change fails when incorrect current password is provided."""
    payload = {
        "current_password": "wrong_old_password",
        "new_password": "new_secure_password_567!@#"
    }
    response = client.post("/auth/change-password", json=payload)
    assert response.status_code == 400
    assert "Incorrect current password" in response.json()["detail"]

    # Verify password was not changed
    db = TestSessionLocal()
    user = db.query(User).filter(User.username == "change_password_tester").first()
    assert user is not None
    assert verify_password("old_password_123!", str(user.password_hash)) is True
    db.close()
