import os
import time
import tempfile
import yt_dlp
from celery import shared_task
from database import SessionLocal
from models import DownloadQueue, LibraryEntry, SessionCookie, Vault
from security import decrypt_data
from services.media_tagger import MediaTagger
from services.hash_service import HashService


@shared_task(bind=True)
def real_download_task(self, task_id: int, prefs_dict: dict, metadata: dict):
    db = SessionLocal()
    try:
        task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
        if not task:
            return

        task.status = "running"
        db.commit()

        # Respect the custom_base_path from provider preferences, or fallback to default
        base_path = prefs_dict.get("custom_base_path")
        if not base_path:
            base_path = os.path.join(
                os.getenv("MEDIA_ROOT", "/media/storage"), "downloads"
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
        )

        ydl_opts = {
            "format": f"bestvideo[height<={resolution_pref}]+bestaudio/best",
            "outtmpl": f"{base_path}/%(title)s.%(ext)s",
            "progress_hooks": [progress_hook],
            "quiet": True,
        }

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

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(task.url, download=True)
            filename = ydl.prepare_filename(info)

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
            new_entry.phash = HashService.generate_phash(filename)
            db.add(new_entry)

            if prefs_dict.get("append_metadata"):
                MediaTagger.tag_file(new_entry.file_path, metadata)

            task.status = "completed"
            db.commit()

    except Exception as e:
        db.refresh(task)
        if task.status in ["paused", "cancelled"]:
            db.commit()
            print(f"Download {task.status}: {str(e)}")
            return

        # Clean up failed download fragments
        if "filename" in locals():
            for ext in ["", ".part", ".ytdl", ".temp"]:
                temp_file = filename + ext
                if os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                    except Exception:
                        pass

        max_retries = prefs_dict.get("max_retries", 3)
        if self.request.retries < max_retries:
            task.status = "pending"
            db.commit()
            print(
                f"Download failed, retrying ({self.request.retries + 1}/{max_retries})..."
            )
            raise self.retry(exc=e, countdown=60)
        else:
            task.status = "failed"
            db.commit()
            print(f"Download failed permanently after {max_retries} retries: {str(e)}")
    finally:
        if (
            "cookie_temp_path" in locals()
            and cookie_temp_path
            and os.path.exists(cookie_temp_path)
        ):
            try:
                os.remove(cookie_temp_path)
            except Exception:
                pass
        db.close()
