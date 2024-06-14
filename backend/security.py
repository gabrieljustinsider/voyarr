import os
import base64
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

MASTER_KEY = os.getenv("MASTER_KEY")
if MASTER_KEY:
    key = base64.urlsafe_b64encode(MASTER_KEY.encode()[:32].ljust(32, b'\0'))
    cipher = Fernet(key)
else:
    cipher = None

def encrypt_data(data: str) -> str:
    if not cipher or not data:
        return data
    return cipher.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    if not cipher or not encrypted_data:
        return encrypted_data
    try:
        return cipher.decrypt(encrypted_data.encode()).decode()
    except Exception:
        return encrypted_data # Fallback if not encrypted or wrong key

