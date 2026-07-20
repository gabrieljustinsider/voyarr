# Voyarr & Voyarr Lens: Complete User Guide

Welcome to Voyarr. This guide covers setup, configuration, and daily use of your self-hosted media library and its companion browser extension, Voyarr Lens.

## What is Voyarr?

Voyarr unifies your adult video service subscriptions into a single media library. Stream directly from your subscriptions, organize your collection, and automate downloads — all from one interface.

- **Stream**: Watch videos from your subscriptions in one place.
- **Organize**: Automatically sort and catalog your media library.
- **Automate**: Set rules to download, transcode, and organize content on a schedule.

## Setting Up Voyarr

Voyarr runs as a set of services that can be deployed on Docker, cloud platforms, or a mix of both. Each service layer is independently configurable.

### Understanding Layers

| Layer | What it does |
|-------|-------------|
| **Frontend** | The web interface you interact with in your browser |
| **Backend API** | The server that processes your requests and manages the library |
| **Workers** | Background processes that handle downloads, transcoding, and AI tasks |
| **Database** | Stores your library metadata, rules, and settings |
| **Scraper Browser** | Browses websites to scrape metadata for your media |

You can choose where each layer runs. By default, everything runs locally in Docker. You can also run the frontend on Cloudflare Pages, the database on Neon, or the scraper via browserless.io.

### Initial Setup

#### 1. Configure Environment

Copy `.env.example` to `.env` in the Voyarr root directory. Open it in any text editor and configure:

- **Media Path**: Set `HOST_MEDIA_PATH_1` to the folder where your video files are stored (e.g., `/volume1/video`).
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
2. Click **Register** to create your first account.
3. The first account created is automatically assigned the **admin** role.
4. From the admin dashboard, you can create user accounts, configure settings, and manage the library.

### Understanding the Web App

The web interface is organized into sections accessible from the sidebar:

- **Library**: Browse and search your media collection.
- **Dashboard**: View system status, recent activity, and statistics.
- **Downloads**: Monitor active and queued downloads.
- **Schedule**: View and manage automated library scans.
- **Settings**: Configure providers, credentials, rules, and system preferences.

See the in-app tooltips and help sections for detailed guidance on each page.

## Installing the Voyarr Lens Browser Extension

Voyarr Lens is a Chrome browser extension (Manifest V3) that helps you create CSS selectors for scraping metadata from websites.

### Installation

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top right).
3. Click **Load unpacked** and select the `extension/` folder in the Voyarr directory.
4. The Voyarr Lens extension is now installed. Pin it to your toolbar for easy access.

### Using Map Mode

When configuring a provider in Voyarr, you can use Map Mode to visually select elements on a website:

1. Open the provider's website in a separate tab.
2. Click the Voyarr Lens extension icon.
3. Click **Map Mode** to activate it.
4. Click on elements on the webpage (titles, performer names, dates) to generate CSS selectors.
5. The selectors are automatically saved and synced to your Voyarr instance.

## Backups and Restores

Voyarr stores its database in a Docker named volume (`voyarr-db-data`). Automated backups are managed by Celery and saved to the `voyarr-backups` volume.

### Manual Backup

```bash
./backup.sh
```

This creates a timestamped SQL dump in the backups volume.

### Cleaning Old Backups

```bash
./clean_backups.sh
```

Removes backup files older than 30 days (configurable via `BACKUP_RETENTION_DAYS`).

### Restore from Backup

To restore from a backup file inside the volume:

```bash
docker run --rm -v voyarr-backups:/backups -v voyarr-db-data:/var/lib/postgresql/data postgres:15-alpine sh -c "pg_restore -U voyarr_user -d voyarr /backups/your_backup_file.sql"
```

## Video Playback

Voyarr uses a shared **SmartVideoPlayer** component across the Library and Live Streams sections. It automatically detects the correct playback strategy based on the file or stream URL — no manual configuration needed.

### Supported Formats & Protocols

| Category | Formats / Protocols | Notes |
|----------|---------------------|-------|
| **Streaming (HLS)** | `.m3u8` | Uses hls.js (loaded from CDN) in Chrome/Firefox/Edge; native playback in Safari/iOS |
| **Streaming (DASH)** | `.mpd` | Uses dash.js (loaded from CDN) |
| **MP4 / MOV** | H.264, H.265, AV1 | Works in all modern browsers |
| **WebM** | VP8, VP9, AV1 | Chrome and Firefox; limited in Safari |
| **Ogg / OGV** | Theora | Chrome, Firefox |
| **MKV** | Any codec | Varies by OS codec pack; best in Chrome or with Windows codec pack |
| **AVI, WMV, FLV** | Various | Limited browser support; transcode to MP4 for best results |
| **TS / M2TS / MTS** | MPEG Transport Stream | Generally supported; may require codec pack on Windows/Edge |
| **MPEG, 3GP, 3G2** | Various | Basic support; MP4 preferred |
| **Audio** | MP3, AAC, FLAC, WAV, OGG, OPUS, M4A, WebA | Full support across modern browsers |
| **RTMP / RTSP** | — | ⚠️ Cannot play directly in a browser; must be re-streamed as HLS |

### Adaptive Streaming Libraries

hls.js and dash.js are **lazy-loaded from CDN only when needed**. This means:
- No additional build-time dependency cost.
- Your browser needs internet access when playing HLS or DASH streams for the first time on a session.
- Safari and iOS use native HLS; hls.js is not loaded.

### Browser Codec Compatibility Notes

- **Chrome / Edge**: Broadest codec support including H.265 on Windows 11 with media extensions.
- **Firefox**: Good VP9/WebM support; H.265 support varies by OS.
- **Safari / iOS**: Native HLS support; limited WebM/VP9; no RTMP/RTSP.
- **Windows + Edge**: MKV/AVI playback can depend on installed Windows codec packs (e.g., K-Lite).

### Troubleshooting Playback Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Spinner stays, no video | Unsupported protocol or format | Check browser console for `MEDIA_ERR_SRC_NOT_SUPPORTED` |
| Video plays but looks corrupted | Unsupported codec | Check for `MEDIA_ERR_DECODE`; transcode to MP4 H.264 |
| "HLS not supported" banner | CDN blocked or offline | Ensure browser has internet access; try Safari for native HLS |
| RTMP/RTSP shows error | Protocol not supported in browsers | Re-stream source as HLS using a media server |
| Audio only, no video | Video codec unsupported | Transcode via the Transcode Queue |

For persistent codec issues, use the **Transcode Queue** (Settings > Transcoding) to convert files to MP4 (H.264/AAC), which has the widest browser compatibility.

---

## Security Settings

### Passkeys (WebAuthn)

Voyarr supports passwordless authentication using WebAuthn passkeys. You can register biometric or hardware security keys from the Account Security page.

**Setup wizard improvements:** When adding a new passkey, the setup wizard now automatically pre-fills the **Website Address** field with your current hostname (`window.location.hostname`), so you rarely need to change it. On desktop and tablet screens, the wizard expands to a wider two-column layout — Display Name and Website Address on the top row, with remaining fields arranged in a grid below — making the form easier to complete at a glance.

### SSO Providers

Link your Google, GitHub, or Discord account for fast login access. Configure OAuth applications in each provider's developer portal and add the credentials to your `.env` file.

### OpenID Connect (OIDC)

Connect Voyarr to any OIDC-compliant identity provider (Keycloak, Authentik, Azure AD, Okta). Users are auto-provisioned on first login.

### Trusted Subnet Bypass

Skip the login screen for users connecting from trusted local networks. Configure CIDR ranges in the Account Security settings.

## User Roles

Three roles are available:

- **Admin**: Full access to all features and settings.
- **User**: Can browse the library, manage downloads, and use features. Cannot access admin settings.
- **Viewer**: Read-only access to the library. Cannot modify settings or trigger downloads.

## File Naming and Organization

Voyarr can automatically rename files based on configurable naming schemes. The reverse regex matching engine scans your media folder and extracts metadata (title, performers, resolution) from existing filenames.

Configure naming patterns in **Settings > File Naming**.
