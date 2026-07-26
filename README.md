# Voyarr

> **v1.100.1** — Self-hosted media server and library management system for adult video collections.

Voyarr unifies your subscriptions, local files, and metadata into one interface. Stream from your subscriptions, organize your personal library, and automate downloads — all from a single self-hosted dashboard.

- **User Guide**: [USER_GUIDE.md](USER_GUIDE.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Security Policy**: [SECURITY.md](SECURITY.md)
- **Privacy Policy**: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

---

## System Architecture

Voyarr is composed of five independently deployable layers:

| Layer | Role | Deployment targets |
|-------|------|--------------------|
| **Frontend** | React 19 PWA with Material UI v9 | `docker`, `cloudflare-pages` |
| **Backend API** | Python FastAPI server | `docker` |
| **Workers** | Celery task queue (downloads, transcodes, AI) | `docker` |
| **Database** | PostgreSQL 15 or Neon serverless | `docker`, `neon` |
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

System data uses Docker named volumes (managed by Docker — no manual folder creation needed):

| Volume | Mount point | Purpose |
|--------|-------------|---------|
| `voyarr-db-data` | `/var/lib/postgresql/data` | Database files |
| `voyarr-config` | `/app/config` | App settings and scraping recipes |
| `voyarr-backups` | `/app/backups` | Database backups |
| `voyarr-certs` | `/app/certs` | TLS certificates |

User-managed data uses bind mounts — you specify the host paths:

| Variable | Container path | Purpose |
|----------|----------------|---------|
| `HOST_MEDIA_PATH_1` | `/media/storage` | Primary media library (Main Storage) |
| `HOST_MEDIA_PATH_2` | `/media/storage_alt1` | Additional media drive |
| `HOST_MEDIA_PATH_3` | `/media/storage_alt2` | Additional media drive |
| `DEFAULT_DOWNLOAD_PATH` | (under media) | Download destination |

All configured paths are also aggregated and exposed as a **unified virtual media directory** at `/media/unified`, allowing the backend to treat your entire library as a single tree regardless of how many drives you have.

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

---

## Quick Start

### Prerequisites

- Docker and Docker Compose (v2)
- Git
- Node.js 22+ (for deploy scripts and version management)

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
   - `HOST_MEDIA_PATH_1` — path to your primary media directory
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

6. **First run**: The first account you register is automatically assigned the **admin** role.

### Docker-only (all layers local)

```bash
# Start the full stack
npm run up

# Stop the stack
npm run down
```

### Cloudflare Pages frontend + Neon database

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

---

### Docker Compose File Reference

Voyarr uses modular Compose fragments that are assembled at runtime by the `deploy/compose.sh` script. This allows each layer to independently choose between Docker and cloud hosting.

| File | Purpose | Used by |
|------|---------|---------|
| `docker-compose.deploy.yml` | **Self-contained single-file production stack** — all services in one file. Use this for Portainer deployments or when you want a single static compose file. | Portainer, manual `docker compose` |
| `docker-compose.base.yml` | Core services: redis, backend, celery_worker, celery_beat. The foundation fragment that every Docker deployment includes. | `deploy/compose.sh` |
| `docker-compose.db-docker.yml` | Adds PostgreSQL 15 as a container. Included automatically when `DATABASE_TARGET=docker`. | `deploy/compose.sh` |
| `docker-compose.frontend-docker.yml` | Adds the nginx-served frontend SPA. Included when `FRONTEND_TARGET=docker`. | `deploy/compose.sh` |
| `docker-compose.scraper-docker.yml` | Local headless Chrome container for scraping. Included when `SCRAPER_BROWSER_TARGET=docker`. | `deploy/compose.sh` |
| `docker-compose.cloudflare-tunnel.yml` | Cloudflare Tunnel sidecar (cloudflared) for exposing the backend without opening ports. Included when `BACKEND_API_TARGET=docker` and `FRONTEND_TARGET` is not docker. | `deploy/compose.sh` |
| `docker-compose.vpn.yml` | Gluetun VPN sidecar for routing backend traffic through a VPN. | Manual include |
| `docker-compose.tailscale.yml` | Tailscale sidecar for secure network access. | Manual include |
| `docker-compose.dev.yml` | Development overrides: dummy DB, local source builds, Vite dev server with HMR. | `npm run dev` |
| `docker-compose.override.yml` | Auto-loaded by Docker Compose in dev. Mounts source code and enables hot-reload for backend, Celery, and frontend. | Docker Compose (auto) |

**For most users**: run `npm run up` (uses `deploy/compose.sh` which selects the right fragments) or deploy `docker-compose.deploy.yml` directly on Portainer.

**For development**: `npm run dev` starts the full stack with hot-reload.

---

## Deployment Drivers

Each layer's deployment system follows a driver pattern:

```
deploy/<layer>/deploy.sh     # Reads target, dispatches to driver
deploy/<layer>/<target>.sh   # Driver for a specific target
```

To add a new deployment target (e.g., `database/supabase.sh`), create a driver script that exports a `deploy_database()` function.

---

## Core Features

### Media Hub
- **Library**: Browse, search, filter, and stream your entire media collection with advanced faceted search
- **Universal Search**: Search across local media, remote databases, and active subscription platforms simultaneously
- **Favorites**: Bookmark and curate preferred content
- **Live Streams**: Real-time streaming from configured providers

### Operations & Queues
- **Download Queue**: Celery-backed task queue with pause/resume and per-item extraction method tracking
- **Transcode Queue**: FFmpeg transcoding engine with H.264/H.265/AV1 output support
- **Mass Ripper**: Batch-rip entire provider channels, playlists, and indexes
- **Subscriptions**: Track, manage, and monitor all your media service subscriptions with billing cycle tracking
- **Download Rules**: Multi-criteria download automation (performers, categories, resolution, studio)

### Metadata & Intelligence
- **Media Providers**: Configure and manage subscription platforms and their CSS scraping maps
- **Payment Billers**: Track billing gateways and payment history per subscription
- **Studios**: Studio and network management with logo, website, and metadata support
- **Metadata Manager**: Automated metadata enrichment from StashDB, ThePornDB, and custom scrapers
- **Duplicates Engine**: Perceptual video hashing (phash/ohash) for duplicate detection and deduplication
- **Scraper Tester**: Live CSS selector testing and recipe validation tool

### System Administration
- **User Management**: Multi-user RBAC with Admin, User, and Viewer roles
- **P2P Sync Nodes**: Sync library metadata between Voyarr instances on your network
- **External API Keys**: Generate and revoke API keys for third-party integrations
- **Backup Manager**: Automated and manual database backup/restore with AES-256 encrypted exports
- **System Logs**: Live log viewer for all backend services
- **System Status**: Real-time service health monitoring

### Authentication
- **Passkeys (WebAuthn)**: Passwordless login with biometrics or hardware security keys; full Conditional UI (autofill mediation) support
- **SSO**: Google, GitHub, and Discord OAuth login with secure account linking
- **OIDC**: Connect any OpenID Connect-compliant identity provider (Keycloak, Authentik, Azure AD, Okta)
- **Trusted Subnet Bypass**: Skip login for trusted local network CIDR ranges
- **Command Palette**: App-wide keyboard navigation via `Cmd/Ctrl + K`

### Browser Extension
- **Voyarr Lens** (Chrome Extension, Manifest V3): Visual CSS selector mapping for metadata scraping with a Map Mode picker, default biller integration, and webcam support

---

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

### WebXR / VR Playback

The player supports immersive WebXR virtual reality playback (Three.js, lazy-loaded from CDN). When accessing from a VR headset (Meta Quest, Apple Vision Pro):
- An **Enter Immersive VR** button appears if WebXR is supported
- Toggle between **Flat Screen**, **180° Dome**, and **360° Sphere** projections
- **Stereo SBS** (Side-by-Side) for stereoscopic content
- Requires a **secure context** (HTTPS or localhost)

### DeoVR Native Integration

Voyarr serves a fully compliant DeoVR Selection Scene JSON feed. Open your DeoVR Player app, navigate to your Voyarr domain, and browse your library in DeoVR's native VR interface.

**Authentication options:**
- **Pairing code** — Generate a 6-digit code from Account Security on your desktop — enter it as the password in DeoVR's sign-in form. No Voyarr password needed on the headset.
- **Username/password** — Traditional sign-in with your Voyarr account credentials.
- **Device pairing** — Open `/pair` on your headset and approve the code from Account Security.

**Feed capabilities:**
- Scene metadata (title, description, performers, tags, categories, rating, date)
- VR projection auto-detection (SBS/TB, 180/360/fisheye)
- Multiple quality encodings with resolution selection
- Thumbnails, gallery images, and preview clips
- Funscript/HSP support for interactive devices
- Download sources for offline playback
- Pagination and multi-field filtering (search, studio, performer, tag)

### Maximizing Compatibility

For the widest browser compatibility, use the **Transcode Queue** to convert any file to **MP4 with H.264 video and AAC audio**. MP4/H.264 plays in every modern browser on every platform without additional codecs.

---

## Changelog Highlights

| Version | Highlights |
|---------|-----------|
| **v1.100.x** | MUI v9 full migration (`slotProps`), Grid v2 props, extraction_method DB column, Vite proxy localhost fallback |
| **v1.96.x** | Tab restoration dependency loop fix; app stability improvements |
| **v1.95.x** | Unified media directory (`/media/unified`) with subfolder scan exclusion controls |
| **v1.94.x** | Multi-drive storage aggregation; Main Storage / Additional Storage labeling |
| **v1.93.x** | Auto-ensure storage volumes in file picker and backend directory browser |
| **v1.92.x** | `autoComplete` attributes on auth inputs; KeyIcon import fix |
| **v1.91.x** | `lazyWithRetry` + `ErrorBoundary` auto-recovery for stale asset chunk hashes |
| **v1.79.x** | Library item removal; recursive folder media import with query-token stream auth |
| **v1.77.x** | Abstract database auto-migration system; Cloudflare Worker route proxy expansion |
| **v1.73.x** | Provider auto-seeding; balanced card grid layouts |
| **v1.68.x** | Voyarr Lens: default biller integration, webcam support, universal host permissions |
