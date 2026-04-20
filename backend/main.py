from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import base64

# Load environment variables
load_dotenv()

app = FastAPI(title="Jizzarr API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Encryption setup
MASTER_KEY = os.getenv("MASTER_KEY")
if MASTER_KEY:
    key = base64.urlsafe_b64encode(MASTER_KEY.encode()[:32].ljust(32, b'\0'))
    cipher = Fernet(key)
else:
    cipher = None

# Pydantic models
class CredentialCreate(BaseModel):
    provider_id: int
    username: str
    password: str

class CredentialResponse(BaseModel):
    id: int
    provider_id: int
    username: str
    created_at: str

# Routes
@app.get("/")
async def root():
    return {"message": "Jizzarr API"}

@app.post("/credentials", response_model=CredentialResponse)
async def create_credential(cred: CredentialCreate):
    if not cipher:
        raise HTTPException(status_code=500, detail="Encryption not configured")
    
    # Encrypt credentials
    encrypted_username = cipher.encrypt(cred.username.encode())
    encrypted_password = cipher.encrypt(cred.password.encode())
    
    # TODO: Save to database
    # For now, return mock response
    return CredentialResponse(
        id=1,
        provider_id=cred.provider_id,
        username=cred.username,  # In real implementation, don't return plain username
        created_at="2023-01-01T00:00:00Z"
    )

@app.get("/credentials/{provider_id}")
async def get_credentials(provider_id: int):
    # TODO: Retrieve from database and decrypt
    return {"message": f"Credentials for provider {provider_id}"}

# Progress streaming endpoint (placeholder)
@app.get("/progress/{task_id}")
async def get_progress(task_id: str):
    # TODO: Implement real-time progress
    return {"task_id": task_id, "progress": 50, "status": "running"}