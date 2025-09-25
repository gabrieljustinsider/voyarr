from unittest.mock import MagicMock, patch
import sys

# Mock database and other complex submodules before importing main
orig_modules = {}
for name in ['database', 'db_utils', 'services.scraper', 'croniter']:
    orig_modules[name] = sys.modules.get(name)
    sys.modules[name] = MagicMock()

from fastapi.testclient import TestClient
from main import app
from dependencies import verify_api_key

# Restore original modules
for name, orig in orig_modules.items():
    if orig is None:
        sys.modules.pop(name, None)
    else:
        sys.modules[name] = orig

# Override auth dependency to allow testing router directly
app.dependency_overrides[verify_api_key] = lambda: {"type": "mock", "user": "admin"}

client = TestClient(app)

@patch("os.path.exists")
@patch("os.path.isdir")
@patch("os.path.abspath")
@patch("os.listdir")
@patch("os.path.getsize")
def test_settings_browse_endpoint(mock_getsize, mock_listdir, mock_abspath, mock_isdir, mock_exists):
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
def test_settings_autocomplete_endpoint(mock_listdir, mock_abspath, mock_isdir, mock_exists):
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
