import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, Button, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { apiFetch, API_BASE } from '../api';

export default function ScraperTester() {
  const [url, setUrl] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [status, setStatus] = useState('Idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const getAuthQuery = () => {
    const token = localStorage.getItem('voyarr_jwt')
    if (token) return `token=${encodeURIComponent(token)}`
    let apiKey = localStorage.getItem('voyarr_api_key')
    if (apiKey) {
      try {
        apiKey = atob(apiKey)
      } catch (e) {
        // fallback
      }
    }
    return `api_key=${encodeURIComponent(apiKey || '')}`
  }

  const handleScrape = async () => {
    if (!url || !recipeId) {
      setError("Both URL and Recipe ID are required.");
      return;
    }
    setStatus('Queuing task...');
    setError(null);
    setResult(null);

    try {
      const res = await apiFetch('/external-api/scrape', {
        method: 'POST',
        body: JSON.stringify({ url, recipe_id: parseInt(recipeId, 10) })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to queue scraping task");
      }

      const data = await res.json();
      setStatus('Waiting for scrape to finish (connecting to stream)...');
      startSSE(data.task_id);
    } catch (err) {
      setStatus('Failed');
      setError(err.message);
    }
  };

  const [scrapingEnabled, setScrapingEnabled] = useState(true);

  useEffect(() => {
    apiFetch('/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.scraping_enabled === 'false') {
          setScrapingEnabled(false);
        }
      })
      .catch(console.error);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startSSE = (taskId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Using query parameter for auth since EventSource doesn't support custom headers
    const eventSource = new EventSource(`${API_BASE}/external-api/scrape/stream/${taskId}?${getAuthQuery()}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.status === 'success') {
        setStatus('Completed');
        setResult(data.result);
        eventSource.close();
      } else if (data.status === 'failed') {
        setStatus('Failed');
        setError(data.error);
        eventSource.close();
      } else {
        setStatus(`In progress: ${data.status}`);
      }
    };

    eventSource.onerror = () => {
      setStatus('Failed');
      setError("Lost connection to the streaming server.");
      eventSource.close();
    };
  };

  const isBusy = status.startsWith('In progress') || status === 'Queuing task...' || status.startsWith('Waiting');

  return (
    <Box sx={{ mt: 2, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h6" gutterBottom>Test Dynamic Scraper</Typography>
      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!scrapingEnabled && (
          <Alert severity="warning" sx={{ mb: 1 }} style={{ color: '#ff9800', background: 'rgba(255, 152, 0, 0.08)', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
            ⚠️ Access Denied: The Scraping feature is disabled globally by the administrator. Please enable it in Settings to test scrapers.
          </Alert>
        )}
        <TextField label="Target URL" value={url} onChange={(e) => setUrl(e.target.value)} fullWidth disabled={!scrapingEnabled} />
        <TextField label="Database Recipe ID" type="number" value={recipeId} onChange={(e) => setRecipeId(e.target.value)} fullWidth disabled={!scrapingEnabled} />

        <Button variant="contained" onClick={handleScrape} disabled={isBusy || !scrapingEnabled} startIcon={isBusy ? <CircularProgress size={20} color="inherit" /> : null}>
          {isBusy ? 'Scraping...' : 'Start Scrape'}
        </Button>

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1">Status: {status}</Typography>
          {error && <Typography color="error">{error}</Typography>}
          {result && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1, overflowX: 'auto' }}>
              <pre style={{ margin: 0, color: '#a5d6ff' }}>{JSON.stringify(result, null, 2)}</pre>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}