# Voyarr

**Voyarr** is a self-hosted media management ecosystem designed to handle subscriptions, metadata scraping, and automated downloads from adult websites. It integrates with **ThePornDB**, **Stash**, and **StashDB**, featuring a remote-control browser extension for dynamic metadata mapping.

📖 **Looking for a non-technical, step-by-step user guide? Check out our complete [User Guide & Tutorial](USER_GUIDE.md)!**

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
17. **Performer Facial Recognition Clustering:** Group visually matching faces using DBSCAN clustering, auto-identifying unknown actors and extracting face portrait thumbnails.
18. **AI-Driven Auto-Chaptering:** Utilize frame-based scene change detection combined with AI Vision models (Ollama/Llava or OpenAI GPT-4o) to automatically segment videos into logical chapters with descriptive titles.
19. **Granular Queue Priority & Controls:** Adjust priorities, pause, resume, or cancel active tasks inside Celery-managed download, transcoding, and recording streams in real-time.
20. **Peer-to-Peer (P2P) Syncing & Reconciling:** Exchange CSS scraper recipes and reconcile library watch status/tags securely between remote Voyarr nodes over HTTP/HTTPS tunnels.
21. **Relational Studio Database Modeling:** Organized flat text studio names into a fully normalized PostgreSQL `studios` model, providing robust metadata structures and tag relations.
22. **Bulk Duplicate Merging Engine:** Resolve multiple visual duplicates programmatically using similarity-based algorithms (`KEEP_HIGHEST_QUALITY`, `KEEP_OLDEST`, `KEEP_NEWEST`).
23. **Passwordless Passkeys (WebAuthn):** Fully secure, modern passwordless logins using biometric security keys. Includes browser and OS credentials detection (1Password, Bitwarden, iCloud Keychain, Google Password Manager), AAGUID manufacturer resolving, geographic location auditing, and WebAuthn Conditional UI (autofill mediation) support.
24. **SSO Provider Fast-Access Linking:** Link Google, GitHub, and Discord accounts to standard user profiles, with automated lockout guards ensuring you can never unlink your sole authentication method.
25. **Secure String User Identifiers:** Complete migration from sequential integer primary keys to randomly generated UUIDs prefixed with `usr_` to defend against user enumeration attacks.
26. **OpenID Connect (OIDC) Integration:** Authenticate via any compliant OIDC provider including Keycloak, Authentik, Authelia, Azure AD / Entra ID, Okta, and Google Workspace. Users are auto-provisioned on first login.
27. **Global Authentication Policy Controls:** Administrative switches to enable or disable Passkeys, SSO, and OIDC globally, with interactive setup notices and backend API enforcement.
28. **Automatic Authentication Bypass:** Skip the login screen from trusted local network subnets (CIDR notation) or when behind a trusted reverse proxy (Authelia, Authentik, Cloudflare Access) that passes authenticated user headers.

## 🔐 Authentication Policies & Administration

Voyarr provides comprehensive, administrator-controlled authentication policies. All settings are managed from the **Settings → Account Security & Authentication** dashboard.

### Enabling / Disabling Sign-In Methods

| Method | Default | Description |
|--------|---------|-------------|
| **Passkeys (WebAuthn)** | ✅ Enabled | Passwordless biometric/hardware key authentication |
| **SSO (Google, GitHub, Discord)** | ❌ Disabled | Social identity provider linking and fast-access login |
| **OpenID Connect (OIDC)** | ❌ Disabled | Enterprise identity federation (Keycloak, Authentik, Azure AD, etc.) |

Toggle any method ON or OFF from the admin dashboard. Disabled methods are hidden from the login screen and blocked at the API level.

### Setting Up SSO Providers

1. Navigate to **Settings → Account Security → Global Authentication Policies**.
2. Toggle **Single Sign-On (SSO)** to ON.
3. Follow the interactive setup notice that appears, which includes direct links to the developer portals for Google, GitHub, and Discord.
4. In each provider's developer portal, create an OAuth application and note the **Client ID** and **Client Secret**.
5. Add these credentials to your host `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_CLIENT_SECRET=your_discord_client_secret
   ```
6. Restart the backend container.

### Setting Up OpenID Connect (OIDC)

1. Toggle **OpenID Connect (OIDC)** to ON in the admin dashboard.
2. In your identity provider (Keycloak, Authentik, Azure AD, Okta, etc.), register Voyarr as a new client application:
   - **Redirect/Callback URI**: `http://<your-voyarr-host>:8000/auth/oidc/callback`
   - **Scopes**: `openid email profile`
3. Copy the **Client ID**, **Client Secret**, and **Discovery URL** into your `.env` file:
   ```env
   OIDC_CLIENT_ID=your_oidc_client_id
   OIDC_CLIENT_SECRET=your_oidc_client_secret
   OIDC_DISCOVERY_URL=https://auth.example.com/.well-known/openid-configuration
   FRONTEND_URL=http://localhost:3000
   ```
4. Restart the backend. A "Sign In with OpenID Connect" button will appear on the login page.

> [!NOTE]
> Users authenticated via OIDC are automatically provisioned on their first login with the "user" role. Administrators can adjust roles afterward.

### Configuring Automatic Authentication Bypass

> [!WARNING]
> Authentication bypass should only be enabled on isolated, private networks. If Voyarr is exposed to the internet, ensure your reverse proxy strips spoofed authentication headers.

**Trusted Subnet Bypass:**
1. Toggle **Trusted Subnet Bypass** to ON.
2. Enter your trusted IP addresses or CIDR ranges (e.g., `127.0.0.1, 192.168.1.0/24, 10.0.0.0/8`).
3. Enter the default username to auto-login as (this user must already exist in Voyarr).
4. Users connecting from matching IPs will be automatically signed in.

**Reverse Proxy Header Trust:**
1. Toggle **Reverse Proxy Header Trust** to ON.
2. Enter the trusted header name (default: `Remote-User`). Common values include:
   - `Remote-User` (Authelia, Authentik)
   - `X-Webauth-User` (Traefik Forward Auth)
   - `X-Forwarded-User` (Cloudflare Access)
3. Configure your reverse proxy to forward the authenticated username in this header.
4. If the user does not exist in Voyarr, they are automatically provisioned with the "user" role.

## 🐳 Docker Configuration

Voyarr is designed to be run via Docker Compose. The stack includes:
* `db`: PostgreSQL 15 database.
* `redis`: Redis 7 for the Celery message broker and cache.
* `backend`: FastAPI Python application.
* `celery_worker`: Background task worker for downloads, phash calculation, and transcoding tasks.
* `celery_beat`: Cron scheduler executing periodic system events (e.g. database backups, scheduled P2P synchronizations).
* `frontend`: Vite-powered React PWA served on port 3000.

## ⚙️ Initial Setup

Voyarr utilizes a **robust named volume architecture** and **dynamic host port selection** to ensure conflict-free ports and permission-safe storage on self-hosted environments (like Synology NAS, Unraid, Portainer, or standard Linux/macOS/Windows servers).

### 1. Storage & Volume Configuration

To run inside Docker, Voyarr splits its storage into two logical areas. This design ensures that you can safely upgrade the app without losing your settings, while keeping full control over where your physical movie and library files are stored.

#### 📦 A. App System Data (Safely Managed inside Docker)
Voyarr stores its own database, application settings, and backups in **Docker Named Volumes** (`voyarr-config`, `voyarr-db-data`, `voyarr-backups`, and `voyarr-certs`). 
* **Zero-Setup Startup**: You do **not** need to create any system folders on your computer or NAS before starting the app. Docker handles this automatically.
* **Persistent & Upgrade-Safe**: Since these files are managed inside Docker volumes, your data is completely separated from the app code. You can stop the app, update it, or pull new versions, and your library lists and settings will remain completely intact. 

#### 🎬 B. Your Movies & Downloads (Stored Directly on Your Host Device)
Your actual library folders, videos, movies, and download directories are stored directly on your host machine's physical drives (such as `/volume1/video` on a Synology NAS or `/home/user/media` on a Linux server).
* **Direct Host Access**: To allow the isolated Docker containers to read and write to your physical drives, the `docker-compose.yml` file contains a mapping declaration that connects your host path to the internal container path:
  * **Host Directory (Your NAS/Server)** ➔ Bridges to ➔ **Internal Container Mount** (`/media/storage`)
* **How to Configure It**: You simply tell Voyarr the exact path to your host media folder in the `.env` file (e.g. `MEDIA_ROOT_1=/volume1/video`). When the container starts, it mounts that host folder directly, allowing you to access all your videos and save new downloads in standard, visible folders outside of Docker.

---

#### 📂 Accessing Your Volume Data from the Host Machine (Optional)
If you ever want to view, copy, or manually back up the internal system configurations and database files from outside the container, you can do so in two ways:

1. **Direct Path (Linux / Synology / Unraid)**:
   Docker stores named volumes in standard directories on your host's filesystem. You can access them with root (`sudo`) privileges at:
   `/var/lib/docker/volumes/voyarr_voyarr-config/_data/`
   
2. **Helper Container (macOS / Windows)**:
   On Docker Desktop (where volumes are stored inside Docker's virtual disk), you can easily copy files to your local machine with this command:
   ```bash
   docker run --rm -v voyarr_voyarr-config:/volume -v $(pwd):/backup alpine cp -r /volume /backup/config_backup
   ```

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

* **Paths**: Point Voyarr to your physical media libraries on your host:
  ```env
  # Point this to your existing primary media folder (e.g. /volume1/video)
  MEDIA_ROOT_1=/volume1/video
  ```

  > [!NOTE]
  > **What about system configuration folders?**
  > By default, your database and settings are safely managed by standard Docker named volumes (`voyarr-config`, `voyarr-db-data`, `voyarr-backups`, `voyarr-certs`), meaning you **do not** have to specify paths like `CONFIG_ROOT` or `DB_DATA_PATH` in `.env` to start the app.
  > 
  > **Why are there multiple media variables?**
  > * **`MEDIA_ROOT_1` (Host Path)**: This is where your actual files live on your NAS. Voyarr mounts this host folder inside the container so it can access it.
  > * **`MEDIA_ROOT` (Inside-Container Scanner Path)**: This tells the backend app *inside the container* where to look for media. By default, it is set to `/media/storage` (which corresponds to `MEDIA_ROOT_1` inside the container).
  > * **Multi-Drive Setup (Advanced)**: If your media library is spread across multiple drives, you can configure additional folders using `MEDIA_ROOT_2` and `MEDIA_ROOT_3`, and then tell the scanner to look at all of them by listing their internal mounts as a comma-separated list in `MEDIA_ROOT` (e.g., `MEDIA_ROOT=/media/storage,/media/storage_alt1`). For 95% of users with a single drive, you can completely ignore `MEDIA_ROOT_2`, `MEDIA_ROOT_3`, and `MEDIA_ROOT`!

* **Standard Container & Permission Settings**: Map container time zones and host system permissions to avoid locking out files:
  ```env
  # Set your local timezone (critical for Celery automated daily backup scheduling)
  TZ=America/New_York

  # Map host user UID and group GID (run `id` in host SSH to find yours) to prevent
  # files generated inside the container (e.g. logs, backups, downloads) from being locked.
  PUID=1000
  PGID=1000
  ```
* **Ports**: Under *Host Ports Configuration*, you have two options:
  - **Auto-Allocation (Recommended)**: Leave `PORT=`, `FRONTEND_PORT=`, `REDIS_PORT=`, and `POSTGRES_PORT=` **blank/empty**.
    * *On Synology (Container Manager)*: Synology will automatically select unused ports on your NAS, **remember them permanently**, and maintain the assignment across restarts and container upgrades.
    * *On CLI*: Docker will assign random ports. Check them via `docker compose ps` and, if desired, add them to your `.env` to lock them in.
  - **Static Allocation**: Specify static ports (e.g., `PORT=8000`, `FRONTEND_PORT=3000`) if you already know they are free.

### 3. Choose Your Deployment Method

Depending on your preference, you can deploy Voyarr using **Docker Compose** (recommended for easy one-step management) or via the **Standard Docker CLI** (for manual container-by-container control).

---

#### 🟢 Method A: Docker Compose Deployment (Highly Recommended)

Docker Compose is the easiest and most robust way to manage the Voyarr multi-container stack.

##### 1. Command Line Interface (CLI)
Navigate to your Voyarr root directory and launch the services in the background:
```bash
# Build the local images and start the stack in detached mode
docker compose up -d --build
```

* **Verify running services**:
  ```bash
  docker compose ps
  ```
  *(If you chose Auto-Allocation for ports, this command will show you the exact randomly assigned ports for the backend and frontend).*
* **View real-time logs**:
  ```bash
  docker compose logs -f
  ```
* **Stop the stack**:
  ```bash
  docker compose down
  ```

##### 2. Graphical UI (Synology Container Manager / Portainer)
* **Synology Container Manager**:
  1. Open **Container Manager** on your NAS.
  2. Navigate to **Project** and click **Create**.
  3. Enter a Project Name (e.g. `voyarr`).
  4. Select **Upload docker-compose.yml** or choose a path to the directory containing it.
  5. Select your pre-configured `.env` file or paste the environment variables.
  6. Click **Next** and complete the wizard. Synology will automatically download images, build local containers, allocate conflict-free ports, and start the project.
* **Portainer**:
  1. Create a new **Stack**.
  2. Paste the contents of `docker-compose.yml` into the Web editor.
  3. Add environment variables under **Environment variables** or upload the `.env` file.
  4. Click **Deploy the stack**.

---

#### 🔵 Method B: Standard Docker CLI Deployment (Individual Containers)

If you prefer to run containers manually without a Compose file, you can build and start them one by one.

##### 1. Create a Shared Docker Network
So the containers can resolve and talk to each other securely:
```bash
docker network create voyarr_network
```

##### 2. Start PostgreSQL Database
```bash
docker run -d \
  --name voyarr-db \
  --network voyarr_network \
  -e POSTGRES_DB=voyarr \
  -e POSTGRES_USER=voyarr_user \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e TZ=America/New_York \
  -v /absolute/path/to/voyarr/init.sql:/docker-entrypoint-initdb.d/init.sql \
  -v voyarr-db-data:/var/lib/postgresql/data \
  -v voyarr-backups:/backups \
  -p 5432:5432 \
  postgres:15-alpine
```

##### 3. Start Redis Message Broker
```bash
docker run -d \
  --name voyarr-redis \
  --network voyarr_network \
  -e TZ=America/New_York \
  -p 6379:6379 \
  redis:7-alpine
```

##### 4. Build and Run FastAPI Backend
* **Build backend image**:
  ```bash
  docker build -t voyarr-backend ./backend
  ```
* **Run backend container**:
  ```bash
  docker run -d \
    --name voyarr-backend \
    --network voyarr_network \
    --user "1000:1000" \
    -e DATABASE_URL=postgresql://voyarr_user:your_secure_password@voyarr-db:5432/voyarr \
    -e CELERY_BROKER_URL=redis://voyarr-redis:6379/0 \
    -e CELERY_RESULT_BACKEND=redis://voyarr-redis:6379/0 \
    -e MEDIA_ROOT=/media/storage \
    -e DEFAULT_DOWNLOAD_PATH=/media/storage/downloads \
    -e MASTER_KEY=your_32_byte_hex_key \
    -e SECRET_KEY=your_secret_key_here \
    -e HOST=0.0.0.0 \
    -e PORT=8000 \
    -e TZ=America/New_York \
    -v voyarr-config:/app/config \
    -v voyarr-backups:/app/backups \
    -v /volume1/video:/media/storage \
    -p 8000:8000 \
    voyarr-backend
  ```

##### 5. Run Celery Worker
The worker uses the same backend image but runs the Celery daemon:
```bash
docker run -d \
  --name voyarr-celery \
  --network voyarr_network \
  --user "1000:1000" \
  -e DATABASE_URL=postgresql://voyarr_user:your_secure_password@voyarr-db:5432/voyarr \
  -e CELERY_BROKER_URL=redis://voyarr-redis:6379/0 \
  -e CELERY_RESULT_BACKEND=redis://voyarr-redis:6379/0 \
  -e MEDIA_ROOT=/media/storage \
  -e DEFAULT_DOWNLOAD_PATH=/media/storage/downloads \
  -e MASTER_KEY=your_32_byte_hex_key \
  -e SECRET_KEY=your_secret_key_here \
  -e TZ=America/New_York \
  -v voyarr-config:/app/config \
  -v voyarr-backups:/app/backups \
  -v /volume1/video:/media/storage \
  voyarr-backend sh -c "mkdir -p /media/storage/logs && celery -A celery_app.celery_app worker --loglevel=info --logfile=/media/storage/logs/celery.log"
```

##### 6. Build and Run Vite Frontend
* **Build frontend image** (specifying backend server address):
  ```bash
  docker build -t voyarr-frontend --build-arg VITE_API_BASE_URL=http://localhost:8000 ./frontend
  ```
* **Run frontend container**:
  ```bash
  docker run -d \
    --name voyarr-frontend \
    --network voyarr_network \
    -e TZ=America/New_York \
    -p 3000:80 \
    voyarr-frontend
  ```

---

### 💾 Granular Backup & Restore System

Voyarr features a multi-tiered, highly granular backup and restore system that protects your data at both the application level and the database level. Because of the hybrid volume setup, all backups are immediately accessible as standard files on your host system.

#### 1. Automated System Backups (App State)
* **How it works**: By default, Celery runs an automated background task once a day (scheduled dynamically based on your `TZ` setting).
* **Backup Destination**: Writes high-compression, fully portable JSON snapshots of the entire application state directly to the `/app/backups` mount inside the container, which maps physically to your host's **`BACKUP_ROOT`** folder.
* **Filename pattern**: `voyarr_backup_YYYYMMDD_HHMMSS.json`.

#### 2. Granular Web UI Export & Restore
Within the Voyarr Web Interface (**Settings > Backup & Restore**), you can export and restore configuration snapshots:

* **🟢 App Settings Only** (`type=settings`): 
  * Exports only your global settings, website scrapers, session states, and third-party vault configurations.
  * *Security*: Highly sensitive credentials (like API keys, passwords, session cookies) are automatically decrypted upon export and re-encrypted using your master AES-256 key upon import. This allows you to migrate configurations to different machines safely.
* **🔵 Full Application Database** (`type=full`):
  * Exports all tables and relations in the exact dependency order, giving you a complete clone of your libraries, chapters, rules, history, and settings in a single portable JSON file.
* **🟡 Custom Selection** (`type=custom`):
  * Select specific database tables (e.g. just `site_recipes`, or just `library_entries`) to backup or restore, leaving other database tables entirely untouched. This is useful for migrating custom site recipes between instances without overwriting library lists.

#### 3. Granular PostgreSQL CLI Dump & Restore (Full Database)
Because the `voyarr-backups` volume maps directly to `/backups` inside the isolated database container, you can also perform physical PostgreSQL CLI dumps directly from your host terminal:

* **To Back Up (Export SQL Dump)**:
  Run this command on your host to dump the full database directly into your host backups folder:
  ```bash
  docker exec -t voyarr-db pg_dump -U voyarr_user -d voyarr > /volume1/docker/voyarr/backups/postgres_dump.sql
  ```
* **To Restore (Import SQL Dump)**:
  To restore a physical SQL dump back into your Voyarr database container, run:
  ```bash
  docker exec -i voyarr-db psql -U voyarr_user -d voyarr < /volume1/docker/voyarr/backups/postgres_dump.sql
  ```
  *(Note: Replace `/volume1/docker/voyarr/backups/` with your actual physical `BACKUP_ROOT` folder path if you customized it).*

---

### 4. Access the Services

Once running, open your web browser and navigate to:
* **Frontend Access**: `http://<your-ip>:3000` (or your randomly assigned frontend port)
* **Backend API Documentation**: `http://<your-ip>:8000/docs` (or your randomly assigned backend port)

### 🔐 User & Admin Bootstrapping

Voyarr features a secure, multi-user environment with Role-Based Access Control (RBAC):

1. **Bootstrap the Admin Account**: Upon fresh installation (when no users exist in the database), navigate to the web login screen and register. The very first user account created is **automatically** granted the `"admin"` role to prevent system lockout.
2. **Lockout Prevention**: Once this first administrator account is created, public registration is **immediately disabled**.
3. **Registering Subsequent Users**: To register a new user after the admin is configured, the registration request must be:
   - Approved and triggered by an existing Admin (sent from within the authenticated Admin dashboard/client).
   - Alternatively, authorized by including the `MASTER_KEY` secret (configured in your `.env` file) as an HTTP header: `X-Voyarr-Api-Key: <your_master_key>`.

## 🔒 Customizable Network Proxies & VPN Integration

Voyarr provides dual-layer network protection to allow secure scraping, geo-restricted stream acquisition, and complete host masking:

### 1. Application-Level Network Customization (Web Settings Dashboard)
Within the **Settings** screen in the frontend, administrators can toggle and configure outbound proxy routing:
*   **Protocol Support**: Full routing via `HTTP`, `HTTPS`, and `SOCKS5` outbound connections.
*   **Vault Security**: Proxy URLs featuring sensitive embedded credentials (e.g., `socks5://user:pass@1.2.3.4:1080`) are **never stored as plain-text**. They are intercepted and encrypted using AES-256-GCM in the secure database `Vault` table.
*   **Custom User-Agent Overrides**: Set a custom HTTP User-Agent string globally to easily masquerade outbound scraper requests.
*   **Dynamic Hot-Reloading**: Applying settings instantly updates environment contexts inside FastAPI and background Celery task daemons without needing any container restarts.
*   **Live Routing Diagnostics**: Click **Run Routing Diagnostics** to sequentially check exit node IP addresses, latency speeds, and active proxy validity scorecards.

---

### 2. Infrastructure-Level Routing (Docker VPN Sidecar via Gluetun)
For complete, leakproof VPN routing across all scraper backend engines, headless Playwright browsers, and downloaders without container overhead:
1.  Verify host support for tun interfaces (`/dev/net/tun` or `NET_ADMIN` capabilities).
2.  Configure your credentials (e.g. Wireguard private keys or OpenVPN logins) inside the newly provided [docker-compose.vpn.yml](docker-compose.vpn.yml) file.
3.  Deploy using the vpn composition profile alongside the main file:
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.vpn.yml up -d
    ```
This hooks all scraper network traffic through a **Gluetun sidecar namespace**, completely locking down metadata requests, headless chromium Playwright contexts, and `yt-dlp` downloaders behind the VPN exit node.

---

## 🛡️ Secure Coding, Resiliency & Test Architecture

Voyarr adheres to rigorous security and architectural resiliency standards. Recent structural improvements include:

### 1. Hardened Backup Signature Verification
Our backup restoration pipeline features a secure cryptographic signature check. When uploading a JSON configuration backup:
* **HMAC Validation**: If a backup payload contains a `signature` field, the server calculates a localized SHA-256 HMAC using the secure system `HMAC_KEY`.
* **Tamper Protection**: Mismatches or invalid signatures are strictly rejected with a `valid: False` payload and blocked from restoration, defending self-hosted instances against unauthorized or tampered configuration injection.

### 2. Resilient Celery Task Orchestration
To prevent silent orchestration failures in background services, exception handling in Celery workers is hardened:
* **Exception Propagation**: Real-time video downloads (`real_download_task`) and FFmpeg video transcoding tasks (`transcode_video_task`, `generate_hls_task`) explicitly propagate errors up to the Celery broker once max retries are exceeded.
* **Orchestration Dashboards**: Tasks are properly transitioned to the `FAILED` state inside your orchestration interfaces rather than silently logging success, ensuring transparent monitoring.

### 3. Outbound SSRF & Loopback Proxy Defense
During P2P node metadata synchronizations:
* **Dynamic Scraper Recipe Validation**: Remote peer nodes pushing new site recipes are subject to strict SSRF destination audits.
* **Subnet Isolation**: Input values targeting loopback adapters or internal private networks (e.g., `127.0.0.1`, `192.168.0.0/16`, local host proxy ports) are strictly blocked from registration to prevent remote peer scanning attacks.

### 4. Zero-Contamination SQLite Test Isolation
Our backend test suites are built for speed and isolated cleanliness:
* **Global Pytest Hook**: A centralized pytest [conftest.py](backend/tests/conftest.py) intercepts all engine creation and `os.environ["DATABASE_URL"]` allocations at execution time.
* **OS Temp Redirection**: Directs all temporary test databases (`sqlite:///file:testdb_*`) to the system's temporary directory (e.g., `/tmp`), completely preventing filesystem clutter in the project root.
* **Contamination Immunity**: Dynamically resolves session pools in [db_utils.py](backend/db_utils.py) to prevent Pytest's import discovery phase from caching references across different test suites.

### 5. Administrative Feature Controls (RBAC) & Security Auditing
To guard server resource consumption and limit access on public-facing networks:
* **Global Module Toggles**: Administrators can enable or disable three core features globally from the settings interface: `streaming` (default: ON), `scraping` (default: OFF), and `ripping` (default: OFF).
* **Router Level Guarding**: The backend implements active route guards (`is_feature_enabled` and `check_feature_permission`) verifying global config and checking the authenticated user's granular JSON `permissions` column (keys: `can_stream`, `can_scrape`, `can_rip`). Unauthorized requests instantly raise `403 Forbidden` errors.
* **Administrative Audit Trails**: Critical actions (user registrations, permission edits, global settings updates) automatically populate the `admin_logs` database table. These logs record `admin_id`, `action`, `target_user_id`, `details`, and `timestamp`, and can be fetched via `GET /api/auth/admin-logs`.

### 6. Library Schema Identifiers & Advanced Filtering
To facilitate large library curation, files are parsed and matched with detailed indicators:
* **Naming Compliance Tracking**: Library entries include the `adheres_to_naming_scheme` boolean column, determining if the scanned file name complies with standard catalog structures.
* **Metadata Match Identifiers**: The `has_metadata_match` column stores whether a local file has a validated provider recipe match.
* **Query Scoping Filters**: The main library catalog router (`GET /api/library/`) parses additional optional boolean filters (`compliant`, `matched`, `has_chapters`, `has_faces`) to perform deep database-side WHERE filtering for fast metadata triage.

### 7. Physical File Renaming, History Tracing & Reversions
To allow corrective actions on incorrect metadata scans and naming mistakes:
* **Trace Log Schema**: The database defines the `file_naming_history` table tracking `old_path`, `new_path`, `old_filename`, `new_filename`, `reason` (e.g. `initial`, `download_naming`, `manual_correction`, `revert`), and a timestamp.
* **Manual Renaming Pipeline**: `POST /api/library/{entry_id}/rename` receives a new filename, executes physical `os.rename` on disk, verifies collision guards, updates the `LibraryEntry.file_path`, and logs `manual_correction`.
* **Deterministic Reversion Engine**: `POST /api/library/{entry_id}/revert-rename` fetches the latest naming history trace ordered deterministically by `timestamp.desc(), id.desc()` (to resolve sub-second SQLite test runs). It validates that the original path is clear, performs `os.rename` back to the initial state, and logs `revert` as a new trace log entry.

---

## 🧩 Browser Extension & Bookmarklet Setup

To use the visual "Map Mode" scraping configuration:

### 💻 1. Standard Desktop Browsers (Chrome / Edge / Opera / Brave)
1. Open Google Chrome or a Chromium-based browser.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `/extension` directory in this repository.
5. You can now use the extension to map CSS selectors on supported websites.

### 🕶️ 2. Meta Quest Browser & Mobile Devices (Universal Bookmarklet)
For VR environments (Meta Quest Browser) or mobile devices where standard unpacked extension uploads are blocked:
1. Log into your Voyarr Web App, open **Settings**, and scroll to the **Browser Extension Integration** panel.
2. Under the **Meta Quest & Mobile (Universal Bookmarklet)** section, click **Copy Bookmarklet**.
3. In your Quest Browser, bookmark any page, rename the bookmark to `"🎯 Voyarr Lens VR"`, and paste the copied `javascript:...` code directly into the URL/Address field of the bookmark.
4. Browse to any supported video streaming site, open your bookmarks list, and click the bookmark to instantly boot up the visual selection overlay directly in 3D Space!

## 🏷️ Versioning

We use SemVer for versioning. Given a version number MAJOR.MINOR.PATCH, we increment the MAJOR version for incompatible API changes, MINOR for backwards-compatible functionality, and PATCH for backwards-compatible bug fixes.
For the versions available, see the tags on this repository.

## ⚖️ Legal & Privacy

By using Voyarr, you agree to our terms and understand our privacy practices as a self-hosted software:
* [Terms of Service](TERMS_OF_SERVICE.md)
* [Privacy Policy](PRIVACY_POLICY.md)

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
