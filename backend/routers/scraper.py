from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import SiteRecipe, Provider
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm.attributes import flag_modified

from dependencies import verify_api_key
router = APIRouter(prefix="/scraper", tags=["scraper"], dependencies=[Depends(verify_api_key)])

class SiteRecipeCreate(BaseModel):
    provider_id: int
    css_selectors: Optional[Dict[str, Any]] = None
    xpath_selectors: Optional[Dict[str, Any]] = None
    regex_patterns: Optional[Dict[str, Any]] = None
    map_mode_data: Optional[Dict[str, Any]] = None

@router.post("/")
def create_recipe(recipe: SiteRecipeCreate, db: Session = Depends(get_db)):
    db_recipe = SiteRecipe(**recipe.dict())
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    return db_recipe

@router.get("/{provider_id}")
def get_recipe(provider_id: int, db: Session = Depends(get_db)):
    recipe = db.query(SiteRecipe).filter(SiteRecipe.provider_id == provider_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe

@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(SiteRecipe).filter(SiteRecipe.id == recipe_id).first()
    if recipe:
        db.delete(recipe)
        db.commit()
    return {"message": "Recipe deleted"}

class MapModePayload(BaseModel):
    host: str
    property: str
    selector: str

@router.post("/map-mode")
def save_map_mode_mapping(payload: MapModePayload, db: Session = Depends(get_db)):
    # Try to match the host to a known provider
    provider = db.query(Provider).filter(Provider.base_url.ilike(f"%{payload.host}%")).first()
    if not provider:
        raise HTTPException(status_code=404, detail=f"No provider configured for host: {payload.host}")

    recipe = db.query(SiteRecipe).filter(SiteRecipe.provider_id == provider.id).first()
    if not recipe:
        recipe = SiteRecipe(provider_id=provider.id, css_selectors={})
        db.add(recipe)

    # Update CSS selectors
    selectors = recipe.css_selectors or {}
    selectors[payload.property] = payload.selector
    recipe.css_selectors = selectors

    # Tell SQLAlchemy the JSON field was explicitly modified
    flag_modified(recipe, "css_selectors")
    db.commit()
    
    return {"success": True, "message": "Mapped successfully!"}

class ScraperTestRequest(BaseModel):
    url: str
    provider_id: int

@router.post("/test")
def test_scraper(req: ScraperTestRequest, db: Session = Depends(get_db)):
    recipe = db.query(SiteRecipe).filter(SiteRecipe.provider_id == req.provider_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="No scraping recipe configured for this provider.")
        
    return {
        "status": "success",
        "message": f"Successfully loaded configuration for {req.provider_id}. Ready to execute.",
        "metadata": {
            "title": f"Mock Title Extracted from {req.url}",
            "performers": ["Scraped Performer 1"],
            "tags": ["scraped", "test"],
            "description": "This is a dummy response returning data extracted based on the configured regex/css selectors."
        }
    }