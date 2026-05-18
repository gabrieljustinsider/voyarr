import os
import base64
from cryptography.fernet import Fernet
from dotenv import load_dotenv
import secrets
import hashlib
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, timezone

load_dotenv()

MASTER_KEY = os.getenv("MASTER_KEY")
if MASTER_KEY:
    # Use SHA-256 to derive a 32-byte key from the user-provided master key.
    # This is more secure than padding or truncating the key.
    derived_key = hashlib.sha256(MASTER_KEY.encode()).digest()
    key = base64.urlsafe_b64encode(derived_key)
    cipher = Fernet(key)
else:
    cipher = None

# JWT & Password Hashing Configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("SECRET_KEY")
if not JWT_SECRET or JWT_SECRET == "your_secret_key_here":  # nosec B105
    print(
        "WARNING: Using an ephemeral fallback SECRET_KEY. Sessions will invalidate on restart. Please set a secure SECRET_KEY in your .env file!"
    )
    JWT_SECRET = secrets.token_urlsafe(32)
ALGORITHM = "HS256"


def encrypt_data(data: str) -> str:
    if not data:
        return data
    if not cipher:
        raise ValueError("Encryption cipher is not initialized. MASTER_KEY is missing.")
    return cipher.encrypt(data.encode()).decode()


def decrypt_data(encrypted_data: str) -> str:
    if not cipher or not encrypted_data:
        return encrypted_data
    try:
        return cipher.decrypt(encrypted_data.encode()).decode()
    except Exception:
        return ""  # Safe fallback to prevent leaking encrypted ciphertexts or bypassing encryption wrappers


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
