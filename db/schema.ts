import { 
  pgTable, 
  text, 
  integer, 
  boolean, 
  serial, 
  timestamp, 
  jsonb, 
  decimal, 
  bigint, 
  uniqueIndex, 
  index, 
  unique 
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Providers
export const providers = pgTable('providers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  baseUrl: text('base_url').notNull(),
  namingPattern: text('naming_pattern'),
  separator: text('separator').default('_'),
  spaceReplacement: text('space_replacement').default('_'),
  logoUrl: text('logo_url'),
  automaticLimits: jsonb('automatic_limits'),
  defaultBillerId: integer('default_biller_id'),
}, (table) => ({
  nameIdx: index('idx_providers_name').on(table.name),
}));

// 2. Studios
export const studios = pgTable('studios', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  logoUrl: text('logo_url'),
  url: text('url'),
  details: text('details'),
  tags: jsonb('tags'),
  isNetwork: boolean('is_network').default(false),
  parentId: integer('parent_id'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nameIdx: index('idx_studios_name').on(table.name),
  parentIdx: index('idx_studios_parent_id').on(table.parentId),
}));

// 3. Site Recipes
export const siteRecipes = pgTable('site_recipes', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  cssSelectors: jsonb('css_selectors'),
  xpathSelectors: jsonb('xpath_selectors'),
  regexPatterns: jsonb('regex_patterns'),
  mapModeData: jsonb('map_mode_data'),
}, (table) => ({
  providerIdx: index('idx_site_recipes_provider_id').on(table.providerId),
}));

// 4. Credentials
export const credentials = pgTable('credentials', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  customLimits: jsonb('custom_limits'),
  syncSource: text('sync_source').default('manual'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerIdx: index('idx_credentials_provider_id').on(table.providerId),
}));

// 5. Media Entries
export const mediaEntries = pgTable('media_entries', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  studioId: integer('studio_id').references(() => studios.id, { onDelete: 'set null' }),
  title: text('title'),
  performers: jsonb('performers'),
  tags: jsonb('tags'),
  ohash: text('ohash').unique(),
  phash: text('phash'),
  siteId: text('site_id'),
  mediaMetadata: jsonb('media_metadata'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  studioIdx: index('idx_media_entries_studio_id').on(table.studioId),
  providerIdx: index('idx_media_entries_provider_id').on(table.providerId),
  ohashIdx: index('idx_media_entries_ohash').on(table.ohash),
  phashIdx: index('idx_media_entries_phash').on(table.phash),
  siteIdx: index('idx_media_entries_site_id').on(table.siteId),
}));

// 6. Local Files
export const localFiles = pgTable('local_files', {
  id: serial('id').primaryKey(),
  mediaEntryId: integer('media_entry_id').notNull().references(() => mediaEntries.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }),
  resolution: text('resolution'),
  matched: boolean('matched').default(false),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  mediaEntryIdx: index('idx_local_files_media_entry_id').on(table.mediaEntryId),
  filePathIdx: index('idx_local_files_path').on(table.filePath),
}));

// 7. Download Queue
export const downloadQueue = pgTable('download_queue', {
  id: serial('id').primaryKey(),
  mediaEntryId: integer('media_entry_id').notNull().references(() => mediaEntries.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  status: text('status').default('pending'),
  progressPercentage: decimal('progress_percentage', { precision: 5, scale: 2 }).default('0'),
  fileSize: bigint('file_size', { mode: 'number' }),
  speed: text('speed'),
  retryCount: integer('retry_count').default(0),
  priority: integer('priority').default(0),
  celeryTaskId: text('celery_task_id'),
  extractionMethod: text('extraction_method'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  mediaEntryIdx: index('idx_download_queue_media_entry_id').on(table.mediaEntryId),
  statusIdx: index('idx_download_queue_status').on(table.status),
}));

// 8. Custom Lists
export const customLists = pgTable('custom_lists', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  itemType: text('item_type'),
  items: jsonb('items'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 9. Download Rules
export const downloadRules = pgTable('download_rules', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  criteria: jsonb('criteria'),
  action: text('action').default('download'),
  scope: text('scope').default('global'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 10. Library Entries
export const libraryEntries = pgTable('library_entries', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  mediaEntryId: integer('media_entry_id').references(() => mediaEntries.id, { onDelete: 'set null' }),
  studioId: integer('studio_id').references(() => studios.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  performers: jsonb('performers'),
  tags: jsonb('tags'),
  filePath: text('file_path').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }),
  resolution: text('resolution'),
  duration: integer('duration'),
  ohash: text('ohash'),
  phash: text('phash'),
  siteId: text('site_id'),
  entryMetadata: jsonb('entry_metadata'),
  adheresToNamingScheme: boolean('adheres_to_naming_scheme').default(true),
  hasMetadataMatch: boolean('has_metadata_match').default(false),
  hasChapters: boolean('has_chapters').default(false),
  hasFacialClusters: boolean('has_facial_clusters').default(false),
  lastUpdated: timestamp('last_updated').default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  studioIdx: index('idx_library_entries_studio_id').on(table.studioId),
  providerIdx: index('idx_library_entries_provider_id').on(table.providerId),
  mediaEntryIdx: index('idx_library_entries_media_entry_id').on(table.mediaEntryId),
  ohashIdx: index('idx_library_entries_ohash').on(table.ohash),
  phashIdx: index('idx_library_entries_phash').on(table.phash),
  siteIdx: index('idx_library_entries_site_id').on(table.siteId),
}));

// 11. File Naming History
export const fileNamingHistory = pgTable('file_naming_history', {
  id: serial('id').primaryKey(),
  libraryEntryId: integer('library_entry_id').notNull().references(() => libraryEntries.id, { onDelete: 'cascade' }),
  oldPath: text('old_path'),
  newPath: text('new_path').notNull(),
  oldFilename: text('old_filename'),
  newFilename: text('new_filename').notNull(),
  reason: text('reason'),
  timestamp: timestamp('timestamp').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  entryIdx: index('idx_file_naming_history_entry_id').on(table.libraryEntryId),
}));

// 12. Duplicate Entries
export const duplicateEntries = pgTable('duplicate_entries', {
  id: serial('id').primaryKey(),
  libraryEntryId1: integer('library_entry_id1').notNull().references(() => libraryEntries.id, { onDelete: 'cascade' }),
  libraryEntryId2: integer('library_entry_id2').notNull().references(() => libraryEntries.id, { onDelete: 'cascade' }),
  similarityScore: decimal('similarity_score', { precision: 5, scale: 2 }),
  reason: text('reason'),
  resolved: boolean('resolved').default(false),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  entry1Idx: index('idx_duplicate_entries_library_entry_id1').on(table.libraryEntryId1),
  entry2Idx: index('idx_duplicate_entries_library_entry_id2').on(table.libraryEntryId2),
  resolvedIdx: index('idx_duplicate_entries_resolved').on(table.resolved),
}));

// 13. Download Preferences
export const downloadPreferences = pgTable('download_preferences', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }).unique(),
  preferredResolution: text('preferred_resolution').default('1080p'),
  namingPattern: text('naming_pattern').default('{title}_{performers}_{resolution}'),
  appendMetadata: boolean('append_metadata').default(true),
  autoTagFiles: boolean('auto_tag_files').default(true),
  duplicateHandling: text('duplicate_handling').default('skip'),
  customBasePath: text('custom_base_path'),
  maxRetries: integer('max_retries').default(3),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerIdx: index('idx_download_preferences_provider_id').on(table.providerId),
}));

// 14. Metadata Cache
export const metadataCache = pgTable('metadata_cache', {
  id: serial('id').primaryKey(),
  siteId: text('site_id').notNull().unique(),
  provider: text('provider'),
  title: text('title'),
  performers: jsonb('performers'),
  tags: jsonb('tags'),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  rawMetadata: jsonb('raw_metadata'),
  syncedToStashdb: boolean('synced_to_stashdb').default(false),
  syncedToTheporndb: boolean('synced_to_theporndb').default(false),
  lastSynced: timestamp('last_synced'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerIdx: index('idx_metadata_cache_provider').on(table.provider),
}));

// 15. Session Cookies
export const sessionCookies = pgTable('session_cookies', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').references(() => providers.id, { onDelete: 'cascade' }),
  name: text('name'),
  siteId: text('site_id'),
  cookieText: text('cookie_text'),
  status: text('status').default('active'),
  downloadLimit: integer('download_limit'),
  downloadsUsed: integer('downloads_used').default(0),
  durationLimitSeconds: integer('duration_limit_seconds'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerIdx: index('idx_session_cookies_provider_id').on(table.providerId),
  siteIdx: index('idx_session_cookies_site_id').on(table.siteId),
  statusIdx: index('idx_session_cookies_status').on(table.status),
}));

// 16. Mass Rip Sessions
export const massRipSessions = pgTable('mass_rip_sessions', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  criteria: jsonb('criteria'),
  status: text('status').default('pending'),
  totalVideos: integer('total_videos').default(0),
  processedVideos: integer('processed_videos').default(0),
  queuedVideos: integer('queued_videos').default(0),
  skippedVideos: integer('skipped_videos').default(0),
  celeryTaskId: text('celery_task_id'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// 17. Vault (Encrypted Storage)
export const vault = pgTable('vault', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  key: text('key').notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  entityKeyUix: unique('uix_vault_entity_key').on(table.entityType, table.entityId, table.key),
  entityTypeIdx: index('idx_vault_entity_type').on(table.entityType),
  entityIdIdx: index('idx_vault_entity_id').on(table.entityId),
}));

// 18. Settings
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// 19. Scrape Schedules
export const scrapeSchedules = pgTable('scrape_schedules', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetUrl: text('target_url'),
  cronExpression: text('cron_expression').notNull(),
  action: text('action').default('metadata_and_download'),
  isActive: boolean('is_active').default(true),
  lastRun: timestamp('last_run'),
  lastRunStatus: text('last_run_status'),
  lastRunDetails: text('last_run_details'),
  nextRun: timestamp('next_run'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerIdx: index('idx_scrape_schedules_provider_id').on(table.providerId),
  isActiveIdx: index('idx_scrape_schedules_is_active').on(table.isActive),
}));

// 20. Users (Universal Identity & SOP)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').default('user'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  lastLoginAt: timestamp('last_login_at'),
  permissions: jsonb('permissions').default(sql`'{"can_stream": true, "can_scrape": false, "can_rip": false, "url_parsing": "edit"}'::jsonb`),
}, (table) => ({
  usernameIdx: index('idx_users_username').on(table.username),
}));

// 21. Admin Logs
export const adminLogs = pgTable('admin_logs', {
  id: serial('id').primaryKey(),
  adminId: text('admin_id').references(() => users.id, { onDelete: 'set null' }),
  adminUsername: text('admin_username').notNull(),
  action: text('action').notNull(),
  details: jsonb('details').default(sql`'{}'::jsonb`),
  timestamp: timestamp('timestamp').default(sql`CURRENT_TIMESTAMP`),
});

// 22. API Keys
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  name: text('name'),
  keyHash: text('key_hash').unique(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  lastUsed: timestamp('last_used'),
}, (table) => ({
  nameIdx: index('idx_api_keys_name').on(table.name),
}));

// 23. Transcoding Queue
export const transcodingQueue = pgTable('transcoding_queue', {
  id: serial('id').primaryKey(),
  libraryEntryId: integer('library_entry_id').references(() => libraryEntries.id, { onDelete: 'cascade' }),
  status: text('status').default('pending'),
  targetCodec: text('target_codec').default('h265'),
  targetResolution: text('target_resolution'),
  progressPercentage: decimal('progress_percentage', { precision: 5, scale: 2 }).default('0'),
  priority: integer('priority').default(0),
  celeryTaskId: text('celery_task_id'),
  pid: integer('pid'),
  details: text('details'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  statusIdx: index('idx_transcoding_queue_status').on(table.status),
}));

// 24. Video Chapters
export const videoChapters = pgTable('video_chapters', {
  id: serial('id').primaryKey(),
  libraryEntryId: integer('library_entry_id').notNull().references(() => libraryEntries.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  libraryEntryIdx: index('idx_video_chapters_library_entry_id').on(table.libraryEntryId),
}));

// 25. Webhooks
export const webhooks = pgTable('webhooks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  events: jsonb('events'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  isActiveIdx: index('idx_webhooks_is_active').on(table.isActive),
}));

// 26. Media Requests
export const mediaRequests = pgTable('media_requests', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  url: text('url'),
  status: text('status').default('pending'),
  requestedBy: text('requested_by'),
  notes: text('notes'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  statusIdx: index('idx_media_requests_status').on(table.status),
}));

// 27. Favorites
export const favorites = pgTable('favorites', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemType: text('item_type').notNull(),
  itemId: text('item_id').notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userFavoriteItemUix: unique('uix_user_favorite_item').on(table.userId, table.itemType, table.itemId),
  userIdx: index('idx_favorites_user_id').on(table.userId),
  itemTypeIdx: index('idx_favorites_item_type_id').on(table.itemType, table.itemId),
}));

// 28. User History
export const userHistory = pgTable('user_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  libraryEntryId: integer('library_entry_id').notNull().references(() => libraryEntries.id, { onDelete: 'cascade' }),
  watchedAt: timestamp('watched_at').default(sql`CURRENT_TIMESTAMP`),
  duration: integer('duration').default(0),
  completed: boolean('completed').default(false),
}, (table) => ({
  userIdx: index('idx_user_history_user_id').on(table.userId),
  entryIdx: index('idx_user_history_entry_id').on(table.libraryEntryId),
}));

// 29. User Video Stats
export const userVideoStats = pgTable('user_video_stats', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  libraryEntryId: integer('library_entry_id').notNull().references(() => libraryEntries.id, { onDelete: 'cascade' }),
  playCount: integer('play_count').default(0),
  climaxCount: integer('climax_count').default(0),
  lastPlayed: timestamp('last_played').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userVideoStatsUix: unique('uix_user_video_stats').on(table.userId, table.libraryEntryId),
  userIdx: index('idx_user_video_stats_user_id').on(table.userId),
  entryIdx: index('idx_user_video_stats_entry_id').on(table.libraryEntryId),
}));

// 30. User Preferences
export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  theme: text('theme').default('dark'),
  uiConfig: jsonb('ui_config'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userIdx: index('idx_user_preferences_user_id').on(table.userId),
}));

// 31. Live Streams
export const liveStreams = pgTable('live_streams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  status: text('status').default('idle'),
  currentTaskId: text('current_task_id'),
  currentOutputPath: text('current_output_path'),
  writtenSize: bigint('written_size', { mode: 'number' }).default(0),
  elapsedSeconds: integer('elapsed_seconds').default(0),
  pid: integer('pid'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nameIdx: index('idx_live_streams_name').on(table.name),
  statusIdx: index('idx_live_streams_status').on(table.status),
}));

// 32. Notification Preferences
export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  dispatchMethod: text('dispatch_method').notNull(),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userIdx: index('idx_notification_preferences_user_id').on(table.userId),
}));

// 33. Notification Rules
export const notificationRules = pgTable('notification_rules', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(),
  discordChannelId: text('discord_channel_id'),
  webhookUrl: text('webhook_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 34. Notification Logs
export const notificationLogs = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userIdx: index('idx_notification_logs_user_id').on(table.userId),
  readIdx: index('idx_notification_logs_read').on(table.read),
}));

// 35. Peer Nodes (P2P Sync)
export const peerNodes = pgTable('peer_nodes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  peerUrl: text('peer_url').notNull(),
  outboundKey: text('outbound_key').notNull(),
  inboundToken: text('inbound_token').notNull(),
  status: text('status').default('inactive'),
  recipeSyncMode: text('recipe_sync_mode').default('auto_merge'),
  syncSchedule: text('sync_schedule').default('manual'),
  libraryScope: text('library_scope').default('all_entries'),
  allowedProviders: jsonb('allowed_providers'),
  lastSyncAt: timestamp('last_sync_at'),
  nextRun: timestamp('next_run'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nameIdx: index('idx_peer_nodes_name').on(table.name),
  statusIdx: index('idx_peer_nodes_status').on(table.status),
}));

// 36. Peer Sync Logs
export const peerSyncLogs = pgTable('peer_sync_logs', {
  id: serial('id').primaryKey(),
  peerId: integer('peer_id').notNull().references(() => peerNodes.id, { onDelete: 'cascade' }),
  direction: text('direction').notNull(),
  recipesSynced: integer('recipes_synced').default(0),
  mediaSynced: integer('media_synced').default(0),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  peerIdx: index('idx_peer_sync_logs_peer_id').on(table.peerId),
}));

// 37. Passkeys (WebAuthn)
export const passkeys = pgTable('passkeys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  signCount: integer('sign_count').default(0),
  aaguid: text('aaguid'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  lastUsedAt: timestamp('last_used_at'),
  ipAddress: text('ip_address'),
  location: text('location'),
  browser: text('browser'),
  osName: text('os_name'),
  backupEligible: boolean('backup_eligible').default(true),
  backupState: boolean('backup_state').default(true),
  rpId: text('rp_id'),
}, (table) => ({
  userIdx: index('idx_passkeys_user_id').on(table.userId),
  credIdx: index('idx_passkeys_credential_id').on(table.credentialId),
}));

// 38. SSO Links
export const ssoLinks = pgTable('sso_links', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  email: text('email'),
  linkedAt: timestamp('linked_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerUserUix: unique('uix_provider_user').on(table.provider, table.providerUserId),
  userIdx: index('idx_sso_links_user_id').on(table.userId),
}));

// 39. Subscription Tiers
export const subscriptionTiers = pgTable('subscription_tiers', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  level: integer('level').default(0),
  price: decimal('price', { precision: 10, scale: 2 }),
  features: jsonb('features').default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerIdx: index('idx_subscription_tiers_provider_id').on(table.providerId),
}));

// 40. Billers
export const billers = pgTable('billers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  url: text('url'),
  supportEmail: text('support_email'),
  supportPhone: text('support_phone'),
  description: text('description'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nameIdx: index('idx_billers_name').on(table.name),
}));

// 41. Provider Billers
export const providerBillers = pgTable('provider_billers', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  billerId: integer('biller_id').notNull().references(() => billers.id, { onDelete: 'cascade' }),
  merchantAccountLabel: text('merchant_account_label'),
  supportedCycles: jsonb('supported_cycles').default(sql`'["monthly", "annual"]'::jsonb`),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerBillerUix: unique('uix_provider_biller').on(table.providerId, table.billerId),
  providerIdx: index('idx_provider_billers_provider_id').on(table.providerId),
  billerIdx: index('idx_provider_billers_biller_id').on(table.billerId),
}));

// 42. Subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  providerId: integer('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  tierId: integer('tier_id').references(() => subscriptionTiers.id, { onDelete: 'set null' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').default('active'),
  isTrial: boolean('is_trial').default(false),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  biller: text('biller'),
  billerId: integer('biller_id').references(() => billers.id, { onDelete: 'set null' }),
  providerBillerId: integer('provider_biller_id').references(() => providerBillers.id, { onDelete: 'set null' }),
  billingCycle: text('billing_cycle'),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  chargeType: text('charge_type').default('bulk'),
  installmentFrequency: text('installment_frequency'),
  subscriptionId: text('subscription_id'),
  orderNumber: text('order_number'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerIdx: index('idx_subscriptions_provider_id').on(table.providerId),
  tierIdx: index('idx_subscriptions_tier_id').on(table.tierId),
  userIdx: index('idx_subscriptions_user_id').on(table.userId),
  providerBillerIdx: index('idx_subscriptions_provider_biller_id').on(table.providerBillerId),
  billerIdx: index('idx_subscriptions_biller_id').on(table.billerId),
}));
