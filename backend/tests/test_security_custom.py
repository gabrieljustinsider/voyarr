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
    assert pw_hash.startswith("$2")  # Bcrypt hashes start with $2a$ or $2b$
    
    assert verify_password(pw, pw_hash) is True
    assert verify_password("wrong_password", pw_hash) is False

def test_long_password_no_truncation_no_value_error():
    """Verify that passwords longer than 72 characters are hashed and verified perfectly without triggering bcrypt's ValueError."""
    # A password of 100 characters should hash successfully because we pre-hash using SHA-512 raw digest
    long_pw = "p" * 100
    pw_hash = get_password_hash(long_pw)
    
    assert verify_password(long_pw, pw_hash) is True
    
    # Also verify that a slightly different long password does not match
    different_long_pw = long_pw + "extra"
    assert verify_password(different_long_pw, pw_hash) is False
