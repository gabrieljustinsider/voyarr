import pytest
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Mock dependencies before importing main
import sys
sys.modules['database'] = MagicMock()
sys.modules['db_utils'] = MagicMock()
sys.modules['services.scraper'] = MagicMock()
sys.modules['nacl'] = MagicMock()
sys.modules['nacl.signing'] = MagicMock()
sys.modules['nacl.exceptions'] = MagicMock()
sys.modules['croniter'] = MagicMock()

from main import app
from database import get_db

def override_get_db():
    yield MagicMock()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture
def mock_db_session():
    mock_db = MagicMock()
    yield mock_db

@patch("routers.discord.verify_signature")
@patch("routers.discord.is_user_authorized")
def test_discord_interaction_ping(mock_auth, mock_verify, mock_db_session):
    mock_verify.return_value = True
    response = client.post(
        "/discord/interactions",
        json={"type": 1}
    )
    assert response.status_code == 200
    assert response.json() == {"type": 1}

@patch("routers.discord.verify_signature")
@patch("routers.discord.is_user_authorized")
def test_discord_interaction_unauthorized(mock_auth, mock_verify, mock_db_session):
    mock_verify.return_value = True
    mock_auth.return_value = False
    
    response = client.post(
        "/discord/interactions",
        json={
            "type": 2,
            "member": {"user": {"id": "12345", "username": "bad_user"}},
            "data": {"name": "search", "options": [{"name": "query", "value": "test"}]}
        }
    )
    
    assert response.status_code == 200
    assert "not authorized" in response.json()["data"]["content"]

@patch("routers.discord.verify_signature")
@patch("routers.discord.is_user_authorized")
@patch("routers.discord.scrape_url_task.delay")
def test_discord_interaction_scrape_authorized(mock_delay, mock_auth, mock_verify, mock_db_session):
    mock_verify.return_value = True
    mock_auth.return_value = True
    
    response = client.post(
        "/discord/interactions",
        json={
            "type": 2,
            "member": {"user": {"id": "99999", "username": "good_user"}},
            "data": {
                "name": "scrape", 
                "options": [
                    {"name": "url", "value": "http://example.com/video"},
                    {"name": "recipe_id", "value": "1"}
                ]
            }
        }
    )
    
    assert response.status_code == 200
    assert "Triggered scrape job" in response.json()["data"]["content"]
    mock_delay.assert_called_once_with("http://example.com/video", 1)
