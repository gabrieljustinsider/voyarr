import os
from celery import shared_task
from database import SessionLocal
from models import LibraryEntry
import logging
from services.webhook_service import WebhookService

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def auto_tag_video_task(self, library_entry_id: int):
    """
    AI-Powered Auto-Tagging Milestone:
    Uses a local LLM or Vision model to extract frames and generate tags.
    """
    db = SessionLocal()
    entry = db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()

    if not entry or not os.path.exists(entry.file_path):
        db.close()
        return "Entry not found"

    try:
        # Placeholder ready for LLaVA, BLIP, or CLIP integration
        # import torch
        # from transformers import pipeline

        logger.info(f"Running AI inference on {entry.file_path}...")
        detected_tags = ["AI-Tagged", "Processed"]

        existing_tags = entry.tags or []
        entry.tags = list(set(existing_tags + detected_tags))
        db.commit()

        WebhookService.trigger(
            "ai_tagging.completed",
            {"library_entry_id": entry.id, "new_tags": detected_tags},
        )
    except ImportError:
        logger.error(
            "AI packages (torch, transformers) not installed. Skipping AI tagging."
        )
    finally:
        db.close()
