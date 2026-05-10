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

## **🔗 Integrations**

* **ThePornDB / StashDB:** Sync metadata and contribute ohash/phash.  
* **Stash Plugin:** Custom scraper for Stash that uses **Voyarr** as a high-quality metadata source.  
* **Browser Extension:** Remote control for Voyarr, progress monitor, and dynamic regex mapper.

## **🐳 Docker Configuration (docker-compose.yml)**

services:  
  db:  
    image: postgres:15-alpine  
    container\_name: voyarr-db  
    volumes:  
      \- voyarr\_db\_data:/var/lib/postgresql/data  
  backend:  
    image: voyarr-api \# Python FastAPI  
    volumes:  
      \- ${MEDIA\_ROOT}:/media/storage  
      \- ./backend:/app  
  frontend:  
    image: voyarr-ui \# PWA

## **🛤️ Roadmap & GitHub Integration**

* **Repo:** [gabrieljustinsider/voyarr](https://github.com/gabrieljustinsider/voyarr)  
* **Project Board:** [Voyarr Board \#1](https://github.com/users/gabrieljustinsider/projects/1)  
* **Automation:** GitHub Actions to sync issues/PRs to the board and handle Docker builds.

## **📋 Next Steps**

1. **Initialize Git:** Push .gitignore, .env.example, and init.sql.  
2. **Backend Foundation:** Define the ProviderBase Python class for modular scraping.  
3. **API Skeleton:** Build FastAPI routes for credential management and progress streaming.
4. **Robust Task Queue (Celery / Redis):** Replace FastAPI BackgroundTasks with Celery (backed by Redis or RabbitMQ) for pausing, resuming, and persistently tracking long-running yt-dlp download tasks.
5. **Reverse Regex Matching Engine:** Implement logic to scan the /media folder and reverse-engineer local files into the database based on naming patterns (e.g., {title}_{performers}_{resolution}.mp4) without hitting external APIs.
6. **Mass Rip & Quality Upgrade Workflow:** Build the Mass Rip API to parse channel/performer pages, evaluate DownloadRules, queue videos, and detect/upgrade local resolutions automatically.
7. **True Perceptual Hashing (phash):** Implement actual video phash generation by capturing frames via FFmpeg/OpenCV, converting to grayscale, and calculating DCT for visual similarity matching.
8. **Browser Extension "Map Mode" UI:** Build the UI/Content Script for the Chrome extension (manifest v3) with a DOM-picker tool to generate CSS Selectors and push them to the SiteRecipe table.
9. **PWA Compatibility:** Configure Vite with `vite-plugin-pwa` to build the app as an installable Progressive Web App, including manifest, icons, and service worker registration.