from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import LibraryEntry
from db_utils import get_or_create_studio_by_name
from pydantic import BaseModel
from typing import List, Optional
import os
from services.media_tagger import MediaTagger
import json

from dependencies import verify_api_key

router = APIRouter(
    prefix="/metadata", tags=["metadata"], dependencies=[Depends(verify_api_key)]
)


class UrlFetchRequest(BaseModel):
    url: str


def is_safe_url(url: str) -> bool:
    try:
        from utils import validate_url_ssrf
        validate_url_ssrf(url)
        return True
    except Exception:
        return False


@router.post("/fetch-url-details")
def fetch_url_details(req: UrlFetchRequest):
    url = req.url
    if not is_safe_url(url):
        raise HTTPException(status_code=400, detail="Invalid or unsafe URL provided (SSRF protection block)")
    
    import requests
    import urllib.parse
    from bs4 import BeautifulSoup
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(status_code=400, detail="Invalid URL scheme")
        safe_url = urllib.parse.urlunparse(parsed)
        
        headers = {
            "User-Agent": "Voyarr/1.0 (Url Metadata Extractor; +https://github.com/gabrieljustinsider/voyarr)"
        }
        res = requests.get(safe_url, headers=headers, timeout=5)
        res.raise_for_status()
        
        soup = BeautifulSoup(res.text, "html.parser")
        
        title = None
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            title = og_title["content"].strip()
        if not title:
            twitter_title = soup.find("meta", name="twitter:title")
            if twitter_title and twitter_title.get("content"):
                title = twitter_title["content"].strip()
        if not title:
            title_tag = soup.find("title")
            if title_tag:
                title = title_tag.text.strip()
        if not title:
            title = url
            
        description = None
        desc_meta = soup.find("meta", name="description")
        if desc_meta and desc_meta.get("content"):
            description = desc_meta["content"].strip()
        if not description:
            og_desc = soup.find("meta", property="og:description")
            if og_desc and og_desc.get("content"):
                description = og_desc["content"].strip()
                
        favicon = None
        for link in soup.find_all("link"):
            rel = link.get("rel", [])
            if isinstance(rel, str):
                rel = [rel]
            if any(r.lower() in ("icon", "shortcut icon", "apple-touch-icon") for r in rel):
                href = link.get("href")
                if href:
                    from urllib.parse import urljoin
                    favicon = urljoin(url, href)
                    break
        if not favicon:
            from urllib.parse import urljoin
            favicon = urljoin(url, "/favicon.ico")
            
        return {
            "title": title,
            "description": description,
            "favicon": favicon,
            "url": url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch metadata: {str(e)}")


class MetadataUpdate(BaseModel):
    title: str
    performers: List[str]
    tags: List[str]
    description: Optional[str] = None
    studio: Optional[str] = None


@router.get("/entry/{entry_id}")
def get_metadata(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    return {
        "id": entry.id,
        "provider_id": entry.provider_id,
        "title": entry.title,
        "performers": entry.performers,
        "tags": entry.tags,
        "file_path": entry.file_path,
        "file_size": entry.file_size,
        "resolution": entry.resolution,
        "duration": entry.duration,
        "ohash": entry.ohash,
        "phash": entry.phash,
        "site_id": entry.site_id,
        "entry_metadata": entry.entry_metadata,
        "studio_id": entry.studio_id,
        "studio_name": entry.studio.name if entry.studio else None,
    }


@router.post("/entry/{entry_id}/update")
def update_metadata(entry_id: int, req: MetadataUpdate, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    entry.title = req.title
    entry.performers = req.performers
    entry.tags = req.tags

    # Resolve studio name string to relational integer studio_id
    if req.studio is not None:
        entry.studio_id = get_or_create_studio_by_name(db, req.studio)

    meta = entry.entry_metadata or {}
    meta["description"] = req.description
    entry.entry_metadata = meta

    db.commit()
    return {"message": "Metadata updated successfully"}


@router.post("/entry/{entry_id}/write-to-file")
def write_metadata_to_file(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == entry_id).first()
    if not entry or not os.path.exists(entry.file_path):
        raise HTTPException(status_code=404, detail="Physical file not found on disk")

    try:
        # Attempt to embed metadata directly into the media file
        embed_meta = {
            "title": entry.title,
            "performers": entry.performers,
            "description": entry.entry_metadata.get("description")
            if entry.entry_metadata
            else None,
            "studio": entry.studio.name if entry.studio else None,
        }
        MediaTagger.tag_file(entry.file_path, embed_meta)

        # Write sidecar .json file for external players
        sidecar_path = f"{entry.file_path}.json"
        with open(sidecar_path, "w") as f:
            json.dump(embed_meta, f, indent=4)

        return {
            "message": "Metadata written successfully",
            "sidecar_file": sidecar_path,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
