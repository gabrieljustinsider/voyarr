# Voyarr & Voyarr Lens: Complete User Guide

> **Version:** v1.100.1 · [README](README.md) · [Troubleshooting](TROUBLESHOOTING.md)

Welcome to Voyarr. This guide covers setup, configuration, and daily use of your self-hosted media library and its companion browser extension, Voyarr Lens.

---

## What is Voyarr?

Voyarr unifies your adult video service subscriptions into a single media library. Stream directly from your subscriptions, organize your collection, and automate downloads — all from one interface.

- **Stream**: Watch videos from your subscriptions in one place.
- **Organize**: Automatically sort and catalog your media library.
- **Automate**: Set rules to download, transcode, and organize content on a schedule.

---

## Setting Up Voyarr

Voyarr runs as a set of services that can be deployed on Docker, cloud platforms, or a mix of both. Each service layer is independently configurable.

### Understanding Layers

| Layer | What it does |
|-------|-------------|
| **Frontend** | The web interface you interact with in your browser (React 19 + MUI v9 PWA) |
| **Backend API** | The server that processes your requests and manages the library (FastAPI) |
| **Workers** | Background processes that handle downloads, transcoding, and AI tasks (Celery) |
| **Database** | Stores your library metadata, rules, and settings (PostgreSQL or Neon) |
| **Scraper Browser** | Browses websites to scrape metadata for your media (headless Chrome) |

You can choose where each layer runs. By default, everything runs locally in Docker. You can also run the frontend on Cloudflare Pages, the database on Neon, or the scraper via browserless.io.

### Initial Setup

#### 1. Configure Environment

Copy `.env.example` to `.env` in the Voyarr root directory. Open it in any text editor and configure:

- **Media Path**: Set `HOST_MEDIA_PATH_1` to the folder where your video files are stored (e.g., `/volume1/video`). This becomes the **Main Storage** drive in the file picker.
- **Additional Drives**: Optionally set `HOST_MEDIA_PATH_2` and `HOST_MEDIA_PATH_3` for additional media drives.
- **Time Zone**: Set `TZ` to your local timezone (e.g., `America/New_York`).
- **User ID**: Set `PUID` and `PGID` to your system user ID (run `id` in a terminal to find yours).

#### 2. Deploy

Open a terminal in the Voyarr directory and run:

```bash
npm run deploy
```

This starts all layers according to your configuration. On first run, Docker downloads the required images.

Once complete, open `http://localhost:80` in your browser (or the port you configured).

### Your First Login

1. Open the Voyarr web interface.
2. Enter a username and password, then click **Sign In with Password** to create your first account.
3. The first account created is automatically assigned the **admin** role.
4. From the admin dashboard, you can create user accounts, configure settings, and manage the library.

---

## Navigating the Web App

The web interface is organized into sections accessible from the collapsible sidebar. Click the arrow at the top of the sidebar to collapse or expand it.

### Media Hub

| Page | Description |
|------|-------------|
| **Dashboard** | System status, download statistics, cookie quota usage, and session activity |
| **Library** | Browse, search, filter, and stream your entire media collection |
| **Universal Search** | Search across local media, remote databases, and all active subscription platforms at once |
| **Favorites** | Bookmarked and curated content |
| **Live Streams** | Real-time streams from configured providers |

### Operations & Queues

| Page | Description |
|------|-------------|
| **Download Queue** | Monitor, pause, resume, and cancel active and queued downloads |
| **Transcode Queue** | Convert media files to different formats using FFmpeg |
| **Mass Ripper** | Batch-rip entire channels, playlists, or indexes from a provider |
| **Subscriptions** | Track your media service subscriptions, billing cycles, and costs |
| **Download Rules** | Automated download triggers based on performers, categories, resolution, and studio |

### Metadata & Intelligence

| Page | Description |
|------|-------------|
| **Media Providers** | Configure subscription platforms and their CSS scraping maps |
| **Payment Billers** | Manage billing gateways linked to subscriptions |
| **Studios** | Studio and network management with logos and metadata |
| **Metadata Manager** | Enrich library entries from StashDB, ThePornDB, and custom scrapers |
| **Duplicates Engine** | Find and manage duplicate files using perceptual hashing (phash/ohash) |
| **Scraper Tester** | Live CSS selector validation tool for configuring provider scrapers |

### System Administration

| Page | Description |
|------|-------------|
| **User Management** | Manage user accounts, roles, and permissions |
| **P2P Sync Nodes** | Configure library synchronization between Voyarr instances |
| **External API Keys** | Generate and revoke API keys for third-party integrations |
| **Backup Manager** | Create, schedule, and restore encrypted database backups |
| **System Logs** | Live log viewer for all backend services |
| **System Status** | Real-time service health monitoring |
| **Settings** | All system configuration — see below |
| **Help & Docs** | In-app documentation and quick reference |

### Command Palette

Press **Cmd + K** (Mac) or **Ctrl + K** (Windows/Linux) anywhere in the app to open the Command Palette for instant keyboard navigation to any page.

---

## Settings Overview

The Settings page is organized into tabs:

- **General**: Time zone, language, UI theme, and display preferences
- **File Naming**: Configure automatic file renaming patterns using reverse regex matching
- **Download Rules**: Default quality, resolution, and format preferences
- **Transcoding**: FFmpeg presets, output format, and codec settings
- **Notifications**: Configure Discord webhooks and outbound notification events
- **Account Security**: Passkeys, SSO, OIDC, and trusted subnet configuration

---

## Storage & Media Directory

### Multi-Drive Setup

Voyarr supports up to three host media directories via environment variables:

```env
HOST_MEDIA_PATH_1=/data/media      # Main Storage
HOST_MEDIA_PATH_2=/data/media2     # Additional Storage
HOST_MEDIA_PATH_3=/data/media3     # Additional Storage
```

> **Note:** the third mount (`HOST_MEDIA_PATH_3`) is commented out in the compose files by default because leaving it unset creates an empty bind mount. To use a third drive, uncomment the `HOST_MEDIA_PATH_3` line in your compose file, set the host path, and add `/media/storage_alt2` to `CONTAINER_MEDIA_PATHS`.

In the file picker (Path Picker), these appear as labelled quick-access drives:
- **Main Storage** → `HOST_MEDIA_PATH_1`
- **Additional Storage** → `HOST_MEDIA_PATH_2` / `HOST_MEDIA_PATH_3`
- **Downloads**, **Library**, **Scan / Import**, **Mounts** — auto-suggested common paths

### Unified Media View

All configured drives are automatically aggregated into a single unified virtual directory at `/media/unified`. The backend uses this path to scan, index, and serve media from all drives without requiring separate scan jobs per drive.

Subfolder exclusion patterns can be configured in **Settings → General** to prevent specific directories from being included in library scans.

---

## Authentication

### Password Login

Standard username/password authentication. Passwords are hashed using bcrypt. All login form fields include correct `autocomplete` attributes for password manager compatibility.

### Passkeys (WebAuthn)

Passkeys allow passwordless login using your device's biometrics (fingerprint, face) or a hardware security key.

#### First-Time Passkey Setup

When an admin enables passkeys for the first time, a configuration wizard appears on the login screen:

1. The **Website Address Override** (RP ID) is pre-populated with your current domain — leave it as-is unless you have a specific multi-domain setup.
2. Set the **Display Name** shown on your device's passkey prompt.
3. Click **Test Settings** to verify your configuration.
4. Once the test succeeds, click **Register Owner Passkey** to bind your first passkey.

**Note:** For passkeys to work, you must access Voyarr over `https://` or `localhost`. Plain HTTP connections will show a `SecurityError`.

#### Registering Additional Passkeys

After the initial setup, additional passkeys (for other users or devices) are registered from **Settings → Account Security**.

### SSO (Google, GitHub, Discord)

Configure OAuth applications in each provider's developer portal and add the client ID and secret to your `.env` file:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

Users link an SSO provider from **Settings → Account Security**. A lockout safeguard prevents removing an SSO link if it is the only remaining authentication method.

### OpenID Connect (OIDC)

Connect Voyarr to any OIDC-compliant identity provider for auto-provisioning on first login. Configure `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` in your `.env`.

### Trusted Subnet Bypass

Skip the login screen for users on trusted local networks. Configure CIDR ranges in **Settings → Account Security**. Disabled by default.

---

## User Roles

Three roles are available:

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all features and settings, including user management and system configuration |
| **User** | Can browse the library, manage downloads, configure personal settings. Cannot access admin-only sections |
| **Viewer** | Read-only access to the library. Cannot modify settings or trigger downloads |

The first registered account is always Admin. Subsequent accounts require an Admin to create them (or an Admin JWT / MASTER_KEY API key to self-register via the API).

---

## Installing the Voyarr Lens Browser Extension

Voyarr Lens is a Chrome browser extension (Manifest V3) that helps you create CSS selectors for scraping metadata from websites. It also supports:
- Default biller auto-linking when adding new subscriptions
- Webcam and live content provider detection
- Universal host permissions for broad site compatibility

### Installation

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top right).
3. Click **Load unpacked** and select the `extension/` folder in the Voyarr directory.
4. The Voyarr Lens extension is now installed. Pin it to your toolbar for easy access.

### Configuration

After installation, click the Voyarr Lens icon and enter:
- **Your Voyarr URL**: The address of your Voyarr instance (e.g., `http://localhost:80`)
- **Extension Secret Key**: Generated from **External API Keys** in Voyarr

### Using Map Mode

When configuring a provider in Voyarr, you can use Map Mode to visually select elements on a website:

1. Open the provider's website in a separate tab.
2. Click the Voyarr Lens extension icon.
3. Click **Map Mode** to activate it.
4. Click on elements on the webpage (titles, performer names, dates) to generate CSS selectors.
5. The selectors are automatically saved and synced to your Voyarr instance.

---

## Backups and Restores

Voyarr stores its database in a Docker named volume (`voyarr-db-data`). Automated backups are managed by Celery and saved to the `voyarr-backups` volume.

### Using the Backup Manager (Web UI)

The **Backup Manager** page (System Administration → Backup Manager) provides:
- **Full backup**: Exports all database tables
- **Encrypted backup**: AES-256 (Fernet/PBKDF2) encrypted exports with an optional passphrase — stored securely, never shown again after creation
- **Restore**: Upload and decrypt a backup file directly from the UI
- **Scheduled backups**: Configure automated backup intervals

### Manual Backup (CLI)

```bash
./backup.sh
```

This creates a timestamped SQL dump in the backups volume.

### Cleaning Old Backups

```bash
./clean_backups.sh
```

Removes backup files older than 30 days (configurable via `BACKUP_RETENTION_DAYS`).

### Restore from Backup (CLI)

```bash
docker run --rm \
  -v voyarr-backups:/backups \
  -v voyarr-db-data:/var/lib/postgresql/data \
  postgres:15-alpine \
  sh -c "pg_restore -U voyarr_user -d voyarr /backups/your_backup_file.sql"
```

---

## Video Playback

Voyarr uses a shared **SmartVideoPlayer** component across the Library and Live Streams sections. It automatically detects the correct playback strategy based on the file or stream URL — no manual configuration needed.

### Supported Formats & Protocols

| Category | Formats / Protocols | Notes |
|----------|---------------------|-------|
| **Streaming (HLS)** | `.m3u8` | Uses hls.js (loaded from CDN) in Chrome/Firefox/Edge; native in Safari/iOS |
| **Streaming (DASH)** | `.mpd` | Uses dash.js (loaded from CDN) |
| **MP4 / MOV** | H.264, H.265, AV1 | Works in all modern browsers |
| **WebM** | VP8, VP9, AV1 | Chrome and Firefox; limited in Safari |
| **Ogg / OGV** | Theora | Chrome, Firefox |
| **MKV** | Any codec | Varies by OS codec pack; best in Chrome or with Windows codec pack |
| **AVI, WMV, FLV** | Various | Limited browser support; transcode to MP4 for best results |
| **TS / M2TS / MTS** | MPEG Transport Stream | Generally supported; may require codec pack on Windows/Edge |
| **MPEG, 3GP, 3G2** | Various | Basic support; MP4 preferred |
| **Audio** | MP3, AAC, FLAC, WAV, OGG, OPUS, M4A | Full support across modern browsers |
| **RTMP / RTSP** | — | ⚠️ Cannot play in a browser; must be re-streamed as HLS |

### Adaptive Streaming Libraries

hls.js and dash.js are **lazy-loaded from CDN only when needed**. This means:
- No additional build-time dependency cost.
- Your browser needs internet access when playing HLS or DASH streams for the first time in a session.
- Safari and iOS use native HLS; hls.js is not loaded.

### WebXR / Immersive VR Playback

The player supports WebXR virtual reality playback (Three.js, lazy-loaded from CDN). When accessing from a compatible VR headset (Meta Quest Browser, Apple Vision Pro):

- An **Enter Immersive VR** button appears in player controls if WebXR is detected
- **Projections**: Flat Screen, 180° Dome, or 360° Sphere
- **Stereoscopy**: Stereo SBS (Side-by-Side) support for 3D content
- **Exit Safeguard**: Click the primary select trigger on either VR controller to exit VR mode
- **Requirement**: Secure context (`https://` or `localhost`) — WebXR is blocked on plain HTTP

### DeoVR Integration

Voyarr serves a native DeoVR-compatible scene feed that turns your VR headset into a private home theater for your library. The feed is automatically available to any supported VR media player.

**Compatible Players**

The DeoVR feed works with any app that implements the DeoVR Selection Scene JSON protocol:
- **DeoVR Player** — Available on Meta Quest Store and Apple App Store (Vision Pro)
- **Any VR media browser** that supports the DeoVR feed format

**How It Works**

1. Open the **DeoVR** app on your headset and navigate to `voyarr.gabrieljustinsider.com` (or your Voyarr domain)
2. The DeoVR browser automatically requests the scene feed from your Voyarr server
3. Tap the **Sign In** button and authenticate using one of the methods below
4. Browse your full library in DeoVR's native VR grid interface with cover thumbnails, metadata, and playback controls

**Signing In Without a Password**

You can authenticate from your VR headset without typing your Voyarr password by generating a temporary pairing code:

1. On your **desktop computer**, open Voyarr and go to **Account Security**
2. Under the **VR Headset & DeoVR Easy Sign-In** section, click **Generate Code** next to "DeoVR Native Sign-In Code"
3. A 6-digit code appears that expires after 5 minutes
4. On your VR headset, open the DeoVR Player and navigate to your Voyarr domain
5. Tap the **Sign In** button
6. Enter the 6-digit code in the **Password** field (leave the Username field blank)

Your library loads immediately — no password saved or entered on the headset.

**Traditional Sign-In**

If you prefer, you can enter your Voyarr username and password directly in the DeoVR sign-in form. Credentials are verified against your Voyarr account.

**Feed Features**

The DeoVR scene feed includes:
- **Video metadata**: Title, duration, description, date added, performers, tags, categories, and rating
- **VR projection detection**: Automatically detects stereo mode (SBS, top-bottom, off) and screen type (flat, 180°, 360°, fisheye) from file names and metadata
- **Multiple resolutions** with encoding-aware quality selection
- **Thumbnails and screenshots**: Cover art and additional gallery images
- **Preview clips**: Short preview URLs when available in metadata
- **Haptic feedback**: Funscript and HSP file URLs for compatible interactive devices
- **Download sources**: Direct download links for each video
- **Pagination**: Full library navigation with page controls (50 items per page)
- **Filter support**: Filter the feed by search query, studio, performer, or tag via URL parameters

**Pairing a VR Headset (Alternative Method)**

If the native DeoVR sign-in is not your preferred approach, you can pair your VR headset using the 6-digit device pairing flow:

1. On your VR headset, open the browser and navigate to `voyarr.gabrieljustinsider.com/pair` (or your Voyarr domain + `/pair`)
2. A 6-digit pairing code is displayed on the headset screen
3. On your desktop computer, open Voyarr → **Account Security** → under "VR Headset & DeoVR Easy Sign-In", enter the 6-digit code and click **Approve VR Device**
4. The headset automatically detects the approval and redirects to the DeoVR feed with an authentication token
5. Your library loads immediately

**QR Code Shortcut**

In the VR Headset section of **Account Security**, a QR code encodes the full authenticated feed URL. Scan it with your headset's camera to jump directly to your library without manual URL entry.

### Browser Codec Compatibility

| Browser | H.264 | H.265 | VP9/WebM | HLS | DASH |
|---------|-------|-------|----------|-----|------|
| Chrome | ✅ | ✅ (Win 11+) | ✅ | via hls.js | via dash.js |
| Firefox | ✅ | ❌ | ✅ | via hls.js | via dash.js |
| Safari/iOS | ✅ | ✅ | ⚠️ | ✅ Native | via dash.js |
| Edge (Win) | ✅ | ✅ (Win 11+) | ✅ | via hls.js | via dash.js |

### Maximizing Compatibility

For guaranteed playback across all browsers and devices, use **Settings → Transcode Queue** to convert files to **MP4 with H.264 video and AAC audio**. This combination plays everywhere without additional OS codec packs.

### Troubleshooting Playback Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Spinner stays, no video | Unsupported protocol or format | Check browser console for `MEDIA_ERR_SRC_NOT_SUPPORTED` |
| Video plays but looks corrupted | Unsupported codec | Check for `MEDIA_ERR_DECODE`; transcode to MP4 H.264 |
| "HLS not supported" banner | CDN blocked or offline | Ensure browser has internet access; try Safari for native HLS |
| RTMP/RTSP shows error | Protocol not supported in browsers | Re-stream source as HLS using a media server |
| Audio only, no video | Video codec unsupported | Transcode via the Transcode Queue |
| "Enter Immersive VR" missing | HTTP (non-secure context) | Access Voyarr over HTTPS or `localhost` |

---

## File Naming and Organization

Voyarr can automatically rename files based on configurable naming schemes. The reverse regex matching engine scans your media folder and extracts metadata (title, performers, resolution) from existing filenames.

Configure naming patterns in **Settings → File Naming**.

---

## Subscriptions

The **Subscriptions** page tracks all your active media service subscriptions:

- Add subscriptions with provider, tier, billing cycle, and cost
- Track start/end dates and renewal reminders
- Link a **Payment Biller** (billing gateway) to each subscription
- Monitor total monthly/annual spend across all services

---

## External API Keys

Generate machine-readable API keys for third-party integrations (scripts, bots, automation):

1. Navigate to **System Administration → External API Keys**
2. Click **Generate New Key** and give it a descriptive name
3. **Copy the key immediately** — it is shown only once and stored as a hash
4. Use the key in the `X-Voyarr-Api-Key` header for API requests

To revoke a key, click **Revoke** next to it in the list.
