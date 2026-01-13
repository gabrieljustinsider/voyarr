from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import SiteRecipe, Provider
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm.attributes import flag_modified

from dependencies import verify_api_key
from utils import validate_url_ssrf

def check_scraper_feature_permission(
    auth_info: dict = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    from db_utils import check_feature_permission
    from models import User
    user = None
    if auth_info.get("type") == "jwt" and auth_info.get("user"):
        user = db.query(User).filter(User.username == auth_info.get("user")).first()
    check_feature_permission(db, "scraping", user)


router = APIRouter(
    prefix="/scraper",
    tags=["scraper"],
    dependencies=[Depends(verify_api_key), Depends(check_scraper_feature_permission)]
)


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
    provider_id: Optional[int] = None


@router.post("/map-mode")
def save_map_mode_mapping(payload: MapModePayload, db: Session = Depends(get_db)):
    # Prioritize direct provider ID match if supplied by the browser extension
    provider = None
    if payload.provider_id:
        provider = db.query(Provider).filter(Provider.id == payload.provider_id).first()

    if not provider:
        provider = (
            db.query(Provider).filter(Provider.base_url.ilike(f"%{payload.host}%")).first()
        )
    if not provider:
        raise HTTPException(
            status_code=404, detail=f"No provider configured for host: {payload.host}"
        )

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
    validate_url_ssrf(req.url)
    recipe = (
        db.query(SiteRecipe).filter(SiteRecipe.provider_id == req.provider_id).first()
    )
    if not recipe:
        raise HTTPException(
            status_code=404, detail="No scraping recipe configured for this provider."
        )

    return {
        "status": "success",
        "message": f"Successfully loaded configuration for {req.provider_id}. Ready to execute.",
        "metadata": {
            "title": f"Mock Title Extracted from {req.url}",
            "performers": ["Scraped Performer 1"],
            "tags": ["scraped", "test"],
            "description": "This is a dummy response returning data extracted based on the configured regex/css selectors.",
        },
    }


@router.get("/bookmarklet", dependencies=[])
def get_bookmarklet():
    """Generates and returns the encoded, minified bookmarklet URL."""
    try:
        import os
        import urllib.parse
        import re
        
        # Determine path to bookmarklet.js
        possible_paths = [
            os.path.join(os.path.dirname(__file__), "../../extension/bookmarklet.js"),
            os.path.join(os.path.dirname(__file__), "../extension/bookmarklet.js"),
            os.path.join(os.path.dirname(__file__), "../bookmarklet.js"),
            "/app/extension/bookmarklet.js",
            "/app/bookmarklet.js"
        ]
        
        file_path = None
        for p in possible_paths:
            if os.path.exists(p):
                file_path = p
                break
                
        if not file_path:
            raise HTTPException(status_code=404, detail="bookmarklet.js not found on host filesystem.")
            
        with open(file_path, "r") as f:
            code = f.read()
            
        # Basic minification to fit into browser URL limits
        code = re.sub(r'//.*?\n', '\n', code)
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
        code = re.sub(r'\s+', ' ', code)
        code = re.sub(r'\s*([\{\}\(\)\;\:\,\=\+\-\*\/])\s*', r'\1', code)
        
        return {"bookmarklet": "javascript:" + urllib.parse.quote(code)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load bookmarklet: {str(e)}")

