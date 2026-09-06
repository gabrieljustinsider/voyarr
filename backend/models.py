import uuid
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
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

Base = declarative_base()  # type: ignore


class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=lambda: "usr_" + uuid.uuid4().hex)
    username = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user")  # 'admin', 'user', 'viewer'
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    permissions = Column(
        JSON().with_variant(JSONB, "postgresql"),
        default=lambda: {"can_stream": True, "can_scrape": False, "can_rip": False}
    )
    last_login_at = Column(TIMESTAMP, nullable=True)
    display_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    locale = Column(String(50), default="en")
    date_format = Column(String(50), default="YYYY-MM-DD")
    time_format = Column(String(50), default="HH:mm:ss")
    timezone = Column(String(100), default="UTC")


class AdminLog(Base):
    __tablename__ = "admin_logs"

    id = Column(Integer, primary_key=True)
    admin_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    admin_username = Column(String(255), nullable=False)
    action = Column(String(255), nullable=False)
    details = Column(JSON().with_variant(JSONB, "postgresql"), default=dict)
    timestamp = Column(TIMESTAMP, default=func.current_timestamp())

    admin = relationship("User")


class ErrorLog(Base):
    __tablename__ = "error_logs"

    id = Column(Integer, primary_key=True)
    category = Column(String(50), nullable=False, index=True)  # 'local_dev', 'external_service', 'app_bug'
    category_label = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    user_friendly_explanation = Column(Text, nullable=False)
    source = Column(String(50), default="frontend", index=True)  # 'frontend' or 'backend'
    stack_trace = Column(Text, nullable=True)
    path = Column(String(500), nullable=True)
    timestamp = Column(TIMESTAMP, default=func.current_timestamp(), index=True)



class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    base_url = Column(String(500), nullable=False)
    naming_pattern = Column(Text)
    separator = Column(String(10), default="_")
    space_replacement = Column(String(10), default="_")
    automatic_limits = Column(
        JSON().with_variant(JSONB, "postgresql")
    )  # Default limits for the provider (e.g., {"daily_downloads": 50, "concurrent_downloads": 2})
    logo_url = Column(Text, nullable=True)
    favicon_url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    supported_methods = Column(
        JSON().with_variant(JSONB, "postgresql"), default=list
    )  # e.g., ["yt-dlp", "cookies", "direct", "api"]
    transparent_logo_bg = Column(Boolean, default=False)
    fit_logo_to_card = Column(Boolean, default=False)
    default_biller_id = Column(
        Integer, ForeignKey("billers.id", ondelete="SET NULL"), nullable=True
    )

    default_biller = relationship("Biller", foreign_keys=[default_biller_id])
    billers = relationship("ProviderBiller", back_populates="provider", cascade="all, delete-orphan")


class Biller(Base):
    __tablename__ = "billers"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    url = Column(String(500), nullable=True)
    support_email = Column(String(255), nullable=True)
    support_phone = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp())

    provider_billers = relationship("ProviderBiller", back_populates="biller", cascade="all, delete-orphan")


class ProviderBiller(Base):
    __tablename__ = "provider_billers"
    __table_args__ = (
        UniqueConstraint("provider_id", "biller_id", name="uix_provider_biller"),
    )

    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    biller_id = Column(Integer, ForeignKey("billers.id", ondelete="CASCADE"), nullable=False, index=True)
    merchant_account_label = Column(String(255), nullable=True)
    supported_cycles = Column(JSON().with_variant(JSONB, "postgresql"), default=lambda: ["monthly", "annual"])
    is_default = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp())

    provider = relationship("Provider", back_populates="billers")
    biller = relationship("Biller", back_populates="provider_billers")


class SubscriptionTier(Base):
    __tablename__ = "subscription_tiers"

    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    level = Column(Integer, default=0)
    price = Column(DECIMAL(10, 2), nullable=True)
    features = Column(JSON().with_variant(JSONB, "postgresql"), default=list)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

    provider = relationship("Provider", backref="tiers")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    tier_id = Column(Integer, ForeignKey("subscription_tiers.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    status = Column(String(50), default="active") # active, expired, cancelled, trial
    is_trial = Column(Boolean, default=False)
    trial_start = Column(TIMESTAMP, nullable=True)
    trial_end = Column(TIMESTAMP, nullable=True)
    start_date = Column(TIMESTAMP, nullable=True)
    end_date = Column(TIMESTAMP, nullable=True)
    biller_id = Column(Integer, ForeignKey("billers.id", ondelete="SET NULL"), nullable=True, index=True)
    provider_biller_id = Column(Integer, ForeignKey("provider_billers.id", ondelete="SET NULL"), nullable=True, index=True)
    billing_cycle = Column(String(50), nullable=True) # monthly, yearly
    cost = Column(DECIMAL(10, 2), nullable=True)
    charge_type = Column(String(50), default="bulk") # bulk, installments
    installment_frequency = Column(String(50), nullable=True) # weekly, biweekly, monthly
    subscription_id = Column(String(255), nullable=True)
    order_number = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp())

    provider = relationship("Provider")
    tier = relationship("SubscriptionTier")
    biller = relationship("Biller")
    provider_biller = relationship("ProviderBiller")

    def get_secure_card_info(self, db_session):
        """Helper method to decrypt and retrieve card info from the secure Vault."""
        from models import Vault
        from security import decrypt_data
        vault_item = db_session.query(Vault).filter_by(
            entity_type="subscription_card", 
            entity_id=self.id
        ).first()
        
        if vault_item and vault_item.encrypted_value:
            return decrypt_data(vault_item.encrypted_value)
        return None

class SiteRecipe(Base):
    __tablename__ = "site_recipes"

    id = Column(Integer, primary_key=True)
    provider_id = Column(
        Integer,
        ForeignKey("providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    css_selectors = Column(JSON().with_variant(JSONB, "postgresql"))
    xpath_selectors = Column(JSON().with_variant(JSONB, "postgresql"))
    regex_patterns = Column(JSON().with_variant(JSONB, "postgresql"))
    map_mode_data = Column(JSON().with_variant(JSONB, "postgresql"))


class Vault(Base):
    __tablename__ = "vault"
    __table_args__ = (
        UniqueConstraint(
            "entity_type", "entity_id", "key", name="uix_vault_entity_key"
        ),
    )

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
    provider_id = Column(
        Integer,
        ForeignKey("providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    custom_limits = Column(
        JSON().with_variant(JSONB, "postgresql")
    )  # Account-level custom provider limits (overrides automatic_limits)
    sync_source = Column(
        String(50), default="manual"
    )  # 'manual', '1password', 'bitwarden'
    external_item_id = Column(String(500), nullable=True)  # linked 1Password item UUID
    external_vault_id = Column(String(500), nullable=True)  # source vault UUID
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class MediaEntry(Base):
    __tablename__ = "media_entries"
    __table_args__ = (
        Index("ix_media_entries_tags", "tags", postgresql_using="gin"),
        Index("ix_media_entries_performers", "performers", postgresql_using="gin"),
    )

    id = Column(Integer, primary_key=True)
    provider_id = Column(
        Integer,
        ForeignKey("providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    studio_id = Column(
        Integer,
        ForeignKey("studios.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = Column(String(500))
    performers = Column(JSON().with_variant(JSONB, "postgresql"))  # Array of strings
    tags = Column(JSON().with_variant(JSONB, "postgresql"))  # Array of strings
    ohash = Column(String(16), unique=True, index=True)
    phash = Column(String(16), index=True)
    site_id = Column(String(100), index=True)
    media_metadata = Column(JSON().with_variant(JSONB, "postgresql"))
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

    studio = relationship("Studio")


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
    media_entry_id = Column(
        Integer,
        ForeignKey("media_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_path = Column(Text, nullable=False)
    file_size = Column(BIGINT)
    resolution = Column(String(20))
    matched = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class DownloadQueue(Base):
    __tablename__ = "download_queue"

    id = Column(Integer, primary_key=True)
    media_entry_id = Column(
        Integer,
        ForeignKey("media_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url = Column(Text, nullable=False)
    status = Column(String(50), default="pending", index=True)
    progress_percentage = Column(DECIMAL(5, 2), default=0)  # type: ignore
    file_size = Column(BIGINT)
    speed = Column(String(20))
    retry_count = Column(Integer, default=0)
    priority = Column(Integer, default=0, index=True)
    celery_task_id = Column(String(255), nullable=True)
    extraction_method = Column(
        String(100), nullable=True
    )  # e.g. "yt-dlp", "html_scrape"
    user_id = Column(String(64), nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp())

    media_entry = relationship("MediaEntry")


class CustomList(Base):
    __tablename__ = "custom_lists"
    __table_args__ = (Index("ix_custom_lists_items", "items", postgresql_using="gin"),)

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    item_type = Column(String(50))  # e.g., "performers", "tags", "categories", "series"
    items = Column(JSON().with_variant(JSONB, "postgresql"))  # Array of strings
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class DownloadRule(Base):
    __tablename__ = "download_rules"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    criteria = Column(
        JSON().with_variant(JSONB, "postgresql")
    )  # Logic for the rule e.g. {"resolution": "1080p", "performers": {"in_list": 1}}
    action = Column(String(50), default="download")  # e.g., 'download', 'skip', 'queue'
    scope = Column(String(50), default="global")  # 'global', 'session', 'provider:<id>'
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class LibraryEntry(Base):
    __tablename__ = "library_entries"
    __table_args__ = (
        Index("ix_library_entries_tags", "tags", postgresql_using="gin"),
        Index("ix_library_entries_performers", "performers", postgresql_using="gin"),
    )

    id = Column(Integer, primary_key=True)
    provider_id = Column(
        Integer,
        ForeignKey("providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    media_entry_id = Column(
        Integer,
        ForeignKey("media_entries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    studio_id = Column(
        Integer,
        ForeignKey("studios.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = Column(String(500), nullable=False)
    performers = Column(
        JSON().with_variant(JSONB, "postgresql")
    )  # Array of performer names
    tags = Column(JSON().with_variant(JSONB, "postgresql"))  # Array of tags/categories
    file_path = Column(Text, nullable=False)
    file_size = Column(BIGINT)
    resolution = Column(String(20))  # e.g., "1080p", "720p", "4K"
    duration = Column(Integer)  # Duration in seconds
    ohash = Column(String(16), index=True)  # Perceptual hash for duplicate detection
    phash = Column(String(16), index=True)  # Perceptual hash
    site_id = Column(String(100), index=True)  # Original source site ID
    entry_metadata = Column(
        JSON().with_variant(JSONB, "postgresql")
    )  # Full metadata from scraping
    adheres_to_naming_scheme = Column(Boolean, default=True)
    has_metadata_match = Column(Boolean, default=False)
    has_chapters = Column(Boolean, default=False)
    has_facial_clusters = Column(Boolean, default=False)
    last_updated = Column(TIMESTAMP, default=func.current_timestamp())
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    chapters = relationship(
        "VideoChapter", back_populates="library_entry", cascade="all, delete-orphan"
    )
    studio = relationship("Studio")


class FileNamingHistory(Base):
    __tablename__ = "file_naming_history"

    id = Column(Integer, primary_key=True)
    library_entry_id = Column(
        Integer,
        ForeignKey("library_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    old_path = Column(Text, nullable=True)
    new_path = Column(Text, nullable=False)
    old_filename = Column(String(500), nullable=True)
    new_filename = Column(String(500), nullable=False)
    reason = Column(String(255), nullable=True)  # e.g., "initial", "manual_correction", "bulk_rename"
    timestamp = Column(TIMESTAMP, default=func.current_timestamp())

    library_entry = relationship("LibraryEntry", backref="naming_history")


class VideoChapter(Base):
    __tablename__ = "video_chapters"
    __table_args__ = (Index("ix_video_chapters_tags", "tags", postgresql_using="gin"),)

    id = Column(Integer, primary_key=True)
    library_entry_id = Column(
        Integer,
        ForeignKey("library_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    start_time = Column(Integer, nullable=False)  # in seconds
    end_time = Column(Integer, nullable=True)  # in seconds
    tags = Column(JSON().with_variant(JSONB, "postgresql"))  # Array of strings
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    library_entry = relationship("LibraryEntry", back_populates="chapters")


class DuplicateEntry(Base):
    __tablename__ = "duplicate_entries"

    id = Column(Integer, primary_key=True)
    library_entry_id1 = Column(
        Integer,
        ForeignKey("library_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    library_entry_id2 = Column(
        Integer,
        ForeignKey("library_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    similarity_score = Column(DECIMAL(5, 2))  # type: ignore # 0-100% similarity
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
    provider_id = Column(
        Integer,
        ForeignKey("providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
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
    performers = Column(JSON().with_variant(JSONB, "postgresql"))
    tags = Column(JSON().with_variant(JSONB, "postgresql"))
    description = Column(Text)
    thumbnail_url = Column(Text)
    raw_metadata = Column(JSON().with_variant(JSONB, "postgresql"))  # Full API response
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
    provider_id = Column(
        Integer,
        ForeignKey("providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
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
    provider_id = Column(
        Integer,
        ForeignKey("providers.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name = Column(String(255), nullable=True)
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
    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    is_pairing = Column(Boolean, default=False, index=True)


class TranscodingQueue(Base):
    __tablename__ = "transcoding_queue"

    id = Column(Integer, primary_key=True)
    library_entry_id = Column(
        Integer, ForeignKey("library_entries.id", ondelete="CASCADE"), index=True
    )
    status = Column(String(50), default="pending", index=True)
    target_codec = Column(String(20), default="h265")
    target_resolution = Column(String(20), nullable=True)
    progress_percentage = Column(DECIMAL(5, 2), default=0.0)  # type: ignore
    priority = Column(Integer, default=0, index=True)
    celery_task_id = Column(String(255), nullable=True)
    pid = Column(Integer, nullable=True)
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
    events = Column(
        JSON().with_variant(JSONB, "postgresql")
    )  # Array of event strings (e.g., 'transcode.completed')
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
    requested_by = Column(String(255))
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class UserVideoStats(Base):
    __tablename__ = "user_video_stats"
    __table_args__ = (
        UniqueConstraint("user_id", "library_entry_id", name="uix_user_library_stat"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    library_entry_id = Column(
        Integer,
        ForeignKey("library_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    play_count = Column(Integer, default=0)
    climax_count = Column(Integer, default=0)
    last_played = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "item_type", "item_id", name="uix_user_favorite_item"
        ),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_type = Column(
        String(50), nullable=False
    )  # 'scene', 'video', 'performer', 'movie', 'category', 'tag', 'studio'
    item_id = Column(String(255), nullable=False)  # Site ID or name
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class UserHistory(Base):
    __tablename__ = "user_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    library_entry_id = Column(
        Integer,
        ForeignKey("library_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    watched_at = Column(TIMESTAMP, default=func.current_timestamp())
    duration = Column(Integer, default=0)
    completed = Column(Boolean, default=False)


class LiveStream(Base):
    __tablename__ = "live_streams"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    url = Column(Text, nullable=False)
    status = Column(
        String(50), default="idle", index=True
    )  # 'idle', 'recording', 'paused', 'failed', 'watching'
    current_task_id = Column(String(255), nullable=True)
    current_output_path = Column(Text, nullable=True)
    written_size = Column(BIGINT, default=0)
    elapsed_seconds = Column(Integer, default=0)
    pid = Column(Integer, nullable=True)
    auto_monitor = Column(Boolean, default=False)
    auto_record = Column(Boolean, default=False)
    last_checked_at = Column(TIMESTAMP, nullable=True)
    last_online_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )


class Studio(Base):
    __tablename__ = "studios"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    logo_url = Column(Text, nullable=True)
    url = Column(String(500), nullable=True)
    details = Column(Text, nullable=True)
    tags = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    is_network = Column(Boolean, default=False)
    parent_id = Column(
        Integer,
        ForeignKey("studios.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type = Column(String(50), nullable=False)
    dispatch_method = Column(String(50), nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class NotificationRule(Base):
    __tablename__ = "notification_rules"

    id = Column(Integer, primary_key=True)
    event_type = Column(String(50), nullable=False)
    discord_channel_id = Column(String(255), nullable=True)
    webhook_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    event_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False, index=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    theme = Column(String(50), default="dark")
    ui_config = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class PeerNode(Base):
    __tablename__ = "peer_nodes"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    peer_url = Column(String(500), nullable=False)
    outbound_key = Column(String(500), nullable=False)
    inbound_token = Column(String(500), nullable=False)
    status = Column(
        String(50), default="inactive", index=True
    )  # active, inactive, error, syncing

    # Configurable Behaviors
    recipe_sync_mode = Column(
        String(50), default="auto_merge"
    )  # auto_merge, manual_review
    sync_schedule = Column(
        String(100), default="manual"
    )  # manual, daily, weekly, custom-cron
    library_scope = Column(
        String(50), default="all_entries"
    )  # all_entries, specific_providers
    allowed_providers = Column(
        JSON().with_variant(JSONB, "postgresql"), default=list
    )  # list of provider IDs

    last_sync_at = Column(TIMESTAMP, nullable=True)
    next_run = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

    sync_logs = relationship(
        "PeerSyncLog", back_populates="peer", cascade="all, delete-orphan"
    )


class PeerSyncLog(Base):
    __tablename__ = "peer_sync_logs"

    id = Column(Integer, primary_key=True)
    peer_id = Column(
        Integer,
        ForeignKey("peer_nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    direction = Column(String(10), nullable=False)  # push, pull, sync
    recipes_synced = Column(Integer, default=0)
    media_synced = Column(Integer, default=0)
    status = Column(String(50), nullable=False)  # success, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

    peer = relationship("PeerNode", back_populates="sync_logs")


class Passkey(Base):
    __tablename__ = "passkeys"

    id = Column(String(64), primary_key=True, default=lambda: "pk_" + uuid.uuid4().hex)
    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    credential_id = Column(Text, unique=True, nullable=False, index=True)
    public_key = Column(Text, nullable=False)
    sign_count = Column(Integer, default=0)
    aaguid = Column(String(64), nullable=True)
    rp_id = Column(String(255), nullable=True)

    # Metadata and logging
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    last_used_at = Column(TIMESTAMP, nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6 support
    location = Column(String(255), nullable=True)  # Mock/offline location

    # Advanced browser details
    browser = Column(String(100), nullable=True)
    os_name = Column(String(100), nullable=True)
    backup_eligible = Column(Boolean, default=True)
    backup_state = Column(Boolean, default=True)

    user = relationship("User")


class SsoLink(Base):
    __tablename__ = "sso_links"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uix_provider_user"),
    )

    id = Column(String(64), primary_key=True, default=lambda: "sso_" + uuid.uuid4().hex)
    user_id = Column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider = Column(String(50), nullable=False)  # 'google', 'github', 'discord'
    provider_user_id = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    linked_at = Column(TIMESTAMP, default=func.current_timestamp())

    user = relationship("User")


class MassRipSession(Base):
    __tablename__ = "mass_rip_sessions"

    id = Column(Integer, primary_key=True)
    provider_id = Column(
        Integer,
        ForeignKey("providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url = Column(Text, nullable=False)
    criteria = Column(JSON().with_variant(JSONB, "postgresql"))  # Chosen criteria (e.g. {"resolution": "1080p", "max_items": 50, "duplicates": "skip"})
    status = Column(String(50), default="pending")  # "pending", "running", "paused", "stopped", "completed", "failed"
    total_videos = Column(Integer, default=0)
    processed_videos = Column(Integer, default=0)
    queued_videos = Column(Integer, default=0)
    skipped_videos = Column(Integer, default=0)
    celery_task_id = Column(String(255), nullable=True)
    user_id = Column(String(64), nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )


class Performer(Base):
    __tablename__ = "performers"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    entry_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    entry_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
