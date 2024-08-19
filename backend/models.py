from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, DECIMAL, BIGINT, JSON, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

Base = declarative_base()

class Provider(Base):
    __tablename__ = 'providers'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    base_url = Column(String(500), nullable=False)
    naming_pattern = Column(Text)
    separator = Column(String(10), default='_')
    space_replacement = Column(String(10), default='_')
    automatic_limits = Column(JSON)  # Default limits for the provider (e.g., {"daily_downloads": 50, "concurrent_downloads": 2})

class SiteRecipe(Base):
    __tablename__ = 'site_recipes'
    
    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=False)
    css_selectors = Column(JSON)
    xpath_selectors = Column(JSON)
    regex_patterns = Column(JSON)
    map_mode_data = Column(JSON)

class Vault(Base):
    __tablename__ = 'vault'
    
    id = Column(Integer, primary_key=True)
    entity_type = Column(String(50), nullable=False) # e.g., 'credential', 'session_cookie'
    entity_id = Column(Integer, nullable=False)
    key = Column(String(100), nullable=False) # e.g., 'username', 'password', 'cookie_data'
    encrypted_value = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp())

class Credential(Base):
    __tablename__ = 'credentials'
    
    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=False)
    custom_limits = Column(JSON)  # Account-level custom provider limits (overrides automatic_limits)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

class MediaEntry(Base):
    __tablename__ = 'media_entries'
    
    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=False)
    title = Column(String(500))
    performers = Column(JSON)  # Array of strings
    tags = Column(JSON)  # Array of strings
    ohash = Column(String(16), unique=True)
    phash = Column(String(16))
    site_id = Column(String(100))
    media_metadata = Column(JSON)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

class Settings(Base):
    __tablename__ = 'settings'
    
    id = Column(Integer, primary_key=True)
    key = Column(String(255), unique=True, nullable=False)
    value = Column(Text)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp())

class LocalFile(Base):
    __tablename__ = 'local_files'
    
    id = Column(Integer, primary_key=True)
    media_entry_id = Column(Integer, ForeignKey('media_entries.id'), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size = Column(BIGINT)
    resolution = Column(String(20))
    matched = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

class DownloadQueue(Base):
    __tablename__ = 'download_queue'
    
    id = Column(Integer, primary_key=True)
    media_entry_id = Column(Integer, ForeignKey('media_entries.id'), nullable=False)
    url = Column(Text, nullable=False)
    status = Column(String(50), default='pending')
    progress_percentage = Column(DECIMAL(5,2), default=0)
    file_size = Column(BIGINT)
    speed = Column(String(20))
    retry_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp())
    
    media_entry = relationship("MediaEntry")

class CustomList(Base):
    __tablename__ = 'custom_lists'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    item_type = Column(String(50))  # e.g., "performers", "tags", "categories", "series"
    items = Column(JSON)  # Array of strings
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

class DownloadRule(Base):
    __tablename__ = 'download_rules'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    criteria = Column(JSON)  # Logic for the rule e.g. {"resolution": "1080p", "performers": {"in_list": 1}}
    action = Column(String(50), default='download')  # e.g., 'download', 'skip', 'queue'
    scope = Column(String(50), default='global')  # 'global', 'session', 'provider:<id>'
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

class LibraryEntry(Base):
    __tablename__ = 'library_entries'
    
    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=False)
    media_entry_id = Column(Integer, ForeignKey('media_entries.id'), nullable=True)
    title = Column(String(500), nullable=False)
    performers = Column(JSON)  # Array of performer names
    tags = Column(JSON)  # Array of tags/categories
    file_path = Column(Text, nullable=False)
    file_size = Column(BIGINT)
    resolution = Column(String(20))  # e.g., "1080p", "720p", "4K"
    duration = Column(Integer)  # Duration in seconds
    ohash = Column(String(16))  # Perceptual hash for duplicate detection
    phash = Column(String(16))  # Perceptual hash
    site_id = Column(String(100))  # Original source site ID
    entry_metadata = Column(JSON)  # Full metadata from scraping
    last_updated = Column(TIMESTAMP, default=func.current_timestamp())
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

class DuplicateEntry(Base):
    __tablename__ = 'duplicate_entries'
    
    id = Column(Integer, primary_key=True)
    library_entry_id1 = Column(Integer, ForeignKey('library_entries.id'), nullable=False)
    library_entry_id2 = Column(Integer, ForeignKey('library_entries.id'), nullable=False)
    similarity_score = Column(DECIMAL(5,2))  # 0-100% similarity
    reason = Column(String(255))  # Why it's marked as duplicate (e.g., "same_hash", "similar_metadata")
    resolved = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    
    entry1 = relationship("LibraryEntry", foreign_keys=[library_entry_id1])
    entry2 = relationship("LibraryEntry", foreign_keys=[library_entry_id2])

class DownloadPreference(Base):
    __tablename__ = 'download_preferences'
    
    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=False)
    preferred_resolution = Column(String(20), default='1080p')  # e.g., "1080p", "720p", "auto"
    naming_pattern = Column(Text, default='{title}_{performers}_{resolution}')  # Pattern for filenames
    append_metadata = Column(Boolean, default=True)  # Write metadata to files
    auto_tag_files = Column(Boolean, default=True)  # Embed metadata tags
    duplicate_handling = Column(String(50), default='skip')  # "skip", "overwrite", "ask"
    custom_base_path = Column(String(500), nullable=True)
    max_retries = Column(Integer, default=3)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp())

class MetadataCache(Base):
    __tablename__ = 'metadata_cache'
    
    id = Column(Integer, primary_key=True)
    site_id = Column(String(100), nullable=False, unique=True)
    provider = Column(String(50))  # "theporndb", "stashdb", etc.
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
    updated_at = Column(TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp())

class ScrapeSchedule(Base):
    __tablename__ = 'scrape_schedules'
    
    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=False)
    name = Column(String(255), nullable=False)
    target_url = Column(Text, nullable=True) # The URL to rip (channel, playlist, or site index)
    cron_expression = Column(String(100), nullable=False)  # e.g., "0 0 * * *"
    action = Column(String(50), default='metadata_and_download') # "metadata_only", "download_only", "metadata_and_download"
    is_active = Column(Boolean, default=True)
    last_run = Column(TIMESTAMP, nullable=True)
    last_run_status = Column(String(50), nullable=True) # e.g. 'success', 'failed'
    last_run_details = Column(Text, nullable=True) # JSON or text details of the run
    next_run = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp())

class SessionCookie(Base):
    __tablename__ = 'session_cookies'
    
    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=True)
    site_id = Column(String(100), nullable=True)
    cookie_text = Column(Text, nullable=True)
    status = Column(String(50), default='active')
    download_limit = Column(Integer)
    downloads_used = Column(Integer, default=0)
    duration_limit_seconds = Column(Integer)
    expires_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, default=func.current_timestamp(), onupdate=func.current_timestamp())

class ApiKey(Base):
    __tablename__ = 'api_keys'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    key_hash = Column(String(255), unique=True, index=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())
    last_used = Column(TIMESTAMP, nullable=True)