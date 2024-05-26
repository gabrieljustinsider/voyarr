from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Provider

from dependencies import verify_api_key
router = APIRouter(prefix="/providers", tags=["providers"], dependencies=[Depends(verify_api_key)])

@router.get("")
async def get_providers(db: Session = Depends(get_db)):
    providers = db.query(Provider).all()
    # Return a default provider if database is empty for testing purposes
    if not providers:
        return [{"id": 1, "name": "Example Provider", "base_url": "https://example.com", "automatic_limits": {"daily_downloads": 50}}]
    return [{"id": p.id, "name": p.name, "base_url": p.base_url, "automatic_limits": p.automatic_limits} for p in providers]
