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