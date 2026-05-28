import requests
import json
from datetime import datetime, timezone
from celery import shared_task  # type: ignore
from croniter import croniter
from db_utils import get_db_session
from models import PeerNode, PeerSyncLog, Provider, SiteRecipe, LibraryEntry, Settings
from typing import Any, cast


@shared_task
def sync_with_peer_task(peer_id: int) -> None:
    """
    Executes outbound sync process with a trusted peer:
    1. Dynamic connection ping
    2. Recipe pulling & auto-merging / queuing
    3. Recipe pushing
    4. Library reconciliation under configured privacy bounds
    5. Update logs and statuses
    """
    with get_db_session() as db:
        peer = db.query(PeerNode).filter(PeerNode.id == peer_id).first()
        if not peer:
            print(f"P2P Sync Error: Peer node {peer_id} not found.")
            return

        peer.status = "syncing"  # type: ignore
        db.commit()

        api_headers: dict[str, str] = {
            "x-api-key": str(peer.outbound_key),
            "X-P2P-Token": str(peer.outbound_key),
            "Content-Type": "application/json",
        }
        peer_url = peer.peer_url.rstrip("/")

        recipes_synced_count = 0
        media_synced_count = 0
        error_msg = None
        sync_status = "success"

        try:
            # 1. PING Connection check
            print(f"P2P Sync: Pinging peer '{peer.name}' at {peer_url}...")
            ping_resp = requests.get(
                f"{peer_url}/api/p2p/ping", headers=api_headers, timeout=15
            )
            ping_resp.raise_for_status()
            print(f"P2P Sync: Connected successfully to peer '{peer.name}'.")

            # 2. RECIPE PULLING
            print(f"P2P Sync: Pulling recipes from '{peer.name}'...")
            pull_resp = requests.post(
                f"{peer_url}/api/p2p/recipes/pull", headers=api_headers, timeout=30
            )
            pull_resp.raise_for_status()
            pull_data = pull_resp.json()

            pulled_providers = pull_data.get("providers", [])
            pulled_recipes = pull_data.get("recipes", [])

            if str(peer.recipe_sync_mode) == "manual_review":
                # Hold in Proposed review queue inside Settings
                proposed_setting = (
                    db.query(Settings)
                    .filter(Settings.key == "p2p_proposed_recipes")
                    .first()
                )
                if proposed_setting:
                    proposed_list: list[dict[str, Any]] = json.loads(str(proposed_setting.value))
                else:
                    proposed_list = []
                    proposed_setting = Settings(key="p2p_proposed_recipes", value="[]")
                    db.add(proposed_setting)

                # Remove any existing pending proposed block for this peer to avoid stale list growth
                proposed_list = [
                    item for item in proposed_list if item.get("peer_id") != peer.id
                ]

                proposed_item: dict[str, Any] = {
                    "peer_id": peer.id,
                    "peer_name": peer.name,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "providers": pulled_providers,
                    "recipes": pulled_recipes,
                    "status": "pending",
                }
                proposed_list.append(proposed_item)
                proposed_setting.value = json.dumps(proposed_list)  # type: ignore
                recipes_synced_count = len(pulled_recipes)
                db.commit()
                print(
                    f"P2P Sync: Recipes placed in manual review queue for '{peer.name}'."
                )

            else:  # auto_merge
                for r_pushed in pulled_recipes:
                    prov_name = r_pushed.get("provider_name")
                    if not prov_name:
                        continue

                    # Find or create provider locally
                    db_prov = (
                        db.query(Provider).filter(Provider.name == prov_name).first()
                    )
                    if not db_prov:
                        p_details = cast(dict[str, Any], next(
                            (p for p in pulled_providers if p.get("name") == prov_name),
                            cast(dict[str, Any], {}),
                        ))
                        db_prov = Provider(
                            name=prov_name,
                            base_url=p_details.get(
                                "base_url", f"https://{prov_name.lower()}.com"
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
                        db_recipe.css_selectors = (
                            db_recipe.css_selectors or r_pushed.get("css_selectors")
                        )
                        db_recipe.xpath_selectors = (
                            db_recipe.xpath_selectors or r_pushed.get("xpath_selectors")
                        )
                        db_recipe.regex_patterns = (
                            db_recipe.regex_patterns or r_pushed.get("regex_patterns")
                        )
                        db_recipe.map_mode_data = (
                            db_recipe.map_mode_data or r_pushed.get("map_mode_data")
                        )

                    recipes_synced_count += 1
                db.commit()
                print(
                    f"P2P Sync: Auto-merged {recipes_synced_count} recipes from '{peer.name}'."
                )

            # 3. RECIPE PUSHING
            print(f"P2P Sync: Pushing local recipes to '{peer.name}'...")
            local_providers = db.query(Provider).all()
            local_recipes = db.query(SiteRecipe).all()

            providers_payload: list[dict[str, Any]] = []
            for p in local_providers:
                providers_payload.append(
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

            recipes_payload: list[dict[str, Any]] = []
            for r in local_recipes:
                prov = db.query(Provider).filter(Provider.id == r.provider_id).first()
                if not prov:
                    continue
                recipes_payload.append(
                    {
                        "provider_name": prov.name,
                        "css_selectors": r.css_selectors,
                        "xpath_selectors": r.xpath_selectors,
                        "regex_patterns": r.regex_patterns,
                        "map_mode_data": r.map_mode_data,
                    }
                )

            push_resp = requests.post(
                f"{peer_url}/api/p2p/recipes/push",
                headers=api_headers,
                json={"providers": providers_payload, "recipes": recipes_payload},
                timeout=30,
            )
            push_resp.raise_for_status()

            # 4. LIBRARY RECONCILIATION
            print(f"P2P Sync: Packing library metadata for '{peer.name}'...")
            local_entries_query = db.query(LibraryEntry)

            # Filter by privacy scope if specified
            if str(peer.library_scope) == "specific_providers":
                allowed_ids = peer.allowed_providers or []
                local_entries_query = local_entries_query.filter(
                    LibraryEntry.provider_id.in_(cast(list[Any], allowed_ids))
                )

            local_entries = local_entries_query.all()
            entries_payload: list[dict[str, Any]] = []
            for entry in local_entries:
                prov = (
                    db.query(Provider).filter(Provider.id == entry.provider_id).first()
                )
                prov_name = prov.name if prov else "Unknown"
                entries_payload.append(
                    {
                        "title": entry.title,
                        "provider_name": prov_name,
                        "site_id": entry.site_id,
                        "ohash": entry.ohash,
                        "phash": entry.phash,
                        "performers": entry.performers or [],
                        "tags": entry.tags or [],
                        "resolution": entry.resolution,
                    }
                )

            print(
                f"P2P Sync: Transmitting {len(entries_payload)} library records to reconcile..."
            )
            reconcile_resp = requests.post(
                f"{peer_url}/api/p2p/library/reconcile",
                headers=api_headers,
                json={"entries": entries_payload},
                timeout=45,
            )
            reconcile_resp.raise_for_status()
            reconcile_data = reconcile_resp.json()

            # Apply returning metadata updates to our local library
            metadata_updates = reconcile_data.get("metadata_updates", [])
            for update in metadata_updates:
                # Find matching local entry by ohash or site_id
                target_entry = None
                ohash = update.get("ohash")
                site_id = update.get("site_id")
                prov_name = update.get("provider_name")

                if ohash:
                    target_entry = (
                        db.query(LibraryEntry)
                        .filter(LibraryEntry.ohash == ohash)
                        .first()
                    )
                if not target_entry and site_id and prov_name:
                    db_prov = (
                        db.query(Provider).filter(Provider.name == prov_name).first()
                    )
                    if db_prov:
                        target_entry = (
                            db.query(LibraryEntry)
                            .filter(
                                LibraryEntry.provider_id == db_prov.id,
                                LibraryEntry.site_id == site_id,
                            )
                            .first()
                        )

                if target_entry:
                    modified = False

                    # Merge performers
                    new_perfs: list[str] = update.get("new_performers") or []
                    if new_perfs:
                        current_perfs = cast(list[str], target_entry.performers) or []
                        merged_perfs = list(set(current_perfs + new_perfs))
                        if len(merged_perfs) > len(current_perfs):
                            target_entry.performers = merged_perfs  # type: ignore
                            modified = True

                    # Merge tags
                    new_tags: list[str] = update.get("new_tags") or []
                    if new_tags:
                        current_tags = cast(list[str], target_entry.tags) or []
                        merged_tags = list(set(current_tags + new_tags))
                        if len(merged_tags) > len(current_tags):
                            target_entry.tags = merged_tags  # type: ignore
                            modified = True

                    # Update resolution if peer recommended a better one
                    better_res = update.get("better_resolution")
                    if better_res and better_res != target_entry.resolution:
                        target_entry.resolution = better_res
                        modified = True

                    if modified:
                        target_entry.last_updated = datetime.now(timezone.utc).replace(tzinfo=None)  # type: ignore
                        media_synced_count += 1

            db.commit()
            print(
                f"P2P Sync: Library sync complete. Reconciled {media_synced_count} media updates."
            )

        except Exception as ex:
            error_msg = str(ex)
            sync_status = "failed"
            print(f"P2P Sync Exception on peer {peer_id}: {error_msg}")

        # 5. LOG RESULTS & UPDATE PEER STATUS
        peer.status = "active" if sync_status == "success" else "error"  # type: ignore
        peer.last_sync_at = datetime.now(timezone.utc).replace(tzinfo=None)  # type: ignore

        # Write Log Entry
        sync_log = PeerSyncLog(
            peer_id=peer.id,
            direction="sync",
            recipes_synced=recipes_synced_count,
            media_synced=media_synced_count,
            status=sync_status,
            error_message=error_msg,
        )
        db.add(sync_log)
        db.commit()


@shared_task
def p2p_sync_scheduler() -> None:
    """
    Periodic task to scan active peers, parse schedules (using croniter),
    and dispatch sync tasks to workers.
    """
    with get_db_session() as db:
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Fetch active or error nodes that have automated schedules
        peers = db.query(PeerNode).filter(PeerNode.sync_schedule != "manual").all()

        for peer in peers:
            # Check if sync is due
            if peer.next_run is None or peer.next_run <= now:  # type: ignore
                print(
                    f"P2P Sync Scheduler: Triggering automated sync for '{peer.name}' (Schedule: {peer.sync_schedule})"
                )

                # Dispatch background celery worker execution
                sync_with_peer_task.delay(peer.id)  # type: ignore

                # Calculate next run cycle
                cron_str = None
                if str(peer.sync_schedule) == "daily":
                    cron_str = "0 2 * * *"
                elif str(peer.sync_schedule) == "weekly":
                    cron_str = "0 2 * * 0"
                else:
                    # Custom cron expression
                    cron_str = peer.sync_schedule

                try:
                    iter_cron = croniter(str(cron_str), now)
                    peer.next_run = iter_cron.get_next(datetime)  # type: ignore
                except Exception as cron_err:
                    print(
                        f"P2P Sync Scheduler Error parsing cron '{cron_str}' for peer {peer.id}: {cron_err}"
                    )
                    # Deactivate automated sync on cron parsing errors to avoid endless looping
                    peer.sync_schedule = "manual"  # type: ignore
                    peer.status = "error"  # type: ignore

            db.commit()
