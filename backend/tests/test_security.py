import pytest
from datetime import timedelta
from jose import jwt

from security import (
    verify_password,
    get_password_hash,
    create_access_token,
    encrypt_data,
    decrypt_data,
    JWT_SECRET,
    ALGORITHM,
    cipher
)

def test_password_hashing_argon2():
    password = "super_secure_password_123!@#"
    
    # Generate the hash
    hashed = get_password_hash(password)
    
    # Ensure it's using the Argon2id algorithm
    assert hashed.startswith("$argon2id$")
    assert hashed != password
    
    # Verify correct password
    assert verify_password(password, hashed) is True
    
    # Verify incorrect password fails
    assert verify_password("wrong_password", hashed) is False

def test_create_access_token():
    data = {"sub": "test_user", "role": "admin"}
    token = create_access_token(data, expires_delta=timedelta(minutes=15))
    
    assert isinstance(token, str)
    
    # Decode the token to verify its payload
    payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    assert payload.get("sub") == "test_user"
    assert payload.get("role") == "admin"
    assert "exp" in payload

def test_encryption_decryption():
    if not cipher:
        pytest.skip("MASTER_KEY not set in environment; skipping encryption tests.")
        
    plaintext = "sensitive_api_key_data"
    encrypted = encrypt_data(plaintext)
    
    assert encrypted != plaintext
    assert decrypt_data(encrypted) == plaintext
    assert decrypt_data("invalid_garbage_data") == ""  # Should return empty string on failure