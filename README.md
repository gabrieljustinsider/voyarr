# Voyarr

Voyarr is a self-hosted media player and library management system for adult video collections. Stream directly from your subscriptions and organize your personal library in one place.

User Guide is available at [USER_GUIDE.md](USER_GUIDE.md). Troubleshooting help at [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## System Architecture

Voyarr is composed of five independently deployable layers:

| Layer | Role | Deployment targets |
|-------|------|-------------------|
| **Frontend** | React PWA with Material UI | `docker`, `cloudflare-pages` |
| **Backend API** | Python FastAPI server | `docker` |
| **Workers** | Celery task queue (downloads, transcodes, AI) | `docker` |
| **Database** | PostgreSQL 15 | `docker`, `neon` |
| **Scraper Browser** | Headless Chrome for metadata scraping | `docker`, `browserless-io` |

Each layer has an independent target variable in your `.env` file:

```env
FRONTEND_TARGET=docker
BACKEND_API_TARGET=docker
WORKERS_TARGET=docker
DATABASE_TARGET=docker
SCRAPER_BROWSER_TARGET=browserless-io
```

When a layer is set to `docker`, it runs as a container managed by Docker Compose. Cloud targets (Cloudflare Pages, Neon, browserless.io) are configured via environment variables and deployed through driver scripts in `deploy/`.

### Volume Architecture

System data uses Docker named volumes (managed by Docker, no manual folder creation needed):

| Volume | Mount point | Purpose |
|--------|-------------|---------|
| `voyarr-db-data` | `/var/lib/postgresql/data` | Database files |
| `voyarr-config` | `/app/config` | App settings and scraping recipes |
| `voyarr-backups` | `/app/backups` | Database backups |
| `voyarr-certs` | `/app/certs` | TLS certificates |

User-managed data uses bind mounts — you specify the host paths:

| Variable | Container path | Purpose |
|----------|---------------|---------|
| `HOST_MEDIA_PATH_1` | `/media/storage` | Primary media library |
| `HOST_MEDIA_PATH_2` | `/media/storage_alt1` | Additional media drive |
| `HOST_MEDIA_PATH_3` | `/media/storage_alt2` | Additional media drive |
| `DEFAULT_DOWNLOAD_PATH` | (under media) | Download destination |

### Secrets Management

A `SECRETS_PROVIDER` variable controls how environment variables are loaded:

- **`dotenv`** (default): Sources `.env` file directly. Suitable for most self-hosted setups.
- **`op`** / **`1password`**: Resolves `op://` URIs via 1Password CLI. For users who manage secrets in 1Password.
- **`bitwarden`**: Sources `.env` with Bitwarden CLI integration for additional secret resolution.

The secrets provider is used by all deploy scripts and shell utilities. The Python backend always uses `python-dotenv` to load `.env` regardless of the provider setting.

### Rotating and Re-injecting Secrets

When you rotate a secret (API token, database password, etc.) in 1Password, regenerate the resolved `.env` file for Portainer or other environments that lack the 1Password CLI:

```bash
# Generate a plaintext .env with all op:// references resolved
op inject -i .env -o .env.portainer --force
```

Load this into Portainer's environment variables, or any other deployment target that reads plaintext `.env` files. Keep the original `.env` with `op://` refs committed — it contains no actual secrets.

## Quick Start

### Prerequisites

- Docker and Docker Compose (v2)
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/gabrieljustinsider/voyarr.git
   cd voyarr
   ```

2. Create your `.env` file from the template:
   ```bash
   cp .env.example .env
   ```

3. Configure `.env` with your settings. At minimum:
   - `MASTER_KEY` — 32-byte hex key for credential encryption
   - `SECRET_KEY` — JWT signing secret
   - `HOST_MEDIA_PATH_1` — path to your media directory
   - Choose deployment targets for each layer

4. Deploy all layers:
   ```bash
   npm run deploy
   ```
   Or deploy individual layers:
   ```bash
   npm run deploy:database
   npm run deploy:backend-api
   npm run deploy:workers
   npm run deploy:scraper
   npm run deploy:frontend
   ```

5. Access the web UI at `http://localhost:80` (or the port configured in `FRONTEND_PORT`).

### Deploying with Docker only (all layers local)

```bash
# Start the full stack
npm run up

# Stop the stack
npm run down
```

### Deploying with Cloudflare Pages frontend + Neon database

Set in `.env`:
```env
FRONTEND_TARGET=cloudflare-pages
DATABASE_TARGET=neon
CLOUDFLARE_PAGES_PROJECT_NAME=voyarr
FRONTEND_BACKEND_URL=https://api.yourdomain.com
NEON_DATABASE_URL=postgresql://...
```

Then deploy:
```bash
# Infrastructure first
npm run deploy:database
npm run deploy:backend-api
npm run deploy:workers

# Frontend last (needs backend URL for build)
npm run deploy:frontend
```

For the backend to be reachable from Cloudflare Pages, use Cloudflare Tunnel:
```bash
# One-time tunnel setup
cloudflared tunnel create voyarr
cloudflared tunnel route dns voyarr api.yourdomain.com

# Add the tunnel token to your .env:
# CLOUDFLARE_TUNNEL_TOKEN=...
```

Or deploy with the tunnel automatically:
```bash
npm run up  # includes cloudflared container when FRONTEND_TARGET is not docker
```

## Deployment Drivers

Each layer's deployment system follows a driver pattern:

```
deploy/<layer>/deploy.sh     # Reads target, dispatches to driver
deploy/<layer>/<target>.sh   # Driver for a specific target
```

To add a new deployment target (e.g., `database/supabase.sh`), create a driver script that exports a `deploy_database()` function.

## Core Features

- Multi-user RBAC with admin, user, and viewer roles
- WebAuthn passkey authentication, SSO (Google, GitHub, Discord), and OIDC
- Automated media scraping and metadata management
- Celery-backed task queue with pause/resume support
- Download rules with multi-criteria filtering (performers, categories, resolution)
- Perceptual video hashing (phash) for duplicate detection
- FFmpeg transcoding engine with H.265 support
- Cron-scheduled library scans and P2P sync between Voyarr nodes
- Discord bot with slash commands for remote administration
- Outbound webhooks for scan/transcode completion events
- Backup and restore with automated scheduling
- Chrome browser extension (Voyarr Lens) for CSS selector mapping
- Studio modeling, chapter management, and facial recognition clustering
- **Universal video/audio playback** via `SmartVideoPlayer` — auto-detects HLS, MPEG-DASH, and native HTML5 formats with lazy-loaded hls.js / dash.js

## Video Playback

Voyarr uses a `SmartVideoPlayer` component that automatically detects the correct playback strategy from the media URL. No configuration is required.

### Supported Formats & Protocols

| Format / Protocol | Strategy | Notes |
|---|---|---|
| `.m3u8` | HLS (hls.js / native Safari) | Adaptive bitrate, low-latency mode |
| `.mpd` | MPEG-DASH (dash.js) | Adaptive streaming |
| `.mp4`, `.m4v`, `.mov` | HTML5 native | Best browser compatibility |
| `.mkv`, `.webm`, `.ogv` | HTML5 native | Chrome/Edge on Windows recommended for MKV |
| `.avi`, `.wmv`, `.flv` | HTML5 native | Support varies by OS codec pack |
| `.ts`, `.m2ts`, `.mts` | HTML5 native | MPEG-2 Transport Stream |
| `.mpeg`, `.mpg`, `.3gp` | HTML5 native | Legacy format support |
| Audio: `.mp3`, `.aac`, `.m4a`, `.wav`, `.flac`, `.ogg`, `.opus` | HTML5 native | Full audio playback |
| `rtmp://`, `rtsp://` | Error with guidance | Cannot play in browser — re-stream as HLS |

### How It Works

- **Automatic detection**: The player reads the URL extension and routes to the correct engine
- **On-demand loading**: `hls.js` and `dash.js` are fetched from CDN only when the source requires them — no build-time dependency bloat
- **Safari / iOS**: HLS is played natively without loading hls.js
- **Error surfacing**: Codec errors, network errors, and unsupported formats show clear, actionable messages

### Maximizing Compatibility

For the widest browser compatibility, use the **Transcode Queue** to convert any file to **MP4 with H.264 video and AAC audio**. MP4/H.264 plays in every modern browser on every platform without additional codecs.

