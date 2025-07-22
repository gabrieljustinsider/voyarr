from unittest.mock import MagicMock
import sys

# Mock dependencies before importing main
sys.modules['database'] = MagicMock()
sys.modules['db_utils'] = MagicMock()
sys.modules['services.scraper'] = MagicMock()
sys.modules['croniter'] = MagicMock()

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
