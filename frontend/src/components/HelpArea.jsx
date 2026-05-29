import React from 'react';
import { Box, Typography, Paper, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AdminHelpArea from './AdminHelpArea';

export default function HelpArea({ userRole }) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        User Help & Documentation
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

      <Accordion sx={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', mb: 1 }}>
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

      <Accordion sx={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">How does the Duplicates engine work?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Voyarr uses Perceptual Hashing (phash) to visually analyze video frames. It groups visually identical videos together in the <strong>Duplicates</strong> tab, allowing you to bulk-resolve conflicts by keeping the highest quality version.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">How do I manage my premium subscriptions and trials?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Use the <strong>Subscriptions</strong> tab to view your active subscriptions, trials, and costs. You can paste a confirmation email to auto-extract billing data, or use the <strong>Voyarr Lens</strong> browser extension on the active provider's tab to securely scan and import subscription and tier details directly into Voyarr.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Can I use external password managers?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Yes! Go to the Advanced Preferences or External APIs tab to link your 1Password Connect or Bitwarden CLI instances.
          </Typography>
        </AccordionDetails>
      </Accordion>
      
      <Paper sx={{ p: 3, mt: 4, borderRadius: '16px', borderLeft: '4px solid #1976d2', background: 'rgba(25, 118, 210, 0.1)' }}>
        <Typography variant="h6" gutterBottom>
          Troubleshooting Tips
        </Typography>
        <ul>
          <li>If tasks are stuck in "Pending", ensure the Celery Worker container is running and healthy.</li>
          <li>If metadata isn't saving to files, verify your <code>/media/storage</code> volume mapping points to the correct host folder.</li>
          <li>For UI rendering issues, try clearing your browser cache or adjusting the Theme in Interface Preferences.</li>
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
