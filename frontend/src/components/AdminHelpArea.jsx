import React from 'react';
import { Box, Typography, Paper, Alert } from '@mui/material';

export default function AdminHelpArea() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'error.main' }}>
        Admin Help &amp; Architecture Guide
      </Typography>
      
      <Alert severity="warning" sx={{ mb: 4, borderRadius: '12px' }}>
        This area contains sensitive infrastructure information and is restricted to administrators only.
      </Alert>

      <Paper sx={{ p: 3, mb: 4, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          Entity Architectural Distinctions (Studios vs. Providers vs. Billers)
        </Typography>
        <Typography variant="body1" paragraph>
          Voyarr strictly decouples content creation, host scraping, and billing processing into three specialized entities:
        </Typography>
        <ul>
          <li><strong>Studios &amp; Networks:</strong> Represents production companies and brand networks (e.g., Brazzers, MindGeek/Aylo). Manages metadata tagging, library organization, and parent/subsidiary network relationships.</li>
          <li><strong>Media Providers:</strong> Represents streaming sites and host targets (e.g., ManyVids, OnlyFans, Pornhub). Manages authentication credentials, browser session cookies, scraper rules, download quotas, and daily limits.</li>
          <li><strong>Subscription Billers:</strong> Represents payment processors listed on credit card statements (e.g., CCBill, Probiller, SegPay). Maps subscriptions to financial statement descriptors and tracks renewal dates.</li>
        </ul>
      </Paper>

      <Paper sx={{ p: 3, mb: 4, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          Internal File Storage &amp; Write Paths
        </Typography>
        <Typography variant="body1" paragraph>
          Voyarr operates securely inside isolated Docker volumes. The backend will only attempt to write to the following designated directories:
        </Typography>
        <ul>
          <li><strong>/app/config/</strong>: System configurations, session states, and persistent certs.</li>
          <li><strong>/app/backups/</strong>: Used for automated JSON database backups.</li>
          <li><strong>/media/storage/logs/</strong>: FastAPI and Celery worker diagnostic logs.</li>
          <li><strong>/media/storage/downloads/</strong>: Ephemeral active queues and live stream recordings.</li>
          <li><strong>/tmp/</strong>: Used for temporary cookie text bridging to yt-dlp, Celery Beat lock files, and the Celery Beat schedule database (which prevents PUID write permission issues).</li>
        </ul>
      </Paper>

      <Paper sx={{ p: 3, mb: 4, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          VPN &amp; Sidecar Architecture
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Gluetun VPN Sidecar:</strong> When using <code>docker-compose.vpn.yml</code>, all backend and worker containers are forced to route their network traffic through the Gluetun VPN container using <code>network_mode: "service:vpn"</code>.
          Ensure you configure your VPN credentials correctly in <code>.env.vpn</code> before launching the stack, as an unhealthy VPN sidecar will block all external API and scraping requests.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Tailscale Mesh VPN:</strong> For secure, remote access without exposing ports, you can deploy the <code>docker-compose.tailscale.yml</code> sidecar. It utilizes Tailscale Serve (via <code>tailscale-serve.json</code>) to automatically reverse proxy the Nginx frontend to your authorized private Tailnet nodes over HTTPS. You must provide a valid <code>TS_AUTHKEY</code> in your environment variables.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 4, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          Database, Routing &amp; Port Troubleshooting
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Host Port Conflict Avoidance:</strong> Postgres (5432), Redis (6379), and the FastAPI backend (8000) are commented out on the host by default. The application is completely self-contained—the Nginx frontend reverse-proxies <code>/api</code> requests internally over Docker's bridge network. You only need to expose them if you explicitly connect external tools.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Database Connection Refused:</strong> Ensure your <code>DATABASE_URL</code> strictly specifies port <code>5432</code>. The backend must connect via the internal Docker bridge network, not your host's exposed Postgres port.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Interactive API Docs 404:</strong> If the Swagger UI docs (<code>/api/docs</code>) return a 404, set <code>ROOT_PATH=/api</code> in your <code>.env</code> file. This informs FastAPI that it is running behind an Nginx prefix and correctly rewrites all internal asset URLs.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Queue Starvation:</strong> If your Celery queues freeze during heavy scraping, increase <code>CELERY_CONCURRENCY</code> in your environment file and ensure Redis is healthy.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 4, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          Video Streaming &amp; Media Serving
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>SmartVideoPlayer:</strong> The built-in video player (<code>SmartVideoPlayer</code> component) auto-detects the playback strategy from each URL — HLS (<code>.m3u8</code>), MPEG-DASH (<code>.mpd</code>), or native HTML5 for all other container formats. The hls.js and dash.js libraries are loaded from CDN (<code>jsdelivr.net</code> / <code>dashjs.org</code>) on demand; no build-time dependency is added.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Stream MIME Types:</strong> The backend's <code>/api/library/&#123;id&#125;/stream</code> endpoint detects the correct MIME type from the file extension and sets it in the <code>Content-Type</code> response header. This allows the browser to route the stream to the correct decoder. The following MIME types are handled: <code>video/mp4</code>, <code>video/x-matroska</code> (MKV), <code>video/webm</code>, <code>video/quicktime</code> (MOV), <code>video/x-msvideo</code> (AVI), <code>video/x-ms-wmv</code>, <code>video/x-flv</code>, <code>video/mp2t</code> (TS), <code>video/mpeg</code>, <code>video/3gpp</code>, and all common audio MIME types.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Global Streaming Toggle:</strong> Streaming can be globally disabled by admins in <strong>Settings → Feature Permissions</strong>. When disabled, the player area displays a warning message instead of the video element. Users with insufficient role permissions to access streaming will receive a <code>403 Forbidden</code> response, which does <em>not</em> trigger a logout — only <code>401 Unauthorized</code> resets the session.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Maximizing Compatibility:</strong> For guaranteed playback across all browsers (including Safari and mobile), use the <strong>Transcode Queue</strong> to convert files to <strong>MP4 with H.264 video and AAC audio</strong>. This format is natively supported by every modern browser without additional codec packs.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          Authentication &amp; Session Management
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Passkey Setup Wizard:</strong> The onboarding wizard auto-populates the WebAuthn Relying Party ID (<code>passkeys_rp_id</code>) with the current <code>window.location.hostname</code>. The layout uses a responsive two-column grid on desktop/tablet screens. Default settings are pre-configured for standard server environments and do not require changes for most deployments.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>401 vs. 403 Handling:</strong> The global API wrapper (<code>api.js</code>) and SSE stream handlers (<code>App.jsx</code>) only trigger a full session reset (redirect to login) on <code>401 Unauthorized</code> responses. A <code>403 Forbidden</code> response (e.g., RBAC restriction, feature disabled) is surfaced as an error in the UI without logging the user out.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>WebAuthn .well-known:</strong> The file at <code>frontend/public/.well-known/webauthn</code> lists the authorized Relying Party IDs that are allowed to use passkeys on this origin. Ensure the domain configured in <code>passkeys_rp_id</code> matches the origin from which users access the app.
        </Typography>
      </Paper>
    </Box>
  );
}
