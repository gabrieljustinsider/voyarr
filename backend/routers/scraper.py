from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import SiteRecipe
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter(prefix="/scraper", tags=["scraper"])

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