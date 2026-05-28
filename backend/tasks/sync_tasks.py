import logging
import requests
from celery import shared_task  # type: ignore
from celery.schedules import crontab  # type: ignore
from celery_app import celery_app
from db_utils import get_db_session
from models import LibraryEntry, Vault, UserVideoStats
from security import decrypt_data
from typing import Any, cast

logger = logging.getLogger(__name__)


@celery_app.on_after_configure.connect  # type: ignore
def setup_periodic_tasks(sender: Any, **kwargs: Any) -> None:
    # Run the StashDB fingerprint sync daemon every 6 hours
    sender.add_periodic_task(
        crontab(minute=0, hour="*/6"),
        sync_fingerprints_to_stashdb.s(),  # type: ignore
        name="Continuous StashDB Fingerprint Syncing",
    )


@shared_task
def sync_fingerprints_to_stashdb() -> int | None:
    """
    Background daemon to automatically and continuously push
    calculated hashes (OSHASH, PHASH) to StashDB.
    """
    with get_db_session() as db:
        vault_entry = (
            db.query(Vault)
            .filter_by(entity_type="global_setting", key="stashdb_api_key")
            .first()
        )

        if not vault_entry or vault_entry.encrypted_value is None:  # type: ignore
            logger.info("StashDB API key not configured. Skipping background sync.")
            return

        api_key = decrypt_data(str(vault_entry.encrypted_value))
        if not api_key:
            return

        headers = {"ApiKey": api_key, "Content-Type": "application/json"}

        entries = (
            db.query(LibraryEntry)
            .filter((LibraryEntry.ohash.isnot(None)) | (LibraryEntry.phash.isnot(None)))
            .yield_per(100)
        )

        synced_count = 0

        for entry in entries:
            # Limit to processing 50 unsynced records per cycle to avoid throttling/long tasks
            if synced_count >= 50:
                break

            meta: dict[str, Any] = dict(cast(dict[str, Any], entry.entry_metadata)) if entry.entry_metadata else {}  # type: ignore
            if "stashdb_synced" in meta:
                continue  # Already successfully synced or marked unmatchable

            scene_id = meta.get("stashdb_scene_id")

            # 1. Attempt to find the global StashDB Scene ID if unknown
            if not scene_id and entry.ohash:  # type: ignore
                query = """
                query SearchScenesByFingerprint($hash: String!) {
                    findScenes(scene_filter: { fingerprints: { value: $hash, modifier: INCLUDES } }) {
                        scenes { id }
                    }
                }
                """
                try:
                    res = requests.post(
                        "https://stashdb.org/graphql",
                        json={"query": query, "variables": {"hash": str(entry.ohash)}},
                        headers=headers,
                        timeout=10,
                    )
                    if res.status_code == 200:
                        scenes = (
                            res.json()
                            .get("data", {})
                            .get("findScenes", {})
                            .get("scenes", [])
                        )
                        if scenes:
                            scene_id = scenes[0].get("id")
                except Exception as e:
                    logger.error(f"Error querying StashDB for {entry.title}: {e}")
                    continue

            if not scene_id:
                # Mark as unmatchable temporarily so we don't get stuck infinitely hammering StashDB
                meta["stashdb_synced"] = "failed_no_scene_match"
                entry.entry_metadata = meta.copy()  # type: ignore
                db.commit()
                continue

            # 2. Submit the fingerprints natively using your existing external API payload
            from routers.external_api import submit_stashdb_fingerprint
            from routers.external_api import FingerprintSubmitRequest

            for algo, f_hash in cast(list[tuple[str, Any]], [("OSHASH", entry.ohash), ("PHASH", entry.phash)]):
                if f_hash and f_hash != "0000000000000000":  # type: ignore
                    try:
                        submit_stashdb_fingerprint(
                            req=FingerprintSubmitRequest(
                                scene_id=str(scene_id) if scene_id else "", hash=str(f_hash), algorithm=str(algo)
                            ),
                            x_api_key=api_key,
                        )
                    except Exception as e:
                        logger.error(f"Failed submitting {algo} for {entry.title}: {e}")

            # 3. Mark the record as fully synced
            meta["stashdb_scene_id"] = scene_id
            meta["stashdb_synced"] = True
            entry.entry_metadata = meta.copy()  # type: ignore
            db.commit()
            synced_count += 1

        if synced_count > 0:
            logger.info(
                f"Successfully background-synced {synced_count} fingerprints to StashDB."
            )

        return synced_count


@shared_task
def sync_user_stats_with_stash_task(
    user_id: int, stash_url: str, stash_api_key: str | None = None
) -> dict[str, Any]:
    """Two-way sync of watch counts, climax counts (O-meter), and timestamps with Stash App."""
    from sqlalchemy.orm import defer

    headers = {"Content-Type": "application/json"}
    if stash_api_key:
        headers["ApiKey"] = stash_api_key

    with get_db_session() as db:
        local_entries = (
            db.query(LibraryEntry)
            .options(
                defer(LibraryEntry.entry_metadata),  # type: ignore
                defer(LibraryEntry.performers),  # type: ignore
                defer(LibraryEntry.tags),  # type: ignore
            )
            .yield_per(50)
        )
        synced_count = 0
        updated_local = 0
        updated_stash = 0

        for entry in local_entries:
            stats = (
                db.query(UserVideoStats)
                .filter(
                    UserVideoStats.user_id == user_id,
                    UserVideoStats.library_entry_id == entry.id,
                )
                .first()
            )

            local_plays = int(cast(int, stats.play_count)) if stats and stats.play_count is not None else 0  # type: ignore
            local_climaxes = int(cast(int, stats.climax_count)) if stats and stats.climax_count is not None else 0  # type: ignore

            stash_scene = None

            if entry.ohash:  # type: ignore
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
                        f"{stash_url.rstrip('/')}/graphql",
                        json={"query": fp_query, "variables": {"hash": str(entry.ohash)}},
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

            if not stash_scene and entry.title:  # type: ignore
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
                        f"{stash_url.rstrip('/')}/graphql",
                        json={
                            "query": title_query,
                            "variables": {"title": str(entry.title)},
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

            stash_id = stash_scene.get("id")
            stash_plays = stash_scene.get("play_count") or 0
            stash_climaxes = stash_scene.get("o_counter") or 0

            merged_plays = max(local_plays, stash_plays)
            merged_climaxes = max(local_climaxes, stash_climaxes)

            if merged_plays > local_plays or merged_climaxes > local_climaxes:
                if not stats:
                    stats = UserVideoStats(
                        user_id=user_id,
                        library_entry_id=entry.id,
                        play_count=merged_plays,
                        climax_count=merged_climaxes,
                    )
                    db.add(stats)
                else:
                    stats.play_count = merged_plays  # type: ignore
                    stats.climax_count = merged_climaxes  # type: ignore
                updated_local += 1

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
                        f"{stash_url.rstrip('/')}/graphql",
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
