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
27. ~~**HLS Direct Streaming Support (v1.12.0):** Added direct HLS slicing to the transcoding engine, allowing lag-free, high-bitrate video streaming inside the PWA browser environment.~~
28. ~~**Peer-to-Peer (P2P) Library & Recipe Syncing (v1.12.0+):** Full peer-to-peer sync engine enabling decentralized recipe and metadata sharing with trusted instances.~~
29. ~~**Relational Studio Database Schema (v1.12.0+):** Replaced flat text studio names with a robust normalized, relational table `studios` mapped across all media index types.~~
30. ~~**Bulk Duplicate Detection & Resolution (v1.12.0+):** Batch perceptual hash merge manager with automated resolution algorithms (highest quality, oldest, newest).~~
31. ~~**Customizable Network Settings & VPN Sidecar Integration (v1.12.0+):** Full support for global HTTP/HTTPS/SOCKS5 proxies, custom outbound User-Agents, active diagnostic scorecards, secure Vault credential storage, and turnkey Gluetun VPN container definitions.~~
32. ~~**Secure Random User IDs, Passkeys (WebAuthn) & SSO Provider Linking (v1.13.0):** Complete migration to secure non-enumerable string User IDs (prefixed with "usr_"), enterprise-grade passwordless passkeys (WebAuthn) with CRUD features, AAGUID mapping, reverse-geocoded location auditing, external SSO Google/GitHub/Discord integration, and WebAuthn Conditional UI (autofill mediation) support.~~
33. ~~**Security Hardening, Celery Propagation, Test DB Redirection & Meta Quest VR Support (v1.13.0+):** Implemented strict backup signature validation checking to block unauthorized database updates, propagated background Celery task failures up to the task orchestrator, isolated internal subnet proxies during remote synchronizations (SSRF protection), introduced a centralized Pytest conftest interceptor redirecting all test databases to the system temporary folder to keep the root directory pristine, and added full companion mapping support for the Meta Quest Browser and mobile platforms using a new Universal Bookmarklet Companion with visual point-and-click overlays, local config persistence, and direct backend API integrations.~~

---

## **⚙️ Specialized System Specifications (v1.12.0+)**

### **1. Peer-to-Peer (P2P) Syncing Engine Architecture**

The P2P Synchronization System enables multiple remote instances of Voyarr to exchange scraper recipes and library metadata lists securely without any centralized cloud database.

#### **A. Database Models & Schema**
- **`peer_nodes`**: Defines peer connections.
  - `name`: Unique name identifier.
  - `peer_url`: Endpoint of the remote host.
  - `inbound_token`: Token that the remote peer must supply to call this node's API.
  - `outbound_key`: Token that this node transmits to authorize requests sent to the remote peer.
  - `recipe_sync_mode`: `auto_merge` (directly merges new selectors) or `manual_review` (stages recipes in manual approval queue).
  - `sync_schedule`: Cron schedule configuration (e.g., `*/30 * * * *` or `manual`).
  - `library_scope`: `all_entries` or `specific_providers`.
  - `allowed_providers`: JSON array of provider IDs permitted to sync.
- **`peer_sync_logs`**: Tracks histories, statuses, directions, and volume of data synced.

#### **B. API Gateway & Inbound Authentication Router (`/p2p`)**
All inbound requests are handled securely under the `/p2p` prefix using a custom FastAPI dependency:
- **Authentication**: Checks the request headers for `x-api-key` or `X-P2P-Token`. Validates headers against registered `inbound_token` hashes in the `peer_nodes` registry.
- **Endpoints**:
  - `GET /p2p/ping`: Verifies connection and returns online status and peer configuration.
  - `GET /p2p/recipes/pull`: Returns local site recipe JSON payloads to the caller.
  - `POST /p2p/recipes/push`: Accepts incoming site recipes. If configured in `manual_review` mode, stores incoming recipes inside the `p2p_proposed_recipes` setting registry for approval.
  - `POST /p2p/library/reconcile`: Reconciles remote media entries. Updates watched status, actor metadata, ratings, and tag classifications based on matched perceptual hashes (`phash`) or OSHASH values.

#### **C. Celery Background Tasks & Schedulers**
- **`tasks.p2p_tasks.sync_with_peer_task(peer_id)`**: Runs a full two-way sync loop (ping remote, pull recipes, auto-merge or stage proposed recipes, push local recipes, and reconcile libraries).
- **`tasks.p2p_tasks.p2p_sync_scheduler`**: Triggered every minute via Celery Beat. It evaluates cron schedules for all active peer nodes and dispatches background synchronization workers automatically.

---

### **2. Relational Studio Model**

To support normalized analytics, search mappings, and prevent typo corruption, flat `studio` text columns have been fully normalized into a relational structure:
- **`studios`**: Relational lookup table storing unique studios, descriptions, metadata urls, and parent associations.
- **Foreign Key Integration**: `studio_id` mapping column introduced across:
  - `media_entries`
  - `library_entries`
  - `custom_lists`
- **Integrity**: Cascades set to `SET NULL` on deletion to ensure media assets remain intact.

---

### **3. Bulk Duplicate Resolution Engine**

Perceptual video hashes (`phash`) are processed by Celery using FFmpeg. When matching files exhibit visual similarity scores exceeding a user-defined threshold, they are flagged in `duplicate_entries`.
The **Bulk Duplicate Resolver** reconciles multiple duplicate conflicts programmatically:
- **Conflict Resolution Algorithms**:
  - `KEEP_HIGHEST_QUALITY`: Identifies and keeps the file with the highest resolution/bitrate. Merges all metadata, performer tags, custom list associations, and viewing metrics to the preserved file before deleting the lower-quality copy from disk.
  - `KEEP_OLDEST`: Retains the first indexed file and disposes of subsequent copies.
  - `KEEP_NEWEST`: Retains the most recently indexed file.

---

### **4. Customizable Network & VPN Integration Engine**

To prevent scraper blocks, protect local hosts from ISP inspection, and bypass geo-restrictions, Voyarr implements a hot-reloadable network proxy, user-agent manager, and off-the-shelf containerized VPN sidecar:
- **Hot-Reloadable Core Loader**: Resolves global proxy switches, retrieves and decrypts sensitive SOCKS5/HTTP credentials from the secure `Vault`, and dynamically maps variables inside the FastAPI and Celery processes without container restarts.
- **Interactive Routing Diagnostics**: A live, multi-service routing check sequentially verifying exit node latencies, public outbound exit IPs, and active proxy health scores to provide instant scorecard feedback in the Settings UI.
- **Turnkey VPN Sidecars**: Integrates with Gluetun, routing all scraping requests (Python and Playwright Chromium contexts) and download daemons through an isolated VPN namespace.

---

### **5. Secure Identity & Passkeys (WebAuthn) Architecture (v1.13.0)**

Voyarr v1.13.0 implements enterprise-grade passwordless authentication, third-party identity synchronization, and secure non-enumerable User IDs:
- **Secure String User IDs**: Replaced all sequential auto-incrementing integer keys (`1`, `2`, `3`) with cryptographically secure, randomly generated UUIDs prefixed with `"usr_"` (e.g., `usr_5d78a9c...`). This completely eliminates User scanning, horizontal privilege scanning, and account enumeration vulnerabilities.
- **Passkeys (WebAuthn) CRUD Lifecycle**:
  - Uses standard browser `navigator.credentials.create()` for registering biometric/security keys and `navigator.credentials.get()` for assertions.
  - **AAGUID Metadata Badge Scoring**: Fully scans the attestation binary blocks during registration to parse the AAGUID, mapping it to specific device vendor brands (Apple iCloud Keychain, Google Password Manager, Windows Hello, YubiKey 5 NFC) and rendering authentic brand icons in the UI.
  - **IP and Geo Auditing**: Logs registration/usage timestamps, IPv4 addresses, and performs offline IP-to-location geocoding (e.g., "Chicago, IL, USA") to record session access footprints.
  - **Inline Renaming**: Allows inline, double-click name editing and credentials revocation within the Settings panel.
- **SSO Provider Fast-Access Linking**: Integrates Google, GitHub, and Discord OAuth fast-access logins. Incorporates account lockout checks that reject unlinking requests if the provider represents the user's last remaining authentication credential.
- **WebAuthn Conditional UI (Autofill Integration)**: Features native browser autocomplete integration using `autoComplete="username webauthn"`. An async mount listener schedules conditional mediation queries via `navigator.credentials.get({ publicKey: options, mediation: "conditional", signal })`, allowing instantaneous biometric logins directly from the username input dropdown without clicking button prompts.
- **Autofill Collision Guards**: Uses persistent React `AbortController` references to terminate outstanding conditional autofill listeners before dispatching explicit manual security challenges, bypassing native selector crashes.

---

## **🚀 Future Feature Roadmap (v1.13.0+)**

The following represents identified feature targets and upcoming components for subsequent releases.

### **1. Real-time Multi-Instance Clustering**
*   **Description:** Allow remote instances to act as hot-failover mirrors, sharing storage allocations and active Celery task queues in real-time.

### **2. Third-Party & User-Created Extensions**
*   **Description:** Add support for third-party and user-created extensions to allow community contributions and custom integrations.

### **3. Distributed Worker Nodes & Add-ons**
*   **Description:** Add node support and a specialized add-on to allow external devices to process intensive tasks (like transcoding or scraping) and report results back to the primary device.