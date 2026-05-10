import os
import yt_dlp
from celery_app import celery_app, get_task_db
from models import DownloadQueue, LibraryEntry, DownloadPreference
from services.media_tagger import MediaTagger
from services.hash_service import HashService

@celery_app.task(bind=True, max_retries=3)
def real_download_task(self, task_id: int, prefs_dict: dict, metadata: dict):
    db = get_task_db()
    try:
        task = db.query(DownloadQueue).filter(DownloadQueue.id == task_id).first()
        if not task:
            return "Task not found"
        
        task.status = "running"
        db.commit()
        
        url = task.url
        output_dir = "/media/storage/downloads"
        os.makedirs(output_dir, exist_ok=True)
        
        def progress_hook(d):
            if d['status'] == 'downloading':
                p_str = d.get('_percent_str', '0%').replace('%', '').strip()
                try:
                    # Parse out ansi-escape characters commonly injected by yt-dlp
                    clean_p = ''.join(c for c in p_str if c.isdigit() or c == '.')
                    task.progress_percentage = float(clean_p)
                    task.speed = d.get('_speed_str', '')
                    task.file_size = d.get('total_bytes') or d.get('downloaded_bytes', 0)
                    # We create a new session locally per tick to avoid locking, 
                    # but for now we just commit on the existing db session
                    db.commit()
                except ValueError:
                    pass
            elif d['status'] == 'finished':
                task.progress_percentage = 100.0
                task.status = "completed"
                db.commit()

        resolution_pref = prefs_dict.get('preferred_resolution', '1080p').replace('p', '') if prefs_dict else "1080"
        
        ydl_opts = {
            'format': f'bestvideo[height<={resolution_pref}]+bestaudio/best',
            'outtmpl': f'{output_dir}/%(title)s.%(ext)s',
            'progress_hooks': [progress_hook],
            'quiet': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            ohash = HashService.generate_ohash(filename)
            
            new_entry = LibraryEntry(
                provider_id=task.media_entry.provider_id,
                title=info.get("title", metadata.get("title", f"Download_{task_id}")),
                performers=metadata.get("performers", []),
                tags=metadata.get("tags", []),
                file_path=filename,
                resolution=prefs_dict.get('preferred_resolution', '1080p') if prefs_dict else "1080p",
                file_size=os.path.getsize(filename) if os.path.exists(filename) else 0,
                ohash=ohash,
                metadata=metadata
            )
            db.add(new_entry)
            db.commit()
            
            if prefs_dict and prefs_dict.get('append_metadata'):
                MediaTagger.tag_file(new_entry.file_path, metadata)
                
    except Exception as e:
        task.status = "failed"
        task.retry_count += 1
        db.commit()
        print(f"Download failed: {str(e)}")
        # Raise for Celery to retry
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()
