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
