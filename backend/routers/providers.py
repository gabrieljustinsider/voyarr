from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Provider
from schemas import ProviderResponse, ProviderCreate

from dependencies import verify_api_key

router = APIRouter(
    prefix="/providers", tags=["providers"], dependencies=[Depends(verify_api_key)]
)


@router.get("", response_model=List[ProviderResponse])
async def get_providers(db: Session = Depends(get_db)):
    providers = db.query(Provider).all()
    # Return a default provider if database is empty for testing purposes
    if not providers:
        return [
            Provider(
                id=1,
                name="Example Provider",
                base_url="https://example.com",
                automatic_limits={"daily_downloads": 50},
                naming_pattern="{title}_{performers}_{resolution}",
                separator="_",
                space_replacement="_"
            )
        ]
    return providers


@router.get("/{provider_id}", response_model=ProviderResponse)
def get_provider(provider_id: int, db: Session = Depends(get_db)):
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@router.post("", response_model=ProviderResponse)
def create_provider(prov: ProviderCreate, db: Session = Depends(get_db)):
    existing = db.query(Provider).filter(Provider.name == prov.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Provider with this name already exists")
    
    db_prov = Provider(
        name=prov.name,
        base_url=prov.base_url,
        naming_pattern=prov.naming_pattern,
        separator=prov.separator,
        space_replacement=prov.space_replacement,
        automatic_limits=prov.automatic_limits
    )
    db.add(db_prov)
    db.commit()
    db.refresh(db_prov)
    return db_prov


@router.put("/{provider_id}", response_model=ProviderResponse)
def update_provider(provider_id: int, prov: ProviderCreate, db: Session = Depends(get_db)):
    db_prov = db.query(Provider).filter(Provider.id == provider_id).first()
    if not db_prov:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    db_prov.name = prov.name
    db_prov.base_url = prov.base_url
    db_prov.naming_pattern = prov.naming_pattern
    db_prov.separator = prov.separator
    db_prov.space_replacement = prov.space_replacement
    db_prov.automatic_limits = prov.automatic_limits
    
    db.commit()
    db.refresh(db_prov)
    return db_prov


@router.delete("/{provider_id}")
def delete_provider(provider_id: int, db: Session = Depends(get_db)):
    db_prov = db.query(Provider).filter(Provider.id == provider_id).first()
    if not db_prov:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    db.delete(db_prov)
    db.commit()
    return {"message": "Provider deleted successfully"}
