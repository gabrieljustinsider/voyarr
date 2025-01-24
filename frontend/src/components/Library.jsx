import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, Card, CardContent, Grid, TextField, 
  Chip, FormControl, InputLabel, Select, MenuItem, Paper, CardMedia, Tooltip,
  Dialog, DialogTitle, DialogContent, IconButton, Button, DialogActions,
  CircularProgress, Alert, Pagination
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined'
import SettingsIcon from '@mui/icons-material/Settings'

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

export default function Library() {
  const [entries, setEntries] = useState([])
  const [apiKey, setApiKey] = useState(localStorage.getItem('voyarr_api_key') || '')
  const [settingsOpen, setSettingsOpen] = useState(!localStorage.getItem('voyarr_api_key'))
  const [filters, setFilters] = useState({
    resolution: '',
    performer: '',
    tag: '',
    ohash: ''
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [playingVideo, setPlayingVideo] = useState(null)
  
  // Scanner State
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [providers, setProviders] = useState([])
  const [scanProviderId, setScanProviderId] = useState('')
  const [scanDirectory, setScanDirectory] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [rescanLoading, setRescanLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
    }, 500)
    return () => clearTimeout(timer)
  }, [filters])

  const getAuthHeaders = useCallback(() => {
    const headers = {}
    const token = localStorage.getItem('voyarr_jwt')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else {
      const key = apiKey || localStorage.getItem('voyarr_api_key') || import.meta.env.VITE_MASTER_KEY || ''
      if (key) headers['X-Voyarr-Api-Key'] = key
    }
    return headers
  }, [apiKey])

  const getAuthQuery = () => {
    const token = localStorage.getItem('voyarr_jwt')
    if (token) return `token=${encodeURIComponent(token)}`
    const key = apiKey || localStorage.getItem('voyarr_api_key') || import.meta.env.VITE_MASTER_KEY || ''
    return `api_key=${encodeURIComponent(key)}`
  }

  const fetchLibrary = useCallback(async () => {
    try {
      // Construct query parameters from active filters
      const params = new URLSearchParams()
      if (debouncedFilters.resolution) params.append('resolution', debouncedFilters.resolution)
      if (debouncedFilters.performer) params.append('performer', debouncedFilters.performer)
      if (debouncedFilters.tag) params.append('tag', debouncedFilters.tag)
      if (debouncedFilters.ohash) params.append('ohash', debouncedFilters.ohash)
      params.append('page', page)
      params.append('limit', 50)

      const res = await fetch(`${API_BASE}/library?${params.toString()}`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setEntries(data)
        } else {
          setEntries(data.items || [])
          setTotalPages(data.pages || 1)
        }
      }
    } catch (e) {
      console.error("Failed to fetch library entries:", e)
    }
  }, [debouncedFilters, page, getAuthHeaders])

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary])

  const handleSaveSettings = () => {
    localStorage.setItem('voyarr_api_key', apiKey)
    setSettingsOpen(false)
    fetchLibrary()
  }

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
    setPage(1)
  }

  const handleClosePlayer = () => {
    setPlayingVideo(null)
  }

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/providers`, {
        headers: getAuthHeaders()
      })
      if (res.ok) setProviders(await res.json())
    } catch (e) {
      console.error(e)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    if (scanDialogOpen && providers.length === 0) fetchProviders()
  }, [scanDialogOpen, providers.length, fetchProviders])

  const handleScanDirectory = async () => {
    setScanLoading(true)
    setScanResult(null)
    try {
      const params = new URLSearchParams()
      params.append('provider_id', scanProviderId)
      if (scanDirectory) params.append('directory', scanDirectory)
      
      const res = await fetch(`${API_BASE}/library/scan?${params.toString()}`, {
        method: 'POST',
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (res.ok) {
        setScanResult({ type: 'success', message: `Scan complete! Added: ${data.result.added}, Matched: ${data.result.matched}, Errors: ${data.result.errors.length}` })
        fetchLibrary() // Refresh library
      } else {
        setScanResult({ type: 'error', message: data.detail || 'Scan failed' })
      }
    } catch (e) {
      setScanResult({ type: 'error', message: e.message })
    }
    setScanLoading(false)
  }

  const handleRescanHashes = async () => {
    setRescanLoading(true)
    try {
      const res = await fetch(`${API_BASE}/library/rescan-hashes`, {
        method: 'POST',
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: data.message, severity: 'success' } }))
        fetchLibrary()
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: data.detail || 'Failed to start rescan', severity: 'error' } }))
      }
    } catch (e) {
      console.error(e)
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Error: ' + e.message, severity: 'error' } }))
    }
    setRescanLoading(false)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Media Library</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Settings">
            <Button variant="outlined" color="inherit" onClick={() => setSettingsOpen(true)}><SettingsIcon /></Button>
          </Tooltip>
          <Button variant="outlined" color="secondary" onClick={handleRescanHashes} disabled={rescanLoading}>
            {rescanLoading ? <CircularProgress size={24} /> : 'Re-scan Hashes'}
          </Button>
          <Button variant="contained" onClick={() => setScanDialogOpen(true)}>Scan Directory</Button>
        </Box>
      </Box>
      
      {/* Filters Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center" mb={2}>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Resolution</InputLabel>
              <Select name="resolution" value={filters.resolution} label="Resolution" onChange={handleFilterChange}>
                <MenuItem value=""><em>All</em></MenuItem>
                <MenuItem value="4K">4K</MenuItem>
                <MenuItem value="1080p">1080p</MenuItem>
                <MenuItem value="720p">720p</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Filter by Performer" name="performer" value={filters.performer} onChange={handleFilterChange} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Filter by Tag" name="tag" value={filters.tag} onChange={handleFilterChange} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Search by ohash" name="ohash" value={filters.ohash} onChange={handleFilterChange} />
          </Grid>
        </Grid>
      </Paper>

      {/* Media Grid */}
      {entries.length === 0 ? (
        <Typography color="textSecondary">No media found matching your criteria.</Typography>
      ) : (
        <Grid container spacing={3}>
          {entries.map(entry => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={entry.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardMedia
                  sx={{ 
                    height: 160, 
                    backgroundColor: '#1a1a1a', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    '&:hover .play-icon': { opacity: 1, transform: 'scale(1.1)' }
                  }}
                  onClick={() => setPlayingVideo(entry)}
                >
                  <PlayCircleOutlineIcon className="play-icon" sx={{ fontSize: 64, color: 'white', position: 'absolute', opacity: 0.7, transition: '0.2s' }} />
                  <Typography variant="caption" color="textSecondary">No Thumbnail</Typography>
                </CardMedia>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" noWrap title={entry.title}>{entry.title}</Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {entry.resolution} • {entry.file_size ? (entry.file_size / (1024*1024)).toFixed(1) + ' MB' : 'Unknown Size'}
                  </Typography>
                  {entry.ohash && (
                    <Typography variant="caption" color="textSecondary" display="block" gutterBottom>ohash: {entry.ohash}</Typography>
                  )}
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{entry.performers?.slice(0, 3).map(p => <Chip key={p} label={p} size="small" />)}</Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 4 }}>
          <Pagination count={totalPages} page={page} onChange={(e, v) => setPage(v)} color="primary" />
        </Box>
      )}

      {/* Scan Directory Dialog */}
      <Dialog open={scanDialogOpen} onClose={() => !scanLoading && setScanDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Scan Local Media Directory</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 3 }}>
            Select a provider to apply its specific naming rules and map the newly discovered files into the database.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel>Provider Ruleset</InputLabel>
            <Select value={scanProviderId} label="Provider Ruleset" onChange={e => setScanProviderId(e.target.value)}>
              {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField 
            fullWidth 
            size="small" 
            label="Directory Path (Leave empty to scan all Media Roots)" 
            value={scanDirectory} 
            onChange={e => setScanDirectory(e.target.value)} 
            sx={{ mb: 2 }}
          />
          {scanResult && (
            <Alert severity={scanResult.type} sx={{ mt: 2 }}>{scanResult.message}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScanDialogOpen(false)} disabled={scanLoading}>Close</Button>
          <Button onClick={handleScanDirectory} variant="contained" disabled={scanLoading || !scanProviderId}>
            {scanLoading ? <CircularProgress size={24} /> : 'Start Scan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings / API Key Dialog */}
      <Dialog open={settingsOpen} onClose={() => { if(apiKey) setSettingsOpen(false) }} maxWidth="sm" fullWidth>
        <DialogTitle>Voyarr Configuration</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 3 }}>
            Please enter your API Key or Master Key to authenticate with the Voyarr backend.
          </Alert>
          <TextField 
            fullWidth 
            type="password"
            label="API Key / Master Key" 
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)} 
            placeholder="vyr_..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSaveSettings} variant="contained" disabled={!apiKey}>
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Video Player Modal */}
      <Dialog open={Boolean(playingVideo)} onClose={handleClosePlayer} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" noWrap sx={{ pr: 2 }}>{playingVideo?.title}</Typography>
          <IconButton onClick={handleClosePlayer} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
          {playingVideo && (
            <>
              <Box sx={{ flexGrow: 1, backgroundColor: 'black', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <video 
                  key={playingVideo.id}
                  controls 
                  autoPlay 
                  style={{ width: '100%', maxHeight: '75vh', outline: 'none' }}
                  src={`${API_BASE}/library/${playingVideo.id}/stream?${getAuthQuery()}`}
                  controlsList="nodownload"
                >
                  Your browser does not support the video tag.
                </video>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: 300 }, minWidth: { md: 300 }, p: 2, backgroundColor: '#1e1e1e', overflowY: 'auto', maxHeight: { md: '75vh' } }}>
                <Typography variant="h6" gutterBottom>File Details</Typography>
                <Typography variant="body2" color="textSecondary">Resolution: {playingVideo.resolution || 'Unknown'}</Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Size: {playingVideo.file_size ? (playingVideo.file_size / (1024*1024)).toFixed(1) + ' MB' : 'Unknown'}
                </Typography>
                
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Performers</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                  {playingVideo.performers?.length > 0 ? (
                    playingVideo.performers.map(p => <Chip key={p} label={p} size="small" color="primary" variant="outlined" />)
                  ) : <Typography variant="body2" color="textSecondary">None</Typography>}
                </Box>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>Tags</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                  {playingVideo.tags?.length > 0 ? (
                    playingVideo.tags.map(t => <Chip key={t} label={t} size="small" variant="outlined" />)
                  ) : <Typography variant="body2" color="textSecondary">None</Typography>}
                </Box>
                
                {playingVideo.metadata?.description && (
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Description</Typography>
                )}
                <Typography variant="body2" color="textSecondary">{playingVideo.metadata?.description}</Typography>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}