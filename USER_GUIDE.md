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

## Security Settings

### Passkeys (WebAuthn)

Voyarr supports passwordless authentication using WebAuthn passkeys. You can register biometric or hardware security keys from the Account Security page.

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
