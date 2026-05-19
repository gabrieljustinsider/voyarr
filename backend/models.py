from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    TIMESTAMP,
    DECIMAL,
    BIGINT,
    JSON,
    Boolean,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

Base = declarative_base()  # type: ignore


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user")  # 'admin', 'user', 'viewer'
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    base_url = Column(String(500), nullable=False)
    naming_pattern = Column(Text)
    separator = Column(String(10), default="_")
    space_replacement = Column(String(10), default="_")
    automatic_limits = Column(
        JSON
    )  # Default limits for the provider (e.g., {"daily_downloads": 50, "concurrent_downloads": 2})


class SiteRecipe(Base):
    __tablename__ = "site_recipes"

    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    css_selectors = Column(JSON)
    xpath_selectors = Column(JSON)
    regex_patterns = Column(JSON)
    map_mode_data = Column(JSON)


class Vault(Base):
    __tablename__ = "vault"
    __table_args__ = (UniqueConstraint('entity_type', 'entity_id', 'key', name='uix_vault_entity_key'),)

    id = Column(Integer, primary_key=True)
    entity_type = Column(
        String(50), nullable=False, index=True
    )  # e.g., 'credential', 'session_cookie'
    entity_id = Column(Integer, nullable=False, index=True)
    key = Column(
        String(100), nullable=False
    )  # e.g., 'username', 'password', 'cookie_data'
    encrypted_value = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    custom_limits = Column(
        JSON
    )  # Account-level custom provider limits (overrides automatic_limits)
    sync_source = Column(
        String(50), default="manual"
    )  # 'manual', '1password', 'bitwarden'
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class MediaEntry(Base):
    __tablename__ = "media_entries"

    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500))
    performers = Column(JSON)  # Array of strings
    tags = Column(JSON)  # Array of strings
    ohash = Column(String(16), unique=True, index=True)
    phash = Column(String(16), index=True)
    site_id = Column(String(100), index=True)
    media_metadata = Column(JSON)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )


class LocalFile(Base):
    __tablename__ = "local_files"

    id = Column(Integer, primary_key=True)
    media_entry_id = Column(Integer, ForeignKey("media_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(Text, nullable=False)
    file_size = Column(BIGINT)
    resolution = Column(String(20))
    matched = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class DownloadQueue(Base):
    __tablename__ = "download_queue"

    id = Column(Integer, primary_key=True)
    media_entry_id = Column(Integer, ForeignKey("media_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(Text, nullable=False)
    status = Column(String(50), default="pending", index=True)
    progress_percentage = Column(DECIMAL(5, 2), default=0)
    file_size = Column(BIGINT)
    speed = Column(String(20))
    retry_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp())

    media_entry = relationship("MediaEntry")


class CustomList(Base):
    __tablename__ = "custom_lists"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    item_type = Column(String(50))  # e.g., "performers", "tags", "categories", "series"
    items = Column(JSON)  # Array of strings
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class DownloadRule(Base):
    __tablename__ = "download_rules"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    criteria = Column(
        JSON
    )  # Logic for the rule e.g. {"resolution": "1080p", "performers": {"in_list": 1}}
    action = Column(String(50), default="download")  # e.g., 'download', 'skip', 'queue'
    scope = Column(String(50), default="global")  # 'global', 'session', 'provider:<id>'
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class LibraryEntry(Base):
    __tablename__ = "library_entries"

    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    media_entry_id = Column(Integer, ForeignKey("media_entries.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(500), nullable=False)
    performers = Column(JSON)  # Array of performer names
    tags = Column(JSON)  # Array of tags/categories
    file_path = Column(Text, nullable=False)
    file_size = Column(BIGINT)
    resolution = Column(String(20))  # e.g., "1080p", "720p", "4K"
    duration = Column(Integer)  # Duration in seconds
    ohash = Column(String(16), index=True)  # Perceptual hash for duplicate detection
    phash = Column(String(16), index=True)  # Perceptual hash
    site_id = Column(String(100), index=True)  # Original source site ID
    entry_metadata = Column(JSON)  # Full metadata from scraping
    last_updated = Column(TIMESTAMP, default=func.current_timestamp())
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

    chapters = relationship("VideoChapter", back_populates="library_entry", cascade="all, delete-orphan")


class VideoChapter(Base):
    __tablename__ = "video_chapters"

    id = Column(Integer, primary_key=True)
    library_entry_id = Column(
        Integer, ForeignKey("library_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(255), nullable=False)
    start_time = Column(Integer, nullable=False)  # in seconds
    end_time = Column(Integer, nullable=True)  # in seconds
    tags = Column(JSON)  # Array of strings
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    library_entry = relationship("LibraryEntry", back_populates="chapters")


class DuplicateEntry(Base):
    __tablename__ = "duplicate_entries"

    id = Column(Integer, primary_key=True)
    library_entry_id1 = Column(
        Integer, ForeignKey("library_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    library_entry_id2 = Column(
        Integer, ForeignKey("library_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    similarity_score = Column(DECIMAL(5, 2))  # 0-100% similarity
    reason = Column(
        String(255)
    )  # Why it's marked as duplicate (e.g., "same_hash", "similar_metadata")
    resolved = Column(Boolean, default=False, index=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

    entry1 = relationship("LibraryEntry", foreign_keys=[library_entry_id1])
    entry2 = relationship("LibraryEntry", foreign_keys=[library_entry_id2])


class DownloadPreference(Base):
    __tablename__ = "download_preferences"

    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    preferred_resolution = Column(
        String(20), default="1080p"
    )  # e.g., "1080p", "720p", "auto"
    naming_pattern = Column(
        Text, default="{title}_{performers}_{resolution}"
    )  # Pattern for filenames
    append_metadata = Column(Boolean, default=True)  # Write metadata to files
    auto_tag_files = Column(Boolean, default=True)  # Embed metadata tags
    duplicate_handling = Column(
        String(50), default="skip"
    )  # "skip", "overwrite", "ask"
    custom_base_path = Column(String(500), nullable=True)
    max_retries = Column(Integer, default=3)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )


class MetadataCache(Base):
    __tablename__ = "metadata_cache"

    id = Column(Integer, primary_key=True)
    site_id = Column(String(100), nullable=False, unique=True, index=True)
    provider = Column(String(50), index=True)  # "theporndb", "stashdb", etc.
    title = Column(String(500))
    performers = Column(JSON)
    tags = Column(JSON)
    description = Column(Text)
    thumbnail_url = Column(Text)
    raw_metadata = Column(JSON)  # Full API response
    synced_to_stashdb = Column(Boolean, default=False)
    synced_to_theporndb = Column(Boolean, default=False)
    last_synced = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )


class ScrapeSchedule(Base):
    __tablename__ = "scrape_schedules"

    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    target_url = Column(
        Text, nullable=True
    )  # The URL to rip (channel, playlist, or site index)
    cron_expression = Column(String(100), nullable=False)  # e.g., "0 0 * * *"
    action = Column(
        String(50), default="metadata_and_download"
    )  # "metadata_only", "download_only", "metadata_and_download"
    is_active = Column(Boolean, default=True, index=True)
    last_run = Column(TIMESTAMP, nullable=True)
    last_run_status = Column(String(50), nullable=True)  # e.g. 'success', 'failed'
    last_run_details = Column(Text, nullable=True)  # JSON or text details of the run
    next_run = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )


class SessionCookie(Base):
    __tablename__ = "session_cookies"

    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=True, index=True)
    site_id = Column(String(100), nullable=True, index=True)
    cookie_text = Column(Text, nullable=True)
    status = Column(String(50), default="active", index=True)
    download_limit = Column(Integer)
    downloads_used = Column(Integer, default=0)
    duration_limit_seconds = Column(Integer)
    expires_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    key_hash = Column(String(255), unique=True, index=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    last_used = Column(TIMESTAMP, nullable=True)


class TranscodingQueue(Base):
    __tablename__ = "transcoding_queue"

    id = Column(Integer, primary_key=True)
    library_entry_id = Column(
        Integer, ForeignKey("library_entries.id", ondelete="CASCADE"), index=True
    )
    status = Column(String(50), default="pending", index=True)
    target_codec = Column(String(20), default="h265")
    target_resolution = Column(String(20), nullable=True)
    progress_percentage = Column(DECIMAL(5, 2), default=0.0)
    details = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    library_entry = relationship("LibraryEntry")


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)
    events = Column(JSON)  # Array of event strings (e.g., 'transcode.completed')
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class MediaRequest(Base):
    __tablename__ = "media_requests"

    id = Column(Integer, primary_key=True)
    title = Column(String(500), nullable=False)
    url = Column(Text, nullable=True)
    status = Column(
        String(50), default="pending", index=True
    )  # 'pending', 'approved', 'rejected', 'downloaded'
    requested_by = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )
