from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import DownloadPreference, Provider
from pydantic import BaseModel
from typing import Optional

from dependencies import verify_api_key

router = APIRouter(
    prefix="/preferences", tags=["preferences"], dependencies=[Depends(verify_api_key)]
)


class PreferenceUpdate(BaseModel):
    preferred_resolution: str = "1080p"
    naming_pattern: str = "{title}_{performers}_{resolution}"
    append_metadata: bool = True
    auto_tag_files: bool = True
    duplicate_handling: str = "skip"
    custom_base_path: Optional[str] = None
    max_retries: int = 3


@router.get("/provider/{provider_id}")
def get_preferences(provider_id: int, db: Session = Depends(get_db)):
    """Get download preferences for a provider."""
    prefs = (
        db.query(DownloadPreference)
        .filter(DownloadPreference.provider_id == provider_id)
        .first()
    )

    if not prefs:
        # Return defaults
        return {
            "provider_id": provider_id,
            "preferred_resolution": "1080p",
            "naming_pattern": "{title}_{performers}_{resolution}",
            "append_metadata": True,
            "auto_tag_files": True,
            "custom_base_path": None,
            "duplicate_handling": "skip",
            "max_retries": 3,
            "available_variables": [
                "title",
                "performers",
                "tags",
                "resolution",
                "date",
                "duration",
                "site_id",
                "provider",
            ],
        }

    return {
        "provider_id": prefs.provider_id,
        "preferred_resolution": prefs.preferred_resolution,
        "naming_pattern": prefs.naming_pattern,
        "append_metadata": prefs.append_metadata,
        "auto_tag_files": prefs.auto_tag_files,
        "duplicate_handling": prefs.duplicate_handling,
        "custom_base_path": getattr(prefs, "custom_base_path", None),
        "max_retries": getattr(prefs, "max_retries", 3),
        "available_variables": [
            "title",
            "performers",
            "tags",
            "resolution",
            "date",
            "duration",
            "site_id",
            "provider",
        ],
    }


@router.post("/provider/{provider_id}")
def update_preferences(
    provider_id: int, prefs: PreferenceUpdate, db: Session = Depends(get_db)
):
    """Update download preferences for a provider."""
    # Verify provider exists
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    db_prefs = (
        db.query(DownloadPreference)
        .filter(DownloadPreference.provider_id == provider_id)
        .first()
    )

    if db_prefs:
        db_prefs.preferred_resolution = prefs.preferred_resolution
        db_prefs.naming_pattern = prefs.naming_pattern
        db_prefs.append_metadata = prefs.append_metadata
        db_prefs.auto_tag_files = prefs.auto_tag_files
        db_prefs.duplicate_handling = prefs.duplicate_handling
        if hasattr(db_prefs, "custom_base_path"):
            db_prefs.custom_base_path = prefs.custom_base_path
        if hasattr(db_prefs, "max_retries"):
            db_prefs.max_retries = prefs.max_retries
    else:
        db_prefs = DownloadPreference(
            provider_id=provider_id,
            preferred_resolution=prefs.preferred_resolution,
            naming_pattern=prefs.naming_pattern,
            append_metadata=prefs.append_metadata,
            auto_tag_files=prefs.auto_tag_files,
            duplicate_handling=prefs.duplicate_handling,
        )
        if hasattr(db_prefs, "custom_base_path"):
            db_prefs.custom_base_path = prefs.custom_base_path
        if hasattr(db_prefs, "max_retries"):
            db_prefs.max_retries = prefs.max_retries
        db.add(db_prefs)

    db.commit()
    return {"message": "Preferences updated"}


@router.get("/naming-patterns")
def get_naming_patterns():
    """Get available naming pattern examples."""
    return {
        "template_variables": {
            "title": "Video title",
            "performers": "Comma-separated performer names",
            "tags": "Comma-separated tags",
            "resolution": "Video resolution (e.g., 1080p)",
            "date": "Publication date (YYYY-MM-DD format)",
            "duration": "Video duration in minutes",
            "site_id": "Original site ID",
            "provider": "Provider name",
        },
        "example_patterns": [
            "{title}_{performers}_{resolution}",
            "{title}_{date}",
            "{performers}_{title}",
            "{resolution}_{title}_{tags}",
        ],
    }


@router.post("/validate-pattern")
def validate_naming_pattern(pattern: dict):
    """Validate a naming pattern."""
    sample_metadata = {
        "title": "Sample Video",
        "performers": "Actor1, Actor2",
        "tags": "tag1, tag2",
        "resolution": "1080p",
        "date": "2024-05-10",
        "duration": "45",
        "site_id": "12345",
        "provider": "example",
    }

    try:
        result = pattern.get("pattern", "").format(**sample_metadata)
        return {"valid": True, "example": result}
    except KeyError as e:
        return {"valid": False, "error": f"Unknown variable: {e}"}
    except Exception as e:
        return {"valid": False, "error": str(e)}
