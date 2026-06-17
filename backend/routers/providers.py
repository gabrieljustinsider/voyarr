from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Provider
from schemas import ProviderResponse, ProviderCreate
from pydantic import BaseModel

from dependencies import verify_api_key
from utils import validate_url_ssrf

router = APIRouter(
    prefix="/providers", tags=["providers"], dependencies=[Depends(verify_api_key)]
)


@router.get("", response_model=List[ProviderResponse])
def get_providers(db: Session = Depends(get_db)):
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
                space_replacement="_",
                logo_url=None,
                favicon_url=None,
                description=None
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
        automatic_limits=prov.automatic_limits,
        logo_url=prov.logo_url,
        favicon_url=prov.favicon_url,
        description=prov.description,
        transparent_logo_bg=prov.transparent_logo_bg,
        fit_logo_to_card=prov.fit_logo_to_card
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
    db_prov.logo_url = prov.logo_url
    db_prov.favicon_url = prov.favicon_url
    db_prov.description = prov.description
    db_prov.transparent_logo_bg = prov.transparent_logo_bg
    db_prov.fit_logo_to_card = prov.fit_logo_to_card
    
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


class ScrapedSiteDetails(BaseModel):
    site_name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None


class ScrapeUrlRequest(BaseModel):
    url: str


def _scrape_url_for_details(target_url: str) -> Dict[str, Any]:
    """Shared helper: fetches target_url and parses branding metadata."""
    validate_url_ssrf(target_url)
    import os
    import requests as req_lib
    import urllib.parse
    from bs4 import BeautifulSoup
    from urllib.parse import urljoin, urlparse

    parsed = urllib.parse.urlparse(target_url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid URL scheme")
    base_url = urllib.parse.urlunparse(parsed).rstrip("/")
    headers = {
        "User-Agent": os.getenv(
            "DEFAULT_USER_AGENT",
            "Mozilla/5.0 (compatible; Voyarr/1.0; +https://github.com/voyarr)"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    resp = req_lib.get(base_url, headers=headers, timeout=10, allow_redirects=True)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.content, "html.parser")

    def get_meta(attr: str, value: str) -> Optional[str]:
        tag = soup.find("meta", attrs={attr: value})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
        return None

    site_name: Optional[str] = (
        get_meta("property", "og:site_name")
        or get_meta("name", "application-name")
    )
    if not site_name:
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            site_name = title_tag.string.strip().split("|")[0].split("-")[0].strip()
    if not site_name:
        parsed_url = urlparse(base_url)
        domain = parsed_url.netloc or parsed_url.path
        if domain.startswith("www."):
            domain = domain[4:]
        site_name = domain.split(".")[0].capitalize()

    description: Optional[str] = (
        get_meta("property", "og:description")
        or get_meta("name", "description")
        or get_meta("name", "twitter:description")
    )

    logo_url: Optional[str] = get_meta("property", "og:image") or get_meta("name", "twitter:image")
    if not logo_url:
        # Fallback: Search for img tags containing 'logo' in their properties
        for img in soup.find_all("img"):
            src = img.get("src")
            if not src:
                continue
            img_id = str(img.get("id", "")).lower()
            img_classes = [str(c).lower() for c in (img.get("class") or [])]
            img_alt = str(img.get("alt", "")).lower()
            img_src = str(src).lower()
            if (
                "logo" in img_id
                or any("logo" in c for c in img_classes)
                or "logo" in img_alt
                or "logo" in img_src
            ):
                logo_url = src
                break

    if logo_url and not logo_url.startswith("http"):
        logo_url = urljoin(base_url, logo_url)

    favicon_url: Optional[str] = None
    for rel_val in ("apple-touch-icon", "shortcut icon", "icon"):
        link_tag = soup.find("link", rel=lambda r: r and rel_val in (r if isinstance(r, list) else [r]))
        if link_tag and link_tag.get("href"):
            href = str(link_tag["href"]).strip()
            favicon_url = href if href.startswith("http") else urljoin(base_url, href)
            break
    if not favicon_url:
        parsed = urlparse(base_url)
        favicon_url = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"

    # If no logo_url was found, fall back to favicon_url as the site logo
    if not logo_url:
        logo_url = favicon_url

    return {
        "site_name": site_name,
        "description": description,
        "logo_url": logo_url,
        "favicon_url": favicon_url,
    }


@router.post("/scrape-url", response_model=ScrapedSiteDetails)
def scrape_url_details(req: ScrapeUrlRequest):
    """
    Scrape an arbitrary URL to extract branding details.
    Used when creating a new provider before it has been saved to the database.
    """
    if not req.url or not req.url.startswith("http"):
        raise HTTPException(status_code=400, detail="A valid http(s) URL is required.")

    try:
        result = _scrape_url_for_details(req.url)
        return ScrapedSiteDetails(**result)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to scrape URL: {e}")



@router.post("/{provider_id}/scrape-details", response_model=ScrapedSiteDetails)
def scrape_provider_site_details(provider_id: int, db: Session = Depends(get_db)):
    """
    Scrape the provider's base_url to extract branding details: site name,
    description, and logo/favicon — from Open Graph, Twitter Card, and
    standard HTML meta tags. Does not require any login credentials.
    """
    db_prov = db.query(Provider).filter(Provider.id == provider_id).first()
    if not db_prov:
        raise HTTPException(status_code=404, detail="Provider not found")

    try:
        result = _scrape_url_for_details(db_prov.base_url)
        return ScrapedSiteDetails(**result)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach provider site: {e}")
