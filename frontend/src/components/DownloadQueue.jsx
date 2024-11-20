import { useState, useEffect } from 'react'
import { 
  Typography, LinearProgress, List, ListItem, Box, Button, Chip, 
  TextField, Select, MenuItem, FormControl, InputLabel, Paper, Grid, CircularProgress 
} from '@mui/material'

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
}

export default function DownloadQueue({ queue, onRefresh }) {
  const [providers, setProviders] = useState([])
  const [newDownload, setNewDownload] = useState({ provider_id: '', url: '' })
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ status: '', url_contains: '', provider_id: '' })

  useEffect(() => {
    fetch(`${API_BASE}/providers`, { headers: HEADERS })
      .then(res => res.json())
      .then(data => setProviders(data))
      .catch(console.error)
  }, [])

  const handleAddDownload = async (force_duplicate = false) => {
    if (!newDownload.provider_id || !newDownload.url) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/download/start`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ ...newDownload, force_duplicate })
      })
      const data = await res.json()
      
      if (data.requires_confirmation) {
        const confirmed = await window.appConfirm(data.message)
        if (confirmed) {
          await handleAddDownload(true)
        }
      } else if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: data.message, severity: 'success' } }))
        setNewDownload({ provider_id: '', url: '' })
        if (onRefresh) onRefresh()
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: data.detail || data.message || 'Download failed to start', severity: 'error' } }))
      }
    } catch (error) {
      console.error(error)
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: error.message, severity: 'error' } }))
    }
    setLoading(false)
  }

  const handleAction = async (taskId, action) => {
    try {
      const response = await fetch(`${API_BASE}/download/${taskId}/${action}`, { 
        method: 'POST',
        headers: HEADERS
      })
      if (response.ok) {
        console.log(`Download ${action} triggered`)
        if (onRefresh) onRefresh()
      }
    } catch (error) {
      console.error(`Error performing ${action} on download:`, error)
    }
  }

  const filteredQueue = queue.filter(task => {
    if (filters.status && task.status !== filters.status) return false
    if (filters.url_contains && !task.url.toLowerCase().includes(filters.url_contains.toLowerCase())) return false
    if (filters.provider_id && task.media_entry?.provider_id !== filters.provider_id) return false
    return true
  })

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Download Queue
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Add Single Download</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Provider</InputLabel>
              <Select value={newDownload.provider_id} label="Provider" onChange={e => setNewDownload({...newDownload, provider_id: e.target.value})}>
                {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={7}>
            <TextField fullWidth size="small" label="Media URL" value={newDownload.url} onChange={e => setNewDownload({...newDownload, url: e.target.value})} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleAddDownload(false)} disabled={loading || !newDownload.provider_id || !newDownload.url}>
              {loading ? <CircularProgress size={24} /> : 'Queue'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Filter by Status</InputLabel>
            <Select value={filters.status} label="Filter by Status" onChange={e => setFilters({...filters, status: e.target.value})}>
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="running">Running</MenuItem>
              <MenuItem value="queued">Queued</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={9}>
          <TextField fullWidth size="small" label="Search URL..." value={filters.url_contains} onChange={e => setFilters({...filters, url_contains: e.target.value})} />
        </Grid>
      </Grid>

      {filteredQueue.length > 0 ? (
        <List>
          {filteredQueue.map((task) => (
            <ListItem key={task.id} sx={{ flexDirection: 'column', alignItems: 'flex-start', mb: 2, p: 2, border: '1px solid #333', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                <Typography variant="h6" noWrap sx={{ maxWidth: '70%' }} title={task.url}>
                  Task {task.id}: {task.url}
                </Typography>
                <Chip 
                  label={task.status} 
                  color={task.status === 'completed' ? 'success' : task.status === 'failed' ? 'error' : task.status === 'queued' ? 'warning' : 'primary'} 
                  size="small"
                />
              </Box>
              <Box sx={{ width: '100%', mb: 1 }}>
                <LinearProgress variant="determinate" value={task.progress_percentage || 0} sx={{ height: 10, borderRadius: 5 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {(task.progress_percentage || 0).toFixed(1)}% complete
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {(task.status === 'running' || task.status === 'pending' || task.status === 'queued') && (
                  <Button size="small" variant="outlined" onClick={() => handleAction(task.id, 'pause')}>
                    Pause
                  </Button>
                )}
                {task.status === 'paused' && (
                  <Button size="small" variant="outlined" onClick={() => handleAction(task.id, 'resume')}>
                    Resume
                  </Button>
                )}
                {task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled' && (
                  <Button size="small" variant="outlined" color="error" onClick={() => handleAction(task.id, 'cancel')}>
                  Cancel
                </Button>
                )}
              </Box>
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography>No downloads match your criteria.</Typography>
      )}
    </Box>
  )
}
