import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Mock the database dependency before importing main
import sys
sys.modules['database'] = MagicMock()
sys.modules['db_utils'] = MagicMock()
sys.modules['services.scraper'] = MagicMock()
sys.modules['croniter'] = MagicMock()

from main import app

client = TestClient(app)

@patch("routers.external_api.requests.post")
def test_theporndb_query_graphql(mock_post):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "data": {
            "searchScenes": {
                "data": [
                    {
                        "id": "1",
                        "title": "Test Scene",
                        "details": "Details",
                        "date": "2023-01-01",
                        "tags": [{"name": "tag1"}],
                        "performers": [{"performer": {"name": "Actor 1"}}],
                        "studio": {"name": "Test Studio"}
                    }
                ]
            }
        }
    }
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    response = client.post(
        "/external-api/theporndb/query",
        json={"query": "Test Scene"},
        headers={"x-api-key": "testkey"}
    )
    if response.status_code != 200:
        print("ERROR 500:", response.text)

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["title"] == "Test Scene"
    assert data["results"][0]["performers"] == ["Actor 1"]
    assert data["results"][0]["tags"] == ["tag1"]


@patch("routers.external_api.requests.post")
def test_theporndb_performer_graphql(mock_post):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "data": {
            "searchPerformers": {
                "data": [
                    {
                        "id": "p1",
                        "name": "Actor 1",
                        "bio": "A bio.",
                        "aliases": ["A1"],
                        "gender": "Female",
                        "cup_size": "C",
                        "measurements": "34C-24-34",
                        "image": "url"
                    }
                ]
            }
        }
    }
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    response = client.post(
        "/external-api/theporndb/performer",
        json={"name": "Actor 1"},
        headers={"x-api-key": "testkey"}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["name"] == "Actor 1"
    assert data["results"][0]["bio"] == "A bio."


@patch("routers.external_api.requests.post")
def test_stashdb_query_fingerprint(mock_post):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "data": {
            "findScenes": {
                "scenes": [
                    {
                        "id": "s1",
                        "title": "Stash Scene",
                        "details": "Details",
                        "date": "2023-01-01",
                        "performers": [{"performer": {"name": "Stash Actor"}}]
                    }
                ]
            }
        }
    }
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    response = client.post(
        "/external-api/stashdb/query",
        json={"hash": "abcdef123456"},
        headers={"x-api-key": "testkey"}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["title"] == "Stash Scene"
    assert data["results"][0]["performers"][0]["name"] == "Stash Actor"
    # Verify fingerprint query was sent
    call_kwargs = mock_post.call_args.kwargs
    assert "fingerprints" in call_kwargs["json"]["query"]
    assert call_kwargs["json"]["variables"]["hash"] == "abcdef123456"
