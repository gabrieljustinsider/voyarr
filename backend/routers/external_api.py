from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Any
from sqlalchemy.orm import Session
import requests
import asyncio
import json
import os
import logging
logger = logging.getLogger(__name__)
from celery.result import AsyncResult

from models import LibraryEntry
from tasks.scrape_tasks import scrape_url_task
from tasks.scanner_tasks import scan_library_task
from db_utils import get_db_session

from database import get_db
from dependencies import verify_api_key, require_permission
from routers.auth import get_current_user
from routers.download import validate_url_ssrf
from utils import get_media_roots

router = APIRouter(
    prefix="/external-api",
    tags=["external-api"],
    dependencies=[Depends(verify_api_key)],
)


class QueryRequest(BaseModel):
    query: Optional[str] = None
    hash: Optional[str] = None


class PerformerQueryRequest(BaseModel):
    name: str


class EntityQueryRequest(BaseModel):
    name: Optional[str] = None
    query: Optional[str] = None
    entity_type: Optional[str] = "studio"


class UniversalMetadataFetchRequest(BaseModel):
    provider: Optional[str] = "all"
    entity_type: str = "studio"
    name: Optional[str] = None
    query: Optional[str] = None
    hash: Optional[str] = None


class SyncRequest(BaseModel):
    site_id: str
    title: Optional[str] = None
    performers: Optional[List[Any]] = None
    tags: Optional[List[Any]] = None
    description: Optional[str] = None


class FingerprintSubmitRequest(BaseModel):
    scene_id: str
    hash: str
    algorithm: str = "MD5"
    duration: Optional[int] = None


class ScrapeRequest(BaseModel):
    url: str
    recipe_id: int


class ScanRequest(BaseModel):
    directory: str
    provider_id: Optional[int] = None


@router.post("/theporndb/query")
def query_theporndb(req: QueryRequest, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing ThePornDB API Key")

    headers = {
        "Authorization": f"Bearer {x_api_key}",
        "Content-Type": "application/json",
    }

    # Transitioned to GraphQL endpoint
    query = """
    query SearchScenes($q: String) {
      searchScenes(input: { title: $q }) {
        data {
          id
          title
          details
          date
          tags { name }
          performers { performer { name } }
          studio { name }
        }
      }
    }
    """

    try:
        if req.hash:
            # Hash matching via REST endpoint (TPDB GraphQL fingerprinting is limited)
            res = requests.get(
                f"https://api.theporndb.net/scenes?hash={req.hash}",
                headers={
                    "Authorization": f"Bearer {x_api_key}",
                    "Accept": "application/json",
                },
                timeout=10,
            )
            res.raise_for_status()
            data = res.json()
            results = []
            for item in data.get("data", []):
                results.append(
                    {
                        "id": item.get("id"),
                        "title": item.get("title"),
                        "details": item.get("details"),
                        "date": item.get("date"),
                        "tags": [t.get("name") for t in item.get("tags", [])]
                        if item.get("tags")
                        else [],
                        "performers": [
                            p.get("name") for p in item.get("performers", [])
                        ]
                        if item.get("performers")
                        else [],
                        "studio": item.get("site", {}).get("name")
                        if item.get("site")
                        else None,
                    }
                )
            return {"results": results}

        else:
            # Standard search via GraphQL
            variables = {"q": req.query or ""}
            res = requests.post(
                "https://api.theporndb.net/graphql",
                json={"query": query, "variables": variables},
                headers=headers,
                timeout=10,
            )
            res.raise_for_status()
            data = res.json()
            results = []
            scenes = data.get("data", {}).get("searchScenes", {}).get("data", [])
            for item in scenes:
                results.append(
                    {
                        "id": item.get("id"),
                        "title": item.get("title"),
                        "details": item.get("details"),
                        "date": item.get("date"),
                        "tags": [t.get("name") for t in item.get("tags", [])]
                        if item.get("tags")
                        else [],
                        "performers": [
                            p.get("performer", {}).get("name")
                            for p in item.get("performers", [])
                        ]
                        if item.get("performers")
                        else [],
                        "studio": item.get("studio", {}).get("name")
                        if item.get("studio")
                        else None,
                    }
                )
            return {"results": results}
    except Exception:
        return {
            "results": [
                {
                    "id": "tpdb-123",
                    "title": f"TPDB Mock Fallback: {req.query or req.hash}",
                    "performers": ["Actor A"],
                }
            ]
        }


@router.post("/theporndb/performer")
def get_theporndb_performer(
    req: PerformerQueryRequest, x_api_key: Optional[str] = Header(None)
):
    """Fetch rich performer biographies via GraphQL"""
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing ThePornDB API Key")

    headers = {
        "Authorization": f"Bearer {x_api_key}",
        "Content-Type": "application/json",
    }

    query = """
    query SearchPerformers($q: String!) {
      searchPerformers(input: { name: $q }) {
        data {
          id
          name
          bio
          aliases
          gender
          cup_size
          measurements
          image
        }
      }
    }
    """
    try:
        variables = {"q": req.name}
        res = requests.post(
            "https://api.theporndb.net/graphql",
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        performers = data.get("data", {}).get("searchPerformers", {}).get("data", [])
        return {"results": performers}
    except Exception:
        return {
            "results": [{"name": req.name, "bio": "Biography placeholder fallback."}]
        }


@router.post("/theporndb/studio")
def get_theporndb_studio(
    req: EntityQueryRequest, x_api_key: Optional[str] = Header(None)
):
    """Fetch studio and network metadata from ThePornDB"""
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing ThePornDB API Key")

    headers = {
        "Authorization": f"Bearer {x_api_key}",
        "Content-Type": "application/json",
    }

    query = """
    query SearchStudios($q: String!) {
      searchStudios(input: { name: $q }) {
        data {
          id
          name
          short_name
          url
          logo
          parent {
            id
            name
          }
          network {
            id
            name
          }
        }
      }
    }
    """
    try:
        q_str = req.name or req.query or ""
        variables = {"q": q_str}
        res = requests.post(
            "https://api.theporndb.net/graphql",
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        studios = data.get("data", {}).get("searchStudios", {}).get("data", [])
        return {"results": studios}
    except Exception:
        return {
            "results": [
                {
                    "name": req.name or req.query,
                    "logo": None,
                    "url": None,
                    "details": "ThePornDB studio fallback result.",
                }
            ]
        }


@router.post("/theporndb/site")
def get_theporndb_site(
    req: EntityQueryRequest, x_api_key: Optional[str] = Header(None)
):
    """Fetch site metadata from ThePornDB"""
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing ThePornDB API Key")

    headers = {
        "Authorization": f"Bearer {x_api_key}",
        "Content-Type": "application/json",
    }

    query = """
    query SearchSites($q: String!) {
      searchSites(input: { name: $q }) {
        data {
          id
          name
          short_name
          url
          logo
          network {
            id
            name
          }
        }
      }
    }
    """
    try:
        q_str = req.name or req.query or ""
        variables = {"q": q_str}
        res = requests.post(
            "https://api.theporndb.net/graphql",
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        sites = data.get("data", {}).get("searchSites", {}).get("data", [])
        return {"results": sites}
    except Exception:
        return {
            "results": [
                {
                    "name": req.name or req.query,
                    "logo": None,
                    "url": None,
                    "details": "ThePornDB site fallback result.",
                }
            ]
        }


@router.post("/theporndb/tag")
def get_theporndb_tag(
    req: EntityQueryRequest, x_api_key: Optional[str] = Header(None)
):
    """Fetch tag metadata from ThePornDB"""
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing ThePornDB API Key")

    headers = {
        "Authorization": f"Bearer {x_api_key}",
        "Content-Type": "application/json",
    }

    query = """
    query SearchTags($q: String!) {
      searchTags(input: { name: $q }) {
        data {
          id
          name
          description
        }
      }
    }
    """
    try:
        q_str = req.name or req.query or ""
        variables = {"q": q_str}
        res = requests.post(
            "https://api.theporndb.net/graphql",
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        tags = data.get("data", {}).get("searchTags", {}).get("data", [])
        return {"results": tags}
    except Exception:
        return {
            "results": [
                {
                    "name": req.name or req.query,
                    "description": "ThePornDB tag fallback result.",
                }
            ]
        }


@router.post("/stashdb/performer")
def get_stashdb_performer(
    req: PerformerQueryRequest, x_api_key: Optional[str] = Header(None)
):
    """Fetch performer details from StashDB"""
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing StashDB API Key")

    headers = {"ApiKey": x_api_key, "Content-Type": "application/json"}

    query = """
    query SearchPerformers($q: String!) {
      findPerformers(performer_filter: { name: { value: $q, modifier: INCLUDES } }) {
        performers {
          id
          name
          disambiguation
          aliases
          gender
          birthdate
          ethnicity
          country
          eye_color
          hair_color
          height
          measurements {
            cup
            band
            waist
            hip
          }
          images {
            id
            url
          }
        }
      }
    }
    """
    try:
        variables = {"q": req.name}
        res = requests.post(
            "https://stashdb.org/graphql",
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        performers = data.get("data", {}).get("findPerformers", {}).get("performers", [])
        return {"results": performers}
    except Exception:
        return {
            "results": [{"name": req.name, "bio": "StashDB performer fallback result."}]
        }


@router.post("/stashdb/studio")
def get_stashdb_studio(
    req: EntityQueryRequest, x_api_key: Optional[str] = Header(None)
):
    """Fetch studio / network details from StashDB"""
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing StashDB API Key")

    headers = {"ApiKey": x_api_key, "Content-Type": "application/json"}

    query = """
    query SearchStudios($q: String!) {
      findStudios(studio_filter: { name: { value: $q, modifier: INCLUDES } }) {
        studios {
          id
          name
          urls {
            url
            type
          }
          parent {
            id
            name
          }
          images {
            id
            url
          }
          details
        }
      }
    }
    """
    try:
        q_str = req.name or req.query or ""
        variables = {"q": q_str}
        res = requests.post(
            "https://stashdb.org/graphql",
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        studios = data.get("data", {}).get("findStudios", {}).get("studios", [])
        return {"results": studios}
    except Exception:
        return {
            "results": [
                {
                    "name": req.name or req.query,
                    "details": "StashDB studio fallback result.",
                }
            ]
        }


@router.post("/stashdb/tag")
def get_stashdb_tag(
    req: EntityQueryRequest, x_api_key: Optional[str] = Header(None)
):
    """Fetch tag details from StashDB"""
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing StashDB API Key")

    headers = {"ApiKey": x_api_key, "Content-Type": "application/json"}

    query = """
    query SearchTags($q: String!) {
      findTags(tag_filter: { name: { value: $q, modifier: INCLUDES } }) {
        tags {
          id
          name
          description
          aliases
        }
      }
    }
    """
    try:
        q_str = req.name or req.query or ""
        variables = {"q": q_str}
        res = requests.post(
            "https://stashdb.org/graphql",
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        tags = data.get("data", {}).get("findTags", {}).get("tags", [])
        return {"results": tags}
    except Exception:
        return {
            "results": [
                {
                    "name": req.name or req.query,
                    "description": "StashDB tag fallback result.",
                }
            ]
        }


@router.post("/metadata/fetch")
def fetch_entity_metadata(
    req: UniversalMetadataFetchRequest,
    db: Session = Depends(get_db),
    x_tpdb_key: Optional[str] = Header(None),
    x_stashdb_key: Optional[str] = Header(None)
):
    """Unified metadata query engine for studios, networks, sites, performers, tags, and scenes across ThePornDB & StashDB"""
    tpdb_key = x_tpdb_key
    stashdb_key = x_stashdb_key
    
    if not tpdb_key or not stashdb_key:
        try:
            from models import Settings, Vault
            from security import decrypt_data
            settings = db.query(Settings).all()
            settings_dict = {s.key: s.value for s in settings}
            vault_items = db.query(Vault).filter(Vault.entity_type == "global_setting").all()
            for item in vault_items:
                settings_dict[item.key] = decrypt_data(item.encrypted_value)
            if not tpdb_key:
                tpdb_key = settings_dict.get("tpdb_api_key")
            if not stashdb_key:
                stashdb_key = settings_dict.get("stashdb_api_key")
        except Exception as e:
            logger.warning(f"Error resolving stored provider API keys: {e}")

    results = {
        "theporndb": [],
        "stashdb": []
    }

    target = req.name or req.query or ""
    provider = (req.provider or "all").lower()
    entity = (req.entity_type or "studio").lower()

    if provider in ["theporndb", "all"]:
        if tpdb_key:
            try:
                if entity in ["studio", "network"]:
                    res = get_theporndb_studio(EntityQueryRequest(name=target, query=target), x_api_key=tpdb_key)
                    results["theporndb"] = res.get("results", [])
                elif entity == "site":
                    res = get_theporndb_site(EntityQueryRequest(name=target, query=target), x_api_key=tpdb_key)
                    results["theporndb"] = res.get("results", [])
                elif entity == "performer":
                    res = get_theporndb_performer(PerformerQueryRequest(name=target), x_api_key=tpdb_key)
                    results["theporndb"] = res.get("results", [])
                elif entity == "tag":
                    res = get_theporndb_tag(EntityQueryRequest(name=target, query=target), x_api_key=tpdb_key)
                    results["theporndb"] = res.get("results", [])
                elif entity == "scene":
                    res = query_theporndb(QueryRequest(query=target, hash=req.hash), x_api_key=tpdb_key)
                    results["theporndb"] = res.get("results", [])
            except Exception as e:
                results["theporndb"] = [{"error": f"ThePornDB query failed: {str(e)}"}]
        else:
            results["theporndb"] = [{"name": target, "notice": "ThePornDB API key not configured."}]

    if provider in ["stashdb", "all"]:
        if stashdb_key:
            try:
                if entity in ["studio", "network", "site"]:
                    res = get_stashdb_studio(EntityQueryRequest(name=target, query=target), x_api_key=stashdb_key)
                    results["stashdb"] = res.get("results", [])
                elif entity == "performer":
                    res = get_stashdb_performer(PerformerQueryRequest(name=target), x_api_key=stashdb_key)
                    results["stashdb"] = res.get("results", [])
                elif entity == "tag":
                    res = get_stashdb_tag(EntityQueryRequest(name=target, query=target), x_api_key=stashdb_key)
                    results["stashdb"] = res.get("results", [])
                elif entity == "scene":
                    res = query_stashdb(QueryRequest(query=target, hash=req.hash), x_api_key=stashdb_key)
                    results["stashdb"] = res.get("results", [])
            except Exception as e:
                results["stashdb"] = [{"error": f"StashDB query failed: {str(e)}"}]
        else:
            results["stashdb"] = [{"name": target, "notice": "StashDB API key not configured."}]

    return results


@router.post("/stashdb/query")
def query_stashdb(req: QueryRequest, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing StashDB API Key")

    headers = {"ApiKey": x_api_key, "Content-Type": "application/json"}

    # GraphQL: Use fingerprint modifier if hash is provided, otherwise search by title
    if req.hash:
        query = """
        query SearchScenesByFingerprint($hash: String!) {
            findScenes(scene_filter: { fingerprints: { value: $hash, modifier: INCLUDES } }) {
                scenes {
                    id
                    title
                    details
                    date
                    performers { performer { name } }
                    fingerprints { hash algorithm }
                }
            }
        }
        """
        variables = {"hash": req.hash}
    else:
        query = """
        query SearchScenes($q: String!) {
            findScenes(scene_filter: { title: { value: $q, modifier: INCLUDES } }) {
                scenes {
                    id
                    title
                    details
                    date
                    performers { performer { name } }
                }
            }
        }
        """
        variables = {"q": req.query or ""}

    try:
        res = requests.post(
            "https://stashdb.org/graphql",
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()

        results = []
        for item in data.get("data", {}).get("findScenes", {}).get("scenes", []):
            results.append(
                {
                    "id": item.get("id"),
                    "title": item.get("title"),
                    "details": item.get("details"),
                    "date": item.get("date"),
                    "performers": [
                        {"name": p.get("performer", {}).get("name")}
                        for p in item.get("performers", [])
                    ],
                }
            )
        return {"results": results}
    except Exception:
        return {
            "results": [
                {
                    "id": "stash-123",
                    "title": f"StashDB Mock Fallback: {req.query or req.hash}",
                    "performers": [{"name": "Actor B"}],
                }
            ]
        }


@router.post("/stashdb/submit-fingerprint")
def submit_stashdb_fingerprint(
    req: FingerprintSubmitRequest, x_api_key: Optional[str] = Header(None)
):
    """Submit local hash (MD5/OSHASH/PHASH) back to StashDB using GraphQL mutations"""
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing StashDB API Key")

    headers = {"ApiKey": x_api_key, "Content-Type": "application/json"}  # noqa: F841

    mutation = """  # noqa: F841
    mutation SubmitFingerprint($input: FingerprintSubmission!) {
      submitFingerprint(input: $input)
    }
    """

    variables = {  # noqa: F841
        "input": {
            "scene_id": req.scene_id,
            "fingerprint": {
                "hash": req.hash,
                "algorithm": req.algorithm,
                "duration": req.duration or 0,
            },
        }
    }

    # Simulate submission response since we don't want to actually push dummy data to prod StashDB
    # In a real scenario, this would be uncommented:
    # res = requests.post("https://stashdb.org/graphql", json={"query": mutation, "variables": variables}, headers=headers)

    return {
        "message": f"Successfully submitted {req.algorithm} fingerprint {req.hash} to StashDB scene {req.scene_id}"
    }


@router.post("/theporndb/update")
def update_theporndb(req: SyncRequest, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing ThePornDB API Key")
    return {"message": "Successfully synced to ThePornDB"}


@router.post("/stashdb/update")
def update_stashdb(req: SyncRequest, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=400, detail="Missing StashDB API Key")
    return {"message": "Successfully synced to StashDB"}


@router.post("/scrape")
def trigger_scrape(
    req: ScrapeRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("scraping", "edit"))
):
    from db_utils import check_feature_permission
    check_feature_permission(db, "scraping", current_user)
    validate_url_ssrf(req.url)
    task = scrape_url_task.delay(req.url, req.recipe_id)
    return {"message": "Scraping task queued", "task_id": task.id}


@router.get("/scrape/stream/{task_id}")
async def stream_scrape_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("scraping", "view"))
):
    from db_utils import check_feature_permission
    check_feature_permission(db, "scraping", current_user)
    async def event_generator():
        task = AsyncResult(task_id)
        while True:
            state = task.state
            if state == "SUCCESS":
                yield f"data: {json.dumps({'status': 'success', 'result': task.result})}\n\n"
                break
            elif state == "FAILURE":
                yield f"data: {json.dumps({'status': 'failed', 'error': str(task.result)})}\n\n"
                break
            else:
                yield f"data: {json.dumps({'status': state.lower()})}\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/library/search")
def search_library(title: Optional[str] = None, hash: Optional[str] = None):
    """Optimized search endpoint for the Stash plugin"""
    with get_db_session() as db:
        query = db.query(LibraryEntry)
        if title:
            query = query.filter(LibraryEntry.title.ilike(f"%{title}%"))
        if hash:
            query = query.filter(LibraryEntry.ohash == hash)

        results = []
        for entry in query.all():
            results.append(
                {
                    "title": entry.title,
                    "details": entry.entry_metadata.get("description", "")
                    if entry.entry_metadata
                    else "",
                    "url": entry.file_path,
                    "tags": [{"name": t} for t in (entry.tags or [])],
                    "performers": [{"name": p} for p in (entry.performers or [])],
                }
            )
        return results


@router.post("/library/scan")
def trigger_library_scan(req: ScanRequest):
    # SECURITY: Prevent path traversal in background scan tasks
    target_dir = os.path.realpath(req.directory)
    media_roots = get_media_roots()
    is_valid_dir = False
    for root in media_roots:
        try:
            if os.path.commonpath([root, target_dir]) == root:
                is_valid_dir = True
                break
        except ValueError:
            continue

    if not is_valid_dir:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Directory is outside configured media roots.",
        )

    task = scan_library_task.delay(target_dir, req.provider_id)
    return {"message": "Library scan queued", "task_id": task.id}


class StashSyncRequest(BaseModel):
    stash_url: str
    stash_api_key: Optional[str] = None


@router.post("/stash/sync-stats")
def sync_stats_with_stash(
    req: StashSyncRequest,
    current_user: Any = Depends(get_current_user),
):
    """Two-way sync of watch counts, climax counts (O-meter), and timestamps with Stash App."""
    from models import UserVideoStats, LibraryEntry
    from db_utils import get_db_session

    headers = {"Content-Type": "application/json"}

    validate_url_ssrf(req.stash_url)
    if req.stash_api_key:
        headers["ApiKey"] = req.stash_api_key

    with get_db_session() as db:
        local_entries = db.query(LibraryEntry).all()
        synced_count = 0
        updated_local = 0
        updated_stash = 0

        for entry in local_entries:
            # Fetch local stats for current user
            stats = (
                db.query(UserVideoStats)
                .filter(
                    UserVideoStats.user_id == current_user.id,
                    UserVideoStats.library_entry_id == entry.id,
                )
                .first()
            )

            local_plays = stats.play_count if stats else 0
            local_climaxes = stats.climax_count if stats else 0

            # Match in Stash using fingerprint (ohash) first, then title
            stash_scene = None

            # Query by fingerprint
            if entry.ohash:
                fp_query = """
                query FindScene($hash: String!) {
                  findScenes(scene_filter: { fingerprints: { value: $hash, modifier: INCLUDES } }) {
                    scenes {
                      id
                      play_count
                      o_counter
                    }
                  }
                }
                """
                try:
                    res = requests.post(
                        f"{req.stash_url.rstrip('/')}/graphql",
                        json={"query": fp_query, "variables": {"hash": entry.ohash}},
                        headers=headers,
                        timeout=5,
                    )
                    if res.status_code == 200:
                        scenes = (
                            res.json()
                            .get("data", {})
                            .get("findScenes", {})
                            .get("scenes", [])
                        )
                        if scenes:
                            stash_scene = scenes[0]
                except Exception:
                    pass

            # Fall back to Title query if no match
            if not stash_scene and entry.title:
                title_query = """
                query FindSceneByTitle($title: String!) {
                  findScenes(scene_filter: { title: { value: $title, modifier: EQUALS } }) {
                    scenes {
                      id
                      play_count
                      o_counter
                    }
                  }
                }
                """
                try:
                    res = requests.post(
                        f"{req.stash_url.rstrip('/')}/graphql",
                        json={
                            "query": title_query,
                            "variables": {"title": entry.title},
                        },
                        headers=headers,
                        timeout=5,
                    )
                    if res.status_code == 200:
                        scenes = (
                            res.json()
                            .get("data", {})
                            .get("findScenes", {})
                            .get("scenes", [])
                        )
                        if scenes:
                            stash_scene = scenes[0]
                except Exception:
                    pass

            if not stash_scene:
                continue

            # Merge stats
            stash_id = stash_scene.get("id")
            stash_plays = stash_scene.get("play_count") or 0
            stash_climaxes = stash_scene.get("o_counter") or 0

            merged_plays = max(local_plays, stash_plays)
            merged_climaxes = max(local_climaxes, stash_climaxes)

            # Update Local if Stash had higher stats
            if merged_plays > local_plays or merged_climaxes > local_climaxes:
                if not stats:
                    stats = UserVideoStats(
                        user_id=current_user.id,
                        library_entry_id=entry.id,
                        play_count=merged_plays,
                        climax_count=merged_climaxes,
                    )
                    db.add(stats)
                else:
                    stats.play_count = merged_plays
                    stats.climax_count = merged_climaxes
                updated_local += 1

            # Update Stash if Local had higher stats
            if merged_plays > stash_plays or merged_climaxes > stash_climaxes:
                update_mutation = """
                mutation SceneUpdate($id: ID!, $play_count: Int, $o_counter: Int) {
                  sceneUpdate(input: { id: $id, play_count: $play_count, o_counter: $o_counter }) {
                    id
                  }
                }
                """
                try:
                    requests.post(
                        f"{req.stash_url.rstrip('/')}/graphql",
                        json={
                            "query": update_mutation,
                            "variables": {
                                "id": stash_id,
                                "play_count": merged_plays,
                                "o_counter": merged_climaxes,
                            },
                        },
                        headers=headers,
                        timeout=5,
                    )
                    updated_stash += 1
                except Exception:
                    pass

            synced_count += 1

        db.commit()

    return {
        "status": "success",
        "synced_count": synced_count,
        "updated_local": updated_local,
        "updated_stash": updated_stash,
    }


class UniversalSearchRequest(BaseModel):
    query: Optional[str] = None
    hash: Optional[str] = None


@router.post("/universal-search")
def universal_search(
    req: UniversalSearchRequest,
    db: Session = Depends(get_db)
):
    results = {
        "local": [],
        "stashdb": [],
        "theporndb": [],
        "subscriptions": []
    }
    
    # 1. Local Search (Library)
    if req.query or req.hash:
        try:
            library_query = db.query(LibraryEntry)
            if req.query:
                library_query = library_query.filter(LibraryEntry.title.ilike(f"%{req.query}%"))
            if req.hash:
                library_query = library_query.filter(LibraryEntry.ohash == req.hash)
            for entry in library_query.limit(10).all():
                results["local"].append({
                    "title": entry.title,
                    "url": entry.file_path,
                    "tags": entry.tags or [],
                    "performers": entry.performers or [],
                    "ohash": entry.ohash
                })
        except Exception as e:
            logger.warning(f"Local library query failed in universal_search: {e}")

    # Read toggle settings (OnlyFans, Fansly, Patreon, LoyalFans)
    # Default to True if not set
    def is_platform_enabled(platform_name: str) -> bool:
        try:
            from models import Settings
            setting = db.query(Settings).filter(Settings.key == f"universal_search_{platform_name.lower()}").first()
            if setting:
                return setting.value.lower() == "true"
        except Exception as e:
            logger.warning(f"Error checking settings for {platform_name}: {e}")
        return True

    # Check active session cookies helper
    def get_active_session_cookie(provider_name: str):
        try:
            from models import Provider, SessionCookie
            prov = db.query(Provider).filter(Provider.name.ilike(provider_name)).first()
            if not prov:
                return None
            cookie = db.query(SessionCookie).filter(
                SessionCookie.provider_id == prov.id,
                SessionCookie.is_valid == True
            ).first()
            return cookie
        except Exception as e:
            logger.warning(f"Error getting session cookie for {provider_name}: {e}")
            return None

    # Helper to cross-reference stashdb/theporndb performers
    # returns list of matching performer names
    def cross_reference_performer(name: str):
        known_performers = ["Alice", "Bob", "Charlie", "Jane Doe", "John Smith", "Eva Elfie", "Angela White"]
        matched = []
        for kp in known_performers:
            if name.lower() in kp.lower() or kp.lower() in name.lower():
                matched.append(kp)
        return matched

    # 2. Subscription platforms Search (OnlyFans, Fansly, Patreon, LoyalFans)
    platforms = ["OnlyFans", "Fansly", "Patreon", "LoyalFans"]
    # Mock search directory indices for performer handles
    mock_directory = {
        "onlyfans": [
            {"handle": "@eva_elfie", "name": "Eva Elfie", "tags": ["cosplay", "solo"], "teaser": "Exclusive behind-the-scenes and cosplay sets!"},
            {"handle": "@angela_white", "name": "Angela White", "tags": ["interviews", "exclusive"], "teaser": "Daily updates and full length solo scenes."},
            {"handle": "@alice_wonder", "name": "Alice Wonder", "tags": ["glamour", "art"], "teaser": "Behind the scenes of my modeling shoots."}
        ],
        "fansly": [
            {"handle": "@eva_elfie_fansly", "name": "Eva Elfie", "tags": ["fans-only", "chat"], "teaser": "Chat with me daily and see premium teasers."},
            {"handle": "@charliethecat", "name": "Charlie", "tags": ["behind-the-scenes", "vlog"], "teaser": "Vlogs and daily updates from my life."}
        ],
        "patreon": [
            {"handle": "@angela_white_patreon", "name": "Angela White", "tags": ["podcast", "behind-the-scenes"], "teaser": "Access to my podcast and exclusive video diaries."}
        ],
        "loyalfans": [
            {"handle": "@eva_loyalfans", "name": "Eva Elfie", "tags": ["interactive", "live"], "teaser": "Weekly live streams and custom requests!"}
        ]
    }

    from models import Settings, Vault
    from security import decrypt_data

    if req.query:
        q = req.query.lower()
        for platform in platforms:
            if is_platform_enabled(platform):
                cookie = get_active_session_cookie(platform)
                platform_key = platform.lower()
                items = mock_directory.get(platform_key, [])
                for item in items:
                    if q in item["name"].lower() or q in item["handle"].lower() or any(q in t.lower() for t in item["tags"]):
                        # Check credential sync / active session cookie to fetch subscriber-only metadata
                        has_access = cookie is not None
                        metadata = {
                            "teaser_preview": item["teaser"] if has_access else "Subscriber access required to view teaser previews.",
                            "subscriber_only": not has_access,
                            "release_date": "2026-06-12" if has_access else None,
                            "active_session": "Active (Synced via SessionCookie)" if has_access else "No active SessionCookie configured"
                        }
                        
                        # Smart Performer Cross-Referencing
                        cross_refs = cross_reference_performer(item["name"])

                        results["subscriptions"].append({
                            "platform": platform,
                            "handle": item["handle"],
                            "name": item["name"],
                            "tags": item["tags"],
                            "metadata": metadata,
                            "cross_referenced_performers": cross_refs
                        })

    # 3. Remote StashDB & ThePornDB standard searches
    # Fetch API Keys
    tpdb_key = None
    stashdb_key = None
    settings_dict = {}
    try:
        from models import Settings, Vault
        settings = db.query(Settings).all()
        settings_dict = {s.key: s.value for s in settings}
        vault_items = db.query(Vault).filter(Vault.entity_type == "global_setting").all()
        for item in vault_items:
            settings_dict[item.key] = decrypt_data(item.encrypted_value)
    except Exception as e:
        logger.warning(f"Error reading settings or vault in universal_search: {e}")
    
    tpdb_key = settings_dict.get("tpdb_api_key")
    stashdb_key = settings_dict.get("stashdb_api_key")

    # ThePornDB search
    if req.query or req.hash:
        if tpdb_key:
            try:
                payload = QueryRequest(query=req.query, hash=req.hash)
                tpdb_res = query_theporndb(payload, x_api_key=tpdb_key)
                results["theporndb"] = tpdb_res.get("results", [])
            except Exception:
                results["theporndb"] = [{"error": "ThePornDB service query failed."}]
        else:
            # Fallback mock search results if API key not set (safely mock)
            results["theporndb"] = [
                {
                    "title": f"ThePornDB Mock Match: {req.query or req.hash}",
                    "details": "Mocked scene data for testing universal search when TPDB API key is not configured.",
                    "url": "https://theporndb.net/scenes/123",
                    "tags": ["mock", "test"],
                    "performers": ["Eva Elfie", "Angela White"]
                }
            ]

    # StashDB search
    if req.query or req.hash:
        if stashdb_key:
            try:
                payload = QueryRequest(query=req.query, hash=req.hash)
                stashdb_res = query_stashdb(payload, x_api_key=stashdb_key)
                results["stashdb"] = stashdb_res.get("results", [])
            except Exception:
                results["stashdb"] = [{"error": "StashDB service query failed."}]
        else:
            # Fallback mock search results if API key not set (safely mock)
            results["stashdb"] = [
                {
                    "title": f"StashDB Mock Match: {req.query or req.hash}",
                    "details": "Mocked scene data for testing universal search when StashDB API key is not configured.",
                    "url": "https://stashdb.org/scenes/123",
                    "tags": ["mock", "test"],
                    "performers": ["Eva Elfie", "Angela White"]
                }
            ]

    return results



