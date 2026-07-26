# **Voyarr: Technical Specification & Implementation Plan**

## **🚀 Overview**

**Voyarr** is a self-hosted (Docker/Self-Hosted) media player and library management ecosystem designed for your adult video collections. Stream videos directly from your adult video service subscriptions and organize your personal media library all in one place.

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
| **api_keys** | Hashed API tokens for external integrations such as third-party APIs and the Discord Bot backend. |
| **credentials** | Maps external credential sync sources (manual, 1Password Connect, Bitwarden CLI REST) and custom limits. |
| **custom_lists** | User-defined categorized arrays of performers, categories, or tags used in rule logic. |
| **download_preferences** | Granular preferences per provider including target resolutions, auto-tagging, and multdrive paths. |
| **download_queue** | Active Celery download worker queues containing progress meters, speeds, file sizes, and retry tracking. |
| **download_rules** | Custom automated rule engines mapping visual and metadata criteria to download, skip, or queue actions. |
| **duplicate_entries** | Tracks duplicate detections by comparing perceptual visual hashes and scoring similarity percentages. |
| **library_entries** | Primary indices of physical files, storing titles, durations, ohash, visual phash, and comprehensive metadata. |
| **local_files** | Tracks local storage paths, file sizes, resolutions, and media entry mapping status. |
| **media_entries** | Relational metadata index storing scraped titles, performers, tags, and original site references. |
| **media_requests** | Internal media requests portal allowing restricted users to submit requests for admin approval. |
| **metadata_cache** | Scraped entity cache for external databases (ThePornDB / StashDB) to reduce API overhead. |
| **providers** | Defines provider domains, scraping configurations, separators, and default download limits. |
| **scrape_schedules** | Handles cron-driven automated tasks for scanning folders or running periodic site-wide channel rips. |
| **session_cookies** | Manages browser cookie text pools, download rate metrics, and validation limits. |
| **settings** | Application key-value global system variables and preferences. |
| **site_recipes** | Holds visual CSS, XPath, and Regex selectors mapped via the "Map Mode" browser extension. |
| **transcoding_queue** | Tracks background FFmpeg transcoding tasks (status, target codecs e.g., H.265, progress, details). |
| **users** | Handles multi-user Role-Based Access Control (RBAC) credentials and system states. |
| **vault** | Secure AES-256-GCM encrypted key-value store for credential secrets (passwords, session cookies). |
| **video_chapters** | Stores time-indexed chapter boundaries, titles, and sub-tags within local library videos. |
| **webhooks** | Manages outbound webhooks triggered by library, transcode, and download lifecycle events. |

## **🏷️ Naming & File Management**

* **Interactive Builder:** Users select objects (e.g., \[Studio\], \[Date\], \[Title\], \[Resolution\]) to define patterns.  
* **Pattern Logic:** Custom separators (e.g., \_, ., \-) and space-to-character replacement.  
* **Matching Engine:** Uses ohash (oshash) and Regex reverse-engineering based on naming patterns to identify existing files.  
* **Metadata Tagging:** Directly writing tags (Title, Performers, Year) to video files via FFmpeg/Mutagen.  
* **Path Hierarchy:** Root \-> Sub-site Folder \-> File (Default or site-specific overrides).

### **📁 Internal File Storage & Write Paths**
To ensure safe, permission-isolated operations, Voyarr strictly limits where it writes data within the container. All persistent data is routed to specific mapped volumes:

* **`/app/config/`**: System configuration, Custom UI settings, browser cookie sessions, and the **Celery Beat scheduling database** (`celerybeat-schedule`).
* **`/app/backups/`**: Automated background JSON database dumps and manual user exports.
* **`/media/storage/logs/`**: Live application logs from FastAPI and Celery workers (e.g., `celery.log`).
* **`/media/storage/downloads/`** *(default)*: Temporary download caches, active queues, and live stream recording outputs.
* **`/media/storage/...`** *(beside video files)*: Generated metadata sidecars (`.json`), HLS transcoded segments (`.hls/`), and AI Facial Recognition clustering caches (`.faces_*/`).
* **`/tmp/`** *(Ephemeral)*: Ephemeral process PID files and temporary cookie text generation for `yt-dlp` bridging. No persistent data is written here.

## **🔍 Core Features**

1. **Additional Admin Features:** Comprehensive operational toolsets for advanced network proxying, synchronization, and automated media management (strictly restricted via RBAC).
2. **Advanced Filtering:** Multi-criteria rules to automate the organization of specific content.  
3. **Bulk Sync Workflow:** Sync media lists → Filter → Match Local → Organize/Upgrade.  
4. **Remote Mapping:** Browser extension "Map Mode" to visually pick CSS selectors on a live site to update Regex.  
5. **Quality Upgrade:** Detects if a higher resolution version of a local file is available and offers an upgrade.  
6. **Progress Indicators:** Inline progress bars with percentage, current size, and total size for all measurable tasks.

## **🔗 Integrations**

* **ThePornDB / StashDB:** Sync metadata and contribute ohash/phash.  
* **1Password & Bitwarden:** Securely synchronize credentials from your external password managers.
* **Stash Plugin:** Custom scraper for Stash that uses **Voyarr** as a high-quality metadata source.  
* **Browser Extension:** Remote control for Voyarr, progress monitor, and dynamic regex mapper.
* **DeoVR Player:** Native scene feed protocol for VR headset playback (Meta Quest, Apple Vision Pro). Serves a full JSON feed with scene metadata, VR projection detection, multiple encodings, haptic feedback support, and pagination. Supports passwordless authentication via 6-digit pairing codes generated from the desktop Account Security panel.

## **🐳 Docker Configuration**

Voyarr uses modular Compose fragments assembled by `deploy/compose.sh`. For production, use `docker-compose.deploy.yml` (single-file stack) or run `npm run up` (auto-selects fragments based on `.env` targets).

Services are built from GitHub Container Registry images:

```yaml
services:  
  db:  
    image: postgres:15-alpine  
    container\_name: voyarr-db  
    volumes:  
      \- ./db/data:/var/lib/postgresql/data  
  backend:  
    image: ghcr.io/gabrieljustinsider/voyarr-backend:latest
    environment:
      - CONTAINER_MEDIA_PATHS=/media/drive1,/media/drive2
    volumes:  
      \- /mnt/host/drive1:/media/drive1
      \- /mnt/host/drive2:/media/drive2
  frontend:  
    image: ghcr.io/gabrieljustinsider/voyarr-frontend:latest
```

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

To support normalized analytics, search mappings, and prevent typo corruption, studios are modeled in a relational structure:
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
- **Secure String User IDs**: Uses cryptographically secure, randomly generated UUIDs prefixed with `"usr_"` (e.g., `usr_5d78a9c...`). This completely eliminates User scanning, horizontal privilege scanning, and account enumeration vulnerabilities.
- **Passkeys (WebAuthn) CRUD Lifecycle**:
  - Uses standard browser `navigator.credentials.create()` for registering biometric/security keys and `navigator.credentials.get()` for assertions.
  - **AAGUID Metadata Badge Scoring**: Fully scans the attestation binary blocks during registration to parse the AAGUID, mapping it to specific device vendor brands (Apple iCloud Keychain, Google Password Manager, Windows Hello, YubiKey 5 NFC) and rendering authentic brand icons in the UI.
  - **IP and Geo Auditing**: Logs registration/usage timestamps, IPv4 addresses, and performs offline IP-to-location geocoding (e.g., "Chicago, IL, USA") to record session access footprints.
  - **Inline Renaming**: Allows inline, double-click name editing and credentials revocation within the Settings panel.
- **SSO Provider Fast-Access Linking**: Integrates Google, GitHub, and Discord OAuth fast-access logins. Incorporates account lockout checks that reject unlinking requests if the provider represents the user's last remaining authentication credential.
- **WebAuthn Conditional UI (Autofill Integration)**: Features native browser autocomplete integration using `autoComplete="username webauthn"`. An async mount listener schedules conditional mediation queries via `navigator.credentials.get({ publicKey: options, mediation: "conditional", signal })`, allowing instantaneous biometric logins directly from the username input dropdown without clicking button prompts.
- **Autofill Collision Guards**: Uses persistent React `AbortController` references to terminate outstanding conditional autofill listeners before dispatching explicit manual security challenges, bypassing native selector crashes.

---

### **6. Premium Branding, First-User Setup, and Asset Standardization (v1.15.0)**

Voyarr v1.15.0 unifies the visual identity across the web platform and browser extension, standardizes icon packaging, and introduces a frictionless first-time administrator onboarding flow:
- **Unified Brand Styling (Outfit Font)**: Migrated the entire ecosystem's typography to the premium Google Font **Outfit**, updating global CSS variables and preconnecting to Google Font CDNs for optimized Largest Contentful Paint (LCP) performance.
- **Sleek Glassmorphic Brand Accents**: Redesigned the login screen and user portal using high-end linear purple-to-blue gradients (`linear-gradient(135deg, #6366f1 0%, #a855f7 100%)`), drop-shadow filters on the official branding logo, and premium responsive glassmorphic cards.
- **Dynamic Version Synchronization**: Implemented dynamic version rendering across all system views. The main app pulls from `package.json` at build time to render a standard `Chip` badge in the navigation `AppBar`. The browser companion extension dynamically queries the chrome runtime manifest (`chrome.runtime.getManifest()`) to display the extension version badge in the popup header next to the title.
- **Frictionless First-User Onboarding Flow**:
  - Implemented an automated database bootstrap detector. The public endpoint `/api/auth/config` evaluates user existence and exposes a `has_users` boolean flag.
  - The login interface conditionally replaces the standard sign-in form with an **Initial Setup** registration card when `has_users` is false. This form handles password confirmation, length checks, administrator account provisioning, and directly initiates a secure login session without separate registration routing, preserving global registration lockout policies immediately after.
- **Standardized Multi-Format PWA Assets**: Programmatically compiled and generated properly-sized multi-format assets from the high-resolution logo (`app_icon.png`):
  - `favicon.ico` (Multi-size fallback standard favicon)
  - `favicon-32x32.png` (Standard desktop browser tab icon)
  - `pwa-192x192.png` (PWA application launcher standard)
  - `pwa-512x512.png` (PWA splash screen and maskable target)
  - Updated `index.html` and `vite.config.js` with the corresponding manifest icon schemas and matching themed backdrop colors (`#0b0f19`).

---

## **🚀 Future Feature Roadmap (v1.18.0+)**

The following represents identified feature targets and upcoming components for subsequent releases.

### **1. Distributed Worker Nodes (The "Heavy Lifting" Update)**
*   **Description:** Build a "Remote Worker Node" system using the existing Celery/Redis architecture to offload intensive tasks (FFmpeg transcoding, AI auto-chaptering, facial recognition) to external machines, preventing the primary NAS from bottlenecking.

### **2. Media Requests Portal**
*   **Description:** A dedicated UI where non-admin users can browse potential channels, paste URLs, and "Request" media. Admins get a centralized approval dashboard that automatically links approved requests to user quotas, fires off mass rips, and sends interactive Discord/Webhook notifications upon completion.

### **3. Third-Party Plugin & Extension Architecture**
*   **Description:** Introduce a modular Python plugin system. A designated `/plugins` folder mapped to a Docker volume will allow users to drop in custom Python scripts for external API bridges, custom metadata scrapers, and new webhook notifiers without modifying the core codebase.

### **4. Real-time Multi-Instance Clustering (High Availability)**
*   **Description:** Expand the P2P engine into a true High Availability (HA) cluster, allowing remote instances (e.g., local and cloud) to act as hot-failover mirrors, sharing storage allocations and active Celery task queues in real-time.