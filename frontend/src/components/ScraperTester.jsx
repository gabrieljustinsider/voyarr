import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, Button, Typography, Paper, CircularProgress } from '@mui/material';

export default function ScraperTester() {
  const [url, setUrl] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [status, setStatus] = useState('Idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`;

  const getAuthQuery = () => {
    const token = localStorage.getItem('voyarr_jwt')
    if (token) return `token=${encodeURIComponent(token)}`
    const apiKey = localStorage.getItem('voyarr_api_key') || import.meta.env.VITE_MASTER_KEY || ''
    return `api_key=${encodeURIComponent(apiKey)}`
  }
  const getAuthHeaders = () => {
    const token = localStorage.getItem('voyarr_jwt')
    if (token) return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    return { 'X-Voyarr-Api-Key': localStorage.getItem('voyarr_api_key') || import.meta.env.VITE_MASTER_KEY || '', 'Content-Type': 'application/json' }
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
      const res = await fetch(`${API_BASE}/external-api/scrape`, {
        method: 'POST',
        headers: getAuthHeaders(),
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

  useEffect(() => {
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
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>Test Dynamic Scraper</Typography>
      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="Target URL" value={url} onChange={(e) => setUrl(e.target.value)} fullWidth />
        <TextField label="Database Recipe ID" type="number" value={recipeId} onChange={(e) => setRecipeId(e.target.value)} fullWidth />
        
        <Button variant="contained" onClick={handleScrape} disabled={isBusy} startIcon={isBusy ? <CircularProgress size={20} color="inherit" /> : null}>
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