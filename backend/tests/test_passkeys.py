import os
import sys
import base64
import json
import hashlib
from datetime import datetime, timezone

# Configure test database in memory
os.environ["DATABASE_URL"] = "sqlite:///file:testdb_passkeys?mode=memory&cache=shared"
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import database
from main import app
from database import SessionLocal, get_db
from models import Base, User, Passkey
from routers.auth import get_current_user
from dependencies import verify_api_key

# Set up test DB
test_engine = create_engine(
    "sqlite:///file:testdb_passkeys?mode=memory&cache=shared",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

database.engine = test_engine
database.SessionLocal = TestSessionLocal

class MockUser:
    id = "usr_passkeys_test_42"
    username = "passkey_user"
    role = "admin"
    is_active = True

mock_user = MockUser()

def override_get_current_user():
    return mock_user

def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db_and_dependencies():
    orig_overrides = dict(app.dependency_overrides)
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db
    
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    db = TestSessionLocal()
    user = User(id="usr_passkeys_test_42", username="passkey_user", role="admin", password_hash="dummy_hash")
    db.add(user)
    db.commit()
    db.close()
    
    yield
    app.dependency_overrides = orig_overrides


def test_passkey_lifecycle():
    # 1. Fetch Registration Options
    response = client.post("/auth/passkeys/register/options")
    assert response.status_code == 200
    options = response.json()
    assert "challenge" in options
    challenge = options["challenge"]
    
    # 2. Cryptographically generate a genuine ECDSA key pair for registration
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization, hashes
    
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    
    # Export public key to SPKI DER
    pub_der = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    pub_b64 = base64.b64encode(pub_der).decode("utf-8")
    
    client_data = {
        "type": "webauthn.create",
        "challenge": challenge,
        "origin": "http://localhost:3000",
    }
    client_data_json = base64.b64encode(json.dumps(client_data).encode()).decode("utf-8")
    
    # Verify and insert passkey
    verify_payload = {
        "credential_id": "test_cred_id_xyz",
        "public_key": pub_b64,
        "client_data_json": client_data_json,
        "aaguid": "dd25717e-f4e8-4d51-bf50-c8cd72ca5397",  # Apple iCloud Keychain
        "name": "iMac TouchID",
        "browser": "Chrome",
        "os_name": "macOS",
    }
    
    reg_response = client.post("/auth/passkeys/register/verify", json=verify_payload)
    assert reg_response.status_code == 200
    assert reg_response.json()["status"] == "success"
    
    # 3. List Passkeys
    list_response = client.get("/auth/passkeys/")
    assert list_response.status_code == 200
    pks = list_response.json()
    assert len(pks) == 1
    assert pks[0]["name"] == "iMac TouchID"
    assert pks[0]["aaguid_info"]["name"] == "iCloud Keychain"
    passkey_id = pks[0]["id"]
    
    # 4. Rename Passkey
    rename_payload = {"name": "MacBook Air TouchID"}
    rename_response = client.put(f"/auth/passkeys/{passkey_id}", json=rename_payload)
    assert rename_response.status_code == 200
    assert rename_response.json()["status"] == "success"
    
    # Check that name is updated
    list_response2 = client.get("/auth/passkeys/")
    assert list_response2.json()[0]["name"] == "MacBook Air TouchID"
    
    # 5. Assertion/Login options
    login_opts_response = client.post("/auth/passkeys/login/options", json={"username": "passkey_user"})
    assert login_opts_response.status_code == 200
    login_opts = login_opts_response.json()
    login_challenge = login_opts["challenge"]
    
    # 6. Verify assertion signature
    login_client_data = {
        "type": "webauthn.get",
        "challenge": login_challenge,
        "origin": "http://localhost:3000",
    }
    login_client_data_json = base64.b64encode(json.dumps(login_client_data).encode()).decode("utf-8")
    
    # Fake authenticator data (37 bytes minimum)
    auth_data = os.urandom(37)
    auth_data_b64 = base64.b64encode(auth_data).decode("utf-8")
    
    # Signed data is authenticatorData || sha256(clientDataJSON)
    client_data_hash = hashlib.sha256(json.dumps(login_client_data).encode()).digest()
    verify_data = auth_data + client_data_hash
    
    # Sign it!
    sig = private_key.sign(verify_data, ec.ECDSA(hashes.SHA256()))
    sig_b64 = base64.b64encode(sig).decode("utf-8")
    
    assert_payload = {
        "credential_id": "test_cred_id_xyz",
        "client_data_json": login_client_data_json,
        "authenticator_data": auth_data_b64,
        "signature": sig_b64,
    }
    
    login_verify_response = client.post("/auth/passkeys/login/verify", json=assert_payload)
    assert login_verify_response.status_code == 200
    assert "access_token" in login_verify_response.json()
    assert login_verify_response.json()["username"] == "passkey_user"
    
    # 7. Delete Passkey
    delete_response = client.delete(f"/auth/passkeys/{passkey_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "success"
    
    # Ensure list is now empty
    list_response3 = client.get("/auth/passkeys/")
    assert len(list_response3.json()) == 0
