import { useState, useEffect } from 'react'
import { Box, Typography, TextField, Button, Paper, Grid, MenuItem, Select, FormControl, InputLabel } from '@mui/material'

export default function ScraperTester() {
  const [providers, setProviders] = useState([])
  const [providerId, setProviderId] = useState('')
  const [url, setUrl] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('http://localhost:8000/providers', {
      headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
    })
      .then(res => res.json())
      .then(data => setProviders(data))
      .catch(console.error)
  }, [])

  const testScraper = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('http://localhost:8000/scraper/test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
        },
        body: JSON.stringify({ url, provider_id: providerId })
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ status: 'error', message: err.message })
    }
    setLoading(false)
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Dynamic Scraper Tester</Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Provider Config</InputLabel>
              <Select value={providerId} label="Provider Config" onChange={e => setProviderId(e.target.value)}>
                {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={7}>
            <TextField fullWidth size="small" label="Test Target URL" value={url} onChange={e => setUrl(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={testScraper} disabled={!providerId || !url || loading}>
              {loading ? 'Testing...' : 'Test Config'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
      {result && (
        <Paper sx={{ p: 2, backgroundColor: '#1e1e1e', overflowX: 'auto' }}>
          <Typography variant="subtitle1" gutterBottom color={result.status === 'error' ? 'error' : 'primary'}>Result Status: {result.status}</Typography>
          <pre style={{ color: '#00ff00', margin: 0 }}>{JSON.stringify(result.metadata || result.message, null, 2)}</pre>
        </Paper>
      )}
    </Box>
  )
}