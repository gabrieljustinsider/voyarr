from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import SiteRecipe, Provider
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm.attributes import flag_modified

from dependencies import verify_api_key, require_permission
from utils import validate_url_ssrf

parse_router = APIRouter(
    prefix="/scraper",
    tags=["scraper"],
    dependencies=[Depends(verify_api_key)]
)

router = APIRouter(
    prefix="/scraper",
    tags=["scraper"],
    dependencies=[Depends(verify_api_key), Depends(require_permission("scraping", "edit"))]
)


class SiteRecipeCreate(BaseModel):
    provider_id: int
    css_selectors: Optional[Dict[str, Any]] = None
    xpath_selectors: Optional[Dict[str, Any]] = None
    regex_patterns: Optional[Dict[str, Any]] = None
    map_mode_data: Optional[Dict[str, Any]] = None


@router.post("")
def create_recipe(recipe: SiteRecipeCreate, db: Session = Depends(get_db)):
    db_recipe = SiteRecipe(**recipe.dict())
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    return db_recipe


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
        code = re.sub(r'(?<!:)\/\/.*?\n', '\n', code)
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
        code = re.sub(r'\s+', ' ', code)
        code = re.sub(r'\s*([\{\}\(\)\;\:\,\=\+\-\*\/])\s*', r'\1', code)
        
        return {"bookmarklet": "javascript:" + urllib.parse.quote(code)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load bookmarklet: {str(e)}")


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


class UrlParseRequest(BaseModel):
    url: str


@parse_router.post("/parse-url")
def parse_url(
    req: UrlParseRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("scraping", "view"))
):
    # 2. SSRF Protection
    validate_url_ssrf(req.url)

    # 3. Fetch URL content using BeautifulSoup
    try:
        import requests
        import urllib.parse
        from bs4 import BeautifulSoup
        import os

        validate_url_ssrf(req.url)
        parsed_url = urllib.parse.urlparse(req.url)
        if parsed_url.scheme not in ("http", "https"):
            raise HTTPException(status_code=400, detail="Invalid URL scheme")
        safe_url = urllib.parse.urlunparse(parsed_url)
        
        session = requests.Session()
        global_ua = os.getenv("DEFAULT_USER_AGENT", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        session.headers.update({"User-Agent": global_ua})

        response = session.get(safe_url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch content from URL: {str(e)}")

    # 4. Domain & Recipe resolution
    parsed_url = urllib.parse.urlparse(req.url)
    domain = parsed_url.netloc.lower()
    
    # Try to find provider
    provider = db.query(Provider).filter(Provider.base_url.ilike(f"%{domain}%")).first()
    metadata = {}

    if provider:
        recipe = db.query(SiteRecipe).filter(SiteRecipe.provider_id == provider.id).first()
        if recipe:
            from services.scraper import DynamicScraper as ScraperService
            scraper = ScraperService(recipe)
            metadata = scraper.parse(str(soup))

    # 5. Fallback generic meta & OpenGraph scraping
    from services.scraper import DynamicScraper
    dummy = DynamicScraper(None)
    fallback = dummy._fallback_extract(soup)

    # Combine results
    for k, v in fallback.items():
        if not metadata.get(k):
            metadata[k] = v

    # 6. Format lists and clean text
    performers = []
    if metadata.get("performers"):
        raw_p = metadata["performers"]
        if isinstance(raw_p, list):
            performers = [p.strip() for p in raw_p if p.strip()]
        elif isinstance(raw_p, str):
            performers = [p.strip() for p in raw_p.split(",") if p.strip()]
            
    tags = []
    if metadata.get("tags"):
        raw_t = metadata["tags"]
        if isinstance(raw_t, list):
            tags = [t.strip() for t in raw_t if t.strip()]
        elif isinstance(raw_t, str):
            tags = [t.strip() for t in raw_t.split(",") if t.strip()]

    description = str(metadata.get("description", "")).strip()
    title = str(metadata.get("title", "")).strip()
    thumbnail_url = str(metadata.get("thumbnail_url", "")).strip()

    # Studio extraction
    studio = ""
    if metadata.get("studio"):
        studio = str(metadata["studio"]).strip()
    elif metadata.get("studio_name"):
        studio = str(metadata["studio_name"]).strip()

    return {
        "status": "success",
        "url": req.url,
        "provider_id": provider.id if provider else None,
        "metadata": {
            "title": title,
            "studio": studio,
            "performers": performers,
            "tags": tags,
            "description": description,
            "thumbnail_url": thumbnail_url
        }
    }
