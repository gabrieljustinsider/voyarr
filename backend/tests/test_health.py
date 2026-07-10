import os

os.environ["DATABASE_URL"] = "sqlite:///file:testdb_temp?mode=memory&cache=shared"

# Mock dependencies before importing main

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

    response_api = client.get("/api/health")
    assert response_api.status_code == 200
    assert response_api.json() == {"status": "healthy"}
