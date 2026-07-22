import os

os.environ["DATABASE_URL"] = "sqlite:///file:testdb_temp_pairing?mode=memory&cache=shared"

from fastapi.testclient import TestClient
from main import app
from models import Base
from database import engine

client = TestClient(app)

# Create the SQLite tables
Base.metadata.create_all(bind=engine)

# Seed a test user in the memory database
from database import SessionLocal
from models import User
from jose import jwt
from security import JWT_SECRET, ALGORITHM

db = SessionLocal()
existing_user = db.query(User).filter(User.username == "test_admin").first()
if not existing_user:
    test_user = User(
        id="test-user-id-123",
        username="test_admin",
        password_hash="mock_hash",
        role="admin",
        is_active=True
    )
    db.add(test_user)
    db.commit()
db.close()

# Generate a JWT token for the test user
token_data = {"sub": "test_admin", "role": "admin"}
test_jwt = jwt.encode(token_data, JWT_SECRET, algorithm=ALGORITHM)

def test_pairing_flow():
    # 1. Initiate pairing (requires authentication via JWT)
    headers = {
        "Authorization": f"Bearer {test_jwt}",
        "X-Voyarr-Api-Key": "test_master_key"
    }
    response = client.post("/auth/pair/initiate", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "pairing_code" in data
    assert len(data["pairing_code"]) == 6
    pairing_code = data["pairing_code"]

    # 2. Confirm pairing with the code (Unauthenticated)
    confirm_response = client.post("/auth/pair/confirm", json={"pairing_code": pairing_code})
    assert confirm_response.status_code == 200
    confirm_data = confirm_response.json()
    assert confirm_data["status"] == "success"
    assert "raw_key" in confirm_data
    assert confirm_data["raw_key"].startswith("vyr_lens_")

    # 3. Try to confirm again (should fail)
    fail_response = client.post("/auth/pair/confirm", json={"pairing_code": pairing_code})
    assert fail_response.status_code == 400
