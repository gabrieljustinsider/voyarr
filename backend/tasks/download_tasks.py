import os
import time
import tempfile
import yt_dlp
from celery import shared_task
from models import DownloadQueue, LibraryEntry, SessionCookie, Vault, Settings
from security import decrypt_data
from services.media_tagger import MediaTagger
from services.hash_service import HashService
from utils import get_media_roots, get_default_download_path
from db_utils import get_db_session


@shared_task(bind=True)
def real_download_task(self, task_id: int, prefs_dict: dict, metadata: dict):
    with get_db_session() as db:
        task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
        if not task:
            return

        task.status = "running"
        task.celery_task_id = self.request.id
        db.commit()

        # Fetch advanced yt-dlp integrations
        global_settings = {
            s.key: s.value
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
                    ]
                )
            )
            .all()
        }

        # Respect the custom_base_path from provider preferences, or fallback to default
        base_path = prefs_dict.get("custom_base_path")

        # SECURITY: Prevent path traversal and arbitrary file writes in custom_base_path
        if base_path:
            is_valid_base = False
            real_base_path = os.path.realpath(base_path)
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

        def progress_hook(d):
            if d["status"] == "downloading":
                # Poll the database every 2 seconds for Pause/Cancel signals
                if time.time() - last_db_check[0] > 2.0:
                    db.refresh(task)
                    last_db_check[0] = time.time()
                    if task.status == "paused":
                        raise Exception("Task paused by user")
                    if task.status == "cancelled":
                        raise Exception("Task cancelled by user")

                p_str = d.get("_percent_str", "0%").replace("%", "").strip()
                # Throttle progress writes to the database to 1 second intervals
                if time.time() - last_progress_update[0] > 1.0:
                    try:
                        clean_p = "".join(c for c in p_str if c.isdigit() or c == ".")
                        if clean_p:
                            task.progress_percentage = float(clean_p)
                            db.commit()
                            last_progress_update[0] = time.time()
                    except ValueError:
                        pass
            elif d["status"] == "finished":
                task.progress_percentage = 100.0
                db.commit()

        resolution_pref = (
            prefs_dict.get("preferred_resolution", "1080p")
            .replace("p", "")
            .replace("4K", "2160")
            .replace("8K", "4320")
            .replace("2K", "1440")
        )

        format_str = f"bestvideo[height<={resolution_pref}]+bestaudio/best"
        if global_settings.get("yt_custom_format"):
            format_str = str(global_settings.get("yt_custom_format"))

        ydl_opts = {
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

        if global_settings.get("yt_browser_cookies"):
            ydl_opts["cookiesfrombrowser"] = (
                global_settings.get("yt_browser_cookies"),
            )

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
                    f.write(decrypt_data(vault_entry.encrypted_value))
                ydl_opts["cookiefile"] = cookie_temp_path

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(task.url, download=True)

                extractor = info.get("extractor", "generic")
                method_used = f"yt-dlp ({extractor})"
                if cookie_temp_path:
                    method_used += " [Cookies]"
                task.extraction_method = method_used
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
                    new_entry.phash = HashService.generate_phash(filename)
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
                        MediaTagger.tag_file(new_entry.file_path, metadata)
                    except Exception as e:
                        print(f"Warning: Failed to tag file {filename}: {str(e)}")

                task.status = "completed"
                db.commit()

                try:
                    from services.notification_service import NotificationService

                    NotificationService.check_and_notify_favorites(db, new_entry)
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
            if "filename" in locals():
                for ext in ["", ".part", ".ytdl", ".temp"]:
                    temp_file = filename + ext
                    if os.path.exists(temp_file):
                        try:
                            os.remove(temp_file)
                        except Exception as rm_err:
                            print(f"Failed to remove {temp_file}: {rm_err}")

            try:
                should_retry = False
                task = (
                    db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
                )
                if task:
                    max_retries = prefs_dict.get("max_retries", 3)
                    if self.request.retries < max_retries:
                        task.status = "pending"
                        db.commit()
                        print(
                            f"Download failed, retrying ({self.request.retries + 1}/{max_retries})..."
                        )
                        should_retry = True
                    else:
                        task.status = "failed"
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
def mass_rip_task(self, session_id: int):
    import re
    import requests
    from models import MassRipSession, Provider, DownloadPreference, SessionCookie, DownloadRule, CustomList, MediaEntry, DownloadQueue
    from db_utils import get_db_session
    from routers.download import evaluate_duplicate_quality, evaluate_rules, validate_url_ssrf
    
    with get_db_session() as db:
        session = db.query(MassRipSession).filter(MassRipSession.id == session_id).first()
        if not session:
            return
        
        session.status = "running"
        session.celery_task_id = self.request.id
        db.commit()
        
        provider_id = session.provider_id
        url_str = session.url
        criteria = session.criteria or {}
        
        provider = db.query(Provider).filter(Provider.id == provider_id).first()
        prefs = db.query(DownloadPreference).filter(DownloadPreference.provider_id == provider_id).first()
        
        ydl_opts = {"extract_flat": True, "quiet": True}
        if prefs:
            if getattr(prefs, "proxy_url", None):
                ydl_opts["proxy"] = prefs.proxy_url
            if getattr(prefs, "sleep_requests", None):
                ydl_opts["sleep_requests"] = float(prefs.sleep_requests)
                
        cookie_obj = db.query(SessionCookie).filter(
            SessionCookie.provider_id == provider_id,
            SessionCookie.status == "active"
        ).first()
        cookie_text = cookie_obj.cookie_text if cookie_obj else None
        
        cookie_file_path = None
        if cookie_text:
            fd, cookie_file_path = tempfile.mkstemp(suffix=".txt")
            with os.fdopen(fd, "w") as f:
                f.write(cookie_text)
            ydl_opts["cookiefile"] = cookie_file_path
            
        extracted_videos = []
        used_method = "yt-dlp"
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
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
        except Exception as e:
            try:
                resp = requests.get(url_str, timeout=15, allow_redirects=False)
                hrefs = re.findall(r'href=[\'"]?([^\'" >]+)', resp.text)
                for href in set(hrefs):
                    if "/video/" in href.lower() or "/watch/" in href.lower() or ".mp4" in href.lower():
                        full_url = href if href.startswith("http") else url_str.rstrip("/") + "/" + href.lstrip("/")
                        extracted_videos.append({"url": full_url, "metadata": {"title": "Unknown"}})
            except Exception as inner_err:
                session.status = "failed"
                db.commit()
                return
        finally:
            if cookie_file_path and os.path.exists(cookie_file_path):
                os.remove(cookie_file_path)
                
        session.total_videos = len(extracted_videos)
        db.commit()
        
        prefs_dict = {
            "preferred_resolution": prefs.preferred_resolution if prefs else "1080p",
            "append_metadata": prefs.append_metadata if prefs else False,
            "custom_base_path": getattr(prefs, "custom_base_path", None) if prefs else None,
            "proxy_url": getattr(prefs, "proxy_url", None) if prefs else None,
            "cookie_text": cookie_text,
        }
        
        rules = db.query(DownloadRule).filter(
            DownloadRule.is_active,
            (DownloadRule.scope == "global") | (DownloadRule.scope == f"provider:{provider_id}")
        ).all()
        
        list_ids = [rule.criteria["in_list"] for rule in rules if rule.criteria and "in_list" in rule.criteria]
        custom_lists_query = db.query(CustomList).filter(CustomList.id.in_(list_ids)).all() if list_ids else []
        custom_lists_map = {cl.id: cl for cl in custom_lists_query}
        
        for video in extracted_videos:
            db.refresh(session)
            while session.status == "paused":
                time.sleep(2.0)
                db.refresh(session)
                
            if session.status == "stopped":
                break
                
            if not video["url"]:
                session.processed_videos += 1
                session.skipped_videos += 1
                db.commit()
                continue
                
            meta = video["metadata"]
            try:
                validate_url_ssrf(video["url"])
            except Exception:
                session.processed_videos += 1
                session.skipped_videos += 1
                db.commit()
                continue
                
            title_raw = meta.get("title")
            title = title_raw[0] if isinstance(title_raw, list) and title_raw else str(title_raw or "Unknown")
            
            max_items = criteria.get("max_items")
            if max_items and session.processed_videos >= int(max_items):
                session.processed_videos += 1
                session.skipped_videos += 1
                db.commit()
                continue
                
            dupe_check = evaluate_duplicate_quality(db, prefs, title, meta)
            if not dupe_check.get("proceed"):
                session.processed_videos += 1
                session.skipped_videos += 1
                db.commit()
                continue
                
            action = evaluate_rules(db, meta, rules, custom_lists_map)
            if action == "skip":
                session.processed_videos += 1
                session.skipped_videos += 1
                db.commit()
                continue
                
            existing_queue = db.query(DownloadQueue).filter(
                DownloadQueue.url == video["url"],
                DownloadQueue.status.in_(["pending", "running", "queued"])
            ).first()
            if existing_queue:
                session.processed_videos += 1
                session.skipped_videos += 1
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
            )
            queue.media_entry = media
            db.add(queue)
            db.flush()
            
            real_download_task.delay(queue.id, prefs_dict, meta)
            
            session.processed_videos += 1
            session.queued_videos += 1
            db.commit()
            
        if session.status != "stopped":
            session.status = "completed"
            db.commit()
