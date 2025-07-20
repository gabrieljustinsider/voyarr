import os
import subprocess
import base64
import requests
import json
import logging
from celery import shared_task
from celery.exceptions import MaxRetriesExceededError
from models import LibraryEntry, Settings
from services.webhook_service import WebhookService
from db_utils import get_db_session

logger = logging.getLogger(__name__)

def extract_frame_base64(file_path: str) -> str:
    """Extracts a frame from the middle of the video and returns it as a base64 string."""
    try:
        # Get video duration
        cmd_duration = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", file_path
        ]
        duration_str = subprocess.check_output(cmd_duration).decode("utf-8").strip()
        duration = float(duration_str)
        midpoint = duration / 2.0

        # Extract frame at midpoint
        frame_path = f"{file_path}.frame.jpg"
        cmd_extract = [
            "ffmpeg", "-y", "-ss", str(midpoint), "-i", file_path,
            "-vframes", "1", "-q:v", "2", frame_path
        ]
        subprocess.run(cmd_extract, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        with open(frame_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
        
        os.remove(frame_path)
        return encoded
    except Exception as e:
        logger.error(f"Failed to extract frame from {file_path}: {e}")
        return ""

def call_ollama_vision(base64_img: str, url: str, raise_on_error: bool = False) -> list[str]:
    """Calls a local Ollama instance with LLaVA to get tags."""
    try:
        payload = {
            "model": "llava",
            "prompt": "Analyze this image and provide exactly 5 descriptive tags for it, separated by commas. Do not include any other text.",
            "images": [base64_img],
            "stream": False
        }
        resp = requests.post(f"{url.rstrip('/')}/api/generate", json=payload, timeout=60)
        resp.raise_for_status()
        result_text = resp.json().get("response", "")
        tags = [tag.strip() for tag in result_text.split(",") if tag.strip()]
        return tags[:5]
    except Exception as e:
        logger.error(f"Ollama Vision API error: {e}")
        if raise_on_error:
            raise
        return []

def call_openai_vision(base64_img: str, api_key: str, raise_on_error: bool = False) -> list[str]:
    """Calls OpenAI GPT-4o to get tags."""
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze this image and provide exactly 5 descriptive tags for it, separated by commas. Do not include any other text."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_img}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 50
        }
        resp = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=60)
        resp.raise_for_status()
        result_text = resp.json()["choices"][0]["message"]["content"]
        tags = [tag.strip() for tag in result_text.split(",") if tag.strip()]
        return tags[:5]
    except Exception as e:
        logger.error(f"OpenAI Vision API error: {e}")
        if raise_on_error:
            raise
        return []

@shared_task(
    bind=True,
    max_retries=5
)
def auto_tag_video_task(self, library_entry_id: int):
    """
    AI-Powered Auto-Tagging Milestone:
    Uses Ollama (LLaVA) or OpenAI (GPT-4o) to extract frames and generate tags.
    """
    with get_db_session() as db:
        entry = db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()

        if not entry or not os.path.exists(entry.file_path):
            return "Entry not found"

        logger.info(f"Running AI inference on {entry.file_path}...")

        # Fetch settings for AI
        ollama_url = db.query(Settings).filter(Settings.key == "ai_ollama_url").first()
        openai_key = db.query(Settings).filter(Settings.key == "ai_openai_key").first()

        detected_tags = []

        if (ollama_url and ollama_url.value) or (openai_key and openai_key.value):
            base64_frame = extract_frame_base64(entry.file_path)
            
            if base64_frame:
                try:
                    if ollama_url and ollama_url.value:
                        logger.info("Using local Ollama Vision model (LLaVA)")
                        detected_tags = call_ollama_vision(base64_frame, ollama_url.value, raise_on_error=True)
                    elif openai_key and openai_key.value:
                        logger.info("Using OpenAI Vision model")
                        detected_tags = call_openai_vision(base64_frame, openai_key.value, raise_on_error=True)
                except (requests.exceptions.RequestException, requests.exceptions.Timeout) as exc:
                    try:
                        # Exponential backoff countdown
                        countdown = 2 ** self.request.retries
                        logger.warning(
                            f"AI service request failed: {exc}. "
                            f"Retrying task in {countdown}s (Attempt {self.request.retries + 1}/{self.max_retries})"
                        )
                        raise self.retry(exc=exc, countdown=countdown)
                    except MaxRetriesExceededError:
                        logger.error("Max retries exceeded for AI auto-tagging. Applying fallback tags.")
                        # Fallback is handled below because detected_tags remains empty []

        # Fallback if no models are configured, extraction failed, or max retries exceeded
        if not detected_tags:
            logger.info("Applying fallback tags due to missing configuration or service error.")
            detected_tags = ["AI-Tagged", "Processed"]

        existing_tags = entry.tags or []
        # Ensure we don't duplicate tags
        entry.tags = list(set(existing_tags + detected_tags))
        db.commit()

        WebhookService.trigger(
            "ai_tagging.completed",
            {"library_entry_id": entry.id, "new_tags": detected_tags},
        )

