from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, DECIMAL, BIGINT, JSON, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

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

class Credential(Base):
    __tablename__ = 'credentials'
    
    id = Column(Integer, primary_key=True)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=False)
    username_encrypted = Column(Text, nullable=False)
    password_encrypted = Column(Text, nullable=False)
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
    metadata = Column(JSON)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())

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

class Filter(Base):
    __tablename__ = 'filters'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    criteria = Column(JSON)  # e.g., {"performers": ["name1"], "categories": ["cat1"], "resolution": "1080p"}
    auto_queue = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=func.current_timestamp())