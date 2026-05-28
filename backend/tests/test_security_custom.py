import pytest
import os

# Configure environment variables for safety
os.environ["MASTER_KEY"] = "test_master_key_1234567890_abcdef"
os.environ["SECRET_KEY"] = "test_jwt_secret_key_1234567890_abcdef"

from security import get_password_hash, verify_password

def test_password_hashing_success():
    """Verify that get_password_hash hashes password successfully and verify_password matches it."""
    pw = "my_super_secure_password"
    pw_hash = get_password_hash(pw)
    
    assert pw_hash != pw
    assert pw_hash.startswith("$argon2id$")  # Argon2 hashes start with $argon2id$
    
    assert verify_password(pw, pw_hash) is True
    assert verify_password("wrong_password", pw_hash) is False

def test_long_password_native_argon2():
    """Verify that long passwords of 100+ characters are handled natively and hashed/verified perfectly by Argon2."""
    long_pw = "p" * 100
    pw_hash = get_password_hash(long_pw)
    
    assert pw_hash.startswith("$argon2id$")
    assert verify_password(long_pw, pw_hash) is True
    
    # Also verify that a slightly different long password does not match
    different_long_pw = long_pw + "extra"
    assert verify_password(different_long_pw, pw_hash) is False
