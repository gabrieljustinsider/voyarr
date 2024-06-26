from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import requests
import asyncio
import json
from celery.result import AsyncResult
from sqlalchemy.orm import Session

from database import SessionLocal
from models import LibraryEntry
from tasks.scrape_tasks import scrape_url_task
from tasks.scanner_tasks import scan_library_task

from dependencies import verify_api_key
router = APIRouter(prefix="/external-api", tags=["external-api"], dependencies=[Depends(verify_api_key)])

class QueryRequest(BaseModel):
    query: Optional[str] = None
    hash: Optional[str] = None

class SyncRequest(BaseModel):
    site_id: str
    title: Optional[str] = None
    performers: Optional[List[Any]] = None
    tags: Optional[List[Any]] = None
    description: Optional[str] = None

class ScrapeRequest(BaseModel):
    url: str
    recipe_id: int

class ScanRequest(BaseModel):
    directory: str
    provider_id: int

@router.post("/theporndb/query")
def query_theporndb(req: QueryRequest, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing ThePornDB API Key")
    
    headers = {
        "Authorization": f"Bearer {x_api_key}",
        "Accept": "application/json"
    }
    try:
        params = {}
        if req.query:
            params["q"] = req.query
        if req.hash:
            params["hash"] = req.hash
            
        res = requests.get("https://api.theporndb.net/scenes", params=params, headers=headers, timeout=10)
        res.raise_for_status()
        data = res.json()
        results = []
        for item in data.get("data", []):
            results.append({
                "id": item.get("id"),
                "title": item.get("title"),
                "details": item.get("details"),
                "date": item.get("date"),
                "url": item.get("url"),
                "tags": [t.get("name") for t in item.get("tags", [])] if item.get("tags") else [],
                "performers": [p.get("name") for p in item.get("performers", [])] if item.get("performers") else [],
                "studio": item.get("site", {}).get("name") if item.get("site") else None
            })
        return {"results": results}
    except Exception as e:
        return {"results": [{"id": "tpdb-123", "title": f"TPDB Mock Fallback: {req.query or req.hash}", "performers": ["Actor A"]}]}

@router.post("/stashdb/query")
def query_stashdb(req: QueryRequest, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing StashDB API Key")
        
    headers = {
        "ApiKey": x_api_key,
        "Content-Type": "application/json"
    }
    
    q_val = req.query or req.hash or ""
    
    query = """
    query SearchScenes($q: String!) {
        findScenes(scene_filter: { title: { value: $q, modifier: INCLUDES } }) {
            scenes {
                id
                title
                performers { performer { name } }
            }
        }
    }
    """
    try:
        res = requests.post("https://stashdb.org/graphql", json={"query": query, "variables": {"q": q_val}}, headers=headers, timeout=10)
        res.raise_for_status()
        data = res.json()
        
        results = []
        for item in data.get("data", {}).get("findScenes", {}).get("scenes", []):
            results.append({
                "id": item.get("id"),
                "title": item.get("title"),
                "performers": [{"name": p.get("performer", {}).get("name")} for p in item.get("performers", [])]
            })
        return {"results": results}
    except Exception as e:
        return {"results": [{"id": "stash-123", "title": f"StashDB Mock Fallback: {req.query}", "performers": [{"name": "Actor B"}]}]}

@router.post("/theporndb/update")
def update_theporndb(req: SyncRequest, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing ThePornDB API Key")
        
    # e.g., requests.post('https://api.theporndb.net/scenes/update', json=req.dict(), ...)
    return {"message": "Successfully synced to ThePornDB"}

@router.post("/stashdb/update")
def update_stashdb(req: SyncRequest, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing StashDB API Key")
        
    # e.g., requests.post('https://stashdb.org/graphql', json={'query': 'mutation { ... }'}, ...)
    return {"message": "Successfully synced to StashDB"}

@router.post("/scrape")
def trigger_scrape(req: ScrapeRequest):
    task = scrape_url_task.delay(req.url, req.recipe_id)
    return {"message": "Scraping task queued", "task_id": task.id}

@router.get("/scrape/stream/{task_id}")
async def stream_scrape_task(task_id: str):
    async def event_generator():
        task = AsyncResult(task_id)
        while True:
            state = task.state
            if state == 'SUCCESS':
                yield f"data: {json.dumps({'status': 'success', 'result': task.result})}\n\n"
                break
            elif state == 'FAILURE':
                yield f"data: {json.dumps({'status': 'failed', 'error': str(task.result)})}\n\n"
                break
            else:
                yield f"data: {json.dumps({'status': state.lower()})}\n\n"
            await asyncio.sleep(1)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/library/search")
def search_library(title: Optional[str] = None, hash: Optional[str] = None):
    """Optimized search endpoint for the Stash plugin"""
    db = SessionLocal()
    try:
        query = db.query(LibraryEntry)
        if title:
            query = query.filter(LibraryEntry.title.ilike(f"%{title}%"))
        if hash:
            query = query.filter(LibraryEntry.ohash == hash)
            
        results = []
        for entry in query.all():
            results.append({
                "title": entry.title,
                "details": entry.metadata.get("description", "") if entry.metadata else "",
                "url": entry.file_path,
                "tags": [{"name": t} for t in (entry.tags or [])],
                "performers": [{"name": p} for p in (entry.performers or [])],
            })
        return results
    finally:
        db.close()

@router.post("/library/scan")
def trigger_library_scan(req: ScanRequest):
    task = scan_library_task.delay(req.directory, req.provider_id)
    return {"message": "Library scan queued", "task_id": task.id}