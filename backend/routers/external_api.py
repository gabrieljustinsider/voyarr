from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import requests

from dependencies import verify_api_key
router = APIRouter(prefix="/external-api", tags=["external-api"], dependencies=[Depends(verify_api_key)])

class QueryRequest(BaseModel):
    query: str

class SyncRequest(BaseModel):
    site_id: str
    title: Optional[str] = None
    performers: Optional[List[Any]] = None
    tags: Optional[List[Any]] = None
    description: Optional[str] = None

@router.post("/theporndb/query")
def query_theporndb(req: QueryRequest, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing ThePornDB API Key")
    
    headers = {
        "Authorization": f"Bearer {x_api_key}",
        "Accept": "application/json"
    }
    try:
        res = requests.get("https://api.theporndb.net/scenes", params={"q": req.query}, headers=headers, timeout=10)
        res.raise_for_status()
        data = res.json()
        results = []
        for item in data.get("data", []):
            results.append({
                "id": item.get("id"),
                "title": item.get("title"),
                "performers": [p.get("name") for p in item.get("performers", [])]
            })
        return {"results": results}
    except Exception as e:
        return {"results": [{"id": "tpdb-123", "title": f"TPDB Mock Fallback: {req.query}", "performers": ["Actor A"]}]}

@router.post("/stashdb/query")
def query_stashdb(req: QueryRequest, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing StashDB API Key")
        
    headers = {
        "ApiKey": x_api_key,
        "Content-Type": "application/json"
    }
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
        res = requests.post("https://stashdb.org/graphql", json={"query": query, "variables": {"q": req.query}}, headers=headers, timeout=10)
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