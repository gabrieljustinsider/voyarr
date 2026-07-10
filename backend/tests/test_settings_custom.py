import os

os.environ["DATABASE_URL"] = "sqlite:///file:testdb_temp?mode=memory&cache=shared"
from unittest.mock import patch

from fastapi.testclient import TestClient
from main import app
from dependencies import verify_api_key


import pytest

# Override auth dependency to allow testing router directly in a clean fixture
@pytest.fixture(autouse=True)
def setup_dependencies():
    orig_overrides = dict(app.dependency_overrides)
    app.dependency_overrides[verify_api_key] = lambda: {"type": "mock", "user": "admin"}
    yield
    app.dependency_overrides = orig_overrides

client = TestClient(app)


@patch("os.path.exists")
@patch("os.path.isdir")
@patch("os.path.abspath")
@patch("os.listdir")
@patch("os.path.getsize")
def test_settings_browse_endpoint(
    mock_getsize, mock_listdir, mock_abspath, mock_isdir, mock_exists
):
    mock_exists.return_value = True
    # mock folders as having no suffix, files as having .txt
    mock_isdir.side_effect = lambda path: not path.endswith(".txt")
    mock_abspath.side_effect = lambda path: path
    mock_listdir.return_value = ["movies", "downloads", "readme.txt"]
    mock_getsize.return_value = 1024

    response = client.get("/settings/browse?path=/media")
    assert response.status_code == 200

    data = response.json()
    assert data["current_path"] == "/media"
    assert len(data["folders"]) == 2
    assert data["folders"][0]["name"] == "downloads"
    assert data["folders"][1]["name"] == "movies"
    assert len(data["files"]) == 1
    assert data["files"][0]["name"] == "readme.txt"
    assert data["files"][0]["size"] == 1024


@patch("os.path.exists")
@patch("os.path.isdir")
@patch("os.path.abspath")
@patch("os.listdir")
def test_settings_autocomplete_endpoint(
    mock_listdir, mock_abspath, mock_isdir, mock_exists
):
    mock_exists.return_value = True
    mock_isdir.side_effect = lambda path: not path.endswith(".txt")
    mock_abspath.side_effect = lambda path: path
    mock_listdir.return_value = ["movies", "music", "readme.txt"]

    response = client.get("/settings/autocomplete?q=/media/m")
    assert response.status_code == 200

    data = response.json()
    assert "suggestions" in data
    # Suggestions that start with "m" under "/media"
    suggestions = data["suggestions"]
    assert len(suggestions) == 2
    assert suggestions[0]["name"] == "movies"
    assert suggestions[1]["name"] == "music"


def test_validate_path_endpoint():
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        response = client.get(f"/settings/validate-path?path={tmpdir}")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["exists"] is True
        assert data["readable"] is True
        assert data["writable"] is True

    # Test with non-existing path under valid parent
    non_existing = os.path.join(tempfile.gettempdir(), "non_existing_perm_test_dir")
    try:
        response = client.get(f"/settings/validate-path?path={non_existing}")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is False
        assert data["writable"] is True
    finally:
        if os.path.exists(non_existing):
            import shutil
            if os.path.isdir(non_existing):
                shutil.rmtree(non_existing)
            else:
                os.remove(non_existing)
