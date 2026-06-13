from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from database import get_db
from models import PeerNode, PeerSyncLog, Provider, SiteRecipe, LibraryEntry, Settings
from schemas import (
    PeerNodeCreate,
    PeerNodeUpdate,
    PeerNodeResponse,
    PeerSyncLogResponse,
)
from dependencies import verify_api_key
from typing import List, Dict, Any, Optional
import json
from datetime import datetime, timezone

router = APIRouter(prefix="/p2p", tags=["p2p"])


# Custom dependency for secure inbound P2P communication
async def verify_p2p_token(
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
    x_p2p_token: Optional[str] = Header(None, alias="X-P2P-Token"),
    db: Session = Depends(get_db),
):
    provided_token = x_api_key or x_p2p_token
    if not provided_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Missing authentication credentials (x-api-key or X-P2P-Token header).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    peer = db.query(PeerNode).filter(PeerNode.inbound_token == provided_token).first()
    if not peer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid P2P authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if peer.status == "inactive":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: This peer node is currently inactive.",
        )

    return peer


# ==========================================
# 1. P2P INBOUND GATEWAYS
# ==========================================


@router.get("/ping")
def ping_peer(peer: PeerNode = Depends(verify_p2p_token)):
    """Verifies dynamic connectivity and returns software version."""
    return {
        "status": "online",
        "peer_name": peer.name,
        "version": "1.18.9",
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/recipes/pull")
def pull_recipes(
    peer: PeerNode = Depends(verify_p2p_token), db: Session = Depends(get_db)
):
    """Exports local site recipes for the peer."""
    # Retrieve all providers and site recipes
    providers = db.query(Provider).all()
    recipes = db.query(SiteRecipe).all()

    providers_data = []
    for p in providers:
        providers_data.append(
            {
                "name": p.name,
                "base_url": p.base_url,
                "naming_pattern": p.naming_pattern,
                "separator": p.separator,
                "space_replacement": p.space_replacement,
                "automatic_limits": p.automatic_limits,
                "supported_methods": p.supported_methods,
            }
        )

    recipes_data = []
    for r in recipes:
        prov = db.query(Provider).filter(Provider.id == r.provider_id).first()
        if not prov:
            continue
        recipes_data.append(
            {
                "provider_name": prov.name,
                "css_selectors": r.css_selectors,
                "xpath_selectors": r.xpath_selectors,
                "regex_patterns": r.regex_patterns,
                "map_mode_data": r.map_mode_data,
            }
        )

    return {"providers": providers_data, "recipes": recipes_data}


@router.post("/recipes/push")
def push_recipes(
    payload: Dict[str, Any],
    peer: PeerNode = Depends(verify_p2p_token),
    db: Session = Depends(get_db),
):
    """Inbound handler that parses and merges site selectors from the peer."""
    providers_pushed = payload.get("providers", [])
    recipes_pushed = payload.get("recipes", [])

    if peer.recipe_sync_mode == "manual_review":
        # Save to proposed queue in Settings
        proposed_setting = (
            db.query(Settings).filter(Settings.key == "p2p_proposed_recipes").first()
        )
        if proposed_setting:
            proposed_list = json.loads(proposed_setting.value)
        else:
            proposed_list = []
            proposed_setting = Settings(key="p2p_proposed_recipes", value="[]")
            db.add(proposed_setting)

        proposed_item = {
            "peer_id": peer.id,
            "peer_name": peer.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "providers": providers_pushed,
            "recipes": recipes_pushed,
            "status": "pending",
        }
        proposed_list.append(proposed_item)
        proposed_setting.value = json.dumps(proposed_list)
        db.commit()

        return {
            "status": "queued",
            "message": f"Successfully queued {len(recipes_pushed)} recipes for manual review.",
        }

    else:  # auto_merge
        recipes_merged = 0
        for r_pushed in recipes_pushed:
            prov_name = r_pushed.get("provider_name")
            if not prov_name:
                continue

            # Find or create provider
            db_prov = db.query(Provider).filter(Provider.name == prov_name).first()
            if not db_prov:
                # Find details from providers list in payload
                p_details = next(
                    (p for p in providers_pushed if p.get("name") == prov_name), {}
                )
                
                base_url = p_details.get("base_url")
                if base_url:
                    from utils import validate_url_ssrf
                    validate_url_ssrf(base_url)
                else:
                    base_url = f"https://{prov_name.lower()}.com"

                db_prov = Provider(
                    name=prov_name,
                    base_url=base_url,
                    naming_pattern=p_details.get("naming_pattern"),
                    separator=p_details.get("separator", "_"),
                    space_replacement=p_details.get("space_replacement", "_"),
                    automatic_limits=p_details.get("automatic_limits"),
                    supported_methods=p_details.get("supported_methods", []),
                )
                db.add(db_prov)
                db.commit()
                db.refresh(db_prov)

            # Merge recipe
            db_recipe = (
                db.query(SiteRecipe)
                .filter(SiteRecipe.provider_id == db_prov.id)
                .first()
            )
            if not db_recipe:
                db_recipe = SiteRecipe(
                    provider_id=db_prov.id,
                    css_selectors=r_pushed.get("css_selectors"),
                    xpath_selectors=r_pushed.get("xpath_selectors"),
                    regex_patterns=r_pushed.get("regex_patterns"),
                    map_mode_data=r_pushed.get("map_mode_data"),
                )
                db.add(db_recipe)
            else:
                # Merge logic: if local is empty, use pushed; otherwise keep or overwrite based on completeness
                db_recipe.css_selectors = db_recipe.css_selectors or r_pushed.get(
                    "css_selectors"
                )
                db_recipe.xpath_selectors = db_recipe.xpath_selectors or r_pushed.get(
                    "xpath_selectors"
                )
                db_recipe.regex_patterns = db_recipe.regex_patterns or r_pushed.get(
                    "regex_patterns"
                )
                db_recipe.map_mode_data = db_recipe.map_mode_data or r_pushed.get(
                    "map_mode_data"
                )

            recipes_merged += 1

        db.commit()
        return {
            "status": "merged",
            "message": f"Successfully auto-merged {recipes_merged} site recipes.",
        }


@router.post("/library/reconcile")
def reconcile_library(
    payload: Dict[str, Any],
    peer: PeerNode = Depends(verify_p2p_token),
    db: Session = Depends(get_db),
):
    """Reconciles library entry lists from the peer against local data and returns missing info/updates."""
    peer_entries = payload.get("entries", [])

    # Filter incoming list by allowed providers if specific_providers scope is selected
    allowed_provider_ids = (
        peer.allowed_providers if peer.library_scope == "specific_providers" else []
    )

    metadata_updates = []
    missing_items = []

    for entry in peer_entries:
        prov_name = entry.get("provider_name")
        ohash = entry.get("ohash")
        phash = entry.get("phash")
        site_id = entry.get("site_id")

        # Privacy bounds: verify provider is allowed
        if peer.library_scope == "specific_providers":
            db_prov = db.query(Provider).filter(Provider.name == prov_name).first()
            if not db_prov or db_prov.id not in allowed_provider_ids:
                continue

        # Look for local match by ohash, phash, or provider/site_id
        db_entry = None
        if ohash:
            db_entry = (
                db.query(LibraryEntry).filter(LibraryEntry.ohash == ohash).first()
            )
        if not db_entry and phash:
            db_entry = (
                db.query(LibraryEntry).filter(LibraryEntry.phash == phash).first()
            )
        if not db_entry and site_id and prov_name:
            db_prov = db.query(Provider).filter(Provider.name == prov_name).first()
            if db_prov:
                db_entry = (
                    db.query(LibraryEntry)
                    .filter(
                        LibraryEntry.provider_id == db_prov.id,
                        LibraryEntry.site_id == site_id,
                    )
                    .first()
                )

        if db_entry:
            # We found a local match! Compare metadata to see if we can provide/suggest updates
            # e.g., missing tags or performers, or higher resolution
            local_tags = db_entry.tags or []
            local_performers = db_entry.performers or []
            peer_tags = entry.get("tags") or []
            peer_performers = entry.get("performers") or []

            # Find tags or performers we have that the peer is missing
            new_tags = [t for t in local_tags if t not in peer_tags]
            new_performers = [p for p in local_performers if p not in peer_performers]

            # Resolution compare
            peer_res = entry.get("resolution")
            local_res = db_entry.resolution
            better_resolution = None
            if local_res and peer_res:
                try:
                    # Very simple resolution comparator
                    l_h = int(
                        local_res.replace("p", "")
                        .replace("K", "000")
                        .replace("k", "000")
                    )
                    p_h = int(
                        peer_res.replace("p", "")
                        .replace("K", "000")
                        .replace("k", "000")
                    )
                    if l_h > p_h:
                        better_resolution = local_res
                except Exception:
                    pass

            if new_tags or new_performers or better_resolution:
                metadata_updates.append(
                    {
                        "ohash": db_entry.ohash,
                        "phash": db_entry.phash,
                        "site_id": db_entry.site_id,
                        "provider_name": prov_name,
                        "new_tags": new_tags,
                        "new_performers": new_performers,
                        "better_resolution": better_resolution,
                    }
                )
        else:
            # Not found locally. Add to missing lists if they have complete metadata we might want
            missing_items.append(
                {
                    "title": entry.get("title"),
                    "provider_name": prov_name,
                    "site_id": site_id,
                    "ohash": ohash,
                    "phash": phash,
                    "performers": entry.get("performers"),
                    "tags": entry.get("tags"),
                    "resolution": entry.get("resolution"),
                }
            )

    return {"metadata_updates": metadata_updates, "missing_items": missing_items}


# ==========================================
# 2. P2P MANAGEMENT ENDPOINTS
# ==========================================


@router.get(
    "/nodes",
    response_model=List[PeerNodeResponse],
    dependencies=[Depends(verify_api_key)],
)
def list_peer_nodes(db: Session = Depends(get_db)):
    """List all trusted peer instances."""
    return db.query(PeerNode).order_by(PeerNode.created_at.desc()).all()


@router.post(
    "/nodes", response_model=PeerNodeResponse, dependencies=[Depends(verify_api_key)]
)
def create_peer_node(node: PeerNodeCreate, db: Session = Depends(get_db)):
    """Register a new trusted peer instance."""
    # Check duplicate name
    existing = db.query(PeerNode).filter(PeerNode.name == node.name).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="A peer node with this name already exists."
        )

    db_node = PeerNode(
        name=node.name,
        peer_url=node.peer_url,
        outbound_key=node.outbound_key,
        inbound_token=node.inbound_token,
        recipe_sync_mode=node.recipe_sync_mode,
        sync_schedule=node.sync_schedule,
        library_scope=node.library_scope,
        allowed_providers=node.allowed_providers or [],
        status="inactive",
    )
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node


@router.put(
    "/nodes/{node_id}",
    response_model=PeerNodeResponse,
    dependencies=[Depends(verify_api_key)],
)
def update_peer_node(node_id: int, node: PeerNodeUpdate, db: Session = Depends(get_db)):
    """Update configurations or status of a registered peer."""
    db_node = db.query(PeerNode).filter(PeerNode.id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Peer node not found.")

    if node.name is not None:
        db_node.name = node.name
    if node.peer_url is not None:
        db_node.peer_url = node.peer_url
    if node.outbound_key is not None:
        db_node.outbound_key = node.outbound_key
    if node.inbound_token is not None:
        db_node.inbound_token = node.inbound_token
    if node.status is not None:
        db_node.status = node.status
    if node.recipe_sync_mode is not None:
        db_node.recipe_sync_mode = node.recipe_sync_mode
    if node.sync_schedule is not None:
        db_node.sync_schedule = node.sync_schedule
        # Reset next_run so scheduling triggers correctly
        db_node.next_run = None
    if node.library_scope is not None:
        db_node.library_scope = node.library_scope
    if node.allowed_providers is not None:
        db_node.allowed_providers = node.allowed_providers

    db.commit()
    db.refresh(db_node)
    return db_node


@router.delete("/nodes/{node_id}", dependencies=[Depends(verify_api_key)])
def delete_peer_node(node_id: int, db: Session = Depends(get_db)):
    """Remove a peer node from the registry."""
    db_node = db.query(PeerNode).filter(PeerNode.id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Peer node not found.")

    db.delete(db_node)
    db.commit()
    return {"message": "Peer node successfully removed."}


@router.get(
    "/nodes/{node_id}/logs",
    response_model=List[PeerSyncLogResponse],
    dependencies=[Depends(verify_api_key)],
)
def get_sync_logs(node_id: int, db: Session = Depends(get_db)):
    """Fetch history of synchronization runs for a peer node."""
    return (
        db.query(PeerSyncLog)
        .filter(PeerSyncLog.peer_id == node_id)
        .order_by(PeerSyncLog.created_at.desc())
        .all()
    )


@router.post("/nodes/{node_id}/sync", dependencies=[Depends(verify_api_key)])
def trigger_peer_sync(node_id: int, db: Session = Depends(get_db)):
    """Enqueues an active background P2P sync task for a peer node."""
    db_node = db.query(PeerNode).filter(PeerNode.id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Peer node not found.")

    from celery_app import celery_app

    task = celery_app.send_task("tasks.p2p_tasks.sync_with_peer_task", args=[node_id])
    return {
        "message": f"Sync task enqueued successfully for peer '{db_node.name}'",
        "task_id": task.id,
    }


@router.post("/nodes/{node_id}/test-connection", dependencies=[Depends(verify_api_key)])
async def test_peer_connection(node_id: int, db: Session = Depends(get_db)):
    """Asynchronously pings a peer to verify connectivity."""
    db_node = db.query(PeerNode).filter(PeerNode.id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Peer node not found.")

    import httpx

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"x-api-key": db_node.outbound_key}
            response = await client.get(
                f"{db_node.peer_url.rstrip('/')}/api/p2p/ping", headers=headers
            )
            if response.status_code == 200:
                data = response.json()
                db_node.status = "active"
                db.commit()
                return {
                    "connected": True,
                    "message": "Connection verified!",
                    "peer_details": data,
                }
            else:
                db_node.status = "error"
                db.commit()
                return {
                    "connected": False,
                    "message": f"Peer returned status {response.status_code}: {response.text}",
                }
    except Exception as e:
        db_node.status = "error"
        db.commit()
        return {"connected": False, "message": f"Connection failed: {str(e)}"}


# ==========================================
# 3. PROPOSED RECIPES QUEUE MANAGEMENT
# ==========================================


@router.get("/proposed-recipes", dependencies=[Depends(verify_api_key)])
def get_proposed_recipes(db: Session = Depends(get_db)):
    """Fetch all recipes currently held in the review queue."""
    setting = db.query(Settings).filter(Settings.key == "p2p_proposed_recipes").first()
    if not setting:
        return []
    return json.loads(setting.value)


@router.post("/proposed-recipes/resolve", dependencies=[Depends(verify_api_key)])
def resolve_proposed_recipe(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Approve or reject a recipe held in the proposed review queue."""
    peer_id = payload.get("peer_id")
    action = payload.get("action")  # 'approve', 'reject'
    provider_name = payload.get("provider_name")

    setting = db.query(Settings).filter(Settings.key == "p2p_proposed_recipes").first()
    if not setting:
        raise HTTPException(status_code=404, detail="No proposed recipes found.")

    proposed_list = json.loads(setting.value)

    # Find matching items
    target_idx = -1
    for i, item in enumerate(proposed_list):
        if item.get("peer_id") == peer_id:
            # Check if this item has the recipe we want
            recipes = item.get("recipes", [])
            has_recipe = any(r.get("provider_name") == provider_name for r in recipes)
            if has_recipe:
                target_idx = i
                break

    if target_idx == -1:
        raise HTTPException(status_code=404, detail="Proposed recipe not found.")

    item = proposed_list[target_idx]
    recipes = item.get("recipes", [])
    providers = item.get("providers", [])

    if action == "approve":
        # Merge this recipe now
        r_pushed = next(r for r in recipes if r.get("provider_name") == provider_name)

        db_prov = db.query(Provider).filter(Provider.name == provider_name).first()
        if not db_prov:
            p_details = next(
                (p for p in providers if p.get("name") == provider_name), {}
            )
            db_prov = Provider(
                name=provider_name,
                base_url=p_details.get(
                    "base_url", f"https://{provider_name.lower()}.com"
                ),
                naming_pattern=p_details.get("naming_pattern"),
                separator=p_details.get("separator", "_"),
                space_replacement=p_details.get("space_replacement", "_"),
                automatic_limits=p_details.get("automatic_limits"),
                supported_methods=p_details.get("supported_methods", []),
            )
            db.add(db_prov)
            db.commit()
            db.refresh(db_prov)

        db_recipe = (
            db.query(SiteRecipe).filter(SiteRecipe.provider_id == db_prov.id).first()
        )
        if not db_recipe:
            db_recipe = SiteRecipe(
                provider_id=db_prov.id,
                css_selectors=r_pushed.get("css_selectors"),
                xpath_selectors=r_pushed.get("xpath_selectors"),
                regex_patterns=r_pushed.get("regex_patterns"),
                map_mode_data=r_pushed.get("map_mode_data"),
            )
            db.add(db_recipe)
        else:
            db_recipe.css_selectors = db_recipe.css_selectors or r_pushed.get(
                "css_selectors"
            )
            db_recipe.xpath_selectors = db_recipe.xpath_selectors or r_pushed.get(
                "xpath_selectors"
            )
            db_recipe.regex_patterns = db_recipe.regex_patterns or r_pushed.get(
                "regex_patterns"
            )
            db_recipe.map_mode_data = db_recipe.map_mode_data or r_pushed.get(
                "map_mode_data"
            )

        db.commit()

    # Remove the recipe from the proposed queue
    updated_recipes = [r for r in recipes if r.get("provider_name") != provider_name]
    if not updated_recipes:
        # If no more recipes in this block, remove the entire item
        proposed_list.pop(target_idx)
    else:
        item["recipes"] = updated_recipes
        proposed_list[target_idx] = item

    setting.value = json.dumps(proposed_list)
    db.commit()

    return {"message": f"Recipe for {provider_name} successfully {action}d."}
