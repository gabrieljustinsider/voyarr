-- Jizzarr Database Schema

-- Providers table
CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    base_url VARCHAR(500) NOT NULL,
    naming_pattern TEXT,
    separator VARCHAR(10) DEFAULT '_',
    space_replacement VARCHAR(10) DEFAULT '_'
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
    username_encrypted TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media entries table
CREATE TABLE media_entries (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    title VARCHAR(500),
    performers TEXT[],
    tags TEXT[],
    ohash VARCHAR(16) UNIQUE,
    phash VARCHAR(16),
    site_id VARCHAR(100),
    metadata JSONB,
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

-- Filters table
CREATE TABLE filters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    criteria JSONB, -- e.g., {"performers": ["name1"], "categories": ["cat1"], "resolution": "1080p"}
    auto_queue BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_media_entries_ohash ON media_entries(ohash);
CREATE INDEX idx_media_entries_phash ON media_entries(phash);
CREATE INDEX idx_local_files_path ON local_files(file_path);
CREATE INDEX idx_download_queue_status ON download_queue(status);