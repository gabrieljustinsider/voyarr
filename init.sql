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

-- Studios table
CREATE TABLE studios (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    logo_url TEXT,
    url VARCHAR(500),
    details TEXT,
    tags JSONB,
    is_network BOOLEAN DEFAULT FALSE,
    parent_id INTEGER REFERENCES studios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_studios_name ON studios(name);
CREATE INDEX idx_studios_parent_id ON studios(parent_id);

-- Site recipes table
CREATE TABLE site_recipes (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    css_selectors JSONB,
    xpath_selectors JSONB,
    regex_patterns JSONB,
    map_mode_data JSONB
);

-- Credentials table (encrypted)
CREATE TABLE credentials (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    custom_limits JSONB,
    sync_source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media entries table
CREATE TABLE media_entries (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    studio_id INTEGER REFERENCES studios(id) ON DELETE SET NULL,
    title VARCHAR(500),
    performers JSONB,
    tags JSONB,
    ohash VARCHAR(16) UNIQUE,
    phash VARCHAR(16),
    site_id VARCHAR(100),
    media_metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_media_entries_studio_id ON media_entries(studio_id);

-- Local files table
CREATE TABLE local_files (
    id SERIAL PRIMARY KEY,
    media_entry_id INTEGER NOT NULL REFERENCES media_entries(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    resolution VARCHAR(20),
    matched BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Download queue table
CREATE TABLE download_queue (
    id SERIAL PRIMARY KEY,
    media_entry_id INTEGER NOT NULL REFERENCES media_entries(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    file_size BIGINT,
    speed VARCHAR(20),
    retry_count INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    celery_task_id VARCHAR(255),
    extraction_method VARCHAR(100),
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
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    media_entry_id INTEGER REFERENCES media_entries(id) ON DELETE SET NULL,
    studio_id INTEGER REFERENCES studios(id) ON DELETE SET NULL,
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
    adheres_to_naming_scheme BOOLEAN DEFAULT TRUE,
    has_metadata_match BOOLEAN DEFAULT FALSE,
    has_chapters BOOLEAN DEFAULT FALSE,
    has_facial_clusters BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_library_entries_studio_id ON library_entries(studio_id);

-- File naming history table
CREATE TABLE file_naming_history (
    id SERIAL PRIMARY KEY,
    library_entry_id INTEGER NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
    old_path TEXT,
    new_path TEXT NOT NULL,
    old_filename VARCHAR(500),
    new_filename VARCHAR(500) NOT NULL,
    reason VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_file_naming_history_entry_id ON file_naming_history(library_entry_id);

-- Duplicate entries table
CREATE TABLE duplicate_entries (
    id SERIAL PRIMARY KEY,
    library_entry_id1 INTEGER NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
    library_entry_id2 INTEGER NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,2),
    reason VARCHAR(255),
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Download preferences table
CREATE TABLE download_preferences (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE UNIQUE,
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
    name VARCHAR(255),
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

-- Mass rip sessions table
CREATE TABLE mass_rip_sessions (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    criteria JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    total_videos INTEGER DEFAULT 0,
    processed_videos INTEGER DEFAULT 0,
    queued_videos INTEGER DEFAULT 0,
    skipped_videos INTEGER DEFAULT 0,
    celery_task_id VARCHAR(255),
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uix_vault_entity_key UNIQUE (entity_type, entity_id, key)
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
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
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

-- Users table
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    permissions JSONB DEFAULT '{"can_stream": true, "can_scrape": false, "can_rip": false, "url_parsing": "edit"}'::jsonb
);

-- Admin Audit Logs table
CREATE TABLE admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    admin_username VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    priority INTEGER DEFAULT 0,
    celery_task_id VARCHAR(255),
    pid INTEGER,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video chapters table
CREATE TABLE video_chapters (
    id SERIAL PRIMARY KEY,
    library_entry_id INTEGER NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    tags JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks table
CREATE TABLE webhooks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    events JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media requests table
CREATE TABLE media_requests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    url TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    requested_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_providers_name ON providers(name);
CREATE INDEX idx_site_recipes_provider_id ON site_recipes(provider_id);
CREATE INDEX idx_vault_entity_type ON vault(entity_type);
CREATE INDEX idx_vault_entity_id ON vault(entity_id);
CREATE INDEX idx_credentials_provider_id ON credentials(provider_id);
CREATE INDEX idx_media_requests_status ON media_requests(status);
CREATE INDEX idx_video_chapters_library_entry_id ON video_chapters(library_entry_id);
CREATE INDEX idx_media_entries_provider_id ON media_entries(provider_id);
CREATE INDEX idx_media_entries_ohash ON media_entries(ohash);
CREATE INDEX idx_media_entries_phash ON media_entries(phash);
CREATE INDEX idx_media_entries_site_id ON media_entries(site_id);
CREATE INDEX idx_local_files_media_entry_id ON local_files(media_entry_id);
CREATE INDEX idx_local_files_path ON local_files(file_path);
CREATE INDEX idx_download_queue_media_entry_id ON download_queue(media_entry_id);
CREATE INDEX idx_download_queue_status ON download_queue(status);
CREATE INDEX idx_library_entries_provider_id ON library_entries(provider_id);
CREATE INDEX idx_library_entries_media_entry_id ON library_entries(media_entry_id);
CREATE INDEX idx_library_entries_ohash ON library_entries(ohash);
CREATE INDEX idx_library_entries_phash ON library_entries(phash);
CREATE INDEX idx_library_entries_site_id ON library_entries(site_id);
CREATE INDEX idx_duplicate_entries_library_entry_id1 ON duplicate_entries(library_entry_id1);
CREATE INDEX idx_duplicate_entries_library_entry_id2 ON duplicate_entries(library_entry_id2);
CREATE INDEX idx_duplicate_entries_resolved ON duplicate_entries(resolved);
CREATE INDEX idx_download_preferences_provider_id ON download_preferences(provider_id);
CREATE INDEX idx_metadata_cache_provider ON metadata_cache(provider);
CREATE INDEX idx_scrape_schedules_provider_id ON scrape_schedules(provider_id);
CREATE INDEX idx_scrape_schedules_is_active ON scrape_schedules(is_active);
CREATE INDEX idx_session_cookies_provider_id ON session_cookies(provider_id);
CREATE INDEX idx_session_cookies_site_id ON session_cookies(site_id);
CREATE INDEX idx_session_cookies_status ON session_cookies(status);
CREATE INDEX idx_api_keys_name ON api_keys(name);
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);

-- Trigram index for faster ILIKE text searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_library_entries_title_trgm ON library_entries USING gin (title gin_trgm_ops);
CREATE INDEX idx_transcoding_queue_status ON transcoding_queue(status);
CREATE UNIQUE INDEX uq_active_transcode_per_entry ON transcoding_queue(library_entry_id) WHERE status IN ('pending', 'running');

-- Favorites table
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    item_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uix_user_favorite_item UNIQUE (user_id, item_type, item_id)
);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_item_type_id ON favorites(item_type, item_id);

-- User history table
CREATE TABLE user_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    library_entry_id INTEGER NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
    watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_user_history_user_id ON user_history(user_id);
CREATE INDEX idx_user_history_entry_id ON user_history(library_entry_id);

-- User video stats table
CREATE TABLE user_video_stats (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    library_entry_id INTEGER NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
    play_count INTEGER DEFAULT 0,
    climax_count INTEGER DEFAULT 0,
    last_played TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uix_user_video_stats UNIQUE (user_id, library_entry_id)
);
CREATE INDEX idx_user_video_stats_user_id ON user_video_stats(user_id);
CREATE INDEX idx_user_video_stats_entry_id ON user_video_stats(library_entry_id);

-- User preferences table
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    theme VARCHAR(50) DEFAULT 'dark',
    ui_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);


-- Live streams table
CREATE TABLE live_streams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'idle',
    current_task_id VARCHAR(255),
    current_output_path TEXT,
    written_size BIGINT DEFAULT 0,
    elapsed_seconds INTEGER DEFAULT 0,
    pid INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_live_streams_name ON live_streams(name);
CREATE INDEX idx_live_streams_status ON live_streams(status);

-- Notification Preferences table
CREATE TABLE notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    dispatch_method VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Notification Rules table
CREATE TABLE notification_rules (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    discord_channel_id VARCHAR(255),
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification Logs table
CREATE TABLE notification_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_read ON notification_logs(read);

-- Peer Nodes table (P2P Sync)
CREATE TABLE peer_nodes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    peer_url VARCHAR(500) NOT NULL,
    outbound_key VARCHAR(500) NOT NULL,
    inbound_token VARCHAR(500) NOT NULL,
    status VARCHAR(50) DEFAULT 'inactive',
    recipe_sync_mode VARCHAR(50) DEFAULT 'auto_merge',
    sync_schedule VARCHAR(100) DEFAULT 'manual',
    library_scope VARCHAR(50) DEFAULT 'all_entries',
    allowed_providers JSONB,
    last_sync_at TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_peer_nodes_name ON peer_nodes(name);
CREATE INDEX idx_peer_nodes_status ON peer_nodes(status);

-- Peer Sync Logs table (P2P Sync)
CREATE TABLE peer_sync_logs (
    id SERIAL PRIMARY KEY,
    peer_id INTEGER NOT NULL REFERENCES peer_nodes(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL,
    recipes_synced INTEGER DEFAULT 0,
    media_synced INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_peer_sync_logs_peer_id ON peer_sync_logs(peer_id);

-- Passkeys table (WebAuthn)
CREATE TABLE passkeys (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    sign_count INTEGER DEFAULT 0,
    aaguid VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    ip_address VARCHAR(45),
    location VARCHAR(255),
    browser VARCHAR(100),
    os_name VARCHAR(100),
    backup_eligible BOOLEAN DEFAULT TRUE,
    backup_state BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX idx_passkeys_credential_id ON passkeys(credential_id);

-- SSO Links table (OAuth logins)
CREATE TABLE sso_links (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uix_provider_user UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_sso_links_user_id ON sso_links(user_id);