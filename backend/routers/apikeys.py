from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from pydantic import BaseModel
import secrets
import hashlib
from dependencies import verify_api_key

# Lazy import for the ApiKey model
from models import ApiKey

router = APIRouter(
    prefix="/apikeys", tags=["apikeys"], dependencies=[Depends(verify_api_key)]
)


class ApiKeyCreate(BaseModel):
    name: str


@router.get("/")
def list_api_keys(db: Session = Depends(get_db)):
    keys = db.query(ApiKey).all()
    return [
        {
            "id": k.id,
            "name": k.name,
            "created_at": k.created_at,
            "last_used": k.last_used,
        }
        for k in keys
    ]


@router.post("/")
def create_api_key(req: ApiKeyCreate, db: Session = Depends(get_db)):
    # Generate a secure random API key
    raw_key = f"vyr_{secrets.token_urlsafe(32)}"

    # Hash the key before storing it in the database
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    new_key = ApiKey(name=req.name, key_hash=key_hash)
    db.add(new_key)
    db.commit()
    db.refresh(new_key)

    # We return the raw key ONLY once. The UI must prompt the user to copy it.
    return {"id": new_key.id, "name": new_key.name, "raw_key": raw_key}


@router.delete("/{key_id}")
def delete_api_key(key_id: int, db: Session = Depends(get_db)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API Key not found")

    db.delete(key)
    db.commit()
    return {"message": "API Key revoked successfully"}
