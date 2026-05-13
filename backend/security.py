import os
import base64
from cryptography.fernet import Fernet
from dotenv import load_dotenv
import hashlib

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
        return encrypted_data # Fallback if not encrypted or wrong key
