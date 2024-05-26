import os
import yt_dlp
from celery import shared_task
from database import SessionLocal
from models import DownloadQueue, LibraryEntry
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
            base_path = os.path.join(os.getenv("MEDIA_ROOT", "/media/storage"), "downloads")
        
        os.makedirs(base_path, exist_ok=True)

        def progress_hook(d):
            if d['status'] == 'downloading':
                p_str = d.get('_percent_str', '0%').replace('%', '').strip()
                try:
                    # Strip ANSI escape sequences commonly injected by yt-dlp
                    clean_p = ''.join(c for c in p_str if c.isdigit() or c == '.')
                    if clean_p:
                        task.progress_percentage = float(clean_p)
                        db.commit()
                except ValueError:
                    pass
            elif d['status'] == 'finished':
                task.progress_percentage = 100.0
                task.status = "completed"
                db.commit()

        resolution_pref = prefs_dict.get('preferred_resolution', '1080p').replace('p', '')
        
        ydl_opts = {
            'format': f'bestvideo[height<={resolution_pref}]+bestaudio/best',
            'outtmpl': f'{base_path}/%(title)s.%(ext)s',
            'progress_hooks': [progress_hook],
            'quiet': True,
        }

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
                resolution=prefs_dict.get('preferred_resolution', '1080p'),
                file_size=os.path.getsize(filename) if os.path.exists(filename) else 0,
                ohash=ohash,
                metadata=metadata
            )
            db.add(new_entry)
            db.commit()
            
            if prefs_dict.get('append_metadata'):
                MediaTagger.tag_file(new_entry.file_path, metadata)
                
    except Exception as e:
        task.status = "failed"
        db.commit()
        print(f"Download failed: {str(e)}")
    finally:
        db.close()