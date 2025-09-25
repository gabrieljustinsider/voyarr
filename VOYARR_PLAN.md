# **Voyarr: Technical Specification & Implementation Plan**

## **🚀 Overview**

**Voyarr** is a self-hosted (Docker/Self-Hosted) media management ecosystem designed to handle subscriptions, metadata scraping, and automated downloads from adult websites. It integrates with **Stash**, **StashDB**, and **ThePornDB**, featuring a remote-control browser extension for dynamic metadata mapping.

## **🏗️ System Architecture**

* **Frontend:** React/Vue PWA (No native browser alerts; custom toasts/modals only).  
* **Backend:** Python (FastAPI) running in Docker.  
* **Database:** PostgreSQL (Relational metadata and history tracking).  
* **Integration:** Stash Plugin \+ Browser Extension (Manifest v3).  
* **Security:** AES-256-GCM encryption for credentials using a RAM-only Master Key.

## **🗄️ Database Schema (PostgreSQL)**

The database consists of 22 fully-integrated relational tables handling authentication, scraper templates, credential vaults, media indexing, and job queues:

| Table | Purpose |
| :---- | :---- |
| **users** | Handles multi-user Role-Based Access Control (RBAC) credentials and system states. |
| **providers** | Defines provider domains, scraping configurations, separators, and default download limits. |
| **site_recipes** | Holds visual CSS, XPath, and Regex selectors mapped via the "Map Mode" browser extension. |
| **vault** | Secure AES-256-GCM encrypted key-value store for credential secrets (passwords, session cookies). |
| **credentials** | Maps external credential sync sources (manual, 1Password Connect, Bitwarden CLI REST) and custom limits. |
| **media_entries** | Relational metadata index storing scraped titles, performers, tags, and original site references. |
| **settings** | Application key-value global system variables and preferences. |
| **local_files** | Tracks local storage paths, file sizes, resolutions, and media entry mapping status. |
| **download_queue** | Active Celery download worker queues containing progress meters, speeds, file sizes, and retry tracking. |
| **custom_lists** | User-defined categorized arrays of performers, categories, or tags used in rule logic. |
| **download_rules** | Custom automated rule engines mapping visual and metadata criteria to download, skip, or queue actions. |
| **library_entries** | Primary indices of physical files, storing titles, durations, ohash, visual phash, and comprehensive metadata. |
| **video_chapters** | Stores time-indexed chapter boundaries, titles, and sub-tags within local library videos. |
| **duplicate_entries** | Tracks duplicate detections by comparing perceptual visual hashes and scoring similarity percentages. |
| **download_preferences** | Granular preferences per provider including target resolutions, auto-tagging, and multdrive paths. |
| **metadata_cache** | Scraped entity cache for external databases (ThePornDB / StashDB) to reduce API overhead. |
| **scrape_schedules** | Handles cron-driven automated tasks for scanning folders or running periodic site-wide channel rips. |
| **session_cookies** | Manages browser cookie text pools, download rate metrics, and validation limits. |
| **api_keys** | Hashed API tokens for external integrations such as third-party APIs and the Discord Bot backend. |
| **transcoding_queue** | Tracks background FFmpeg transcoding tasks (status, target codecs e.g., H.265, progress, details). |
| **webhooks** | Manages outbound webhooks triggered by library, transcode, and download lifecycle events. |
| **media_requests** | Internal media requests portal allowing restricted users to submit requests for admin approval. |

## **🏷️ Naming & File Management**

* **Interactive Builder:** Users select objects (e.g., \[Studio\], \[Date\], \[Title\], \[Resolution\]) to define patterns.  
* **Pattern Logic:** Custom separators (e.g., \_, ., \-) and space-to-character replacement.  
* **Matching Engine:** Uses ohash (oshash) and Regex reverse-engineering based on naming patterns to identify existing files.  
* **Metadata Tagging:** Directly writing tags (Title, Performers, Year) to video files via FFmpeg/Mutagen.  
* **Path Hierarchy:** Root \-\> Sub-site Folder \-\> File (Default or site-specific overrides).

## **🔍 Core Features**

1. **Scrape-Only Mode:** Harvests metadata and links (thumbnails/trailers) without downloading video.  
2. **Advanced Filtering:** Multi-criteria rules to automate the download of specific content.  
3. **Mass Rip Workflow:** Scrape media list (with metadata progress) → Filter → Match Local → Download/Upgrade.  
4. **Remote Mapping:** Browser extension "Map Mode" to visually pick CSS selectors on a live site to update Regex.  
5. **Quality Upgrade:** Detects if a higher resolution version of a local file is available and offers redownload.  
6. **Progress Indicators:** Inline progress bars with percentage, current size, and total size for all measurable tasks.

## **🔗 Integrations**

* **ThePornDB / StashDB:** Sync metadata and contribute ohash/phash.  
* **1Password & Bitwarden:** Securely synchronize credentials from your external password managers.
* **Stash Plugin:** Custom scraper for Stash that uses **Voyarr** as a high-quality metadata source.  
* **Browser Extension:** Remote control for Voyarr, progress monitor, and dynamic regex mapper.

## **🐳 Docker Configuration (docker-compose.yml)**

services:  
  db:  
    image: postgres:15-alpine  
    container\_name: voyarr-db  
    volumes:  
      \- ./db/data:/var/lib/postgresql/data  
  backend:  
    image: ghcr.io/gabrieljustinsider/voyarr-backend:latest
    environment:
      \- MEDIA_ROOT=/media/drive1,/media/drive2
    volumes:  
      \- /mnt/host/drive1:/media/drive1
      \- /mnt/host/drive2:/media/drive2
  frontend:  
    image: ghcr.io/gabrieljustinsider/voyarr-frontend:latest

## **🛤️ Roadmap & GitHub Integration**

* **Repo:** [gabrieljustinsider/voyarr](https://github.com/gabrieljustinsider/voyarr)  
* **Project Board:** [Voyarr Board \#1](https://github.com/users/gabrieljustinsider/projects/1)  
* **Automation:** GitHub Actions to sync issues/PRs to the board and handle Docker builds.

## **✅ Completed Milestones**

1. ~~**Initialize Git:** Push .gitignore, .env.example, and init.sql.~~
2. ~~**Backend Foundation:** Define the ProviderBase Python class for modular scraping.~~
3. ~~**API Skeleton:** Build FastAPI routes for credential management and progress streaming.~~
4. ~~**Robust Task Queue (Celery / Redis):** Replace FastAPI BackgroundTasks with Celery.~~
5. ~~**Reverse Regex Matching Engine:** Implement logic to scan the `/media` folder and reverse-engineer local files.~~
6. ~~**Mass Rip & Quality Upgrade Workflow:** Build the Mass Rip API to queue videos and detect local resolutions.~~
7. ~~**True Perceptual Hashing (phash):** Implement actual video phash generation via FFmpeg.~~
8. ~~**Browser Extension "Map Mode" UI:** Build the UI/Content Script for the Chrome extension.~~
9. ~~**PWA Compatibility:** Configure Vite with `vite-plugin-pwa` to build the app as an installable PWA.~~
10. ~~**Automated Transcoding Pipeline:** Integrate background FFmpeg tasks via Celery to transcode large files.~~
11. ~~**Multi-User & Role-Based Access Control (RBAC):** Introduce a multi-user environment and JWT tokens.~~
12. ~~**AI-Powered Auto-Tagging:** Integrate local Vision models or lightweight LLMs to automatically identify performers, tags, or categorize content.~~
13. ~~**Distributed Worker Nodes:** Expand the Celery architecture to support remote worker nodes across multiple machines.~~
14. ~~**Webhooks & Notification Ecosystem:** Build outbound webhooks to trigger events in other home lab applications.~~
15. ~~**Scheduled & Off-Peak Tasks:** Enhance the transcoding and download pipelines to run during user-defined off-peak hours.~~
16. ~~**Multi-Drive Storage Arrays:** Support parsing comma-separated paths for scalable libraries spanning multiple physical disks.~~
17. ~~**Password Manager Integrations:** Support for 1Password Connect and Bitwarden CLI REST APIs.~~
18. ~~**Hardened SSRF Defenses:** Comprehensive internal IP/hostname blocking for scraper proxies.~~
19. ~~**Deep API Integrations (v1.8.1):** Rich StashDB/ThePornDB GraphQL search, matching, and fingerprint (MD5/OSHASH/PHASH) submissions.~~
20. ~~**Discord Slash Commands Bot (v1.8.2):** Integrated `/search`, `/add` to queue, and `/scrape` remote triggers.~~
21. ~~**Visual Quota & Performance Meters (v1.8.2):** Advanced responsive charts mapping active rate limits.~~
22. ~~**WebSocket Live Log Pipeline (v1.8.3):** Real-time logs streams with advanced searching, filtering, and channel toggling.~~
23. ~~**Performer Facial Recognition Clustering (v1.11.0):** Implement DBSCAN-based local lightweight facial recognition & groupings to auto-identify unknown actors across the library.~~
24. ~~**Continuous StashDB Fingerprint Syncing (v1.11.0):** Automated background daemon to continuously push calculated hashes (OSHASH/PHASH) to community databases to improve global coverage.~~
25. ~~**AI-Driven Auto-Chaptering (v1.11.0):** Frame-based scene change detection paired with LLM/Ollama or OpenAI GPT-4o Vision to auto-slice and title video segments.~~
26. ~~**Granular Queue Priority & Controls (v1.11.0):** Integrated full pause, resume, cancel, and priority level adjustments for download, transcoding, and live recording queues.~~

---

## **🚀 Future Feature Roadmap (v1.12.0+)**

The following represents identified feature targets and upcoming components for subsequent releases.

### **1. HLS Direct Streaming Support**
*   **Description:** Add direct HLS slicing to the transcoding engine, allowing lag-free, high-bitrate video streaming inside the PWA browser environment.

### **2. Peer-to-Peer (P2P) Library Syncing**
*   **Description:** Support decentralized syncing of scraper recipes and library metadata lists directly with trusted peer nodes over secure tunnels.