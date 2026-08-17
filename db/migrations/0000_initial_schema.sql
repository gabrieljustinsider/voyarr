CREATE TABLE "admin_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" text,
	"admin_username" text NOT NULL,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"timestamp" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"key_hash" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"last_used" timestamp,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"custom_limits" jsonb,
	"sync_source" text DEFAULT 'manual',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "custom_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"item_type" text,
	"items" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "download_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"preferred_resolution" text DEFAULT '1080p',
	"naming_pattern" text DEFAULT '{title}_{performers}_{resolution}',
	"append_metadata" boolean DEFAULT true,
	"auto_tag_files" boolean DEFAULT true,
	"duplicate_handling" text DEFAULT 'skip',
	"custom_base_path" text,
	"max_retries" integer DEFAULT 3,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "download_preferences_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
CREATE TABLE "download_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_entry_id" integer NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'pending',
	"progress_percentage" numeric(5, 2) DEFAULT '0',
	"file_size" bigint,
	"speed" text,
	"retry_count" integer DEFAULT 0,
	"priority" integer DEFAULT 0,
	"celery_task_id" text,
	"extraction_method" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "download_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"criteria" jsonb,
	"action" text DEFAULT 'download',
	"scope" text DEFAULT 'global',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "duplicate_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"library_entry_id1" integer NOT NULL,
	"library_entry_id2" integer NOT NULL,
	"similarity_score" numeric(5, 2),
	"reason" text,
	"resolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_type" text NOT NULL,
	"item_id" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "uix_user_favorite_item" UNIQUE("user_id","item_type","item_id")
);
--> statement-breakpoint
CREATE TABLE "file_naming_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"library_entry_id" integer NOT NULL,
	"old_path" text,
	"new_path" text NOT NULL,
	"old_filename" text,
	"new_filename" text NOT NULL,
	"reason" text,
	"timestamp" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "library_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"media_entry_id" integer,
	"studio_id" integer,
	"title" text NOT NULL,
	"performers" jsonb,
	"tags" jsonb,
	"file_path" text NOT NULL,
	"file_size" bigint,
	"resolution" text,
	"duration" integer,
	"ohash" text,
	"phash" text,
	"site_id" text,
	"entry_metadata" jsonb,
	"adheres_to_naming_scheme" boolean DEFAULT true,
	"has_metadata_match" boolean DEFAULT false,
	"has_chapters" boolean DEFAULT false,
	"has_facial_clusters" boolean DEFAULT false,
	"last_updated" timestamp DEFAULT CURRENT_TIMESTAMP,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "live_streams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'idle',
	"current_task_id" text,
	"current_output_path" text,
	"written_size" bigint DEFAULT 0,
	"elapsed_seconds" integer DEFAULT 0,
	"pid" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "live_streams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "local_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_entry_id" integer NOT NULL,
	"file_path" text NOT NULL,
	"file_size" bigint,
	"resolution" text,
	"matched" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "mass_rip_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"url" text NOT NULL,
	"criteria" jsonb,
	"status" text DEFAULT 'pending',
	"total_videos" integer DEFAULT 0,
	"processed_videos" integer DEFAULT 0,
	"queued_videos" integer DEFAULT 0,
	"skipped_videos" integer DEFAULT 0,
	"celery_task_id" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "media_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"studio_id" integer,
	"title" text,
	"performers" jsonb,
	"tags" jsonb,
	"ohash" text,
	"phash" text,
	"site_id" text,
	"media_metadata" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "media_entries_ohash_unique" UNIQUE("ohash")
);
--> statement-breakpoint
CREATE TABLE "media_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"status" text DEFAULT 'pending',
	"requested_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "metadata_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"provider" text,
	"title" text,
	"performers" jsonb,
	"tags" jsonb,
	"description" text,
	"thumbnail_url" text,
	"raw_metadata" jsonb,
	"synced_to_stashdb" boolean DEFAULT false,
	"synced_to_theporndb" boolean DEFAULT false,
	"last_synced" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "metadata_cache_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"dispatch_method" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"discord_channel_id" text,
	"webhook_url" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"sign_count" integer DEFAULT 0,
	"aaguid" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"last_used_at" timestamp,
	"ip_address" text,
	"location" text,
	"browser" text,
	"os_name" text,
	"backup_eligible" boolean DEFAULT true,
	"backup_state" boolean DEFAULT true,
	"rp_id" text,
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "peer_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"peer_url" text NOT NULL,
	"outbound_key" text NOT NULL,
	"inbound_token" text NOT NULL,
	"status" text DEFAULT 'inactive',
	"recipe_sync_mode" text DEFAULT 'auto_merge',
	"sync_schedule" text DEFAULT 'manual',
	"library_scope" text DEFAULT 'all_entries',
	"allowed_providers" jsonb,
	"last_sync_at" timestamp,
	"next_run" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "peer_nodes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "peer_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"peer_id" integer NOT NULL,
	"direction" text NOT NULL,
	"recipes_synced" integer DEFAULT 0,
	"media_synced" integer DEFAULT 0,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"naming_pattern" text,
	"separator" text DEFAULT '_',
	"space_replacement" text DEFAULT '_',
	"logo_url" text,
	"automatic_limits" jsonb,
	CONSTRAINT "providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "scrape_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"name" text NOT NULL,
	"target_url" text,
	"cron_expression" text NOT NULL,
	"action" text DEFAULT 'metadata_and_download',
	"is_active" boolean DEFAULT true,
	"last_run" timestamp,
	"last_run_status" text,
	"last_run_details" text,
	"next_run" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "session_cookies" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer,
	"name" text,
	"site_id" text,
	"cookie_text" text,
	"status" text DEFAULT 'active',
	"download_limit" integer,
	"downloads_used" integer DEFAULT 0,
	"duration_limit_seconds" integer,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "site_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"css_selectors" jsonb,
	"xpath_selectors" jsonb,
	"regex_patterns" jsonb,
	"map_mode_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "sso_links" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"email" text,
	"linked_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "uix_provider_user" UNIQUE("provider","provider_user_id")
);
--> statement-breakpoint
CREATE TABLE "studios" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"url" text,
	"details" text,
	"tags" jsonb,
	"is_network" boolean DEFAULT false,
	"parent_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "studios_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subscription_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"name" text NOT NULL,
	"level" integer DEFAULT 0,
	"price" numeric(10, 2),
	"features" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"tier_id" integer,
	"user_id" text,
	"status" text DEFAULT 'active',
	"is_trial" boolean DEFAULT false,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"start_date" timestamp,
	"end_date" timestamp,
	"biller" text,
	"billing_cycle" text,
	"cost" numeric(10, 2),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "transcoding_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"library_entry_id" integer,
	"status" text DEFAULT 'pending',
	"target_codec" text DEFAULT 'h265',
	"target_resolution" text,
	"progress_percentage" numeric(5, 2) DEFAULT '0',
	"priority" integer DEFAULT 0,
	"celery_task_id" text,
	"pid" integer,
	"details" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "user_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"library_entry_id" integer NOT NULL,
	"watched_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"duration" integer DEFAULT 0,
	"completed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"theme" text DEFAULT 'dark',
	"ui_config" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_video_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"library_entry_id" integer NOT NULL,
	"play_count" integer DEFAULT 0,
	"climax_count" integer DEFAULT 0,
	"last_played" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "uix_user_video_stats" UNIQUE("user_id","library_entry_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"last_login_at" timestamp,
	"permissions" jsonb DEFAULT '{"can_stream": true, "can_scrape": false, "can_rip": false, "url_parsing": "edit"}'::jsonb,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vault" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"key" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "uix_vault_entity_key" UNIQUE("entity_type","entity_id","key")
);
--> statement-breakpoint
CREATE TABLE "video_chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"library_entry_id" integer NOT NULL,
	"title" text NOT NULL,
	"start_time" integer NOT NULL,
	"end_time" integer,
	"tags" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"events" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_preferences" ADD CONSTRAINT "download_preferences_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_queue" ADD CONSTRAINT "download_queue_media_entry_id_media_entries_id_fk" FOREIGN KEY ("media_entry_id") REFERENCES "public"."media_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_entries" ADD CONSTRAINT "duplicate_entries_library_entry_id1_library_entries_id_fk" FOREIGN KEY ("library_entry_id1") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_entries" ADD CONSTRAINT "duplicate_entries_library_entry_id2_library_entries_id_fk" FOREIGN KEY ("library_entry_id2") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_naming_history" ADD CONSTRAINT "file_naming_history_library_entry_id_library_entries_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_media_entry_id_media_entries_id_fk" FOREIGN KEY ("media_entry_id") REFERENCES "public"."media_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_files" ADD CONSTRAINT "local_files_media_entry_id_media_entries_id_fk" FOREIGN KEY ("media_entry_id") REFERENCES "public"."media_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mass_rip_sessions" ADD CONSTRAINT "mass_rip_sessions_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_entries" ADD CONSTRAINT "media_entries_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_entries" ADD CONSTRAINT "media_entries_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_sync_logs" ADD CONSTRAINT "peer_sync_logs_peer_id_peer_nodes_id_fk" FOREIGN KEY ("peer_id") REFERENCES "public"."peer_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_schedules" ADD CONSTRAINT "scrape_schedules_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_cookies" ADD CONSTRAINT "session_cookies_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_recipes" ADD CONSTRAINT "site_recipes_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_links" ADD CONSTRAINT "sso_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_tiers" ADD CONSTRAINT "subscription_tiers_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcoding_queue" ADD CONSTRAINT "transcoding_queue_library_entry_id_library_entries_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_history" ADD CONSTRAINT "user_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_history" ADD CONSTRAINT "user_history_library_entry_id_library_entries_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_video_stats" ADD CONSTRAINT "user_video_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_video_stats" ADD CONSTRAINT "user_video_stats_library_entry_id_library_entries_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_chapters" ADD CONSTRAINT "video_chapters_library_entry_id_library_entries_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_name" ON "api_keys" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_credentials_provider_id" ON "credentials" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_download_preferences_provider_id" ON "download_preferences" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_download_queue_media_entry_id" ON "download_queue" USING btree ("media_entry_id");--> statement-breakpoint
CREATE INDEX "idx_download_queue_status" ON "download_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_duplicate_entries_library_entry_id1" ON "duplicate_entries" USING btree ("library_entry_id1");--> statement-breakpoint
CREATE INDEX "idx_duplicate_entries_library_entry_id2" ON "duplicate_entries" USING btree ("library_entry_id2");--> statement-breakpoint
CREATE INDEX "idx_duplicate_entries_resolved" ON "duplicate_entries" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "idx_favorites_user_id" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_item_type_id" ON "favorites" USING btree ("item_type","item_id");--> statement-breakpoint
CREATE INDEX "idx_file_naming_history_entry_id" ON "file_naming_history" USING btree ("library_entry_id");--> statement-breakpoint
CREATE INDEX "idx_library_entries_studio_id" ON "library_entries" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "idx_library_entries_provider_id" ON "library_entries" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_library_entries_media_entry_id" ON "library_entries" USING btree ("media_entry_id");--> statement-breakpoint
CREATE INDEX "idx_library_entries_ohash" ON "library_entries" USING btree ("ohash");--> statement-breakpoint
CREATE INDEX "idx_library_entries_phash" ON "library_entries" USING btree ("phash");--> statement-breakpoint
CREATE INDEX "idx_library_entries_site_id" ON "library_entries" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_live_streams_name" ON "live_streams" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_live_streams_status" ON "live_streams" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_local_files_media_entry_id" ON "local_files" USING btree ("media_entry_id");--> statement-breakpoint
CREATE INDEX "idx_local_files_path" ON "local_files" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "idx_media_entries_studio_id" ON "media_entries" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "idx_media_entries_provider_id" ON "media_entries" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_media_entries_ohash" ON "media_entries" USING btree ("ohash");--> statement-breakpoint
CREATE INDEX "idx_media_entries_phash" ON "media_entries" USING btree ("phash");--> statement-breakpoint
CREATE INDEX "idx_media_entries_site_id" ON "media_entries" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_media_requests_status" ON "media_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_metadata_cache_provider" ON "metadata_cache" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_user_id" ON "notification_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_read" ON "notification_logs" USING btree ("read");--> statement-breakpoint
CREATE INDEX "idx_notification_preferences_user_id" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_passkeys_user_id" ON "passkeys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_passkeys_credential_id" ON "passkeys" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "idx_peer_nodes_name" ON "peer_nodes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_peer_nodes_status" ON "peer_nodes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_peer_sync_logs_peer_id" ON "peer_sync_logs" USING btree ("peer_id");--> statement-breakpoint
CREATE INDEX "idx_providers_name" ON "providers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_scrape_schedules_provider_id" ON "scrape_schedules" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_scrape_schedules_is_active" ON "scrape_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_session_cookies_provider_id" ON "session_cookies" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_session_cookies_site_id" ON "session_cookies" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_session_cookies_status" ON "session_cookies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_site_recipes_provider_id" ON "site_recipes" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_sso_links_user_id" ON "sso_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_studios_name" ON "studios" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_studios_parent_id" ON "studios" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_tiers_provider_id" ON "subscription_tiers" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_provider_id" ON "subscriptions" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_tier_id" ON "subscriptions" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user_id" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transcoding_queue_status" ON "transcoding_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_history_user_id" ON "user_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_history_entry_id" ON "user_history" USING btree ("library_entry_id");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_user_id" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_video_stats_user_id" ON "user_video_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_video_stats_entry_id" ON "user_video_stats" USING btree ("library_entry_id");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_vault_entity_type" ON "vault" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_vault_entity_id" ON "vault" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_video_chapters_library_entry_id" ON "video_chapters" USING btree ("library_entry_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_is_active" ON "webhooks" USING btree ("is_active");