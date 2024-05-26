import { useState, useEffect } from 'react'
import { Box, Typography, TextField, Button, Paper, Grid, Snackbar, Alert, Divider } from '@mui/material'

export default function Settings() {
  const [settings, setSettings] = useState({
    media_root_path: '/media/storage',
    download_destination: '/media/storage/downloads',
    library_folder: '/media/storage/library',
    scan_folder: '/media/storage/downloads',
    concurrent_downloads: '3',
    global_speed_limit_kbps: '0',
    default_resolution: '1080p',
    theme: 'dark',
    extension_secret: ''
  })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const API_BASE = 'http://localhost:8000/settings'

  useEffect(() => {
    fetch(API_BASE, {
      headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
    })
      .then(res => res.json())
      .then(data => {
        setSettings(prev => ({ ...prev, ...data }))
      })
      .catch(console.error)
  }, [])

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value })
  }

  const handleSave = async (key, value) => {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
        },
        body: JSON.stringify({ key, value: String(value) })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `Setting "${key}" updated successfully!`, severity: 'success' })
      }
    } catch (err) {
      setSnackbar({ open: true, message: `Failed to update "${key}".`, severity: 'error' })
    }
  }

  const generateExtensionSecret = () => {
    const array = new Uint8Array(32)
    window.crypto.getRandomValues(array)
    const newKey = Array.from(array, byte => ('0' + byte.toString(16)).slice(-2)).join('')
    setSettings(prev => ({ ...prev, extension_secret: newKey }))
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Application Settings</Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Storage & Paths</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={10}>
            <TextField fullWidth label="Docker Media Root Mapping" name="media_root_path" value={settings.media_root_path || ''} onChange={handleChange} helperText="The physical directory path where downloads will be organized inside the container." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('media_root_path', settings.media_root_path)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={10}>
            <TextField fullWidth label="Default Download Destination" name="download_destination" value={settings.download_destination || ''} onChange={handleChange} helperText="Sub-directory where new, unprocessed files are initially downloaded." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('download_destination', settings.download_destination)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={10}>
            <TextField fullWidth label="Permanent Library Folder" name="library_folder" value={settings.library_folder || ''} onChange={handleChange} helperText="Directory where organized and tagged media is permanently stored." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('library_folder', settings.library_folder)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={10}>
            <TextField fullWidth label="Existing Media Scan Target" name="scan_folder" value={settings.scan_folder || ''} onChange={handleChange} helperText="Directory targeted by the Reverse Regex Engine when searching for existing local files." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('scan_folder', settings.scan_folder)}>Save</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Global Download Defaults</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField fullWidth type="number" label="Max Concurrent Downloads" name="concurrent_downloads" value={settings.concurrent_downloads || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('concurrent_downloads', settings.concurrent_downloads)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField fullWidth type="number" label="Global Speed Limit (Kbps)" name="global_speed_limit_kbps" value={settings.global_speed_limit_kbps || ''} onChange={handleChange} helperText="Set 0 for unlimited" />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('global_speed_limit_kbps', settings.global_speed_limit_kbps)}>Save</Button>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Default Preferred Resolution" name="default_resolution" value={settings.default_resolution || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('default_resolution', settings.default_resolution)}>Save</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Browser Extension Integration</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField fullWidth label="Extension Secret Key" name="extension_secret" value={settings.extension_secret || ''} onChange={handleChange} helperText="Used to securely authenticate the browser extension with your Voyarr backend." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="outlined" color="secondary" onClick={generateExtensionSecret}>Generate Key</Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('extension_secret', settings.extension_secret)}>Save</Button>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(25, 118, 210, 0.1)', borderRadius: 1, border: '1px solid #1976d2' }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            <strong>How to install the Browser Extension:</strong>
          </Typography>
          <Typography variant="body2">
            1. Open Chrome or Edge and navigate to <code>chrome://extensions/</code><br/>
            2. Enable <strong>Developer mode</strong> in the top right corner.<br/>
            3. Click <strong>Load unpacked</strong> and select the <code>/extension</code> folder from your Voyarr installation directory.
          </Typography>
        </Box>
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}