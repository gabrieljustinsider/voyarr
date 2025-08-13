# Voyarr

**Voyarr** is a self-hosted media management ecosystem designed to handle subscriptions, metadata scraping, and automated downloads from adult websites. It integrates with **Stash**, **StashDB**, and **ThePornDB**, featuring a remote-control browser extension for dynamic metadata mapping.

## 🚀 Overview

Voyarr automates the tedious parts of managing a local media library. From automatically queueing videos based on performer rules to upgrading existing files when a higher resolution becomes available, Voyarr is your automated media assistant.

## 🏗️ System Architecture

* **Frontend:** React PWA with Material UI, offering an installable, app-like experience.
* **Backend:** Python (FastAPI) handling API requests.
* **Task Queue:** Celery backed by Redis for robust, persistent download task management (using `yt-dlp`).
* **Database:** PostgreSQL for relational metadata, local file tracking, and rule management.
* **Integrations:** Stash Plugin + Browser Extension (Manifest V3).
* **Credential Sync:** Native 1Password Connect and Bitwarden CLI REST integrations.
* **Security:** AES-256-GCM encryption for credentials using a RAM-only Master Key.

## 🔍 Core Features

1. **Robust Task Queue:** Uses Celery and Redis to track long-running downloads. Supports pause/resume and persists through container restarts.
2. **Advanced Filtering & Rules:** Set multi-criteria rules (Performers, Categories, Resolution) to automate the queueing of specific content.
3. **Mass Rip Workflow:** Provide a channel/performer URL to automatically scrape all videos, evaluate them against your rules, and queue them.
4. **Quality Upgrade:** Automatically detects if a queued video is a higher resolution (e.g., 4K) than a local file (e.g., 1080p) and upgrades it.
5. **Reverse Regex Matching Engine:** Scans your `/media` folder and automatically extracts metadata (Title, Performers, Resolution) from existing files based on configurable naming patterns.
6. **True Perceptual Hashing (phash):** Uses FFmpeg to extract frames and calculates DCT visual hashes to detect visually similar or duplicate videos.
7. **Multi-Drive Storage:** Spread your library across multiple hard drives seamlessly using comma-separated Docker volume mappings.
8. **Multi-User RBAC:** Create restricted user accounts for friends and family without exposing your Master Key or admin privileges.
9. **Remote Mapping Extension:** A Chrome browser extension with a "Map Mode" UI allowing you to click on elements on live websites to generate CSS selectors for site scraping recipes.
10. **Discord Bot Portal:** Remotely trigger Celery scrape tasks, search the library, and add downloads directly via Discord Slash Commands.
11. **Automated Transcoding Engine:** Run background FFmpeg pipelines to convert video libraries to lightweight codecs (e.g. H.265) and set target resolutions.
12. **Outbound Webhooks & Notifications:** Send real-time notifications to external endpoints for downloads, scans, and transcode completions.
13. **Cron Scrape Schedules:** Schedule automated periodic channel scans and page rips via custom cron-expression schedules.
14. **System Backup & Recovery:** Export complete PostgreSQL schema records and media metadata configurations.
15. **Media Requests Portal:** Allow standard or guest users to request downloads via a centralized portal with admin approval queues.
16. **Video Chapters:** Generate, browse, and edit time-indexed chapter boundaries with sub-tag descriptors directly in the local library.

## 🐳 Docker Configuration

Voyarr is designed to be run via Docker Compose. The stack includes:
* `db`: PostgreSQL 15 database.
* `redis`: Redis 7 for the Celery message broker.
* `backend`: FastAPI Python application.
* `celery_worker`: Background task worker for downloads and heavy processing.
* `frontend`: Vite-powered React PWA served on port 3000.

## ⚙️ Initial Setup

Voyarr utilizes a **hybrid volume architecture** and **dynamic host port selection** to ensure conflict-free ports and permission-safe storage on self-hosted environments (like Synology NAS, Unraid, or standard Linux servers).

### 1. Pre-create Host Folders (Volume Setup)
To prevent host-side permission errors (like `root:root` locked folder conflicts) and ensure seamless container upgrades, pre-create your config and database directories on your host NAS/server:

1. Create a root project directory (e.g., `/volume1/docker/voyarr/`).
2. Inside it, create the following subdirectories:
   - `config` (For persistent configurations, cookies, and app settings)
   - `db-data` (For PostgreSQL database storage)
   - `media` (For your media libraries, e.g., `/volume1/video/voyarr`)

### 2. Configure Your Environment Variables
Copy the provided `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Open `.env` and configure the following parameters:

* **Paths**: Point the path variables directly to the host folders you created in Step 1:
  ```env
  CONFIG_ROOT=/volume1/docker/voyarr/config
  DB_DATA_PATH=/volume1/docker/voyarr/db-data
  MEDIA_ROOT_1=/volume1/docker/voyarr/media
  ```
* **Ports**: Under *Host Ports Configuration*, you have two options:
  - **Auto-Allocation (Recommended)**: Leave `PORT=`, `FRONTEND_PORT=`, `REDIS_PORT=`, and `POSTGRES_PORT=` **blank/empty**.
    * *On Synology (Container Manager)*: Synology will automatically select unused ports on your NAS, **remember them permanently**, and maintain the assignment across restarts and container upgrades.
    * *On CLI*: Docker will assign random ports. Check them via `docker compose ps` and, if desired, add them to your `.env` to lock them in.
  - **Static Allocation**: Specify static ports (e.g., `PORT=8000`, `FRONTEND_PORT=3000`) if you already know they are free.

### 3. Deploy the Stack
Start the services:

```bash
docker compose up -d
```

If you chose Auto-Allocation, run `docker compose ps` to inspect your dynamically assigned frontend and backend API host ports.

### 4. Access the Services
Navigate to your assigned frontend host port (e.g., `http://<your-ip>:<assigned-port>`). The React PWA can be installed directly onto your device.

### 🔐 User & Admin Bootstrapping

Voyarr features a secure, multi-user environment with Role-Based Access Control (RBAC):

1. **Bootstrap the Admin Account**: Upon fresh installation (when no users exist in the database), navigate to the web login screen and register. The very first user account created is **automatically** granted the `"admin"` role to prevent system lockout.
2. **Lockout Prevention**: Once this first administrator account is created, public registration is **immediately disabled**.
3. **Registering Subsequent Users**: To register a new user after the admin is configured, the registration request must be:
   - Approved and triggered by an existing Admin (sent from within the authenticated Admin dashboard/client).
   - Alternatively, authorized by including the `MASTER_KEY` secret (configured in your `.env` file) as an HTTP header: `X-Voyarr-Api-Key: <your_master_key>`.

## 🧩 Browser Extension Setup

To use the "Map Mode" for visual scraping configuration:
1. Open Google Chrome or a Chromium-based browser.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `/extension` directory in this repository.
5. You can now use the extension to map CSS selectors on supported websites.

## 🏷️ Versioning

We use SemVer for versioning. Given a version number MAJOR.MINOR.PATCH, we increment the MAJOR version for incompatible API changes, MINOR for backwards-compatible functionality, and PATCH for backwards-compatible bug fixes.
For the versions available, see the tags on this repository.

## ⚖️ Legal & Privacy

By using Voyarr, you agree to our terms and understand our privacy practices as a self-hosted software:
* [Terms of Service](TERMS_OF_SERVICE.md)
* [Privacy Policy](PRIVACY_POLICY.md)

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
