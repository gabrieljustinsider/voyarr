import React from 'react';
import { Box, Typography, Paper, Accordion, AccordionSummary, AccordionDetails, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AdminHelpArea from './AdminHelpArea';

const ACCORDION_SX = { background: 'rgba(255,255,255,0.05)', borderRadius: '8px', mb: 1 }

export default function HelpArea({ userRole }) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        User Help &amp; Documentation
      </Typography>
      
      <Paper sx={{ p: 3, mb: 4, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          Getting Started
        </Typography>
        <Typography variant="body1" paragraph>
          Welcome to Voyarr! To get started, configure your provider accounts in the <strong>Providers</strong> tab and ensure you have entered your credentials. 
          Use the <strong>Mass Rip</strong> tab to scrape links automatically, or the <strong>Downloads</strong> tab to monitor active tasks.
        </Typography>
        <Typography variant="body1" paragraph>
          If you are using the Browser Extension, ensure it is connected to the same API URL as this dashboard.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 4, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          🗺️ Tab Directory &amp; Feature Overview
        </Typography>
        <Typography variant="body2" paragraph color="textSecondary">
          Every tab in Voyarr serves a specialized operational purpose:
        </Typography>
        <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 1 } }}>
          <li><strong>📊 Dashboard:</strong> Real-time operational telemetry, active download queues, server bandwidth, and storage health.</li>
          <li><strong>🎬 Media Library:</strong> Stream, search, filter, and organize indexed video collections with resolution and tag filters.</li>
          <li><strong>⚡ Mass Rip:</strong> Bulk video link extraction engine from target channels, playlists, and user profiles.</li>
          <li><strong>⚙️ Transcode Queue:</strong> Hardware-accelerated video converter for web-compatible H.264/MP4 formats.</li>
          <li><strong>📡 Live Streams:</strong> Monitor, preview, and record real-time HLS streams and webcam broadcasts.</li>
          <li><strong>🎬 Studios:</strong> Production companies and network hierarchies for metadata tagging and library organization.</li>
          <li><strong>📡 Providers:</strong> Download hosts and streaming sites for login credentials, cookie storage, and rate limits.</li>
          <li><strong>💳 Billers:</strong> Subscription payment processors mapped to credit card statement descriptors.</li>
          <li><strong>💎 Subscriptions:</strong> Track active memberships, free trial expirations, and monthly expenditure.</li>
          <li><strong>⏱️ Schedules:</strong> Automated recurring background scraper and maintenance cron jobs.</li>
          <li><strong>🔄 P2P Sync:</strong> Secure catalog replication and scraper recipe sharing between remote Voyarr nodes.</li>
          <li><strong>🏷️ Metadata Manager:</strong> Scraper enrichment (TPDB, StashDB), URL parsing, and NFO file generators.</li>
          <li><strong>🔍 Duplicates:</strong> Frame-by-frame perceptual hash (pHash) visual duplicate finder and conflict resolution.</li>
          <li><strong>❤️ Favorites:</strong> Bookmarked collection of starred scenes, performers, studios, and custom tags.</li>
          <li><strong>📈 Analytics:</strong> Playback statistics, peak bandwidth graphs, and downloadable CSV analytics reports.</li>
          <li><strong>📋 System Logs:</strong> Live stdout/stderr console logs and categorized error diagnostic tools.</li>
          <li><strong>⚙️ Settings:</strong> Vault integrations (1Password, Bitwarden), authentication policies, and API keys.</li>
        </Box>
      </Paper>

      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Frequently Asked Questions
      </Typography>

      {/* ── Existing FAQs ─────────────────────────────────────────────── */}

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">What is the difference between Studios, Media Providers, and Subscription Billers?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Voyarr maintains three distinct entity types to organize your media, downloads, and finances:
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0 }}>
            <li style={{ marginBottom: '8px' }}>
              <strong>🎬 Production Studios &amp; Networks (Who Creates Content):</strong> Represents content producers, production houses, and broadcast networks (e.g. <em>Brazzers</em>, <em>MindGeek/Aylo</em>). Used for metadata tagging, library organization, and establishing parent/subsidiary network hierarchies.
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>📡 Media Providers (Where Content is Downloaded From):</strong> Represents streaming sites and download hosts (e.g. <em>ManyVids</em>, <em>OnlyFans</em>, <em>Pornhub</em>). Used to store login credentials, browser session cookies, scraper rules, and download rate limits.
            </li>
            <li>
              <strong>💳 Subscription Billers (How Access is Paid For):</strong> Represents payment processing entities listed on bank/credit card statements (e.g. <em>CCBill</em>, <em>Probiller</em>, <em>Epoch</em>, <em>SegPay</em>). Used to map subscriptions to statement descriptors and track billing renewals.
            </li>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">How do I fix "Permission Denied" errors?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            This usually happens if the container user doesn't have permission to write to your media folders. 
            Ensure your PUID and PGID in the <code>.env</code> file match your host user's IDs.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">How does the Duplicates engine work?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Voyarr uses Perceptual Hashing (phash) to visually analyze video frames. It groups visually identical videos together in the <strong>Duplicates</strong> tab, allowing you to bulk-resolve conflicts by keeping the highest quality version.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">How do I manage my premium subscriptions and trials?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Use the <strong>Subscriptions</strong> tab to view your active subscriptions, trials, and costs. You can paste a confirmation email to auto-extract billing data, or use the <strong>Voyarr Lens</strong> browser extension on the active provider's tab to securely scan and import subscription and tier details directly into Voyarr.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Can I use external password managers?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Yes! Go to the Advanced Preferences or External APIs tab to link your 1Password Connect or Bitwarden CLI instances.
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* ── Video Playback FAQs ────────────────────────────────────────── */}

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">What video formats and codecs does Voyarr support?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Voyarr uses a <strong>SmartVideoPlayer</strong> that automatically detects the correct playback strategy from each file's URL — no manual configuration needed.
          </Typography>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 1 }}>Streaming Protocols</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            {['HLS (.m3u8)', 'MPEG-DASH (.mpd)'].map(f => (
              <Chip key={f} label={f} size="small" color="primary" variant="outlined" />
            ))}
          </Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>Video Containers</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            {['MP4', 'M4V', 'MOV', 'MKV', 'WebM', 'OGV', 'AVI', 'WMV', 'FLV', 'TS / M2TS', 'MPEG / MPG', '3GP / 3G2'].map(f => (
              <Chip key={f} label={f} size="small" variant="outlined" />
            ))}
          </Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>Audio Formats</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            {['MP3', 'AAC', 'M4A', 'WAV', 'FLAC', 'OGG', 'OPUS', 'WebA'].map(f => (
              <Chip key={f} label={f} size="small" variant="outlined" />
            ))}
          </Box>
          <Typography variant="body2" color="textSecondary">
            <strong>Note:</strong> HLS and MPEG-DASH libraries (hls.js / dash.js) are loaded from CDN automatically only when needed. 
            Safari and iOS play HLS natively without any additional library. 
            MKV and AVI playback depends on your OS codec pack — Chrome/Edge on Windows provide the best support. 
            For guaranteed compatibility on all browsers, use the <strong>Transcode Queue</strong> to convert files to MP4 with H.264 video and AAC audio.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">A video won't play or I see a codec error — what do I do?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Open your browser's developer console (F12 → Console tab) and look for an error code:
          </Typography>
          <Box component="ul" sx={{ pl: 2, mt: 0 }}>
            <li><Typography variant="body2"><strong>MEDIA_ERR_SRC_NOT_SUPPORTED (code 4)</strong> — The container format is not supported by your browser. Try Chrome or Edge on Windows for MKV/AVI, or transcode the file to MP4.</Typography></li>
            <li><Typography variant="body2"><strong>MEDIA_ERR_DECODE (code 3)</strong> — The file can be opened but the codec inside isn't supported. Common with H.265/HEVC video in Firefox. Transcode to H.264 via the Transcode Queue.</Typography></li>
            <li><Typography variant="body2"><strong>MEDIA_ERR_NETWORK (code 2)</strong> — A network issue interrupted the stream. Check the backend container is healthy and the file exists on disk.</Typography></li>
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            For the widest browser support, use <strong>Settings → Transcode Queue</strong> to re-encode any file to <strong>MP4 (H.264 video + AAC audio)</strong>.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">How do live streams work in the player?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            The <strong>Live Streams</strong> tab resolves a monitored URL to its real stream link via the backend, then hands it off to the SmartVideoPlayer which auto-detects the protocol:
          </Typography>
          <Box component="ul" sx={{ pl: 2, mt: 0 }}>
            <li><Typography variant="body2"><strong>HLS (.m3u8)</strong> — Played via hls.js (all browsers) or natively (Safari/iOS). Low-latency mode is enabled.</Typography></li>
            <li><Typography variant="body2"><strong>MPEG-DASH (.mpd)</strong> — Played via dash.js, loaded from CDN on demand.</Typography></li>
            <li><Typography variant="body2"><strong>RTMP / RTSP</strong> — These protocols cannot play in a browser. The stream must be re-streamed as HLS (e.g., via FFmpeg or a server-side proxy) and the <code>.m3u8</code> URL used instead.</Typography></li>
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            If the stream player shows "HLS not supported", ensure your browser has internet access to load hls.js from the CDN (jsdelivr.net).
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Does Voyarr support VR headsets / WebXR immersive playback?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Yes! The player has built-in **WebXR** rendering capabilities using Three.js (dynamic CDN lazy-loading):
          </Typography>
          <Box component="ul" sx={{ pl: 2, mt: 0 }}>
            <li><Typography variant="body2"><strong>Supported Headsets</strong> — Meta Quest (via Quest Browser), Apple Vision Pro (via Safari WebXR settings), HTC Vive, and all headsets supporting standard WebXR immersive VR sessions.</Typography></li>
            <li><Typography variant="body2"><strong>Projection Formats</strong> — Choose between **Flat Screen** (cinema theater mode), **180° Dome** (hemispherical projection), or **360° Sphere** (full spherical environment).</Typography></li>
            <li><Typography variant="body2"><strong>Stereoscopic Video</strong> — Supports stereoscopic Side-by-Side (SBS) videos. Enable **Stereo SBS** mode to map independent left/right perspectives to each eye.</Typography></li>
            <li><Typography variant="body2"><strong>Exiting VR Mode</strong> — Click the select/trigger button on either controller to exit immersive mode and return to the flat browser dashboard, or use your headset's system home button.</Typography></li>
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            If you do not see the "Enter Immersive VR" button, ensure you are accessing the dashboard over HTTPS or localhost, as WebXR is blocked by browsers on non-secure HTTP origins.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Can I browse my library in DeoVR Player without a password?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Yes. Voyarr serves a native DeoVR-compatible scene feed. You can sign in from your VR headset by generating a temporary 6-digit pairing code — no password entry required on the headset.
          </Typography>
          <Box component="ol" sx={{ pl: 2, mt: 0 }}>
            <li><Typography variant="body2"><strong>On your desktop</strong>, go to Account Security → VR Headset &amp; DeoVR Easy Sign-In → click <strong>Generate Code</strong> under "DeoVR Native Sign-In Code". A 6-digit code appears.</Typography></li>
            <li><Typography variant="body2"><strong>On your VR headset</strong>, open the DeoVR Player app and navigate to your Voyarr domain. Tap the <strong>Sign In</strong> button.</Typography></li>
            <li><Typography variant="body2">Enter the 6-digit code in the <strong>Password</strong> field. Leave the Username field blank.</Typography></li>
            <li><Typography variant="body2">Your library loads immediately in DeoVR's native VR interface — full metadata, thumbnails, and playback controls.</Typography></li>
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            The code expires after 5 minutes and can only be used once. Generate a new code from Account Security for each session. You can also use your Voyarr username and password directly in the DeoVR sign-in form.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={ACCORDION_SX}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">What metadata does Voyarr expose to DeoVR?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            The DeoVR scene feed includes the following per-video metadata:
          </Typography>
          <Box component="ul" sx={{ pl: 2, mt: 0 }}>
            <li><Typography variant="body2"><strong>Title, description, date added</strong> — Basic video information from your library.</Typography></li>
            <li><Typography variant="body2"><strong>Performers, tags, categories</strong> — Media organization metadata for filtering and discovery.</Typography></li>
            <li><Typography variant="body2"><strong>Duration, rating</strong> — Video length and user-assigned rating.</Typography></li>
            <li><Typography variant="body2"><strong>VR projection</strong> — Stereo mode (SBS, top-bottom, off) and screen type (flat, 180°, 360°, fisheye) are auto-detected from metadata or filenames.</Typography></li>
            <li><Typography variant="body2"><strong>Video encodings</strong> — Multiple resolution options with direct stream URLs.</Typography></li>
            <li><Typography variant="body2"><strong>Thumbnails and gallery images</strong> — Cover art and additional screenshots.</Typography></li>
            <li><Typography variant="body2"><strong>Preview clips</strong> — Short preview video URLs when available.</Typography></li>
            <li><Typography variant="body2"><strong>Funscript / HSP</strong> — Haptic feedback file URLs for interactive devices.</Typography></li>
            <li><Typography variant="body2"><strong>Download sources</strong> — Direct download links for offline playback.</Typography></li>
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            The feed is paginated (50 items per page) and supports filtering by search query, studio, performer, or tag via URL parameters.
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* ── Troubleshooting Tips ───────────────────────────────────────── */}
      
      <Paper sx={{ p: 3, mt: 4, borderRadius: '16px', borderLeft: '4px solid #1976d2', background: 'rgba(25, 118, 210, 0.1)' }}>
        <Typography variant="h6" gutterBottom>
          Troubleshooting Tips
        </Typography>
        <ul>
          <li>If tasks are stuck in "Pending", ensure the Celery Worker container is running and healthy.</li>
          <li>If metadata isn't saving to files, verify your <code>/media/storage</code> volume mapping points to the correct host folder.</li>
          <li>For UI rendering issues, try clearing your browser cache or adjusting the Theme in Interface Preferences.</li>
          <li>If a video shows a codec error, use the <strong>Transcode Queue</strong> to convert it to MP4 (H.264 + AAC) for maximum browser compatibility.</li>
          <li>If a live stream shows "HLS not supported" or fails to load, ensure your browser has internet access to load hls.js from <code>cdn.jsdelivr.net</code>.</li>
          <li>If you encounter database lock errors during bulk operations, check your disk I/O performance and ensure the SQLite database is not on a network drive.</li>
          <li>If thumbnails fail to generate, check that the FFmpeg binary is accessible within the container and verify your media file permissions.</li>
        </ul>
      </Paper>

      {/* Render AdminHelpArea contextually at the bottom for admins */}
      {userRole === 'admin' && (
        <Box sx={{ mt: 5, borderTop: '1px solid rgba(255,255,255,0.08)', pt: 4 }}>
          <AdminHelpArea />
        </Box>
      )}
    </Box>
  );
}
