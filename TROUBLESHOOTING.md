# Voyarr Troubleshooting Guide

Common issues and their solutions.

## 1. Container fails to start with "Bind mount failed"

**Error example:**
```
Error response from daemon: Bind mount failed: '/path/to/media' does not exist
```

**Cause:** Bind-mounted host paths (media storage, downloads) must exist on the host before the container starts.

**Solution:**
1. Create the missing directory on your host: `mkdir -p /path/to/media`
2. Verify `HOST_MEDIA_PATH_1` in `.env` points to an existing directory.
3. Run `npm run up` again.

Named volumes for system data (config, db-data, backups) are created automatically by Docker.

## 2. Backend starts but database connection is refused

**Error example:**
```
Database connection failed: (psycopg2.OperationalError) connection to server at "db"
```

**Cause:** If the database is Docker-based (`DATABASE_TARGET=docker`), the backend container may start before the PostgreSQL container is ready. If using Neon (`DATABASE_TARGET=neon`), the connection string may be incorrect.

**Solutions:**

For Docker database:
- The backend automatically retries the connection up to 10 times with a 3-second delay. Wait 30 seconds.
- Check that the database container is running: `docker compose ps`

For Neon database:
- Verify `NEON_DATABASE_URL` is correctly set in your environment.
- Ensure your Neon database's IP is allowlisted for your connection.
- Check that SSL mode is enabled in the connection string (`?sslmode=require`).

## 3. Permission Denied errors for media files

**Error example:**
```
PermissionError: [Errno 13] Permission denied: '/media/storage/downloads/video.mp4'
```

**Cause:** The container's user ID doesn't have write permissions to your host media directories.

**Solution:**
1. Find your host user ID: `id` (look for `uid=1000` and `gid=1000`).
2. Set `PUID` and `PGID` in `.env` to match.
3. If media files are owned by a different group (e.g., a `media` group on a NAS), set `SUPPLEMENTARY_GID` to that group's ID.
4. Restart the stack: `npm run up`

## 4. Frontend shows blank page or API errors

**Error example:**
```
Failed to fetch /api/health
```

**Cause:** The frontend cannot reach the backend API.

**Solutions:**

For Docker frontend (`FRONTEND_TARGET=docker`):
- The nginx container proxies `/api` requests to the backend container. Verify both containers are running: `docker compose ps`
- Check the backend health: `curl http://localhost:8000/health`

For Cloudflare Pages frontend (`FRONTEND_TARGET=cloudflare-pages`):
- Verify `FRONTEND_BACKEND_URL` is set correctly in `.env`.
- If using Cloudflare Tunnel, ensure the tunnel is running and the token is valid.
- If the backend has CORS restrictions, verify `CORS_ORIGINS` includes your Cloudflare Pages domain.

## 5. Downloads stall or fail

**Error example:**
```
yt-dlp error: Unable to extract video data
```

**Cause:** The scraper browser cannot access the target website, or the provider credentials are invalid.

**Solutions:**
1. Check the scraper browser is running (if using Docker).
2. If using browserless.io, verify your `BROWSERLESS_TOKEN` is correct and has available usage.
3. Verify provider credentials in Settings > Credentials.
4. Check the Celery worker logs: `docker compose logs celery_worker`

## 6. Out of disk space

Docker named volumes consume host disk space. Check their sizes:

```bash
docker system df -v | grep voyarr
```

To prune unused volumes (careful — this removes data):
```bash
docker volume prune --filter name=voyarr
```

Backup volumes before any pruning:

```bash
docker run --rm -v voyarr-backups:/backups alpine tar czf /backups/volumes-backup.tar.gz /backups
```

## 7. Database connection string issues

**Error example:**
```
FATAL: password authentication failed for user "voyarr_user"
```

**Cause:** The `DATABASE_URL` or individual `POSTGRES_*` variables are misconfigured.

**Solution:**
1. If using Docker database, verify `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` match.
2. If using Neon, the `NEON_DATABASE_URL` must be the full connection string including password.
3. Password containing special characters may need URL encoding (%40 for @, %23 for #, etc.).

## 8. Cloudflare Tunnel not connecting

**Error example:**
```
cloudflared error: failed to connect to origin
```

**Cause:** The cloudflared container cannot reach the backend service.

**Solution:**
1. Ensure the backend container is healthy: `docker compose ps backend`
2. Verify `CLOUDFLARE_TUNNEL_TOKEN` is correctly set.
3. Check cloudflared logs: `docker compose logs cloudflared`
4. Ensure your tunnel was created and configured:
   ```bash
   cloudflared tunnel list
   cloudflared tunnel route dns list <tunnel-name>
   ```

## 9. Celery tasks not executing

**Error example:**
```
Received unregistered task
```

**Cause:** The Celery worker and beat services may be out of sync.

**Solution:**
1. Check the worker is connected to Redis: `docker compose logs celery_worker`
2. Restart both services: `docker compose restart celery_worker celery_beat`
3. Verify Redis is running: `docker compose ps redis`

## 10. General troubleshooting steps

If you encounter an issue not listed here:

1. Check all container logs:
   ```bash
   docker compose logs -f
   ```

2. Verify all services are running:
   ```bash
   docker compose ps
   ```

3. Check the health endpoint:
   ```bash
   curl http://localhost:8000/health
   ```

4. Restart the entire stack:
   ```bash
   npm run down && npm run up
   ```

5. For persistent issues, check the GitHub Issues page or open a new issue with relevant logs.
