# Voyarr

**Voyarr** is a self-hosted media management ecosystem designed to handle subscriptions, metadata scraping, and automated downloads from adult websites. It integrates with **Stash**, **StashDB**, and **ThePornDB**, featuring a remote-control browser extension for dynamic metadata mapping.

## 🚀 Overview

Voyarr automates the tedious parts of managing a local media library. From automatically queueing videos based on performer rules to upgrading existing files when a higher resolution becomes available, Voyarr is your automated media assistant.

## 🏗️ System Architecture

* **Frontend:** React PWA with Material UI, offering an installable, app-like experience.
* **Backend:** Python (FastAPI) handling API requests.
* **Task Queue:** Celery backed by Redis for robust, persistent download task management (using `yt-dlp`).
* **Database:** PostgreSQL for relational metadata, local file tracking, and rule management.
* **Integrations:** Stash Plugin + Browser Extension (Manifest V3) + DeoVR / XR Players.
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
10. **VR & XR Compatibility:** Native DeoVR JSON API support for streaming 180°/360° VR content directly to your headset.

## 🐳 Docker Configuration

Voyarr is designed to be run via Docker Compose. The stack includes:
* `db`: PostgreSQL 15 database.
* `redis`: Redis 7 for the Celery message broker.
* `backend`: FastAPI Python application.
* `celery_worker`: Background task worker for downloads and heavy processing.
* `frontend`: Vite-powered React PWA served on port 3000.

## ⚙️ Initial Setup

1. Copy the provided `.env.example` file to `.env` and fill in your values:

```bash
cp .env.example .env
```

Update any required secrets (e.g., `MASTER_KEY`) and API keys.

2. Start the stack (using pre-built production images):

```bash
docker compose up -d
```

3. Access the services:

- **Frontend:** `http://localhost:3000` (Installable as a PWA)
- **Backend API:** `http://localhost:8000`
- **FastAPI docs:** `http://localhost:8000/docs`

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
