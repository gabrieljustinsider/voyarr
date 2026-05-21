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

#### 📂 Choosing Where System Data Lives (Root Settings Folder)
Voyarr needs a place to store its own system configurations, settings, and database. You can choose **any folder** on your NAS or server to act as the root path for these system files. 

For example, you might choose:
* **Option A (Default)**: `/volume1/docker/voyarr/` (If you keep all Docker apps on Volume 1)
* **Option B (Custom Volume)**: `/volume2/appdata/voyarr/` (If you have a separate fast SSD storage pool on Volume 2)

Once you decide on this root directory, open **File Station** on your NAS and create the following two folders inside it:
* 📁 **`config`** (This stores your app settings, custom recipes, and logged-in website sessions)
* 📁 **`db-data`** (This stores the database file containing your library lists, rules, and download queues)

---

#### 🎬 Using Your Existing Media Folders (No need to create new ones!)
You **do not** need to create a new folder for your media if you already have one! If you have an existing directory where you store your videos, movies, or downloaded files, Voyarr can plug directly into it. 

* **How it works**: Simply find the path of your existing folder and tell Voyarr where to look. It will read and write downloads directly inside your existing folders, saving you from copying or moving any files.
* **Examples of Existing Paths**:
  * If your videos are in the default Synology video shared folder: `/volume1/video`
  * If you have a custom media shared folder on a second drive: `/volume2/my_adult_library`
  * If you keep downloads in a generic downloads folder: `/volume1/downloads/completed`

You will specify this path in the `.env` file in the next step.

### 2. Configure Your Environment Variables
Copy the provided `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Open `.env` and configure the following parameters:

* **Paths**: Tell Voyarr where your folders are located on your NAS:
  ```env
  # 1. Point this to the config folder you created inside your chosen root path
  CONFIG_ROOT=/volume1/docker/voyarr/config
  
  # 2. Point this to the db-data folder you created inside your chosen root path
  DB_DATA_PATH=/volume1/docker/voyarr/db-data
  
  # 3. Point this to your existing media folder (e.g. /volume1/video)
  MEDIA_ROOT_1=/volume1/video
  ```

  > [!NOTE]
  > **Why are there multiple media variables?**
  > * **`MEDIA_ROOT_1` (Host Path)**: This is where your actual files live on your NAS. Voyarr mounts this host folder inside the container so it can access it.
  > * **`MEDIA_ROOT` (Inside-Container Scanner Path)**: This tells the backend app *inside the container* where to look for media. By default, it is set to `/media/storage` (which corresponds to `MEDIA_ROOT_1` inside the container).
  > * **Multi-Drive Setup (Advanced)**: If your media library is spread across multiple drives, you can configure additional folders using `MEDIA_ROOT_2` and `MEDIA_ROOT_3`, and then tell the scanner to look at all of them by listing their internal mounts as a comma-separated list in `MEDIA_ROOT` (e.g., `MEDIA_ROOT=/media/storage,/media/storage_alt1`). For 95% of users with a single drive, you can completely ignore `MEDIA_ROOT_2`, `MEDIA_ROOT_3`, and `MEDIA_ROOT`!
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
