import os

os.environ["DATABASE_URL"] = "sqlite:///file:testdb_temp_pairing?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key"
os.environ["SECRET_KEY"] = "test_jwt_secret_key"

from fastapi.testclient import TestClient
from main import app
from database import Base, engine

client = TestClient(app)

# Create the SQLite tables
Base.metadata.create_all(bind=engine)

def test_pairing_flow():
    # 1. Initiate pairing (requires authentication, we bypass with MASTER_KEY)
    headers = {"X-Voyarr-Api-Key": "test_master_key"}
    response = client.post("/api/auth/pair/initiate", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "pairing_code" in data
    assert len(data["pairing_code"]) == 6
    pairing_code = data["pairing_code"]

    # 2. Confirm pairing with the code (Unauthenticated)
    confirm_response = client.post("/api/auth/pair/confirm", json={"pairing_code": pairing_code})
    assert confirm_response.status_code == 200
    confirm_data = confirm_response.json()
    assert confirm_data["status"] == "success"
    assert "raw_key" in confirm_data
    assert confirm_data["raw_key"].startswith("vyr_lens_")

    # 3. Try to confirm again (should fail)
    fail_response = client.post("/api/auth/pair/confirm", json={"pairing_code": pairing_code})
    assert fail_response.status_code == 400
