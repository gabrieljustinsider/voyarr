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

      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Frequently Asked Questions
      </Typography>

      {/* ── Existing FAQs ─────────────────────────────────────────────── */}

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
