import os
import time
import tempfile
import yt_dlp
from celery import shared_task
from models import DownloadQueue, LibraryEntry, SessionCookie, Vault, Settings
from security import decrypt_data
from services.media_tagger import MediaTagger
from services.hash_service import HashService
from utils import get_media_roots, get_primary_root
from db_utils import get_db_session


@shared_task(bind=True)
def real_download_task(self, task_id: int, prefs_dict: dict, metadata: dict):
    with get_db_session() as db:
        task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
        if not task:
            return

        task.status = "running"
        db.commit()

        # Fetch advanced yt-dlp integrations
        global_settings = {s.key: s.value for s in db.query(Settings).filter(
            Settings.key.in_([
                "yt_write_subs", "yt_write_thumbs", "yt_sponsorblock", 
                "yt_live_streams", "yt_native_playlists", 
                "yt_browser_cookies", "yt_custom_format"
            ])
        ).all()}

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
                print(f"Warning: custom_base_path '{base_path}' is outside configured media roots. Falling back to default.")
                base_path = None

        if not base_path:
            primary_root = get_primary_root()
            base_path = os.path.join(
                primary_root, "downloads"
            )

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

        resolution_pref = prefs_dict.get("preferred_resolution", "1080p").replace(
            "p", ""
        ).replace("4K", "2160").replace("8K", "4320").replace("2K", "1440")

        format_str = f"bestvideo[height<={resolution_pref}]+bestaudio/best"
        if global_settings.get("yt_custom_format"):
            format_str = global_settings.get("yt_custom_format")

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
            ydl_opts["cookiesfrombrowser"] = (global_settings.get("yt_browser_cookies"),)

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
                    title=info.get("title", metadata.get("title", f"Download_{task_id}")),
                    performers=metadata.get("performers", []),
                    tags=metadata.get("tags", []),
                    file_path=filename,
                    resolution=prefs_dict.get("preferred_resolution", "1080p"),
                    file_size=os.path.getsize(filename) if os.path.exists(filename) else 0,
                    ohash=ohash,
                    metadata=metadata,
                )
                
                try:
                    new_entry.phash = HashService.generate_phash(filename)
                except Exception as e:
                    print(f"Warning: Failed to generate phash for {filename}: {str(e)}")
                    
                db.add(new_entry)

                if prefs_dict.get("append_metadata"):
                    try:
                        MediaTagger.tag_file(new_entry.file_path, metadata)
                    except Exception as e:
                        print(f"Warning: Failed to tag file {filename}: {str(e)}")

                task.status = "completed"
                db.commit()

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
                task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
                if task:
                    max_retries = prefs_dict.get("max_retries", 3)
                    if self.request.retries < max_retries:
                        task.status = "pending"
                        db.commit()
                        print(f"Download failed, retrying ({self.request.retries + 1}/{max_retries})...")
                        should_retry = True
                    else:
                        task.status = "failed"
                        db.commit()
                        print(f"Download failed permanently after {max_retries} retries: {str(e)}")
            except Exception as inner_e:
                print(f"Failed to update task status during error handling: {str(inner_e)}")
                
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
