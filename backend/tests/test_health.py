import os

os.environ["DATABASE_URL"] = "sqlite:///file:testdb_temp?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key"
os.environ["SECRET_KEY"] = "test_jwt_secret_key"

# Mock dependencies before importing main

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
