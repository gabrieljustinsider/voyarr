# **Jizzarr: Technical Specification & Implementation Plan**

## **🚀 Overview**

**Jizzarr** is a self-hosted (Docker/NAS) media management ecosystem designed to handle subscriptions, metadata scraping, and automated downloads from adult websites. It integrates with **Stash**, **StashDB**, and **ThePornDB**, featuring a remote-control browser extension for dynamic metadata mapping.

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
| local\_files | Tracks physical NAS paths, file sizes, and matching resolution status. |
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
* **Stash Plugin:** Custom scraper for Stash that uses **Jizzarr** as a high-quality metadata source.  
* **Browser Extension:** Remote control for Jizzarr, progress monitor, and dynamic regex mapper.

## **🐳 Docker Configuration (docker-compose.yml)**

services:  
  db:  
    image: postgres:15-alpine  
    container\_name: jizzarr-db  
    volumes:  
      \- jizzarr\_db\_data:/var/lib/postgresql/data  
  backend:  
    image: jizzarr-api \# Python FastAPI  
    volumes:  
      \- ${NAS\_MEDIA\_ROOT}:/media/nas  
      \- ./backend:/app  
  frontend:  
    image: jizzarr-ui \# PWA

## **🛤️ Roadmap & GitHub Integration**

* **Repo:** [gabrieljustinsider/jizzarr](https://github.com/gabrieljustinsider/jizzarr)  
* **Project Board:** [Jizzarr Board \#1](https://github.com/users/gabrieljustinsider/projects/1)  
* **Automation:** GitHub Actions to sync issues/PRs to the board and handle Docker builds.

## **📋 Next Steps**

1. **Initialize Git:** Push .gitignore, .env.example, and init.sql.  
2. **Backend Foundation:** Define the ProviderBase Python class for modular scraping.  
3. **API Skeleton:** Build FastAPI routes for credential management and progress streaming.