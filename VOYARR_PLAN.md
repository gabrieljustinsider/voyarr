# **Voyarr: Technical Specification & Implementation Plan**

## **🚀 Overview**

**Voyarr** is a self-hosted (Docker/Self-Hosted) media management ecosystem designed to handle subscriptions, metadata scraping, and automated downloads from adult websites. It integrates with **Stash**, **StashDB**, and **ThePornDB**, featuring a remote-control browser extension for dynamic metadata mapping.

## **🏗️ System Architecture**

* **Frontend:** React/Vue PWA (No native browser alerts; custom toasts/modals only).  
* **Backend:** Python (FastAPI) running in Docker.  
* **Database:** PostgreSQL (Relational metadata and history tracking).  
* **Integration:** Stash Plugin \+ Browser Extension (Manifest v3) \+ DeoVR/XR API.  
* **Security:** AES-256-GCM encryption for credentials using a RAM-only Master Key.

## **🗄️ Database Schema (PostgreSQL)**

| Table | Purpose |
| :---- | :---- |
| providers | Base URLs, Naming Patterns, Separator settings, Space replacement logic. |
| site\_recipes | CSS/XPath/Regex selectors for dynamic site scraping and "Map Mode" data. |
| credentials | Encrypted logins for automated authentication (AES-256-GCM). |
| media\_entries | Metadata (Title, Performers, Tags), ohash, phash, and site IDs. |
| local\_files | Tracks physical storage paths, file sizes, and matching resolution status. |
| download\_queue | Real-time progress percentage, file size, speed, and retry status. |
| filters | Multi-criteria rules (Performers, Categories, Resolution) for auto-queueing. |

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
7. **XR & VR Support:** Native DeoVR JSON API and metadata tags to stream 180°/360° videos directly to XR headsets.

## **🔗 Integrations**

* **ThePornDB / StashDB:** Sync metadata and contribute ohash/phash.  
* **1Password & Bitwarden:** Securely synchronize credentials from your external password managers.
* **Stash Plugin:** Custom scraper for Stash that uses **Voyarr** as a high-quality metadata source.  
* **Browser Extension:** Remote control for Voyarr, progress monitor, and dynamic regex mapper.
* **DeoVR & XR Players:** Native JSON API endpoint to serve media libraries directly to DeoVR and other compatible VR players.

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

## **🚀 Post-v1.8.0 Feature Backlog**

The following items represent identified feature gaps and unfinished components discovered during the v1.8.0 system audit.

### **1. AI-Powered Auto-Tagging (Placeholder Only)**
*   **Status:** Milestone 12 is marked as complete, but `backend/tasks/ai_tasks.py` contains only a functional placeholder.
*   **Gap:** It logs "Running AI inference" and returns hardcoded tags (`["AI-Tagged", "Processed"]`). It lacks actual integration with local vision models (CLIP/LLaVA) or LLM providers for true content categorization.

### **2. Deep API Integrations (ThePornDB & StashDB)**
Significant feature gaps exist in the metadata synchronization layers:
*   **ThePornDB (#10):** Missing rich performer biographies, actor-specific search, and support for the more efficient GraphQL endpoint.
*   **StashDB (#11):** Lacks deterministic matching using **Fingerprints** (MD5/OSHASH/PHASH). Also missing the ability to "submit" local hashes and metadata edits back to the StashDB community via GraphQL mutations.

### **3. Discord Bot Expansion (#6)**
*   **Status:** Minimal implementation.
*   **Gap:** The bot currently only supports the `/request` command. Full requirements include library searching, adding new items, and "Scrape CRUD" operations directly via Discord Slash Commands.

### ~~**4. Dashboard & Quota Visualization (#9)**~~
*   **Status:** Complete.
*   **Gap:** Visual meters for quota usage are now integrated into the Dashboard and Provider list components.

### **5. WebSocket Log Streaming Enhancements (#2)**
*   **Status:** Functional but basic.
*   **Gap:** The logic in `backend/routers/logs.py` lacks real-time filtering (log levels), keyword searching, or the ability to toggle between different log sources (Celery vs. FastAPI).

---

### **Summary of Pending Work**

| Feature | State | Missing Component |
| :--- | :--- | :--- |
| **AI Tagging** | ⚠️ Placeholder | Local/API Model integration |
| **Fingerprints** | ❌ Missing | MD5/PHASH matching & submission |
| **Discord Bot** | ⚠️ Minimal | Search/Manage library commands |
| **Quota Meters** | ✅ Complete | Visual usage charts/meters added |
| **Biographies** | ❌ Missing | Performer profile & social sync |