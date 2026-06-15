# 🛠️ Voyarr Troubleshooting Guide

This document covers the most common issues you might encounter while setting up or running Voyarr and provides quick, straightforward solutions.

---

## 1. "Bind mount failed: '/path/to/folder' does not exist"
**Error Log Example:**
`Error response from daemon: Bind mount failed: '/volume1/docker/voyarr/db-data' does not exist`

**Cause:**
Docker requires that all physical host folders (such as `config`, `db-data`, `backups`, and media paths) exist on your system *before* it can mount them. If they don't exist, Docker will refuse to start the container.

**Solution:**
1. Open your terminal or file explorer on your host NAS/server.
2. Manually create the missing folders.
3. Re-run `docker compose up -d`.

---

## 2. Database Connection Refused (Postgres Port Issue)
**Error Log Example:**
`WARNING: Database connection failed: (psycopg2.OperationalError) connection to server at "db" (172.28.0.2), port 32788 failed: Connection refused`

**Cause:**
This happens when your backend container tries to connect to the internal database using the *external* host port (e.g., `32788`) instead of the native internal Docker port (`5432`). Inside the isolated `voyarr_network`, containers must communicate using `5432`.

**Solution:**
1. Open your `docker-compose.yml` file.
2. Ensure the `DATABASE_URL` for `backend`, `celery_worker`, and `celery_beat` hardcodes the port `5432`. It should look exactly like this:
   `DATABASE_URL=${DATABASE_URL:-postgresql://${POSTGRES_USER:-voyarr_user}:${POSTGRES_PASSWORD:-voyarr_password}@db:5432/${POSTGRES_DB:-voyarr}}`
3. Run `docker compose down` and then `docker compose up -d` to apply the changes.

---

## 3. Permission Denied / Files Are Locked
**Error Log Example:**
`PermissionError: [Errno 13] Permission denied: '/media/storage/downloads/video.mp4'`

**Cause:**
The container is trying to write files (like downloads, database backups, or logs) using a user ID that doesn't have permission to write to your NAS/host shared folders.

**Solution:**
1. Find your host User ID (PUID) and Group ID (PGID). Connect to your server via SSH and run `id`.
2. Open your `.env` file and update the `PUID` and `PGID` variables to match the output from the `id` command.
   ```env
   PUID=1000
   PGID=1000
   ```
3. If the folder is owned by an external group (e.g., a dedicated `media` group on your NAS), find its GID and assign it to `SUPPLEMENTARY_GID` in your `.env` file.
4. Recreate the containers: `docker compose up -d`.

---

## 4. "Relation 'settings' does not exist" on Fresh Install
**Error Log Example:**
`psycopg2.errors.UndefinedTable: relation "settings" does not exist`

**Cause:**
A race condition occurred where the Celery task worker attempted to load global proxy settings from the database before the FastAPI backend had a chance to create the database tables.

**Solution:**
This issue was patched in recent versions! Make sure you are pulling the latest image. 
1. Run `docker compose pull`
2. Run `docker compose up -d`
Wait about 10 seconds for the backend to finish fully initializing the database schema before the workers attempt to read from it.

---

## 5. "Permission denied: 'celerybeat-schedule'"
**Error Log Example:**
`[Errno 13] Permission denied: 'celerybeat-schedule'`

**Cause:**
The Celery Beat container doesn't have the necessary file permissions to write its schedule tracking file inside the `/app` root.

**Solution:**
Ensure you are using the latest `docker-compose.yml` configurations where the `celery_beat` command writes to `--schedule=/tmp/celerybeat-schedule`. Because `/tmp` is globally writable inside the container, this completely eliminates the permission denied crash on startup.

---

## 6. Access to API Blocked by CORS Policy or Port Mismatch
**Error Log Example (Browser Console):**
`Access to fetch at 'http://<nas-ip>:8000/auth/config' from origin 'http://<nas-ip>:32786' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`

**Cause:**
Historically, web applications required configuring cross-origin resource sharing (CORS) headers to allow the frontend browser client to talk directly to the backend API on a different port. If you changed the host backend port (e.g. to `32785`) but the frontend was built to look at a default port like `8000`, the connection would fail or get blocked by your browser's security rules.

**Solution:**
Voyarr features **port-agnostic relative routing**. The frontend application defaults its base URL to the relative path `/api`.
1. The built-in Nginx proxy inside the frontend container receives all requests sent to `/api` and routes them internally over the private Docker bridge network (`voyarr_network`) directly to `http://backend:8000`.
2. This completely bypasses the browser's CORS restrictions and eliminates the need to configure CORS origins or expose the backend port directly to the host network for standard web UI usage.
3. Access your application solely via the frontend port (e.g., `http://<nas-ip>:32786`) and let Nginx handle the internal routing.

---

## 7. Interactive API Documentation (/api/docs) Returns 404 Not Found
**Error Symptom:**
You can access the frontend web interface and standard endpoints successfully, but trying to view the interactive FastAPI documentation at `http://<nas-ip>:<frontend-port>/api/docs` or `http://<nas-ip>:<frontend-port>/api/redoc` returns a `404 Not Found` error.

**Cause:**
By default, the backend container runs at the root path (`/`) internally. When Nginx forwards a request like `/api/docs` to the backend, the backend receives `/api/docs` but doesn't recognize the `/api` prefix because it is expecting the documentation to live at `/docs`.

**Solution:**
To make the interactive API documentation and testing work perfectly through the `/api` reverse proxy subpath, tell the backend about its subpath prefix:
1. Open your `.env` file on your host.
2. Uncomment or set the `ROOT_PATH` variable to `/api`:
   ```env
   ROOT_PATH=/api
   ```
3. Re-create the containers:
   ```bash
   docker compose down && docker compose up -d
   ```
*This informs FastAPI that it is running behind a proxy with the `/api` prefix. It will automatically strip `/api` from all incoming requests before matching them, allowing `/api/docs` to load successfully and letting the interactive "Try it out" buttons send test requests to the correct paths.*

---

## 8. Host Port Conflict on Port 8000 (CLI Deployments)
**Error Log Example:**
`Error response from daemon: driver failed programming external connectivity on endpoint voyarr-backend: Bind for 0.0.0.0:8000 failed: port is already allocated`

**Cause:**
In the main `docker-compose.yml`, the backend host-exposed port is configured as `${BACKEND_PORT:-8000}:8000`. If you deploy Voyarr via the Command Line (CLI) and leave the `BACKEND_PORT` variable blank or empty in your `.env` file, Docker Compose falls back to attempting to bind the backend container to port `8000` on your host. If you have another service (such as Portainer, OMV, or a development server) already using port 8000, the deployment will fail.

**Solution:**
If you are deploying via the CLI (instead of Synology Container Manager's auto-allocation GUI which automatically resolves port conflicts):
1. Open your `.env` file.
2. Assign a custom, unused host integer port to `BACKEND_PORT` (e.g., `32785`):
   ```env
   BACKEND_PORT=32785
   ```
3. Run the startup command again:
   ```bash
   docker compose up -d
   ```

---

## 9. Securely Connecting to the PostgreSQL Database (DBeaver via SSH Tunnel)

**Goal:**
Connect a database administration tool (such as **DBeaver**, **pgAdmin**, or **DataGrip**) from your desktop machine to the PostgreSQL database container running on your NAS or host server, without exposing the database port publicly to the local network (LAN) or the internet.

**Why this is highly secure:**
In the production `docker-compose.yml`, the database container has its `ports:` mapping completely omitted by default to prevent any port conflicts on your host server (such as Synology NAS's built-in Postgres service using port 5432). 

To connect an external tool, you must explicitly expose the database port on your host's loopback interface by adding the following section back to the `db` service inside your `docker-compose.yml`:
```yaml
    ports:
      - "127.0.0.1:5435:5432"
```
*(By binding to `127.0.0.1` and using a non-conflicting port like `5435`, the database port remains unreachable directly over the LAN, but is accessible locally through an SSH Tunnel).*

**Step-by-Step Configuration in DBeaver:**

1. **Create a New PostgreSQL Connection:**
   * Open DBeaver, click **New Database Connection**, and select **PostgreSQL**.

2. **Configure the Main Connection Settings (Connection Tab):**
   * **Host:** `127.0.0.1` *(Leave this exactly as `127.0.0.1`. Do NOT type your NAS/server IP here, because from the perspective of the SSH tunnel terminal inside the NAS, the database port is bound to the NAS's localhost interface).*
   * **Port:** `5435` *(Or whichever custom loopback host port you configured in your `ports:` mapping)*
   * **Database:** `voyarr` *(Or the value of `POSTGRES_DB`)*
   * **Username:** `voyarr_user` *(Or the value of `POSTGRES_USER`)*
   * **Password:** `voyarr_password` *(Or the value of `POSTGRES_PASSWORD`)*

3. **Configure the SSH Tunnel (SSH Tab):**
   * Toggle **Use SSH Tunnel** to **ON** (checked).
   * **SSH Host:** `<your-nas-ip-address-or-domain>` *(Type the actual IP address or domain name of your NAS/server)*
   * **Port:** `22` *(Or your customized Synology/host SSH port)*
   * **User Name:** Your NAS/host system username with SSH administration privileges (e.g., your Synology DSM administrator account).
   * **Authentication Method:** Select **Password** (or **Public Key** if you use SSH keypairs).
   * **Password / Private Key:** Enter your NAS login password or path to your SSH private key file.

4. **Test Connection:**
   * Click **Test Connection** at the bottom left.
   * DBeaver will securely authenticate over SSH first, map the remote `127.0.0.1:5435` loopback socket locally over the encrypted tunnel, and establish a fully secure connection to your Postgres instance!

---

## 10. Browserless / Scraping Connection Errors

**Error Log Example:**
`WebSocket connection failed` or `Connection refused to wss://chrome.browserless.io` or `net::ERR_NAME_NOT_RESOLVED` for `ws://browserless:3000`

**Cause:**
The backend or celery worker cannot connect to the headless Chrome instance required for advanced metadata scraping. This is usually due to a missing/invalid API token, incorrect URL, or the local container not running.

**Solution:**
Depending on whether you are using the cloud-hosted Browserless service or running it locally, check the following in your `.env` file:

* **If using Cloud (Browserless.io - Default):**
  1. Ensure your URL is correct: `BROWSERLESS_URL=wss://chrome.browserless.io`
  2. Make sure you signed up for an account and provided a valid token: `BROWSERLESS_TOKEN=your_actual_api_key`

* **If using Local Docker Container:**
  1. Ensure you have explicitly started the browserless container (it is disabled by default). Run: `docker compose --profile browserless up -d`
  2. Ensure your URL points to the local container: `BROWSERLESS_URL=ws://browserless:3000`
  3. Verify the token matches the default or what you set in the compose file: `BROWSERLESS_TOKEN=voyarr-secure-browserless-token`

After making any changes to your `.env` file, restart your containers to apply them:
```bash
docker compose down && docker compose up -d
```

---

## 11. "504 Gateway Timeout" During Portainer Stack Deployment

**Error Example:**
Portainer UI throws an error: `504 Gateway Timeout` or `Gateway Timeout` when attempting to deploy, start, or update the Voyarr stack.

**Cause:**
Portainer has a default web request timeout (usually 60 seconds) when deploying stacks. If you are starting Voyarr for the first time, Docker needs to pull the backend, frontend, database, and background images. If your internet connection is slow, or if the optional heavy `browserless/chrome` image is being downloaded, the process exceeds 60 seconds. Portainer's UI times out, even though the host's Docker daemon continues pulling the images in the background.

**Solution:**
1. **Pre-pull the images:** SSH into your host server and run the pull commands manually before deploying in Portainer:
   ```bash
   docker pull ghcr.io/gabrieljustinsider/voyarr-backend:latest
   docker pull browserless/chrome:latest
   ```
   Once the images are cached on the host, Portainer's stack deployment will finish instantly without timing out.
2. **Use Cloud Browserless (Default):** Make sure you do not start the stack with the local `browserless` profile enabled unless necessary. This avoids downloading the heavy Chrome image entirely.
3. **Deploy via CLI:** If you continue to experience UI timeouts, bypass Portainer's editor and deploy directly from your host shell:
   ```bash
   docker compose up -d
   ```

---

## 12. "500 Internal Server Error" During Portainer Stack Deployment

**Error Example:**
Portainer UI displays a generic red banner: `500 Internal Server Error` or `Request failed with status code 500` when clicking **Deploy the stack**.

**Cause:**
Because Portainer passes stack deployment requests directly to the underlying Docker daemon, a `500` status is a generic catch-all error wrapping several potential Docker engine issues:
1. **Relative Volume Paths:** The `docker-compose.yml` defaults to relative volumes for media (e.g., `${HOST_MEDIA_PATH_1:-./media}`). Portainer Community Edition (CE) does not automatically resolve relative host directories unless configured.
2. **Missing Host Folders:** Docker cannot mount host paths that do not exist, throwing an internal daemon error.
3. **Port Conflicts:** If ports `80` (frontend default) or `5432` (database default) are already in use on the host, the deployment fails.

**Solution:**
1. **Examine the True Error:**
   Before deploying, open your browser's Developer Tools (**F12 -> Network tab**). Click **Deploy the stack**, locate the failed red request (usually under `/api/stacks`), and check the **Response** tab. This will reveal the exact Docker error message (e.g., `bind source path does not exist`).
2. **Define Absolute Paths in the Environment:**
   In your stack environment variables (or `.env` file), configure `HOST_MEDIA_PATH_1` to point to a valid, **absolute** directory path on your host machine:
   ```env
   HOST_MEDIA_PATH_1=/volume1/docker/voyarr/media
   ```
3. **Verify Folders Exist:**
   Ensure that you manually create the directory specified in `HOST_MEDIA_PATH_1` on the host server before deploying.
4. **Resolve Port Conflicts:**
   Set custom frontend and backend ports in your stack variables if the defaults (`80`, `8000`) are already occupied:
   ```env
   FRONTEND_PORT=8082
   BACKEND_PORT=8083
   ```

---

## 13. "Unable to start stack: Sorry, the page you are looking for is not found" (Synology Inc.) in Portainer

**Error Example:**
When deploying the stack, the Portainer UI fails and prints a raw HTML error containing:
`Sorry, the page you are looking for is not found. ... Synology Inc.`

**Cause:**
This error indicates a communication disruption between your browser and Portainer, returned by the Synology Host's built-in Reverse Proxy/Web Station. The most common trigger is a **Port Conflict on Port 80**:
1. The `docker-compose.yml` defaults the frontend service port to `80` (`${FRONTEND_PORT:-80}:80`).
2. On Synology NAS, port `80` is permanently reserved by the host system (Web Station/DSM) to route HTTP traffic.
3. When Docker attempts to bind the frontend container to host port `80`, the allocation fails. This startup crash/network error causes the Synology reverse proxy routing your traffic to Portainer to lose connection to the backend agent, returning a Synology `404 Not Found` HTML page instead.

**Solution:**
1. **Change the Frontend Port**:
   In your Portainer stack environment variables (or `.env` file), set `FRONTEND_PORT` to an unused custom port (e.g., `8082` or `32786`):
   ```env
   FRONTEND_PORT=8082
   ```
2. **Re-deploy the Stack**:
   Click **Deploy the stack** again. With the port conflict resolved, the containers will bind successfully and the stack will start without triggering the Synology proxy 404 response.