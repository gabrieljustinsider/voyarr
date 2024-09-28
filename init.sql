-- Voyarr Database Schema

-- Providers table
CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    base_url VARCHAR(500) NOT NULL,
    naming_pattern TEXT,
    separator VARCHAR(10) DEFAULT '_',
    space_replacement VARCHAR(10) DEFAULT '_',
    automatic_limits JSONB
);

-- Site recipes table
CREATE TABLE site_recipes (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    css_selectors JSONB,
    xpath_selectors JSONB,
    regex_patterns JSONB,
    map_mode_data JSONB
);

-- Credentials table (encrypted)
CREATE TABLE credentials (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    custom_limits JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media entries table
CREATE TABLE media_entries (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    title VARCHAR(500),
    performers JSONB,
    tags JSONB,
    ohash VARCHAR(16) UNIQUE,
    phash VARCHAR(16),
    site_id VARCHAR(100),
    media_metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Local files table
CREATE TABLE local_files (
    id SERIAL PRIMARY KEY,
    media_entry_id INTEGER REFERENCES media_entries(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    resolution VARCHAR(20),
    matched BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Download queue table
CREATE TABLE download_queue (
    id SERIAL PRIMARY KEY,
    media_entry_id INTEGER REFERENCES media_entries(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    file_size BIGINT,
    speed VARCHAR(20),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom lists table
CREATE TABLE custom_lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    item_type VARCHAR(50),
    items JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Download rules table
CREATE TABLE download_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    criteria JSONB,
    action VARCHAR(50) DEFAULT 'download',
    scope VARCHAR(50) DEFAULT 'global',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Library entries table
CREATE TABLE library_entries (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    media_entry_id INTEGER REFERENCES media_entries(id),
    title VARCHAR(500) NOT NULL,
    performers JSONB,
    tags JSONB,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    resolution VARCHAR(20),
    duration INTEGER,
    ohash VARCHAR(16),
    phash VARCHAR(16),
    site_id VARCHAR(100),
    entry_metadata JSONB,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Duplicate entries table
CREATE TABLE duplicate_entries (
    id SERIAL PRIMARY KEY,
    library_entry_id1 INTEGER REFERENCES library_entries(id) ON DELETE CASCADE,
    library_entry_id2 INTEGER REFERENCES library_entries(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,2),
    reason VARCHAR(255),
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Download preferences table
CREATE TABLE download_preferences (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    preferred_resolution VARCHAR(20) DEFAULT '1080p',
    naming_pattern TEXT DEFAULT '{title}_{performers}_{resolution}',
    append_metadata BOOLEAN DEFAULT TRUE,
    auto_tag_files BOOLEAN DEFAULT TRUE,
    duplicate_handling VARCHAR(50) DEFAULT 'skip',
    custom_base_path TEXT,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Metadata cache table
CREATE TABLE metadata_cache (
    id SERIAL PRIMARY KEY,
    site_id VARCHAR(100) NOT NULL UNIQUE,
    provider VARCHAR(50),
    title VARCHAR(500),
    performers JSONB,
    tags JSONB,
    description TEXT,
    thumbnail_url TEXT,
    raw_metadata JSONB,
    synced_to_stashdb BOOLEAN DEFAULT FALSE,
    synced_to_theporndb BOOLEAN DEFAULT FALSE,
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session cookies table
CREATE TABLE session_cookies (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    site_id VARCHAR(100),
    cookie_text TEXT,
    status VARCHAR(50) DEFAULT 'active',
    download_limit INTEGER,
    downloads_used INTEGER DEFAULT 0,
    duration_limit_seconds INTEGER,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vault table
CREATE TABLE vault (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    key VARCHAR(100) NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scrape schedules table
CREATE TABLE scrape_schedules (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_url TEXT,
    cron_expression VARCHAR(100) NOT NULL,
    action VARCHAR(50) DEFAULT 'metadata_and_download',
    is_active BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP,
    last_run_status VARCHAR(50),
    last_run_details TEXT,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Keys table
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    key_hash VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP
);

-- Transcoding queue table
CREATE TABLE transcoding_queue (
    id SERIAL PRIMARY KEY,
    library_entry_id INTEGER REFERENCES library_entries(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
    target_codec VARCHAR(20) DEFAULT 'h265',
    target_resolution VARCHAR(20),
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_active_transcode_per_entry UNIQUE (library_entry_id) WHERE (status IN ('pending', 'running'))
);

-- Indexes for performance
CREATE INDEX idx_media_entries_ohash ON media_entries(ohash);
CREATE INDEX idx_media_entries_phash ON media_entries(phash);
CREATE INDEX idx_local_files_path ON local_files(file_path);
CREATE INDEX idx_download_queue_status ON download_queue(status);

-- Trigram index for faster ILIKE text searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_library_entries_title_trgm ON library_entries USING gin (title gin_trgm_ops);
CREATE INDEX idx_transcoding_queue_status ON transcoding_queue(status);