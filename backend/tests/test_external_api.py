import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Mock the database dependency before importing main

from main import app
from dependencies import verify_api_key


def override_verify_api_key():
    return {"type": "master_key"}


from models import Base, LibraryEntry, Subscription, Settings, Vault, Provider, SessionCookie
from database import SessionLocal

# Override auth dependency in a clean fixture
@pytest.fixture(autouse=True)
def setup_dependencies():
    with SessionLocal() as db:
        Base.metadata.create_all(bind=db.get_bind())
    orig_overrides = dict(app.dependency_overrides)
    app.dependency_overrides[verify_api_key] = override_verify_api_key
    yield
    app.dependency_overrides = orig_overrides

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
                        "studio": {"name": "Test Studio"},
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
        headers={"x-api-key": "testkey"},
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
                        "image": "url",
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
        headers={"x-api-key": "testkey"},
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
                        "performers": [{"performer": {"name": "Stash Actor"}}],
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
        headers={"x-api-key": "testkey"},
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


def test_stashdb_submit_fingerprint():
    # Test without API Key
    response = client.post(
        "/external-api/stashdb/submit-fingerprint",
        json={
            "scene_id": "stash-123",
            "hash": "abcdef123456",
            "algorithm": "OSHASH",
            "duration": 120,
        },
    )
    assert response.status_code == 400
    assert "Missing StashDB API Key" in response.json()["detail"]

    # Test with API Key
    response = client.post(
        "/external-api/stashdb/submit-fingerprint",
        json={
            "scene_id": "stash-123",
            "hash": "abcdef123456",
            "algorithm": "OSHASH",
            "duration": 120,
        },
        headers={"x-api-key": "testkey"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "Successfully submitted" in data["message"]
    assert "OSHASH" in data["message"]
    assert "abcdef123456" in data["message"]
    assert "stash-123" in data["message"]


def test_extract_with_xpath():
    from bs4 import BeautifulSoup
    from providers.base import ProviderBase

    class DummyProvider(ProviderBase):
        def login(self) -> bool:
            return True

        def scrape_metadata(self, url: str) -> dict:
            return {}

        def get_download_url(self, media_id: str) -> str:
            return ""

    provider = DummyProvider("http://example.com")
    html_content = """
    <html>
        <body>
            <div class="test-class">Hello World</div>
            <a href="http://link1.com">Link 1</a>
            <a href="http://link2.com">Link 2</a>
        </body>
    </html>
    """
    soup = BeautifulSoup(html_content, "html.parser")

    # Test tag extraction
    res = provider.extract_with_xpath(soup, "//div[@class='test-class']")
    assert res == ["Hello World"]

    # Test attribute extraction
    res_attrs = provider.extract_with_xpath(soup, "//a/@href")
    assert res_attrs == ["http://link1.com", "http://link2.com"]

    # Test text() extraction
    res_texts = provider.extract_with_xpath(soup, "//a/text()")
    assert res_texts == ["Link 1", "Link 2"]


from database import SessionLocal

def test_universal_search():
    with SessionLocal() as db_session:
        Base.metadata.create_all(bind=db_session.get_bind())
    # Test query searching OnlyFans and other sites
    response = client.post(
        "/external-api/universal-search",
        json={"query": "Eva Elfie"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "local" in data
    assert "stashdb" in data
    assert "theporndb" in data
    assert "subscriptions" in data
    
    # Verify subscriptions response
    subs = data["subscriptions"]
    assert len(subs) > 0
    of_matches = [s for s in subs if s["platform"] == "OnlyFans"]
    assert len(of_matches) > 0
    assert of_matches[0]["handle"] == "@eva_elfie"
    assert "cosplay" in of_matches[0]["tags"]
    # Check that smart performer cross referencing returned matches
    assert "Eva Elfie" in of_matches[0]["cross_referenced_performers"]

