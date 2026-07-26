import os
import time
import tempfile
import yt_dlp
from celery import shared_task  # type: ignore
from models import DownloadQueue, LibraryEntry, SessionCookie, Vault, Settings
from security import decrypt_data
from services.media_tagger import MediaTagger
from services.hash_service import HashService
from utils import get_media_roots, get_default_download_path
from db_utils import get_db_session
from typing import Any, cast


@shared_task(bind=True)
def real_download_task(self: Any, task_id: int, prefs_dict: dict[str, Any], metadata: dict[str, Any]) -> None:
    with get_db_session() as db:
        task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
        if not task:
            return

        task.status = "running"  # type: ignore
        task.celery_task_id = self.request.id  # type: ignore
        db.commit()

        # Fetch advanced yt-dlp integrations
        global_settings = {
            str(s.key): str(s.value)
            for s in db.query(Settings)
            .filter(
                Settings.key.in_(
                    [
                        "yt_write_subs",
                        "yt_write_thumbs",
                        "yt_sponsorblock",
                        "yt_live_streams",
                        "yt_native_playlists",
                        "yt_browser_cookies",
                        "yt_custom_format",
                        "download_destination",
                            "global_speed_limit_kbps",
                    ]
                )
            )
            .all()
        }

        # Respect the custom_base_path from provider preferences, or fallback to default
        base_path = str(prefs_dict.get("custom_base_path")) if prefs_dict.get("custom_base_path") else None

        # SECURITY: Prevent path traversal and arbitrary file writes in custom_base_path
        if base_path:
            is_valid_base = False
            real_base_path = os.path.realpath(str(base_path))
            media_roots = get_media_roots()
            for root in media_roots:
                try:
                    if os.path.commonpath([root, real_base_path]) == root:
                        is_valid_base = True
                        break
                except ValueError:
                    continue

            if not is_valid_base:
                print(
                    f"Warning: custom_base_path '{base_path}' is outside configured media roots. Falling back to default."
                )
                base_path = None

        if not base_path:
            base_path = get_default_download_path()

        os.makedirs(base_path, exist_ok=True)

        last_db_check = [time.time()]
        last_progress_update = [time.time()]

        def progress_hook(d: dict[str, Any]) -> None:
            if d["status"] == "downloading":
                # Poll the database every 2 seconds for Pause/Cancel signals
                if time.time() - last_db_check[0] > 2.0:
                    db.refresh(task)
                    last_db_check[0] = time.time()
                    if task and str(task.status) == "paused":
                        raise Exception("Task paused by user")
                    if task and str(task.status) == "cancelled":
                        raise Exception("Task cancelled by user")

                p_str = d.get("_percent_str", "0%").replace("%", "").strip()
                # Throttle progress writes to the database to 1 second intervals
                if time.time() - last_progress_update[0] > 1.0:
                    try:
                        clean_p = "".join(c for c in p_str if c.isdigit() or c == ".")
                        if clean_p:
                            task.progress_percentage = float(clean_p)  # type: ignore

                            # Extract speed, ETA, and byte counts from yt-dlp
                            speed_str = d.get("_speed_str", "")
                            eta_str = d.get("_eta_str", "")
                            downloaded = d.get("downloaded_bytes", 0)
                            total = d.get("total_bytes") or d.get("total_bytes_estimate", 0)

                            task.speed = speed_str[:20]  # type: ignore

                            db.commit()

                            # Store extended info via Celery meta for tooltip display
                            self.update_state(state="PROGRESS", meta={
                                "progress": float(clean_p),
                                "speed": speed_str,
                                "eta": eta_str,
                                "downloaded_bytes": downloaded,
                                "total_bytes": total,
                            })

                            last_progress_update[0] = time.time()
                    except ValueError:
                        pass
            elif d["status"] == "finished":
                task.progress_percentage = 100.0  # type: ignore
                task.speed = ""  # type: ignore
                db.commit()
                self.update_state(state="PROGRESS", meta={
                    "progress": 100,
                    "speed": "",
                    "eta": "",
                    "downloaded_bytes": 0,
                    "total_bytes": 0,
                })

        resolution_pref = str(
            prefs_dict.get("preferred_resolution", "1080p")  # type: ignore
            .replace("p", "")
            .replace("4K", "2160")
            .replace("8K", "4320")
            .replace("2K", "1440")
        )

        format_str = f"bestvideo[height<={resolution_pref}]+bestaudio/best"
        if global_settings.get("yt_custom_format") is not None:
            format_str = str(global_settings.get("yt_custom_format"))

        ydl_opts: dict[str, Any] = {
            "format": format_str,
            "outtmpl": f"{base_path}/%(title)s.%(ext)s",
            "progress_hooks": [progress_hook],
            "quiet": True,
            "noplaylist": global_settings.get("yt_native_playlists") != "true",
        }

        if global_settings.get("yt_write_subs") == "true":
            ydl_opts["writesubtitles"] = True
            ydl_opts["writeautomaticsub"] = True

        if global_settings.get("yt_write_thumbs") == "true":
            ydl_opts["writethumbnail"] = True

        if global_settings.get("yt_sponsorblock") == "true":
            ydl_opts["sponsorblock_remove"] = ["all"]

        if global_settings.get("yt_live_streams") == "true":
            ydl_opts["live_from_start"] = True

        if global_settings.get("yt_browser_cookies") is not None:
            ydl_opts["cookiesfrombrowser"] = (
                global_settings.get("yt_browser_cookies"),
            )

        # PERFORMANCE: Apply global bandwidth speed limits if configured to prevent network saturation
        speed_limit_kbps = global_settings.get("global_speed_limit_kbps", "0")
        if speed_limit_kbps and speed_limit_kbps != "0":
            try:
                ydl_opts["ratelimit"] = float(speed_limit_kbps) * 1024
            except ValueError:
                pass

        cookie_temp_path = None
        active_cookie = (
            db.query(SessionCookie)
            .filter(
                SessionCookie.provider_id == task.media_entry.provider_id,
                SessionCookie.status == "active",
            )
            .first()
        )
        if active_cookie:
            vault_entry = (
                db.query(Vault)
                .filter_by(
                    entity_type="session_cookie",
                    entity_id=active_cookie.id,
                    key="cookie_text",
                )
                .first()
            )
            if vault_entry:
                fd, cookie_temp_path = tempfile.mkstemp(suffix=".txt", text=True)
                with os.fdopen(fd, "w") as f:
                    f.write(decrypt_data(str(vault_entry.encrypted_value)))
                ydl_opts["cookiefile"] = cookie_temp_path

        filename = ""
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:  # type: ignore
                info = ydl.extract_info(str(task.url), download=True)

                extractor = info.get("extractor", "generic")
                method_used = f"yt-dlp ({extractor})"
                if cookie_temp_path:
                    method_used += " [Cookies]"
                task.extraction_method = method_used  # type: ignore
                db.commit()

                filename = ydl.prepare_filename(info)

                # Handle yt-dlp post-processing extension changes (e.g., merging into .mkv)
                if "requested_downloads" in info and info["requested_downloads"]:
                    filename = info["requested_downloads"][0].get("filepath", filename)
                elif not os.path.exists(filename):
                    base_name, _ = os.path.splitext(filename)
                    for ext in [".mp4", ".mkv", ".webm", ".avi", ".ts"]:
                        if os.path.exists(base_name + ext):
                            filename = base_name + ext
                            break

                ohash = HashService.generate_ohash(filename)

                # Save to Library
                new_entry = LibraryEntry(
                    provider_id=task.media_entry.provider_id,
                    title=info.get(
                        "title", metadata.get("title", f"Download_{task_id}")
                    ),
                    performers=metadata.get("performers", []),
                    tags=metadata.get("tags", []),
                    file_path=filename,
                    resolution=prefs_dict.get("preferred_resolution", "1080p"),
                    file_size=os.path.getsize(filename)
                    if os.path.exists(filename)
                    else 0,
                    ohash=ohash,
                    metadata=metadata,
                )

                try:
                    new_entry.phash = HashService.generate_phash(filename)  # type: ignore
                except Exception as e:
                    print(f"Warning: Failed to generate phash for {filename}: {str(e)}")
                db.add(new_entry)
                db.flush()

                # Log naming history
                from models import FileNamingHistory
                history = FileNamingHistory(
                    library_entry_id=new_entry.id,
                    old_path=None,
                    new_path=filename,
                    old_filename=None,
                    new_filename=os.path.basename(filename),
                    reason="download_naming"
                )
                db.add(history)
                if prefs_dict.get("append_metadata"):
                    try:
                        MediaTagger.tag_file(str(new_entry.file_path), metadata)
                    except Exception as e:
                        print(f"Warning: Failed to tag file {filename}: {str(e)}")

                task.status = "completed"  # type: ignore
                db.commit()

                try:
                    from services.notification_service import NotificationService

                    # Check and update matching approved MediaRequests
                    try:
                        from models import MediaRequest
                        matching_req = db.query(MediaRequest).filter(
                            MediaRequest.url == task.url,
                            MediaRequest.status == "approved"
                        ).first()
                        if matching_req:
                            matching_req.status = "downloaded"
                            db.commit()
                            
                            NotificationService.notify_global(
                                db,
                                "task_completed",
                                "Media Request Ready",
                                f"📣 Requested media '{matching_req.title}' (requested by {matching_req.requested_by}) is now ready for streaming!",
                            )
                    except Exception as req_err:
                        print(f"Error updating request status: {req_err}")

                    NotificationService.check_and_notify_favorites(db, new_entry)  # type: ignore
                    NotificationService.notify_global(
                        db,
                        "task_completed",
                        "Download Completed",
                        f"Successfully downloaded '{new_entry.title}'.",
                    )
                except Exception as notif_err:
                    print(
                        f"Error sending notifications for download completion: {notif_err}"
                    )

        except Exception as e:
            if "Task paused by user" in str(e) or "Task cancelled by user" in str(e):
                print(f"Download manually stopped: {str(e)}")
                return

            # Clean up failed download fragments
            if filename:
                for ext in ["", ".part", ".ytdl", ".temp"]:
                    temp_file = filename + ext
                    if os.path.exists(temp_file):
                        try:
                            os.remove(temp_file)
                        except Exception as rm_err:
                            print(f"Failed to remove {temp_file}: {rm_err}")

            should_retry = False
            try:
                task = (
                    db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
                )
                if task:
                    max_retries = int(prefs_dict.get("max_retries", 3))
                    if self.request.retries < max_retries:
                        task.status = "pending"  # type: ignore
                        db.commit()
                        print(
                            f"Download failed, retrying ({self.request.retries + 1}/{max_retries})..."
                        )
                        should_retry = True
                    else:
                        task.status = "failed"  # type: ignore
                        db.commit()
                        print(
                            f"Download failed permanently after {max_retries} retries: {str(e)}"
                        )

                        try:
                            from services.notification_service import (
                                NotificationService,
                            )

                            NotificationService.notify_global(
                                db,
                                "task_completed",
                                "Download Failed",
                                f"Download failed permanently for '{task.url}': {str(e)}",
                            )
                        except Exception as notif_err:
                            print(
                                f"Error sending download failure notification: {notif_err}"
                            )
            except Exception as inner_e:
                print(
                    f"Failed to update task status during error handling: {str(inner_e)}"
                )

            if should_retry:
                if (
                    "cookie_temp_path" in locals()
                    and cookie_temp_path
                    and os.path.exists(cookie_temp_path)
                ):
                    try:
                        os.remove(cookie_temp_path)
                    except Exception as cookie_err:
                        print(f"Failed to remove cookie path: {cookie_err}")
                raise self.retry(exc=e, countdown=60)
            else:
                raise e
        finally:
            if (
                "cookie_temp_path" in locals()
                and cookie_temp_path
                and os.path.exists(cookie_temp_path)
            ):
                try:
                    os.remove(cookie_temp_path)
                except Exception as cookie_err:
                    print(f"Failed to remove cookie path: {cookie_err}")


@shared_task(bind=True)
def mass_rip_task(self: Any, session_id: int) -> None:
    import re
    import requests
    from models import MassRipSession, DownloadPreference, SessionCookie, DownloadRule, CustomList, MediaEntry, DownloadQueue
    from db_utils import get_db_session
    from routers.download import evaluate_duplicate_quality, evaluate_rules, validate_url_ssrf  # type: ignore
    
    with get_db_session() as db:
        session = db.query(MassRipSession).filter(MassRipSession.id == session_id).first()
        if not session:
            return
        
        session.status = "running"  # type: ignore
        session.celery_task_id = self.request.id  # type: ignore
        db.commit()
        
        provider_id = session.provider_id
        url_str = str(session.url)
        criteria: dict[str, Any] = cast(dict[str, Any], session.criteria) if session.criteria else {}  # type: ignore
        
        # provider = db.query(Provider).filter(Provider.id == provider_id).first()
        prefs = db.query(DownloadPreference).filter(DownloadPreference.provider_id == provider_id).first()
        
        # PERFORMANCE: skip_download prevents accidental binary fetching, extract_flat="in_playlist" is significantly faster than True
        ydl_opts: dict[str, Any] = {"extract_flat": "in_playlist", "skip_download": True, "quiet": True, "ignoreerrors": True}
        if prefs:
            proxy_url = getattr(prefs, "proxy_url", None)
            if proxy_url is not None and str(proxy_url):  # type: ignore
                ydl_opts["proxy"] = str(proxy_url)
            sleep_req = getattr(prefs, "sleep_requests", None)
            if sleep_req is not None:
                ydl_opts["sleep_requests"] = float(str(sleep_req))
                
        cookie_obj = db.query(SessionCookie).filter(
            SessionCookie.provider_id == provider_id,
            SessionCookie.status == "active"
        ).first()
        cookie_text = str(cookie_obj.cookie_text) if cookie_obj and cookie_obj.cookie_text is not None else None  # type: ignore
        
        cookie_file_path = None
        if cookie_text:
            fd, cookie_file_path = tempfile.mkstemp(suffix=".txt")
            with os.fdopen(fd, "w") as f:
                f.write(cookie_text)
            ydl_opts["cookiefile"] = cookie_file_path
            
        extracted_videos: list[dict[str, Any]] = []
        used_method = "yt-dlp"
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:  # type: ignore
                info = ydl.extract_info(url_str, download=False)
                if info and "entries" in info:
                    extractor = info.get("extractor", "generic")
                    used_method = f"yt-dlp ({extractor})"
                    for entry in info["entries"]:
                        if not entry:
                            continue
                        url = entry.get("url") or entry.get("webpage_url")
                        if url:
                            extracted_videos.append({
                                "url": url,
                                "metadata": {"title": entry.get("title", "Unknown")}
                            })
                elif info:
                    extractor = info.get("extractor", "generic")
                    used_method = f"yt-dlp ({extractor})"
                    extracted_videos.append({
                        "url": info.get("url") or info.get("webpage_url") or url_str,
                        "metadata": {"title": info.get("title", "Unknown")}
                    })
        except Exception:
            try:
                resp = requests.get(url_str, timeout=15, allow_redirects=False)
                hrefs = re.findall(r'href=[\'"]?([^\'" >]+)', resp.text)
                for href in set(hrefs):
                    if "/video/" in href.lower() or "/watch/" in href.lower() or ".mp4" in href.lower():
                        full_url = href if href.startswith("http") else url_str.rstrip("/") + "/" + href.lstrip("/")
                        extracted_videos.append({"url": full_url, "metadata": {"title": "Unknown"}})
            except Exception:
                session.status = "failed"  # type: ignore
                db.commit()
                return
        finally:
            if cookie_file_path and os.path.exists(str(cookie_file_path)):
                os.remove(cookie_file_path)
                
        session.total_videos = len(extracted_videos)  # type: ignore
        db.commit()
        
        prefs_dict: dict[str, Any] = {
            "preferred_resolution": str(prefs.preferred_resolution) if prefs else "1080p",  # type: ignore
            "append_metadata": bool(prefs.append_metadata) if prefs else False,  # type: ignore
            "custom_base_path": str(getattr(prefs, "custom_base_path", "")) if prefs and getattr(prefs, "custom_base_path", None) is not None else None,  # type: ignore
            "proxy_url": str(getattr(prefs, "proxy_url", "")) if prefs and getattr(prefs, "proxy_url", None) is not None else None,  # type: ignore
            "cookie_text": cookie_text,
        }
        
        rules = db.query(DownloadRule).filter(
            DownloadRule.is_active,
            (DownloadRule.scope == "global") | (DownloadRule.scope == f"provider:{provider_id}")
        ).all()
        
        list_ids = [rule.criteria["in_list"] for rule in rules if rule.criteria and "in_list" in rule.criteria]  # type: ignore
        custom_lists_query = db.query(CustomList).filter(CustomList.id.in_(list_ids)).all() if list_ids else []  # type: ignore
        custom_lists_map = {cl.id: cl for cl in custom_lists_query}
        
        for video in extracted_videos:
            db.refresh(session)
            while str(session.status) == "paused":
                time.sleep(2.0)
                db.refresh(session)
                
            if str(session.status) == "stopped":
                break
                
            if not video["url"]:
                session.processed_videos = int(session.processed_videos) + 1  # type: ignore
                session.skipped_videos = int(session.skipped_videos) + 1  # type: ignore
                db.commit()
                continue
                
            meta: dict[str, Any] = video["metadata"]
            try:
                validate_url_ssrf(str(video["url"]))
            except Exception:
                session.processed_videos = int(session.processed_videos) + 1  # type: ignore
                session.skipped_videos = int(session.skipped_videos) + 1  # type: ignore
                db.commit()
                continue
                
            title_raw: Any = meta.get("title")
            title: str = str(title_raw[0]) if isinstance(title_raw, list) and len(title_raw) > 0 else str(title_raw or "Unknown")  # type: ignore
            
            max_items = criteria.get("max_items")
            if max_items and int(cast(int, session.processed_videos)) >= int(max_items):  # type: ignore
                session.processed_videos = int(session.processed_videos) + 1  # type: ignore
                session.skipped_videos = int(session.skipped_videos) + 1  # type: ignore
                db.commit()
                continue
                
            dupe_check: dict[str, Any] = evaluate_duplicate_quality(db, prefs, str(title), meta)  # type: ignore
            if not dupe_check.get("proceed"):  # type: ignore
                session.processed_videos = int(session.processed_videos) + 1  # type: ignore
                session.skipped_videos = int(session.skipped_videos) + 1  # type: ignore
                db.commit()
                continue
                
            action = evaluate_rules(db, meta, rules, custom_lists_map)  # type: ignore
            if action == "skip":  # type: ignore
                session.processed_videos = int(session.processed_videos) + 1  # type: ignore
                session.skipped_videos = int(session.skipped_videos) + 1  # type: ignore
                db.commit()
                continue
                
            existing_queue = db.query(DownloadQueue).filter(
                DownloadQueue.url == video["url"],
                DownloadQueue.status.in_(["pending", "running", "queued"])
            ).first()
            if existing_queue:  # type: ignore
                session.processed_videos = int(session.processed_videos) + 1  # type: ignore
                session.skipped_videos = int(session.skipped_videos) + 1  # type: ignore
                db.commit()
                continue
                
            media = MediaEntry(
                provider_id=provider_id,
                title=title,
                performers=meta.get("performers", []),
                tags=meta.get("tags", []),
                media_metadata=meta,
            )
            queue = DownloadQueue(
                url=video["url"],
                status="pending",
                progress_percentage=0.0,
                extraction_method=used_method,
            )  # type: ignore
            queue.media_entry = media
            db.add(queue)
            db.flush()
            
            real_download_task.delay(queue.id, prefs_dict, meta)  # type: ignore
            
            session.processed_videos = int(session.processed_videos) + 1  # type: ignore
            session.queued_videos = int(session.queued_videos) + 1  # type: ignore
            db.commit()
            
        if str(session.status) != "stopped":
            session.status = "completed"  # type: ignore
            db.commit()
