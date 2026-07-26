import { useState, useEffect } from 'react'
import { 
  Typography, LinearProgress, List, Box, Button, Chip, 
  TextField, Select, MenuItem, FormControl, InputLabel, Autocomplete, Grid, CircularProgress,
  IconButton, Divider
} from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DownloadIcon from '@mui/icons-material/Download'
import FilterListIcon from '@mui/icons-material/FilterList'
import apiFetch from '../api'
import GlassCard from './common/GlassCard'

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } }
const accentSx = { bgcolor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', p: 2 }

export default function DownloadQueue({ queue, onRefresh }) {
  const [providers, setProviders] = useState([])
  const [newDownload, setNewDownload] = useState({ provider_id: '', url: '' })
  const [loading, setLoading] = useState(false)
  
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
        if (onRefresh) onRefresh()
      }
    } catch (error) {
      console.error(`Error performing ${action} on download:`, error)
    }
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
      <GlassCard sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <Box sx={{ p: 1, borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: '#fff', display: 'flex' }}>
            <DownloadIcon fontSize="small" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: '700' }}>Add Single Download</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', ...accentSx }}>
          <Box sx={{ flexShrink: 0, minWidth: 240 }}>
            <Autocomplete
              options={providers}
              getOptionLabel={(p) => p.name}
              value={providers.find(p => p.id === newDownload.provider_id) || null}
              onChange={(e, v) => setNewDownload({...newDownload, provider_id: v?.id || ''})}
              renderInput={(params) => <TextField {...params} label="Select Media Provider" size="small" />}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 280 }}>
            <TextField fullWidth size="small" label="Media URL" placeholder="https://..." value={newDownload.url} onChange={e => setNewDownload({...newDownload, url: e.target.value})} sx={inputSx} />
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <Button variant="contained" color="primary" onClick={() => handleAddDownload(false)} disabled={loading || !newDownload.provider_id || !newDownload.url} sx={{ height: 40, px: 3, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Queue Download'}
            </Button>
          </Box>
        </Box>
      </GlassCard>

      {/* Filter & Search Toolbar */}
      <GlassCard sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <FilterListIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: '700', color: 'rgba(255,255,255,0.7)' }}>Filter & Search</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', ...accentSx }}>
          <Box sx={{ flexShrink: 0, minWidth: 220 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="filter-status-label">Filter Status</InputLabel>
              <Select labelId="filter-status-label" value={filters.status} label="Filter Status" onChange={e => setFilters({...filters, status: e.target.value})} sx={{ borderRadius: '10px' }}>
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="running">Running</MenuItem>
                <MenuItem value="queued">Queued</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 240 }}>
            <TextField fullWidth size="small" label="Search Download URL" value={filters.url_contains} onChange={e => setFilters({...filters, url_contains: e.target.value})} sx={inputSx} />
          </Box>
        </Box>
      </GlassCard>

      {filteredQueue.length > 0 ? (
        <List sx={{ p: 0 }}>
          {filteredQueue.map((task) => (
            <GlassCard key={task.id} sx={{ mb: 2 }}>
              {/* Header row: title + status chip */}
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

              {/* Progress bar */}
              <Box sx={{ width: '100%', mb: 1.5 }}>
                <LinearProgress variant="determinate" value={task.progress_percentage || 0} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.08)' }} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontWeight: 'bold' }}>
                  {(task.progress_percentage || 0).toFixed(1)}% complete
                </Typography>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1.5 }} />

              {/* Action buttons + priority */}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {(task.status === 'running' || task.status === 'pending' || task.status === 'queued') && (
                    <Button size="small" variant="outlined" color="warning" onClick={() => handleAction(task.id, 'pause')} sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem' }}>
                      Pause
                    </Button>
                  )}
                  {task.status === 'paused' && (
                    <Button size="small" variant="outlined" color="success" onClick={() => handleAction(task.id, 'resume')} sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem' }}>
                      Resume
                    </Button>
                  )}
                  {task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled' && (
                    <Button size="small" variant="outlined" color="error" onClick={() => handleAction(task.id, 'cancel')} sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem' }}>
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
            </GlassCard>
          ))}
        </List>
      ) : (
        <GlassCard sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700, mb: 1 }}>No Downloads</Typography>
          <Typography variant="body2" color="text.secondary">No downloads currently match your criteria.</Typography>
        </GlassCard>
      )}
    </Box>
  )
}
