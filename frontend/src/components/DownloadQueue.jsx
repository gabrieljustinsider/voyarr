import { useState, useEffect } from 'react'
import { 
  Typography, LinearProgress, List, ListItem, Box, Button, Chip, 
  TextField, Select, MenuItem, FormControl, InputLabel, Paper, Grid, CircularProgress,
  IconButton
} from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import apiFetch from '../api'

export default function DownloadQueue({ queue, onRefresh }) {
  const [providers, setProviders] = useState([])
  const [newDownload, setNewDownload] = useState({ provider_id: '', url: '' })
  const [loading, setLoading] = useState(false)
  
  const [streamUrlInput, setStreamUrlInput] = useState('')
  const [extractedStream, setExtractedStream] = useState(null)
  const [extracting, setExtracting] = useState(false)

  const [filters, setFilters] = useState({ status: '', url_contains: '', provider_id: '' })

  useEffect(() => {
    apiFetch('/providers')
      .then(res => res.json())
      .then(data => setProviders(data))
      .catch(console.error)
  }, [])

  const handleAddDownload = async (force_duplicate = false) => {
    if (!newDownload.provider_id || !newDownload.url) return
    setLoading(true)
    try {
      const res = await apiFetch('/download/start', {
        method: 'POST',
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
      const response = await apiFetch(`/progress/${taskId}/${action}`, { 
        method: 'POST'
      })
      if (response.ok) {
        console.log(`Download ${action} triggered`)
        if (onRefresh) onRefresh()
      }
    } catch (error) {
      console.error(`Error performing ${action} on download:`, error)
    }
  }

  const handleExtractStream = async () => {
    if (!streamUrlInput) return
    setExtracting(true)
    setExtractedStream(null)
    try {
      const res = await apiFetch('/download/extract-stream', {
        method: 'POST',
        body: JSON.stringify({ url: streamUrlInput })
      })
      const data = await res.json()
      if (res.ok) setExtractedStream(data)
      else window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: data.detail || 'Extraction failed', severity: 'error' } }))
    } catch (error) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: error.message, severity: 'error' } }))
    }
    setExtracting(false)
  }

  const handleCopyStreamUrl = () => {
    if (extractedStream?.stream_url) {
      navigator.clipboard.writeText(extractedStream.stream_url)
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Stream URL copied to clipboard!', severity: 'success' } }))
    }
  }

  const handleSaveStream = async () => {
    if (!extractedStream) return
    try {
      const res = await apiFetch('/download/save-stream', {
        method: 'POST',
        body: JSON.stringify({ title: extractedStream.title, url: extractedStream.stream_url })
      })
      const data = await res.json()
      if (res.ok) window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Live stream saved successfully!', severity: 'success' } }))
      else window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: data.detail || 'Failed to save stream', severity: 'error' } }))
    } catch (error) { window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: error.message, severity: 'error' } })) }
  }

  const filteredQueue = (queue || []).filter(task => {
    if (filters.status && task.status !== filters.status) return false
    if (filters.url_contains && !task.url.toLowerCase().includes(filters.url_contains.toLowerCase())) return false
    if (filters.provider_id && task.media_entry?.provider_id !== filters.provider_id) return false
    return true
  })

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" sx={{ fontWeight: '800', letterSpacing: '-0.5px', mb: 3 }}>
        Download Queue
      </Typography>

      {/* Add Single Download Card */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '16px', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <Typography variant="h6" sx={{ fontWeight: '700', mb: 2 }}>Add Single Download</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ flexShrink: 0, minWidth: 240 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="provider-select-label">Select Media Provider</InputLabel>
              <Select 
                labelId="provider-select-label"
                value={newDownload.provider_id} 
                label="Select Media Provider" 
                onChange={e => setNewDownload({...newDownload, provider_id: e.target.value})}
                sx={{ borderRadius: '10px' }}
              >
                {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 280 }}>
            <TextField 
              fullWidth 
              size="small" 
              label="Media URL" 
              placeholder="https://..."
              value={newDownload.url} 
              onChange={e => setNewDownload({...newDownload, url: e.target.value})} 
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => handleAddDownload(false)} 
              disabled={loading || !newDownload.provider_id || !newDownload.url} 
              sx={{ height: 40, px: 3, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Queue Download'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Live Stream Extractor Card */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '16px', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <Typography variant="h6" sx={{ fontWeight: '700', mb: 0.5 }}>Live Stream Extractor</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Extract direct stream URLs (.m3u8 / .mp4) from supported sites to copy or add to your Live Stream Hub.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1, minWidth: 280 }}>
            <TextField 
              fullWidth 
              size="small" 
              label="Webcam Page URL" 
              placeholder="e.g. https://chaturbate.com/room_name/"
              value={streamUrlInput} 
              onChange={e => setStreamUrlInput(e.target.value)} 
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <Button 
              variant="outlined" 
              color="secondary"
              onClick={handleExtractStream} 
              disabled={extracting || !streamUrlInput} 
              sx={{ height: 40, px: 3, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
            >
              {extracting ? <CircularProgress size={20} color="inherit" /> : 'Extract Stream URL'}
            </Button>
          </Box>
        </Box>

        {extractedStream && (
          <Box sx={{ mt: 2.5, p: 2, backgroundColor: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px' }}>
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 'bold' }} gutterBottom>{extractedStream.title}</Typography>
            <Typography variant="caption" sx={{ wordBreak: 'break-all', display: 'block', mb: 2, fontFamily: 'monospace', p: 1.5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {extractedStream.stream_url}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button size="small" variant="contained" onClick={handleCopyStreamUrl} sx={{ borderRadius: '8px', textTransform: 'none', px: 2 }}>Copy Link</Button>
              <Button size="small" variant="contained" color="secondary" onClick={handleSaveStream} sx={{ borderRadius: '8px', textTransform: 'none', px: 2 }}>Save to Live Streams</Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Filter & Search Toolbar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(12px)' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ flexShrink: 0, minWidth: 220 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="filter-status-label">Filter Status</InputLabel>
              <Select 
                labelId="filter-status-label"
                value={filters.status} 
                label="Filter Status" 
                onChange={e => setFilters({...filters, status: e.target.value})}
                sx={{ borderRadius: '10px' }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="running">Running</MenuItem>
                <MenuItem value="queued">Queued</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 240 }}>
            <TextField 
              fullWidth 
              size="small" 
              label="Search Download URL" 
              value={filters.url_contains} 
              onChange={e => setFilters({...filters, url_contains: e.target.value})} 
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
          </Box>
        </Box>
      </Paper>

      {filteredQueue.length > 0 ? (
        <List sx={{ p: 0 }}>
          {filteredQueue.map((task) => (
            <Paper key={task.id} sx={{ mb: 2, p: 2.5, borderRadius: '14px', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', mb: 1.5, gap: 1 }}>
                <Typography variant="subtitle1" noWrap sx={{ maxWidth: '75%', fontWeight: '700' }} title={task.url}>
                  Task #{task.id}: {task.url}
                </Typography>
                <Chip 
                  label={(task.status || 'unknown').toUpperCase()} 
                  color={task.status === 'completed' ? 'success' : task.status === 'failed' ? 'error' : task.status === 'queued' ? 'warning' : 'primary'} 
                  size="small"
                  sx={{ fontWeight: 'bold', fontSize: '0.65rem' }}
                />
              </Box>
              <Box sx={{ width: '100%', mb: 1.5 }}>
                <LinearProgress variant="determinate" value={task.progress_percentage || 0} sx={{ height: 8, borderRadius: 4 }} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontWeight: 'bold' }}>
                  {(task.progress_percentage || 0).toFixed(1)}% complete
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {(task.status === 'running' || task.status === 'pending' || task.status === 'queued') && (
                    <Button size="small" variant="outlined" color="warning" onClick={() => handleAction(task.id, 'pause')} sx={{ borderRadius: '8px', textTransform: 'none' }}>
                      Pause
                    </Button>
                  )}
                  {task.status === 'paused' && (
                    <Button size="small" variant="outlined" color="success" onClick={() => handleAction(task.id, 'resume')} sx={{ borderRadius: '8px', textTransform: 'none' }}>
                      Resume
                    </Button>
                  )}
                  {task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled' && (
                    <Button size="small" variant="outlined" color="error" onClick={() => handleAction(task.id, 'cancel')} sx={{ borderRadius: '8px', textTransform: 'none' }}>
                      Cancel
                    </Button>
                  )}
                </Box>

                {task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                      Priority: {task.priority || 0}
                    </Typography>
                    <IconButton size="small" onClick={() => handleAction(task.id, 'priority/up')} color="primary">
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleAction(task.id, 'priority/down')} color="primary">
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Paper>
          ))}
        </List>
      ) : (
        <Paper sx={{ p: 6, textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.08)', borderRadius: '16px' }}>
          <Typography color="text.secondary">No downloads currently match your criteria.</Typography>
        </Paper>
      )}
    </Box>
  )
}