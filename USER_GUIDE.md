# 📖 Voyarr & Voyarr Lens: Complete User Guide
Welcome to **Voyarr**! This guide is written to help you set up and get the most out of your self-hosted media library and its companion browser extension, **Voyarr Lens**. No prior programming or advanced technical knowledge is required!

---

## 🎯 Table of Contents
1. [🌟 What is Voyarr?](#-what-is-voyarr)
2. [🚀 Setting Up Voyarr for the First Time](#-setting-up-voyarr-for-the-first-time)
3. [🔑 Your First Login & Creating an Admin Account](#-your-first-login--creating-an-admin-account)
4. [🖥️ Tour of the Web App & Core Workflows](#-tour-of-the-web-app--core-workflows)
5. [🧩 Installing and Using the "Voyarr Lens" Browser Companion](#-installing-and-using-the-voyarr-lens-browser-companion)
6. [🎯 Mastering "Map Mode" (Point-and-Click Selector Mapping)](#-mastering-map-mode-point-and-click-selector-mapping)
7. [🛡️ Biometric Passkeys, Social Logins, and Security Settings](#-biometric-passkeys-social-logins-and-security-settings)
8. [💾 Backups and Restores Made Simple](#-backups-and-restores-made-simple)
9. [🔐 Feature Access Controls & Granular User Permissions (RBAC)](#-feature-access-controls--granular-user-permissions-rbac)
10. [📂 File Naming Scheme, Metadata Matches & Advanced Filtering](#-file-naming-scheme-metadata-matches--advanced-filtering)
11. [📜 File Naming History Log & One-Click Reversion Rollbacks](#-file-naming-history-log--one-click-reversion-rollbacks)

---

## 🌟 What is Voyarr?

Think of **Voyarr** as your own private, smart streaming platform. If you subscribe to multiple media websites, creators, or studios, managing your accounts and downloads manually can be a headache. 

Voyarr does all the heavy lifting:
- **Organizes**: Scrapes premium metadata (titles, performers, tags, studios) and matches them to your files.
- **Automates**: You can set simple "rules" (like *"If performer is Alice and quality is 4K, download immediately"*).
- **Cleans**: Finds duplicate files, transcodes videos to smaller sizes using modern compression, and visualizes chapters.
- **Connects**: Uses the **Voyarr Lens** browser extension to let you click on elements on live websites to teach your server how to read them!

---

## 🚀 Setting Up Voyarr for the First Time

Voyarr runs inside **Docker**, which is a system that allows apps to run in their own secure, isolated "containers" on your server or NAS (such as a Synology NAS, Unraid, or Linux system).

### Step 1: Zero-Setup for Application Data
Voyarr utilizes **Docker Named Volumes** (`voyarr-config`, `voyarr-db-data`, `voyarr-backups`, and `voyarr-certs`) to manage its internal database, certificate folders, configurations, and backups. 
* **No manual folder creation needed:** You do **not** need to create any database or configuration folders on your server or NAS before starting the app. Docker handles this automatically and keeps your settings entirely persistent and upgrade-safe.

### Step 2: Configure Your Environment File (`.env`)
Copy the provided `.env.example` file in your Voyarr folder and rename the copy to `.env`. Open it in any text editor and configure your local settings:

```env
# Point this to your existing local videos folder on your host machine (where your media is stored):
HOST_MEDIA_PATH_1=/volume1/video

# Set your local timezone (critical for scheduling automated backups):
TZ=America/New_York
```

> [!TIP]
> **What are PUID, PGID, and SUPPLEMENTARY_GID?**
> These variables map the permissions of files and hardware within the isolated container directly to your host server's user and group accounts:
> * **`PUID` (User ID)**: The user ID that runs the container processes. Any new files written by Voyarr (backups, downloads, logs) will be owned by this user on your host.
> * **`PGID` (Group ID)**: The primary group ID for created files.
> * **`SUPPLEMENTARY_GID` (Additional GIDs)**: An extra group ID that grants the container access to other host assets. This is like an "extra keycard" allowing the container to access resources like GPU transcoders (e.g., render/video GIDs) or extra NAS share shares without altering the ownership of newly created files.
>
> **🔍 How to Find Your Host IDs (Terminal Process Call):**
> Connect to your server/NAS via SSH and run these quick shell commands to output your exact IDs for copy-pasting:
> * Find your **User ID (PUID)**: `id -u`
> * Find your **Primary Group ID (PGID)**: `id -g`
> * Find all **Group Memberships (Supplementary GIDs)**: `id` (shows names and GIDs) or `id -G` (shows GIDs only)
>
> **⚙️ Under the Hood: Docker Native User Process Mapping**
> When Docker starts the container's processes, it maps them directly to the native Linux kernel's process privileges via standard OS system calls:
> 1. **`setuid` (to `PUID`) & `setgid` (to `PGID`):** Establishes the primary identity of the process. Any new files, backups, or logs written *by* the container will be owned by these IDs on the host.
> 2. **`setgroups` (including `SUPPLEMENTARY_GID`):** Appends additional GIDs to the process's supplementary membership list. This does not change the owner of newly created files, but acts as an "extra keycard" granting the process read/write permissions to existing files or hardware devices (such as `/dev/dri` GPU nodes owned by the host's `render` group) that require different GID privileges.
>
> Because Linux naturally supports multi-group process authorization, defining `PUID`, `PGID`, and `SUPPLEMENTARY_GID` together is completely safe, standard, and highly recommended.
>
> **NAS Specific Setup Tutorials:**
> For step-by-step graphical guides for your specific NAS:
> * Asustor: https://mariushosting.com/asustor-nas-find-uid-userid-and-gid-groupid-in-5-seconds/
> * Synology: https://mariushosting.com/synology-find-uid-userid-and-gid-groupid-in-5-seconds/
> * UGREEN: https://mariushosting.com/ugreen-nas-find-uid-userid-and-gid-groupid-in-5-seconds/


### Step 3: Run the App
- **If using the Terminal (CLI)**: Open a terminal in your Voyarr folder and run:
  ```bash
  docker compose up -d --build
  ```
- **If using Synology Container Manager**: Go to Project -> Create, upload your `docker-compose.yml`, select your `.env` file, and click Next.
- **If using Portainer**: Go to Stacks -> Add Stack, paste the contents of `docker-compose.yml`, upload `.env`, and click Deploy.

---

## 🔑 Your First Login & Creating an Admin Account

Once the container finishes starting up, open your web browser and go to `http://<your-server-ip>:3000` (or the port assigned to your frontend).

1. **Bootstrap Admin**: Since the database is completely empty on your first start, the very first user registration is **automatically granted full Administrator permissions**.
2. **Immediate Lockout**: As soon as you finish registering this first account, public registration is **immediately disabled globally**. Nobody else can visit your site and create an account.
3. **Registering Other Users**: If you want to invite friends or family, you must login as the Admin, go to **Settings > User Profiles**, and trigger a custom invite/registration code from within your dashboard.

---

## 🖥️ Tour of the Web App & Core Workflows

### 1. Adding a Media Provider (Website Integration)
A "Provider" is any website you want to scrape or download from.
- Navigate to **Providers > Add New Provider**.
- Enter the site domain (e.g., `creatorplace.com`) and your custom options.
- Under the **Credentials** section, you can enter your site username/password, or paste your logged-in browser session cookies. 
- *Note: Voyarr stores all passwords and credentials using high-security AES-256 encryption. They are safe and secure inside your local database.*

### 2. Setting Up Automated Download Rules
Rules tell Voyarr exactly what you want it to capture.
- Go to **Rules > Add Download Rule**.
- Define your criteria. For example:
  - **Include Performer**: `Jane Doe`
  - **Resolution Filter**: `1080p` or `4K`
  - **Action**: `Queue & Download`
- Save the rule. When you scrape channels, any videos matching these rules will automatically start downloading in the background.

### 3. Running a "Mass Rip"
If you find a performer or channel with hundreds of videos, you can scrape and queue them all at once:
- Paste the Performer's URL into the **Mass Rip** search bar.
- Click **Analyze**. Voyarr will scrape all the videos on the page, index their metadata, and show you a list.
- Click **Run Quality Check**. Voyarr will cross-reference the list with your local library. If you already have a video in `1080p` but the site has it in `4K`, it will flag it as an **Upgrade Opportunity**!
- Click **Start Queue** to automate the entire download process.

---

## 🧩 Installing and Using the "Voyarr Lens" Browser Companion

The browser companion is a highly interactive extension that connects Google Chrome (or any Chromium browser like Brave, Edge, or Opera) directly to your self-hosted Voyarr server.

### Step-by-Step Installation:
1. Open your browser and navigate to `chrome://extensions/`.
2. In the top-right corner of the Extensions page, toggle **Developer mode** to **ON**.
3. In the top-left corner, click the **Load unpacked** button.
4. Browse to your local Voyarr project folder on your computer, select the `extension` folder, and click **Open**.
5. The **Voyarr Lens** icon (a blue lens logo) will appear in your extensions list. Pin it to your browser toolbar for quick access!

### Connecting it to Your Server:
1. Click the **Voyarr Lens** icon in your toolbar.
2. In the popup, enter your self-hosted server URL (e.g., `http://192.168.1.50:8000`).
3. Enter your **Master API Key** (you can find or generate this in your web app under **Settings > Developer & API Keys**).
4. Click **Connect**. Once connected, a green indicator will light up, showing you are ready to map!

### 🕶️ Meta Quest Browser & Mobile VR Setup (Universal Bookmarklet):
Since the **Meta Quest Browser** runs on an isolated virtual reality OS, it does not allow you to install third-party unpacked folders from the Chrome Web Store. 
To bypass this limit, Voyarr includes a universal **Bookmarklet Companion**:
1. Log into your Voyarr Web App and go to **Settings**.
2. Scroll to the **Browser Extension Integration** section and locate the **Meta Quest & Mobile (Universal Bookmarklet)** panel on the right.
3. Click the **Copy Bookmarklet** button. 
4. In your Meta Quest Browser:
   - Create a bookmark of any random webpage (for example, this one).
   - Edit the bookmark's name to `"🎯 Voyarr Lens VR"`.
   - **Crucial Step**: Paste the copied bookmarklet code (beginning with `javascript:`) into the **Address/URL** field of the bookmark, overwriting the original web address, and save it!
5. To use it in VR: Browse to your target media website inside the VR headset, open your Bookmarks list, and click **Voyarr Lens VR**. The premium visual mapping console will instantly slide up in 3D Space!

---

## 🎯 Mastering "Map Mode" (Point-and-Click Selector Mapping)

Have you ever wondered how scraper tools extract the Title, Performer, and Video URLs from a web page? They use "CSS Selectors," which are directional codes telling the computer exactly where to find text inside a web page's structure.

Historically, finding these required looking at HTML code. **Voyarr Lens** changes this completely with **Map Mode**—a point-and-click visual mapper.

### Step 1: Open a Supported Subscribed Website
Go to any subscription site you want to map a recipe for, and navigate to a video detail page.

### Step 2: Activate Map Mode
- Click the **Voyarr Lens** icon in your toolbar and click **Toggle Map Mode**.
- *Alternative Shortcut*: Press `Ctrl+Shift+M` (`Cmd+Shift+M` on macOS) or right-click anywhere on the webpage and select **Start Voyarr Map Mode**.

### Step 3: Hover and Click
As you move your mouse cursor across the webpage, elements will light up with a **dashed green box**, showing you exactly what the extension is targeting.

1. **Map the Title**:
   - Hover your cursor over the video's main title text on the webpage.
   - A dashed green box will surround the title. Click it once!
   - In the extension overlay that appears, select **Title** as the field type.
2. **Map the Performers**:
   - Hover over the performer's name links and click. Select **Performers** in the overlay.
3. **Map the Tags**:
   - Hover over the categories or tags on the page, click, and select **Tags**.
4. **Map the Video Source URL**:
   - Hover over the main video player window (or the download button) and click it. Select **Video Source**.

### Step 4: Validate and Test
- Open the Voyarr Lens toolbar popup while on the page.
- Under your mapped fields, you will see the exact CSS selectors generated for you (for example, `h1.title-text` or `.metadata > a.actor`).
- Click the **Test** (eye icon) next to any selector. The elements on the webpage will **flash bright green**! This lets you immediately confirm that the selector is targeting the correct items.
- If a selector isn't quite right, you can manually type or adjust the text in the text-box and click Test again to re-validate.

### Step 5: Save Recipe to Server
Select your target **Provider** from the dropdown menu inside the extension popup and click **Save Recipe to Server**. The selector settings are instantly uploaded and securely saved directly on your home Voyarr server!

---

## 🛡️ Biometric Passkeys, Social Logins, and Security Settings

Voyarr features premium security systems usually reserved for enterprise platforms, fully accessible to beginners.

### 1. Setting Up Passkeys (Biometric Logins)
Passkeys let you sign into Voyarr using your device's fingerprint scanner (TouchID), facial recognition (FaceID), or hardware keys (like YubiKeys).
- Log into your Voyarr Web App.
- Go to **Settings > Account Security > Manage Passkeys**.
- Click **Register New Passkey**.
- Your browser or operating system will pop up a window asking for your fingerprint, face scan, or PIN. Provide it, and enter a name for the key (e.g., "iPhone TouchID").
- Done! The next time you visit the login screen, clicking in the username box will bring up a list of your passkeys. Tap your fingerprint, and you are logged in instantly—no password required!

### 2. Linking Social SSO Accounts (Fast Access)
You can link your Google, GitHub, or Discord accounts to sign in with one click:
- Enable SSO in the **Settings > Global Authentication Policies** panel.
- Link your personal profiles.
- *Lockout Protection*: Voyarr includes "Lockout Protection." If you try to unlink a social login, Voyarr checks if it is your last remaining way to sign in. If it is, Voyarr will block the action to make sure you never lock yourself out of your system!

---

## 💾 Backups and Restores Made Simple

Backups are critical to ensuring that you never lose your library lists, custom scraper recipes, or rules.

- **Automated Nightly Backups**: Voyarr runs an automated task once a day that bundles your entire application state into a secure, highly compressed file named `voyarr_backup_YYYYMMDD_HHMMSS.json` in your server's `backups` folder.
- **Manual Backups**:
  - Go to **Settings > Backup & Restore** inside the web app.
  - Choose your backup type:
    - **Settings Only**: Backs up only scraper recipes, session cookies, and vault secrets. *(Perfect for sharing recipes or moving settings to a new server safely, as it re-encrypts all passwords using your new server's master key!)*
    - **Full Backup**: Backs up every single database record (library entries, performer clusters, chapters, rules).
  - Click **Download Backup File** to save the JSON snapshot to your local computer.
- **Restoring Data**: Simply upload your saved `.json` backup file in the **Restore** section and click **Apply Restore**. Voyarr will verify the file's cryptographically secure signature to ensure it is not corrupted or tampered with, and restore your system state in seconds!

---

## 🛡️ Routing Traffic Through a VPN (Optional)

If you want to hide your scraping and downloading traffic from your ISP, Voyarr includes native support for routing its internal traffic through a Gluetun VPN sidecar.

### Step 1: Configure Your VPN Credentials
Open your `.env` file and scroll down to **5. VPN SIDECAR (GLUETUN) & BROWSERLESS CONFIGURATION**. Uncomment the variables and fill in your VPN provider's details:
- `VPN_SERVICE_PROVIDER` (e.g., `mullvad`, `nordvpn`, `surfshark`)
- `VPN_TYPE` (e.g., `wireguard` or `openvpn`)
- `WIREGUARD_PRIVATE_KEY`
- `WIREGUARD_ADDRESSES`

### Step 2: Enable the VPN Compose Configuration
By default, Voyarr uses standard network routing. To route traffic through the VPN, you need to use the VPN-enabled compose setup.

**If using the Terminal (CLI):**
Instead of the standard start command, launch the stack using the dedicated VPN compose file as an override:
```bash
docker compose -f docker-compose.yml -f docker-compose.vpn.yml up -d
```
*(Note: Docker Compose will automatically merge the files, turning the VPN on and securely routing all other containers' traffic through it!)*

### Step 3: Verify the Connection
Once the containers spin up, you can verify the VPN is active by checking the logs of the VPN container:
```bash
docker logs voyarr-vpn
```
Look for a message saying `Healthy` or `VPN connection established`. If the VPN fails to connect (e.g., due to bad credentials), the backend and celery containers will automatically pause their network traffic to completely prevent any IP leaks!

---

## 🔐 Feature Access Controls & Granular User Permissions (RBAC)

Voyarr contains powerful, built-in global controls and a **Role-Based Access Control (RBAC)** permission system designed to protect resources and restrict system access.

### Global Feature Controls
As an administrator, you can enable or disable three core app modules globally from the **Settings > Global Feature Toggles** panel:
1. **Streaming**: Allows users to watch content directly in their browser or cast to media players. (Enabled by default).
2. **Scraping**: Allows querying provider channels and updating metadata. (Disabled by default).
3. **Ripping**: Allows downloading media content to physical server storage. (Disabled by default).

If a feature is globally disabled, all associated background workers and API endpoints are fully blocked, and warning banners are displayed in the corresponding user dashboard screens.

### Per-User Permission Policies
Admins can grant granular, individual permissions to standard accounts:
- **Can Stream**: Grants access to playback routes.
- **Can Scrape**: Grants access to scan directories, retrieve metadata, and manage recipes.
- **Can Rip**: Grants access to execute direct and queued media downloads.

### Security Audit Logging
To keep track of administrative changes, Voyarr automatically records all security-sensitive actions in the **Admin Audit Logs**:
- Creating or editing users.
- Modifying user roles or individual permission flags.
- Changing global feature toggles.
- Access the audit list directly under **Settings > Admin Audit Logs** to review a timestamped trail of who performed what action.

---

## 📂 File Naming Scheme, Metadata Matches & Advanced Filtering

Keeping large media collections organized is easy with Voyarr's built-in file compliance identifiers:

- **Naming Scheme Compliance**: Shows whether a file adheres to standard library naming patterns (e.g., `Studio - Date - Performer - Title.mp4`). Uncompliant files are marked with a yellow warning tag so you can quickly clean them up.
- **Metadata Matches**: Indicates if a video file has been successfully matched to an official online provider record. unmatched files display a red "Unmatched" badge.
- **Dynamic Indicators**: Interactive tags showing if the video contains parsed Chapters or Facial Clustering markers.
- **Advanced Filtering**: Use the dynamic filters sidebar in the **Library** screen to immediately query and narrow down files. Search by:
  - Compliant vs. Non-compliant names.
  - Matched vs. Unmatched metadata.
  - Entries that contain chapter divisions or facial groupings.

---

## 📜 File Naming History Log & One-Click Reversion Rollbacks

If a metadata mismatch occurs or a file is renamed incorrectly, Voyarr lets you track, audit, and completely reverse changes to physical files:

### Automatic & Manual Tracing
1. **Auto-Logging on Scan**: When files are scanned (`Reverse-Regex` matching), their original file names and paths are permanently recorded as `initial` records in the log.
2. **Auto-Logging on Download**: When downloads complete and are cataloged, the downloaded file path is logged as a `download_naming` event.
3. **Manual Renaming**: You can rename any media file directly from the library entry's edit screen by typing a new filename. Voyarr physically renames the file on your server's disk, updates the database, and logs a `manual_correction` action.

### One-Click Reversion (Rollbacks)
If you realize a file was misidentified and named incorrectly, you don't need to go to your server's command line or FTP client.
- Go to the library entry's **File History** tab.
- Review the historical trace of all past names and folder locations.
- Click **Revert to Previous Name**.
- Voyarr will instantly and safely execute a physical rollback—moving and renaming the file on disk back to its exact previous path, restoring database records, and logging a `revert` action.
- The system includes strict path-existence guards to ensure no files are accidentally overwritten or lost!
