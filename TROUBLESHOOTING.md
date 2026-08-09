# Voyarr Troubleshooting Guide

> **Version:** v1.100.1 · [User Guide](USER_GUIDE.md) · [README](README.md)

Common issues and their solutions.

---

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

---

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
- Ensure the connection string includes `?sslmode=require&channel_binding=require` (required by Neon).
- Check that your Neon project's IP allowlist permits connections from your server.

---

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

---

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

For Cloudflare Worker frontend (`FRONTEND_TARGET=cloudflare-worker`):
- Verify `FRONTEND_BACKEND_URL` is set correctly in `.env`.
- If using Cloudflare Tunnel, ensure the tunnel is running and the token is valid.
- Verify `CORS_ORIGINS` in your backend environment includes your Cloudflare Worker domain.

For local development (Vite):
- The Vite dev server proxies `/api` to `http://localhost:8000` by default (configurable via `VITE_API_BASE_URL`).
- Ensure the backend is running: `cd backend && python run.py`

---

## 5. Stale chunk errors after a deployment update

**Error example:**
```
Failed to fetch dynamically imported module: https://voyarr.example.com/assets/Library-xxxxx.js
```

**Cause:** After a new deployment, the browser may have cached the old index page referencing old asset chunk hashes, which no longer exist on the server.

**Solution:**
- Voyarr includes a `lazyWithRetry` wrapper and `ErrorBoundary` that automatically detect stale chunk hashes and perform a hard reload to fetch the updated assets.
- If the error persists, manually hard-refresh (`Ctrl+Shift+R` or `Cmd+Shift+R`) the browser tab.
- Clear browser cache and reload if automatic recovery does not trigger.

---

## 6. Downloads stall or fail

**Error example:**
```
yt-dlp error: Unable to extract video data
```

**Cause:** The scraper browser cannot access the target website, or the provider credentials are invalid.

**Solutions:**
1. Check the scraper browser is running (if using Docker): `docker compose ps scraper`
2. If using browserless.io, verify your `BROWSERLESS_TOKEN` is correct and has available session quota.
3. Verify provider credentials in **Settings → Credentials**.
4. Check the Celery worker logs: `docker compose logs celery_worker`
5. Verify the `extraction_method` column exists in `download_queue` — this is added automatically by the schema migration on startup.

---

## 7. Out of disk space

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

---

## 8. Database connection string issues

**Error example:**
```
FATAL: password authentication failed for user "voyarr_user"
```

**Cause:** The `DATABASE_URL` or individual `POSTGRES_*` variables are misconfigured.

**Solution:**
1. If using Docker database, verify `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` match across all references.
2. If using Neon, the `NEON_DATABASE_URL` must be the full connection string including password and SSL parameters.
3. Passwords containing special characters may need URL encoding (`%40` for `@`, `%23` for `#`, etc.).

---

## 9. Cloudflare Tunnel not connecting

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

---

## 10. Celery tasks not executing

**Error example:**
```
Received unregistered task
```

**Cause:** The Celery worker and beat services may be out of sync, or Redis is not accessible.

**Solution:**
1. Check the worker is connected to Redis: `docker compose logs celery_worker`
2. Restart both services: `docker compose restart celery_worker celery_beat`
3. Verify Redis is running: `docker compose ps redis`
4. Check Redis connectivity: `docker compose exec redis redis-cli ping`

---

## 11. Login redirects back to settings pages on reload

**Symptom:** After logging in, reloading the page (e.g., `/settings`) redirects back to the dashboard.

**Cause:** This was a tab restoration effect dependency loop in earlier versions that reset the active page back to Dashboard on mount.

**Status:** Fixed in v1.96.0. Ensure you are running v1.96.0 or later. If the issue persists, clear your browser's `localStorage` for the Voyarr origin and re-login.

---

## 12. File picker only shows root filesystem — custom media drives not visible

**Symptom:** The Path Picker file browser only shows `/` and doesn't have quick-access buttons for your media drives.

**Cause:** `HOST_MEDIA_PATH_1`, `HOST_MEDIA_PATH_2`, and/or `HOST_MEDIA_PATH_3` are not set or not mounted into the container.

**Solution:**
1. Verify the variables are set in `.env`.
2. Confirm the host paths exist: `ls -la /your/media/path`
3. Restart the stack: `npm run up`
4. The Path Picker will now show **Main Storage**, **Additional Storage**, **Downloads**, **Library**, **Scan / Import**, and **Mounts** as quick-access drives.

---

## 13. Video won't play / codec error

**Error examples (browser console):**
```
MEDIA_ERR_SRC_NOT_SUPPORTED
MEDIA_ERR_DECODE
```

**Browser codec support matrix:**

| Format | Chrome | Firefox | Safari | Edge (Win) |
|--------|--------|---------|--------|------------|
| MP4 / H.264 | ✅ | ✅ | ✅ | ✅ |
| MP4 / H.265 | ✅ (Win 11 + codec pack) | ❌ | ✅ | ✅ (Win 11) |
| WebM / VP9 | ✅ | ✅ | ⚠️ Limited | ✅ |
| MKV | ✅ | ✅ | ❌ | ⚠️ Needs Windows codec pack |
| AVI | ⚠️ | ⚠️ | ❌ | ⚠️ Needs codec pack |
| WMV / FLV | ❌ | ❌ | ❌ | ⚠️ Very limited |

**How to diagnose:**
1. Open your browser's Developer Tools (F12) and go to the **Console** tab.
2. Play the video and look for the error code:
   - `MEDIA_ERR_SRC_NOT_SUPPORTED` — the browser doesn't recognise the container/MIME type.
   - `MEDIA_ERR_DECODE` — the container is recognised but the codec inside is not supported.
3. The **Network** tab will show the stream request; confirm the `Content-Type` response header matches the actual file format.

**Solutions:**
- For `MEDIA_ERR_DECODE` or unsupported containers: use the **Transcode Queue** to convert the file to **MP4 (H.264 / AAC)**, which plays in every modern browser without codec packs.
- For MKV or WebM on Windows/Edge: install the [K-Lite Codec Pack](https://www.codecguide.com/) or switch to Chrome.
- For WMV or FLV: transcoding is the only reliable solution.

---

## 14. Live stream playback fails or shows "HLS not supported"

**Symptoms:**
- Stream spinner never resolves.
- Banner reads "HLS not supported" or "DASH not supported".
- Stream plays in VLC but not in Voyarr.

**How SmartVideoPlayer loads streaming libraries:**

hls.js (for `.m3u8` HLS streams) and dash.js (for `.mpd` DASH streams) are **lazy-loaded from CDN** at playback time. They are not bundled into the Voyarr frontend. This means:
- Your **browser must have internet access** when initiating HLS or DASH playback for the first time in a session.
- If the CDN is unreachable (e.g., strict network firewall, air-gapped server), the library will fail to load and you will see the "not supported" banner.
- **Safari / iOS** use native HLS and do not need hls.js at all.

**RTMP / RTSP streams cannot play in a browser:**

Web browsers do not support the RTMP or RTSP protocols natively. If your live stream source uses RTMP or RTSP, you must re-stream it as HLS using a media server (e.g., nginx-rtmp, SRS, or MediaMTX) before Voyarr can play it.

**Diagnosis checklist:**
1. Confirm the stream URL ends in `.m3u8` (HLS) or `.mpd` (DASH). If it starts with `rtmp://` or `rtsp://`, see the note above.
2. Open the stream URL directly in your browser to verify it resolves and returns valid playlist data.
3. Check the browser console for network errors — a 403/404 on the `.m3u8` URL means the stream source is down or requires authentication.
4. If on a restricted network, try loading `https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js` in your browser to confirm CDN access.

---

## 15. "Enter Immersive VR" button is missing or VR mode fails to launch

**Symptoms:**
- You are viewing the player inside a VR headset browser (e.g. Meta Quest Browser), but the "Enter Immersive VR" button does not appear.
- Clicking the button displays a "Failed to enter XR Mode: SecurityError" message.

**Causes:**
1. **Insecure Context (HTTP)**: Modern browsers restrict the WebXR Device API to **Secure Contexts**. If you access Voyarr using an unencrypted `http://` domain, the browser disables all VR capabilities.
2. **Blocked CDN Resources**: The player dynamically lazy-loads Three.js from `cdnjs.cloudflare.com`. If your headset's network blocks Cloudflare CDNs, the immersive renderer cannot initialize.

**Solutions:**
- **Access over HTTPS**: Enable SSL/TLS on your server or reverse proxy so you access Voyarr over `https://yourdomain.com`.
- **Use localhost fallback**: The browser treats `http://localhost` or `http://127.0.0.1` as secure. If debugging locally, ensure you use one of these.
- **Check Headset Connection**: Ensure your VR headset has internet access and can reach `https://cdnjs.cloudflare.com/` to fetch Three.js.
- **Safeguard Exit**: If your headset becomes stuck during WebXR playback, click the select trigger button on either VR controller to trigger the safeguard exit and return to the flat desktop layout.

---

## 16. Passkey "SecurityError: relying party ID not registrable" in browser console

**Symptom:** Browser console shows:
```
Passkey autofill conditional error: SecurityError: The relying party ID is not a registrable domain suffix of, nor equal to the current domain.
```

**Cause:** This error appears in local development when the passkey RP ID configured in Voyarr (typically `localhost`) doesn't exactly match what the browser expects. It is a **benign warning** in local development contexts and does not affect password login or any other functionality.

**In production:** Ensure the **Website Address Override** in passkey settings (Settings → Account Security → Passkey Configuration) matches your actual domain (e.g., `yourdomain.com`). Do not include the protocol (`https://`) or port number — only the bare domain.

---

## 17. General troubleshooting steps

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

5. For persistent issues, check the [GitHub Issues](https://github.com/gabrieljustinsider/voyarr/issues) page or open a new issue with relevant logs.

---

## 18. DeoVR / VR Headset Integration

### DeoVR shows "Unauthorized" or blank screen

The DeoVR browser requests a scene feed from `/deovr`. Unauthenticated requests receive an empty feed with a Sign In prompt.

**Solution:** Tap the **Sign In** button in the DeoVR app and enter a 6-digit pairing code (generated from Account Security on your desktop) or your Voyarr username and password.

### DeoVR shows "Invalid credentials" after signing in

**Likely causes:**
- The 6-digit pairing code expired (valid for 5 minutes). Generate a fresh code from Account Security.
- You entered your Voyarr username and password incorrectly. Check that your account exists and is active.

### "Sign In" button does not appear in DeoVR

**Solution:** Voyarr signals to DeoVR that authorization is required. If the button does not appear, ensure your Voyarr server is reachable over HTTPS. Try navigating to `https://yourdomain.com/deovr` directly in the DeoVR browser and confirm you receive a JSON response (you can inspect the response with a non-VR browser first).

### Pairing code not working

**Likely causes:**
- The code was generated on a different user account. Pairing codes are tied to the Voyarr user who generated them. Both the desktop session and the headset must authenticate against the same user account.
- The code expired after 5 minutes. Generate a new code.
- The code was already used. Each pairing code is single-use.

### `/pair` page does not display a code

**Solution:** Ensure the Cloudflare Worker is properly deployed and the `BACKEND_ORIGIN` environment variable is configured. The `/pair` page calls the backend API to generate a pairing code. If the backend is unreachable, the page displays a "Failed to connect to server" error.

### DeoVR feed shows no videos even after signing in

**Likely causes:**
- Your library is empty. Add media through the Voyarr web interface first.
- The streaming feature is disabled. Check **Settings → Feature Toggles** to ensure streaming is enabled.
- Your account does not have the "streaming" permission. Contact your Voyarr administrator.

### DeoVR feed shows incorrect VR metadata (wrong projection, no 3D)

Voyarr auto-detects stereo mode and screen type from file metadata and filenames. If detection is incorrect:

1. Manually set `stereo_mode` and `screenType` in the video's metadata via Voyarr's web interface.
2. Ensure file names follow naming conventions that include `SBS`, `TB`, `180`, `360`, or similar keywords.
3. Metadata from the scraping provider takes precedence over filename detection.

### QR code scan does not load the DeoVR feed

The QR code encodes the feed URL with your authentication token. If scanning shows an error:
- The token in the QR code may be expired. Generate a fresh QR code from Account Security.
- The QR code includes the `token` query parameter. Ensure your DeoVR app supports URL query parameters for authentication.
