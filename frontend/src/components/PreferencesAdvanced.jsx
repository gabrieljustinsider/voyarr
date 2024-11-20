import { useState, useEffect } from 'react'
import { 
  Box, Typography, TextField, Button, Paper, Grid, Snackbar, Alert, 
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Divider, CircularProgress, Tooltip, IconButton
} from '@mui/material'

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
}

export default function PreferencesAdvanced() {
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [prefs, setPrefs] = useState({
    preferred_resolution: '1080p',
    naming_pattern: '{title}_{performers}_{resolution}',
    append_metadata: true,
    auto_tag_files: true,
    duplicate_handling: 'skip',
    custom_base_path: '',
    max_retries: 3
  })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  
  // Pattern Validation State
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState(null)
  const [patternInfo, setPatternInfo] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/providers`, { headers: HEADERS })
      .then(res => res.json())
      .then(data => setProviders(data))
      .catch(console.error)
      
    fetch(`${API_BASE}/preferences/naming-patterns`, { headers: HEADERS })
      .then(res => res.json())
      .then(data => setPatternInfo(data))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (selectedProvider) {
      fetch(`${API_BASE}/preferences/provider/${selectedProvider}`, { headers: HEADERS })
        .then(res => res.json())
        .then(data => {
          setPrefs({
            preferred_resolution: data.preferred_resolution || '1080p',
            naming_pattern: data.naming_pattern || '{title}_{performers}_{resolution}',
            append_metadata: data.append_metadata !== false,
            auto_tag_files: data.auto_tag_files !== false,
            duplicate_handling: data.duplicate_handling || 'skip',
            custom_base_path: data.custom_base_path || '',
            max_retries: data.max_retries ?? 3
          })
        })
        .catch(console.error)
    }
  }, [selectedProvider])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setPrefs(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleValidatePattern = async () => {
    setValidating(true)
    setValidationResult(null)
    try {
      const res = await fetch(`${API_BASE}/preferences/validate-pattern`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ pattern: prefs.naming_pattern })
      })
      const data = await res.json()
      setValidationResult(data)
    } catch (err) {
      setValidationResult({ valid: false, error: err.message })
    }
    setValidating(false)
  }

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_BASE}/preferences/provider/${selectedProvider}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(prefs)
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Provider preferences saved successfully!', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: 'Failed to save preferences.', severity: 'error' })
      }
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' })
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Advanced Provider Preferences</Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Select Provider</InputLabel>
          <Select
            value={selectedProvider}
            label="Select Provider"
            onChange={(e) => setSelectedProvider(e.target.value)}
          >
            {providers.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedProvider && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6">Path & Naming Rules</Typography>
              <Divider sx={{ my: 1 }} />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Custom Base Path" name="custom_base_path" value={prefs.custom_base_path} onChange={handleChange} helperText="e.g., /media/storage/Site_A. Overrides global download destination." />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField fullWidth label="Naming Pattern" name="naming_pattern" value={prefs.naming_pattern} onChange={handleChange} />
                <Button variant="outlined" onClick={handleValidatePattern} disabled={validating || !prefs.naming_pattern} sx={{ mt: 1 }}>
                  {validating ? <CircularProgress size={24} /> : 'Test'}
                </Button>
              </Box>
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="textSecondary">Available variables:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {patternInfo ? Object.entries(patternInfo.template_variables).map(([key, desc]) => (
                    <Tooltip key={key} title={desc}>
                      <Chip size="small" label={`{${key}}`} />
                    </Tooltip>
                  )) : <Typography variant="caption">Loading variables...</Typography>}
                </Box>
              </Box>
              {validationResult && (
                <Alert severity={validationResult.valid ? "info" : "error"} sx={{ mt: 1 }}>
                  {validationResult.valid ? `Example output: ${validationResult.example}` : `Error: ${validationResult.error}`}
                </Alert>
              )}
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2 }}>Download Behavior</Typography>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Preferred Resolution</InputLabel>
                <Select name="preferred_resolution" value={prefs.preferred_resolution} label="Preferred Resolution" onChange={handleChange}>
                  <MenuItem value="4K">4K</MenuItem>
                  <MenuItem value="1080p">1080p</MenuItem>
                  <MenuItem value="720p">720p</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Duplicate Handling</InputLabel>
                <Select name="duplicate_handling" value={prefs.duplicate_handling} label="Duplicate Handling" onChange={handleChange}>
                  <MenuItem value="skip">Skip</MenuItem>
                  <MenuItem value="ask">Ask</MenuItem>
                  <MenuItem value="overwrite">Overwrite (Upgrade)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField fullWidth type="number" label="Max Retries" name="max_retries" value={prefs.max_retries} onChange={handleChange} helperText="Auto-retry limit for failed downloads" />
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <FormControlLabel control={<Switch checked={prefs.append_metadata} onChange={handleChange} name="append_metadata" />} label="Append Metadata to File" />
                <FormControlLabel control={<Switch checked={prefs.auto_tag_files} onChange={handleChange} name="auto_tag_files" />} label="Auto-tag files in Library" />
              </Box>
            </Grid>

            <Grid item xs={12} sx={{ mt: 2 }}>
              <Button variant="contained" color="primary" onClick={handleSave} size="large">Save Preferences</Button>
            </Grid>
          </Grid>
        )}
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}