import os
import ffmpeg
import subprocess
import re
from celery import shared_task
from models import TranscodingQueue, LibraryEntry
import logging
from datetime import datetime, timezone
from services.webhook_service import WebhookService
from services.off_peak_service import OffPeakService
from db_utils import get_db_session

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def transcode_video_task(self, transcode_job_id: int):
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
            db.query(LibraryEntry).filter(LibraryEntry.id == job.library_entry_id).first()
        )
        if not library_entry or not os.path.exists(library_entry.file_path):
            job.status = "failed"
            job.details = f"Library entry or file not found: {library_entry.file_path if library_entry else 'N/A'}"
            db.commit()
            return

        job.status = "running"
        job.progress_percentage = 0.0
        job.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()

        input_path = library_entry.file_path
        file_dir, file_name = os.path.split(input_path)
        file_base, file_ext = os.path.splitext(file_name)

        # Define output path for the new transcoded file
        output_filename = f"{file_base}.{job.target_codec}.mkv"
        output_path = os.path.join(file_dir, output_filename)
        temp_output_path = output_path + ".tmp"

        process = None
        try:
            logger.info(f"Starting transcode for {input_path} to {output_path}")

            # Get media duration for progress calculation
            probe = ffmpeg.probe(input_path)
            try:
                duration = float(probe["format"].get("duration", 0))
            except (KeyError, TypeError, ValueError):
                duration = 0.0

            # Build FFmpeg command
            stream = ffmpeg.input(input_path)
            stream = ffmpeg.output(
                stream,
                temp_output_path,
                vcodec="libx265" if job.target_codec == "h265" else "libaom-av1",
                acodec="copy",  # Copy audio track without re-encoding
                **{
                    "crf": 28
                },  # Constant Rate Factor (lower is better quality, 28 is a good default)
            )

            # Compile command and run via subprocess to capture real-time stderr
            args = ffmpeg.compile(stream, overwrite_output=True)
            process = subprocess.Popen(
                args, stderr=subprocess.PIPE, universal_newlines=True
            )

            time_regex = re.compile(r"time=(\d+):(\d+):(\d+\.\d+)")
            last_progress = 0.0
            error_log = []

            for line in process.stderr:
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
                        job.progress_percentage = progress
                        job.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
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
            old_file_size = library_entry.file_size

            library_entry.file_path = output_path
            library_entry.file_size = new_file_size

            # Invalidate old hashes since the file binary and potentially visual frames have changed
            library_entry.ohash = None
            library_entry.phash = None
            library_entry.entry_metadata = (library_entry.entry_metadata or {}).copy()
            library_entry.entry_metadata["previous_file"] = {
                "path": old_file_path,
                "size": old_file_size,
            }

            # Update job status
            job.status = "completed"
            job.progress_percentage = 100.0
            job.details = f"Transcoded successfully. New size: {new_file_size} bytes."

            db.commit()

            # Clean up old file
            if old_file_path != output_path and os.path.exists(old_file_path):
                os.remove(old_file_path)

            # Trigger Webhook
            WebhookService.trigger(
                "transcode.completed",
                {
                    "library_entry_id": library_entry.id,
                    "file_path": output_path,
                    "new_size": new_file_size,
                },
            )

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
                job.status = "failed"
                job.details = str(e)
                db.commit()
            logger.error(f"FFmpeg error for {input_path}: {job.details}")
            if os.path.exists(temp_output_path):
                os.remove(temp_output_path)  # Clean up temp file on failure
