import { useState, useEffect } from 'react'
import { 
  Box, Typography, TextField, Button, Paper, Grid, 
  FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress 
} from '@mui/material'
import { apiFetch } from '../api'

export default function MassRip() {
  const [providers, setProviders] = useState([])
  const [providerId, setProviderId] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [rippingEnabled, setRippingEnabled] = useState(true)

  useEffect(() => {
    apiFetch('/providers')
      .then(res => res.json())
      .then(data => setProviders(data))
      .catch(console.error)

    apiFetch('/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.ripping_enabled === 'false') {
          setRippingEnabled(false)
        }
      })
      .catch(console.error)
  }, [])

  const handleMassRip = async () => {
    if (!providerId || !url) return
    setLoading(true)
    setResult(null)
    
    try {
      const res = await apiFetch('/download/mass_rip', {
        method: 'POST',
        body: JSON.stringify({ provider_id: providerId, url: url })
      })
      const data = await res.json()
      
      if (res.ok) {
        setResult({ type: 'success', message: data.message })
      } else {
        setResult({ type: 'error', message: data.detail || 'Failed to start mass rip' })
      }
    } catch (e) {
      setResult({ type: 'error', message: e.message })
    }
    setLoading(false)
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" gutterBottom>Mass Rip Workflow</Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        {!rippingEnabled && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            ⚠️ Access Denied: The Ripping feature is disabled globally by the administrator. Please enable it in Settings to use this workflow.
          </Alert>
        )}
        <Typography variant="body1" sx={{ mb: 3 }}>
          Provide a channel or playlist URL. Voyarr will scrape all contained video URLs and process them sequentially through your active global and provider-specific Download Rules, queueing matched videos automatically.
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" disabled={!rippingEnabled}>
              <InputLabel>Provider Ruleset</InputLabel>
              <Select value={providerId} label="Provider Ruleset" onChange={e => setProviderId(e.target.value)}>
                {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={7}>
            <TextField fullWidth size="small" label="Target URL (Channel/Playlist)" value={url} onChange={e => setUrl(e.target.value)} disabled={!rippingEnabled} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={handleMassRip} disabled={loading || !providerId || !url || !rippingEnabled}>
              {loading ? <CircularProgress size={24} /> : 'Start Mass Rip'}
            </Button>
          </Grid>
        </Grid>
        {result && <Alert severity={result.type} sx={{ mt: 3 }}>{result.message}</Alert>}
      </Paper>
    </Box>
  )
}