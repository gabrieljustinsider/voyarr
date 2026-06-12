import os
import subprocess  # nosec B404
import base64
import requests
import logging
import re
from celery import shared_task  # type: ignore
from celery.exceptions import MaxRetriesExceededError  # type: ignore
from models import LibraryEntry, Settings, VideoChapter
from services.webhook_service import WebhookService
from db_utils import get_db_session
from typing import Any, cast

logger = logging.getLogger(__name__)


def extract_frame_base64(file_path: str) -> str:
    """Extracts a frame from the middle of the video and returns it as a base64 string."""
    # Prevent argument injection if the filename starts with "-"
    abs_file_path = os.path.abspath(file_path)

    try:
        # Get video duration
        cmd_duration = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            abs_file_path,
        ]
        # SECURITY: Add timeout to prevent process hanging (Denial of Service)
        duration_str = (
            subprocess.check_output(cmd_duration, stdin=subprocess.DEVNULL, timeout=30).decode("utf-8").strip()
        )  # nosec B603
        duration = float(duration_str)
        midpoint = duration / 2.0

        try:
            cmd_extract = [
                "ffmpeg",
                "-y",
                "-ss",
                str(midpoint),
                "-i",
                abs_file_path,
                "-vframes",
                "1",
                "-q:v",
                "2",
                "-f",
                "image2pipe",
                "-vcodec",
                "mjpeg",
                "-"
            ]
            process = subprocess.run(
                cmd_extract,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL,
                check=True,
                timeout=60,
            )  # nosec B603

            return base64.b64encode(process.stdout).decode("utf-8")

    except subprocess.TimeoutExpired as e:
        logger.error(f"Timeout while extracting frame from {abs_file_path}: {e}")
        return ""
    except Exception as e:
        logger.error(f"Failed to extract frame from {abs_file_path}: {e}")
        return ""


def call_ollama_vision(
    base64_img: str, url: str, raise_on_error: bool = False
) -> list[str]:
    """Calls a local Ollama instance with LLaVA to get tags."""
    try:
        payload: dict[str, Any] = {
            "model": "llava",
            "prompt": "Analyze this image and provide exactly 5 descriptive tags for it, separated by commas. Do not include any other text.",
            "images": [base64_img],
            "stream": False,
        }
        resp = requests.post(
            f"{url.rstrip('/')}/api/generate", json=payload, timeout=60
        )
        resp.raise_for_status()
        result_text = resp.json().get("response", "")
        tags = [tag.strip() for tag in result_text.split(",") if tag.strip()]
        return tags[:5]
    except Exception as e:
        logger.error(f"Ollama Vision API error: {e}")
        if raise_on_error:
            raise
        return []


def call_openai_vision(
    base64_img: str, api_key: str, raise_on_error: bool = False
) -> list[str]:
    """Calls OpenAI GPT-4o to get tags."""
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        payload: dict[str, Any] = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze this image and provide exactly 5 descriptive tags for it, separated by commas. Do not include any other text.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_img}"
                            },
                        },
                    ],
                }
            ],
            "max_tokens": 50,
        }
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        result_text = resp.json()["choices"][0]["message"]["content"]
        tags = [tag.strip() for tag in result_text.split(",") if tag.strip()]
        return tags[:5]
    except Exception as e:
        logger.error(f"OpenAI Vision API error: {e}")
        if raise_on_error:
            raise
        return []


@shared_task(bind=True, max_retries=5)
def auto_tag_video_task(self: Any, library_entry_id: int) -> str | None:
    """
    AI-Powered Auto-Tagging Milestone:
    Uses Ollama (LLaVA) or OpenAI (GPT-4o) to extract frames and generate tags.
    """
    with get_db_session() as db:
        entry = (
            db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()
        )

        if not entry or not entry.file_path or not os.path.exists(str(entry.file_path)):  # type: ignore
            return "Entry not found"

        logger.info(f"Running AI inference on {entry.file_path}...")

        # Fetch settings for AI
        ollama_url = db.query(Settings).filter(Settings.key == "ai_ollama_url").first()
        openai_key = db.query(Settings).filter(Settings.key == "ai_openai_key").first()

        detected_tags = []

        if (ollama_url and ollama_url.value) or (openai_key and openai_key.value):  # type: ignore
            base64_frame = extract_frame_base64(str(entry.file_path))

            if base64_frame:
                try:
                    if ollama_url and ollama_url.value:  # type: ignore
                        logger.info("Using local Ollama Vision model (LLaVA)")
                        detected_tags = call_ollama_vision(
                            base64_frame, str(ollama_url.value), raise_on_error=True
                        )
                    elif openai_key and openai_key.value:  # type: ignore
                        logger.info("Using OpenAI Vision model")
                        detected_tags = call_openai_vision(
                            base64_frame, str(openai_key.value), raise_on_error=True
                        )
                except (
                    requests.exceptions.RequestException,
                    requests.exceptions.Timeout,
                ) as exc:
                    try:
                        # Exponential backoff countdown
                        countdown = 2 ** int(self.request.retries)
                        logger.warning(
                            f"AI service request failed: {exc}. "
                            f"Retrying task in {countdown}s (Attempt {self.request.retries + 1}/{self.max_retries})"
                        )
                        raise self.retry(exc=exc, countdown=countdown)
                    except MaxRetriesExceededError:
                        logger.error(
                            "Max retries exceeded for AI auto-tagging. Applying fallback tags."
                        )
                        # Fallback is handled below because detected_tags remains empty []

        # Fallback if no models are configured, extraction failed, or max retries exceeded
        if not detected_tags:
            logger.info(
                "Applying fallback tags due to missing configuration or service error."
            )
            detected_tags = ["AI-Tagged", "Processed"]

        existing_tags = cast(list[str], entry.tags) if entry.tags else []  # type: ignore
        # Ensure we don't duplicate tags
        entry.tags = list(set(existing_tags + detected_tags))  # type: ignore
        db.commit()

        WebhookService.trigger(  # type: ignore
            "ai_tagging.completed",
            {"library_entry_id": int(cast(int, entry.id)) if entry.id else library_entry_id, "new_tags": detected_tags},  # type: ignore
        )


def extract_frame_at_timestamp_base64(file_path: str, timestamp: float) -> str:
    abs_file_path = os.path.abspath(file_path)

    try:
        cmd_extract = [
            "ffmpeg",
            "-y",
            "-ss",
            str(timestamp),
            "-i",
            abs_file_path,
            "-vframes",
            "1",
            "-q:v",
            "2",
            "-f",
            "image2pipe",
            "-vcodec",
            "mjpeg",
            "-"
        ]
        process = subprocess.run(
            cmd_extract,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            check=True,
            timeout=60,
        )  # nosec B603

        return base64.b64encode(process.stdout).decode("utf-8")
    except subprocess.TimeoutExpired as e:
        logger.error(
            f"Timeout extracting frame at {timestamp} from {abs_file_path}: {e}"
        )
        return ""
    except Exception as e:
        logger.error(
            f"Failed to extract frame at {timestamp} from {abs_file_path}: {e}"
        )
        return ""


def get_scene_changes(file_path: str, threshold: float = 0.3) -> list[float]:
    abs_file_path = os.path.abspath(file_path)
    cmd = [
        "ffmpeg",
        "-i",
        abs_file_path,
        "-filter:v",
        f"select='gt(scene,{threshold})',showinfo",
        "-f",
        "null",
        "-",
    ]
    timestamps = [0.0]  # Always include the start
    try:
        # High timeout as full video scene detection takes time
        output = subprocess.check_output(
            cmd, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, timeout=300
        ).decode("utf-8")  # nosec B603
        # Parses 'pts_time:12.345'
        for match in re.finditer(r"pts_time:([\d\.]+)", output):
            timestamps.append(float(match.group(1)))
    except Exception as e:
        logger.error(f"Scene detection failed or timed out: {e}")
        # Fallback to uniform chapters every 5 minutes if scene detection fails
        try:
            cmd_duration = [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                abs_file_path,
            ]
            duration = float(
                subprocess.check_output(cmd_duration, stdin=subprocess.DEVNULL, timeout=30)
                .decode("utf-8")
                .strip()
            )  # nosec B603
            timestamps = [i * 300.0 for i in range(int(duration / 300))]
            if not timestamps:
                timestamps = [0.0]
        except Exception:
            pass
    return sorted(list(set(timestamps)))


def call_vision_model_text(base64_img: str, url: str, api_key: str, prompt: str) -> str:
    if url:  # Local Ollama
        try:
            payload: dict[str, Any] = {
                "model": "llava",
                "prompt": prompt,
                "images": [base64_img],
                "stream": False,
            }
            resp = requests.post(
                f"{url.rstrip('/')}/api/generate", json=payload, timeout=60
            )
            resp.raise_for_status()
            return resp.json().get("response", "").strip()
        except Exception as e:
            logger.error(f"Ollama Chaptering error: {e}")
            return ""
    elif api_key:  # OpenAI GPT-4o
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            }
            payload: dict[str, Any] = {
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_img}"
                                },
                            },
                        ],
                    }
                ],
                "max_tokens": 50,
            }
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=60,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"OpenAI Chaptering error: {e}")
            return ""
    return ""


@shared_task(bind=True, max_retries=3)
def generate_video_chapters_task(
    self: Any, library_entry_id: int, min_chapter_duration: float = 120.0
) -> str:
    with get_db_session() as db:
        entry = (
            db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()
        )
        if not entry or not entry.file_path or not os.path.exists(str(entry.file_path)):  # type: ignore
            return "Entry not found"

        ollama_url = db.query(Settings).filter(Settings.key == "ai_ollama_url").first()
        openai_key = db.query(Settings).filter(Settings.key == "ai_openai_key").first()

        if not ((ollama_url and ollama_url.value) or (openai_key and openai_key.value)):  # type: ignore
            return "No AI vision model configured."

        logger.info(f"Detecting scenes for {entry.file_path}...")
        raw_timestamps = get_scene_changes(str(entry.file_path))

        # Filter timestamps to ensure chapters aren't too close together
        filtered_timestamps: list[float] = []
        last_ts = -min_chapter_duration
        for ts in raw_timestamps:
            if ts - last_ts >= min_chapter_duration:
                filtered_timestamps.append(ts)
                last_ts = ts

        logger.info(
            f"Generating {len(filtered_timestamps)} chapters for {entry.file_path}..."
        )
        prompt = "Analyze this image and provide a short, 3 to 5 word chapter title that describes the scene. Do not include any other text or quotes."

        # Clear existing auto-chapters to replace them
        db.query(VideoChapter).filter(
            VideoChapter.library_entry_id == entry.id
        ).delete()

        for i, ts in enumerate(filtered_timestamps):
            sample_ts = ts + 5.0  # Extract frame slightly after the cut
            base64_frame = extract_frame_at_timestamp_base64(str(entry.file_path), sample_ts)

            if not base64_frame:
                continue

            chapter_title = f"Chapter {i + 1}"
            ai_title = call_vision_model_text(
                base64_frame,
                str(ollama_url.value) if ollama_url and ollama_url.value else "",  # type: ignore
                str(openai_key.value) if openai_key and openai_key.value else "",  # type: ignore
                prompt,
            )
            if ai_title:
                chapter_title = ai_title.strip('"').strip("'")

            next_ts = (
                filtered_timestamps[i + 1]
                if i + 1 < len(filtered_timestamps)
                else (int(cast(int, entry.duration)) if entry.duration else (ts + 300))  # type: ignore
            )

            chapter = VideoChapter(
                library_entry_id=entry.id,
                title=chapter_title,
                start_time=int(ts),
                end_time=int(next_ts),
            )
            db.add(chapter)

        entry.has_chapters = len(filtered_timestamps) > 0  # type: ignore
        db.commit()
        logger.info(f"Successfully auto-chaptered {entry.title}.")
        return f"Generated {len(filtered_timestamps)} chapters."
