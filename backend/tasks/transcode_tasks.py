import os
import subprocess  # nosec B404
import logging
import re
import ffmpeg  # type: ignore
from datetime import datetime, timezone
from celery_app import celery_app
from db_utils import get_db_session
from models import TranscodingQueue, LibraryEntry
from services.webhook_service import WebhookService
from services.off_peak_service import OffPeakService
from typing import Any, cast

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="tasks.transcode_tasks.transcode_video_task")  # type: ignore
def transcode_video_task(self: Any, transcode_job_id: int) -> None:
    """
    Celery task to transcode a video file to a more efficient codec.
    """
    # Milestone 4: Scheduled & Off-Peak Tasks
    if not OffPeakService.is_off_peak():
        logger.info(
            "Outside of off-peak hours. Deferring transcode task by 60 minutes."
        )
        self.retry(countdown=3600, max_retries=None)

    with get_db_session() as db:
        job = (
            db.query(TranscodingQueue)
            .filter(TranscodingQueue.id == transcode_job_id)
            .first()
        )
        if not job:
            logger.error(f"Transcode job {transcode_job_id} not found.")
            return

        library_entry = (
            db.query(LibraryEntry)
            .filter(LibraryEntry.id == job.library_entry_id)
            .first()
        )
        if not library_entry or not library_entry.file_path or not os.path.exists(str(library_entry.file_path)):  # type: ignore
            job.status = "failed"  # type: ignore
            job.details = f"Library entry or file not found: {library_entry.file_path if library_entry else 'N/A'}"  # type: ignore
            db.commit()
            return

        job.status = "running"  # type: ignore
        job.progress_percentage = 0.0  # type: ignore
        job.celery_task_id = self.request.id  # type: ignore
        job.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)  # type: ignore
        db.commit()

        input_path = str(library_entry.file_path)
        file_dir, file_name = os.path.split(input_path)
        file_base, _ = os.path.splitext(file_name)

        # Define output path for the new transcoded file
        output_filename = f"{file_base}.{job.target_codec}.mkv"
        output_path = os.path.join(file_dir, output_filename)
        temp_output_path = output_path + ".tmp"

        process = None
        try:
            logger.info(f"Starting transcode for {input_path} to {output_path}")

            # Get media duration for progress calculation
            probe = ffmpeg.probe(input_path)  # type: ignore
            try:
                duration = float(probe["format"].get("duration", 0))
            except (KeyError, TypeError, ValueError):
                duration = 0.0

            # Build FFmpeg command
            stream = ffmpeg.input(input_path)  # type: ignore
            stream = ffmpeg.output(  # type: ignore
                stream,  # type: ignore
                temp_output_path,
                vcodec="libx265" if str(job.target_codec) == "h265" else "libaom-av1",
                acodec="copy",  # Copy audio track without re-encoding
                **{
                    "crf": 28
                },  # Constant Rate Factor (lower is better quality, 28 is a good default)
            )

            # Compile command and run via subprocess to capture real-time stderr
            args = ffmpeg.compile(stream, overwrite_output=True)  # type: ignore
            process = subprocess.Popen(  # nosec B603
                args, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, universal_newlines=True
            )

            # Save the process ID to allow pause/resume/cancel
            job.pid = process.pid  # type: ignore
            db.commit()

            time_regex = re.compile(r"time=(\d+):(\d+):(\d+\.\d+)")
            last_progress = 0.0
            error_log: list[str] = []

            for line in process.stderr or []:
                error_log.append(line)
                if len(error_log) > 20:
                    error_log.pop(0)  # Keep only the last 20 lines to save memory

                match = time_regex.search(line)
                if match:
                    hours, minutes, seconds = (
                        float(match.group(1)),
                        float(match.group(2)),
                        float(match.group(3)),
                    )
                    current_time = hours * 3600 + minutes * 60 + seconds
                    if duration > 0:
                        progress = min((current_time / duration) * 100, 99.9)
                    else:
                        progress = 50.0  # Indeterminate progress fallback

                    # Update database every 5% to prevent database locking/spamming
                    if progress - last_progress >= 5.0:
                        # Re-fetch job to check if cancelled or paused
                        db.refresh(job)
                        if str(job.status) == "cancelled":
                            logger.info(
                                f"Transcode job {transcode_job_id} cancelled by user."
                            )
                            process.terminate()
                            return

                        job.progress_percentage = progress  # type: ignore
                        job.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)  # type: ignore
                        db.commit()
                        last_progress = progress

            process.wait()
            if process.returncode != 0:
                error_msg = "".join(error_log)
                raise Exception(
                    f"FFmpeg failed with exit code {process.returncode}:\n{error_msg}"
                )

            # --- Transcode successful ---
            logger.info(f"Transcode successful for {input_path}")

            # Get new file size
            new_file_size = os.path.getsize(temp_output_path)
            os.rename(temp_output_path, output_path)

            # Store old file info and update library entry
            old_file_path = library_entry.file_path
            old_file_size = int(cast(int, library_entry.file_size)) if library_entry.file_size is not None else 0  # type: ignore

            library_entry.file_path = output_path  # type: ignore
            library_entry.file_size = new_file_size  # type: ignore

            # Invalidate old hashes since the file binary and potentially visual frames have changed
            library_entry.ohash = None  # type: ignore
            library_entry.phash = None  # type: ignore
            library_entry.entry_metadata = (library_entry.entry_metadata or {}).copy()  # type: ignore 
            library_entry.entry_metadata["previous_file"] = {  # type: ignore
                "path": old_file_path,
                "size": old_file_size,
            }

            # Update job status
            job.status = "completed"  # type: ignore
            job.progress_percentage = 100.0  # type: ignore
            job.details = f"Transcoded successfully. New size: {new_file_size} bytes."  # type: ignore
            db.commit()

            # Clean up old file
            if str(old_file_path) != output_path and os.path.exists(str(old_file_path)):
                os.remove(str(old_file_path))

            # Trigger Webhook
            WebhookService.trigger(  # type: ignore
                "transcode.completed",
                {
                    "library_entry_id": library_entry.id,
                    "file_path": output_path,
                    "new_size": new_file_size,
                },
            )

            # Trigger Notification
            try:
                from services.notification_service import NotificationService

                NotificationService.notify_global(
                    db,
                    "task_completed",
                    "Transcoding Completed",
                    f"Successfully transcoded '{library_entry.title}' to {job.target_codec}.",
                )
            except Exception as notif_err:
                print(f"Error sending transcode completion notification: {notif_err}")

        except Exception as e:
            if process and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()

            db.rollback()
            job = (
                db.query(TranscodingQueue)
                .filter(TranscodingQueue.id == transcode_job_id)
                .first()
            )
            if job:
                job.status = "failed"  # type: ignore
                job.details = str(e)  # type: ignore
                db.commit()
            logger.error(f"FFmpeg error for {input_path}: {str(e)}")

            # Clean up temp file on failure
            if os.path.exists(temp_output_path):
                os.remove(temp_output_path)

            try:
                from services.notification_service import NotificationService

                NotificationService.notify_global(
                    db,
                    "task_completed",
                    "Transcoding Failed",
                    f"Failed to transcode '{library_entry.title if library_entry else 'unknown'}': {str(e)}",
                )
            except Exception as notif_err:
                print(f"Error sending transcode failure notification: {notif_err}")

            raise e


@celery_app.task(bind=True, name="tasks.transcode_tasks.generate_hls_task")  # type: ignore
def generate_hls_task(self: Any, library_entry_id: int) -> str | None:
    """
    Generates an HLS playlist and transport stream segments for direct web streaming.
    """
    with get_db_session() as db:
        entry = (
            db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()
        )
        if not entry or not entry.file_path or not os.path.exists(str(entry.file_path)):  # type: ignore
            logger.error(f"Entry {library_entry_id} not found or missing file path.")
            return

        # SECURITY: Use absolute path to prevent FFmpeg option injection if file starts with "-"
        video_path = os.path.abspath(str(entry.file_path))

    hls_dir = f"{video_path}.hls"
    os.makedirs(hls_dir, exist_ok=True)
    playlist_path = os.path.join(hls_dir, "master.m3u8")

    if os.path.exists(playlist_path):
        logger.info(f"HLS playlist already exists for {video_path}")
        return "Already generated"

    logger.info(f"Starting HLS generation for {video_path}")

    try:
        cmd: list[str] = [
            "ffmpeg",
            "-y",
            "-i",
            video_path,
            "-profile:v",
            "main",
            "-crf",
            "20",
            "-g",
            "48",
            "-keyint_min",
            "48",
            "-sc_threshold",
            "0",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-hls_time",
            "10",
            "-hls_playlist_type",
            "vod",
            "-hls_segment_filename",
            os.path.join(hls_dir, "segment_%03d.ts"),
            playlist_path,
        ]
        # Execute FFmpeg without a timeout since transcode operations on large files are lengthy
        subprocess.run(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL, check=True
        )  # nosec B603
        logger.info(f"Successfully generated HLS for {video_path}")
        return "HLS Generated successfully"
    except Exception as e:
        logger.error(f"Failed to generate HLS for {video_path}: {e}")
        raise e
