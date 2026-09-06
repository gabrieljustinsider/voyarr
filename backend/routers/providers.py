from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import Provider, Biller, ProviderBiller
from schemas import (
    ProviderResponse, ProviderCreate,
    ProviderBillerCreate, ProviderBillerUpdate, ProviderBillerResponse
)
from pydantic import BaseModel

from dependencies import verify_api_key
from utils import validate_url_ssrf

router = APIRouter(
    prefix="/providers", tags=["providers"], dependencies=[Depends(verify_api_key)]
)


@router.get("", response_model=List[ProviderResponse])
def get_providers(db: Session = Depends(get_db)):
    providers = db.query(Provider).options(joinedload(Provider.default_biller)).all()
    filtered_providers = [p for p in providers if p.name != "Example Provider"]
    
    # If database only contains dummy Example Provider or is empty, run seed_default_data
    if not filtered_providers:
        try:
            from seed_data import seed_default_data
            seed_default_data(db.get_bind())
            providers = db.query(Provider).options(joinedload(Provider.default_biller)).all()
            filtered_providers = [p for p in providers if p.name != "Example Provider"]
        except Exception as e:
            print(f"Auto-seeding error in get_providers: {e}")
            
    return filtered_providers


@router.get("/{provider_id}", response_model=ProviderResponse)
def get_provider(provider_id: int, db: Session = Depends(get_db)):
    provider = db.query(Provider).options(joinedload(Provider.default_biller)).filter(Provider.id == provider_id).first()
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
        fit_logo_to_card=prov.fit_logo_to_card,
        default_biller_id=prov.default_biller_id
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
    db_prov.default_biller_id = prov.default_biller_id
    
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


# ==================== PROVIDER BILLER JUNCTION CRUD ====================

@router.get("/{provider_id}/billers", response_model=List[ProviderBillerResponse])
def get_provider_billers(provider_id: int, db: Session = Depends(get_db)):
    """List all billers associated with this provider."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    return db.query(ProviderBiller).options(joinedload(ProviderBiller.biller)).filter(
        ProviderBiller.provider_id == provider_id
    ).all()


@router.post("/{provider_id}/billers", response_model=ProviderBillerResponse)
def add_provider_biller(provider_id: int, pb_in: ProviderBillerCreate, db: Session = Depends(get_db)):
    """Attach a biller instance to this provider with custom cycles/options."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    biller = db.query(Biller).filter(Biller.id == pb_in.biller_id).first()
    if not biller:
        raise HTTPException(status_code=404, detail="Biller not found")

    existing = db.query(ProviderBiller).filter(
        ProviderBiller.provider_id == provider_id,
        ProviderBiller.biller_id == pb_in.biller_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Biller is already linked to this provider")

    if pb_in.is_default:
        db.query(ProviderBiller).filter(ProviderBiller.provider_id == provider_id).update({"is_default": False})

    new_pb = ProviderBiller(
        provider_id=provider_id,
        biller_id=pb_in.biller_id,
        merchant_account_label=pb_in.merchant_account_label,
        supported_cycles=pb_in.supported_cycles or ["monthly", "annual"],
        is_default=pb_in.is_default or False
    )
    db.add(new_pb)
    db.commit()
    db.refresh(new_pb)
    return new_pb


@router.put("/{provider_id}/billers/{pb_id}", response_model=ProviderBillerResponse)
def update_provider_biller(provider_id: int, pb_id: int, pb_in: ProviderBillerUpdate, db: Session = Depends(get_db)):
    """Update custom options, cycles, or default status for a provider-biller instance."""
    pb = db.query(ProviderBiller).filter(
        ProviderBiller.id == pb_id,
        ProviderBiller.provider_id == provider_id
    ).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Provider biller link not found")

    if pb_in.is_default:
        db.query(ProviderBiller).filter(
            ProviderBiller.provider_id == provider_id,
            ProviderBiller.id != pb_id
        ).update({"is_default": False})

    for key, val in pb_in.model_dump(exclude_unset=True).items():
        setattr(pb, key, val)

    db.commit()
    db.refresh(pb)
    return pb


@router.delete("/{provider_id}/billers/{pb_id}")
def delete_provider_biller(provider_id: int, pb_id: int, db: Session = Depends(get_db)):
    """Remove a biller association from a provider."""
    pb = db.query(ProviderBiller).filter(
        ProviderBiller.id == pb_id,
        ProviderBiller.provider_id == provider_id
    ).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Provider biller link not found")

    db.delete(pb)
    db.commit()
    return {"message": "Provider biller removed successfully"}

