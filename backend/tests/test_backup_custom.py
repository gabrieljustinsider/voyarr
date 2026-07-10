import os

os.environ["DATABASE_URL"] = "sqlite:///file:testdb_temp?mode=memory&cache=shared"
from unittest.mock import MagicMock
import json

from fastapi.testclient import TestClient
from main import app
from dependencies import verify_api_key
from database import get_db


import pytest

# Override auth dependency in a clean fixture
@pytest.fixture(autouse=True)
def setup_dependencies():
    orig_overrides = dict(app.dependency_overrides)
    app.dependency_overrides[verify_api_key] = lambda: {"type": "mock", "user": "admin"}
    yield
    app.dependency_overrides = orig_overrides

client = TestClient(app)


def test_backup_export_and_verify_cycle():
    # Mock database session
    mock_db = MagicMock()

    mock_mappings = MagicMock()
    mock_mappings.all.return_value = [{"id": 1, "key": "test_key", "value": "test_val"}]

    mock_execute = MagicMock()
    mock_execute.mappings.return_value = mock_mappings
    mock_db.execute.return_value = mock_execute

    app.dependency_overrides[get_db] = lambda: mock_db

    # 1. Export plaintext
    response = client.get("/backup/export?type=full")
    assert response.status_code == 200
    export_json = response.json()
    assert export_json["encrypted"] is False
    assert export_json["type"] == "full"
    assert "checksum" in export_json
    assert "signature" in export_json

    # 2. Verify plaintext backup
    # Simulate uploading the exported file
    file_payload = {
        "file": ("backup.json", json.dumps(export_json), "application/json")
    }
    verify_response = client.post("/backup/verify", files=file_payload)
    assert verify_response.status_code == 200
    verify_json = verify_response.json()
    assert verify_json["valid"] is True
    assert verify_json["encrypted"] is False

    # 3. Export encrypted
    response_enc = client.get("/backup/export?type=full&password=mypassword123")
    assert response_enc.status_code == 200
    export_enc_json = response_enc.json()
    assert export_enc_json["encrypted"] is True
    assert "ciphertext" in export_enc_json
    assert "salt" in export_enc_json

    # 4. Verify encrypted backup (fails without password)
    file_enc_payload = {
        "file": ("backup_enc.json", json.dumps(export_enc_json), "application/json")
    }
    verify_enc_response = client.post("/backup/verify", files=file_enc_payload)
    assert verify_enc_response.status_code == 200
    verify_enc_json = verify_enc_response.json()
    assert verify_enc_json["valid"] is True
    assert verify_enc_json["encrypted"] is True
    assert "passphrase required" in verify_enc_json["message"].lower()

    # 5. Verify encrypted backup (succeeds with password)
    verify_enc_pw_response = client.post(
        "/backup/verify?password=mypassword123", files=file_enc_payload
    )
    assert verify_enc_pw_response.status_code == 200
    verify_enc_pw_json = verify_enc_pw_response.json()
    assert verify_enc_pw_json["valid"] is True
    assert verify_enc_pw_json["encrypted"] is True
    assert verify_enc_pw_json["verified_signature"] is True
    assert "decrypted_data" in verify_enc_pw_json

    # 6. Verify tampered backup signature mismatch
    tampered_json = export_json.copy()
    tampered_json["signature"] = "invalid_signature_to_simulate_tampering"
    file_tampered_payload = {
        "file": ("backup_tampered.json", json.dumps(tampered_json), "application/json")
    }
    verify_tampered_response = client.post("/backup/verify", files=file_tampered_payload)
    assert verify_tampered_response.status_code == 200
    verify_tampered_json = verify_tampered_response.json()
    assert verify_tampered_json["valid"] is False
    assert "signature verification failed" in verify_tampered_json["message"].lower()
