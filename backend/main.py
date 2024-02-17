from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import base64
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base

# Load environment variables
load_dotenv()

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback to individual POSTGRES vars
    db_user = os.getenv("POSTGRES_USER", "jizzarr_user")
    db_pass = os.getenv("POSTGRES_PASSWORD", "password")
    db_host = os.getenv("POSTGRES_HOST", "db")
    db_port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "jizzarr")
    DATABASE_URL = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

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
    encrypted_username = cipher.encrypt(cred.username.encode()).decode()
    encrypted_password = cipher.encrypt(cred.password.encode()).decode()
    
    # Save to database
    db = SessionLocal()
    try:
        from models import Credential
        new_cred = Credential(
            provider_id=cred.provider_id,
            username_encrypted=encrypted_username,
            password_encrypted=encrypted_password
        )
        db.add(new_cred)
        db.commit()
        db.refresh(new_cred)
        return CredentialResponse(
            id=new_cred.id,
            provider_id=new_cred.provider_id,
            username=cred.username,  # Note: In production, don't return plain username
            created_at=new_cred.created_at.isoformat()
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save credential: {str(e)}")
    finally:
        db.close()

@app.get("/credentials/{provider_id}")
async def get_credentials(provider_id: int):
    # TODO: Retrieve from database and decrypt
    return {"message": f"Credentials for provider {provider_id}"}

# Progress streaming endpoint (placeholder)
@app.get("/progress/{task_id}")
async def get_progress(task_id: str):
    # TODO: Implement real-time progress
    return {"task_id": task_id, "progress": 50, "status": "running"}