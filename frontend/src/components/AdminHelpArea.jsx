import React from 'react';
import { Box, Typography, Paper, Alert } from '@mui/material';

export default function AdminHelpArea() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'error.main' }}>
        Admin Help & Architecture Guide
      </Typography>
      
      <Alert severity="warning" sx={{ mb: 4, borderRadius: '12px' }}>
        This area contains sensitive infrastructure information and is restricted to administrators only.
      </Alert>

      <Paper sx={{ p: 3, mb: 4, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          Internal File Storage & Write Paths
        </Typography>
        <Typography variant="body1" paragraph>
          Voyarr operates securely inside isolated Docker volumes. The backend will only attempt to write to the following designated directories:
        </Typography>
        <ul>
          <li><strong>/app/config/</strong>: System configurations, session states, and the Celery Beat schedule database.</li>
          <li><strong>/app/backups/</strong>: Used for automated JSON database backups.</li>
          <li><strong>/media/storage/logs/</strong>: FastAPI and Celery worker diagnostic logs.</li>
          <li><strong>/media/storage/downloads/</strong>: Ephemeral active queues and live stream recordings.</li>
          <li><strong>/tmp/</strong>: Used for temporary cookie text bridging to yt-dlp.</li>
        </ul>
      </Paper>

      <Paper sx={{ p: 3, mb: 4, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          VPN & Sidecar Architecture
        </Typography>
        <Typography variant="body1" paragraph>
          When using <code>docker-compose.vpn.yml</code>, all backend and worker containers are forced to route their network traffic through the Gluetun VPN container using <code>network_mode: "service:vpn"</code>.
        </Typography>
        <Typography variant="body1" paragraph>
          Ensure you configure your VPN credentials correctly in <code>.env.vpn</code> before launching the stack, as an unhealthy VPN sidecar will block all external API and scraping requests.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <Typography variant="h6" gutterBottom color="primary">
          Database & Celery Troubleshooting
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Database Connection Refused:</strong> Ensure your <code>DATABASE_URL</code> strictly specifies port <code>5432</code>. The backend must connect via the internal Docker bridge network, not your host's exposed Postgres port.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Queue Starvation:</strong> If your Celery queues freeze during heavy scraping, increase <code>CELERY_CONCURRENCY</code> in your environment file and ensure Redis is healthy.
        </Typography>
      </Paper>
    </Box>
  );
}
