import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, TextField, Button, Paper, Grid, 
  FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, LinearProgress, Chip
} from '@mui/material'
import { Play, Pause, Square, Trash2, RefreshCw, ExternalLink } from 'lucide-react'
import { apiFetch } from '../api'

export default function MassRip() {
  const [providers, setProviders] = useState([])
  const [providerId, setProviderId] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [rippingEnabled, setRippingEnabled] = useState(true)
  const [sessions, setSessions] = useState([])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiFetch('/download/mass_rip/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch (e) {
      console.error('Failed to fetch mass rip sessions:', e)
    }
  }, [])

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

    fetchSessions()
  }, [fetchSessions])

  // Poll for session updates every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSessions()
    }, 3000)
    return () => clearInterval(interval)
  }, [fetchSessions])

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
        setUrl('')
        fetchSessions()
      } else {
        setResult({ type: 'error', message: data.detail || 'Failed to start mass rip' })
      }
    } catch (e) {
      setResult({ type: 'error', message: e.message })
    }
    setLoading(false)
  }

  const handleSessionAction = async (sessionId, action) => {
    try {
      let endpoint = `/download/mass_rip/sessions/${sessionId}/${action}`
      let method = 'POST'
      if (action === 'delete') {
        endpoint = `/download/mass_rip/sessions/${sessionId}`
        method = 'DELETE'
      }
      
      const res = await apiFetch(endpoint, { method })
      if (res.ok) {
        fetchSessions()
      } else {
        const data = await res.json().catch(() => ({}))
        console.error(`Failed to ${action} session:`, data.detail || res.statusText)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const getProviderName = (id) => {
    const p = providers.find(prov => prov.id === id)
    return p ? p.name : `Provider #${id}`
  }

  const getStatusChip = (status) => {
    let color = 'default'
    switch (status) {
      case 'completed':
        color = 'success'
        break
      case 'running':
        color = 'primary'
        break
      case 'pending':
        color = 'info'
        break
      case 'paused':
        color = 'warning'
        break
      case 'failed':
      case 'stopped':
        color = 'error'
        break
    }
    return <Chip label={status.toUpperCase()} color={color} size="small" variant="light" sx={{ fontWeight: 600, fontSize: '10px' }} />
  }

  const formatDateTime = (dtStr) => {
    if (!dtStr) return '-'
    const date = new Date(dtStr)
    return date.toLocaleString()
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>Mass Rip Workflow</Typography>
      
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', backgroundImage: 'linear-gradient(rgba(255,255,255,0.01), rgba(255,255,255,0))' }}>
        {!rippingEnabled && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: '8px' }}>
            ⚠️ Access Denied: The Ripping feature is disabled globally by the administrator. Please enable it in Settings to use this workflow.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
          Provide a channel or playlist URL. Voyarr will scrape all contained video URLs and process them sequentially through your active global and provider-specific Download Rules, queueing matched videos automatically.
        </Typography>
        
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md="auto" sx={{ minWidth: 260 }}>
            <FormControl fullWidth size="small" disabled={!rippingEnabled}>
              <InputLabel>Provider Ruleset</InputLabel>
              <Select value={providerId} label="Provider Ruleset" onChange={e => setProviderId(e.target.value)}>
                {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md>
            <TextField 
              fullWidth 
              size="small" 
              label="Target URL (Channel/Playlist)" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              disabled={!rippingEnabled} 
            />
          </Grid>
          <Grid item xs={12} md="auto">
            <Button 
              variant="contained" 
              onClick={handleMassRip} 
              disabled={loading || !providerId || !url || !rippingEnabled}
              sx={{ minWidth: 160, height: 40, fontWeight: 600 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Start Mass Rip'}
            </Button>
          </Grid>
        </Grid>
        {result && <Alert severity={result.type} sx={{ mt: 3, borderRadius: '8px' }}>{result.message}</Alert>}
      </Paper>

      {/* Ripping Tasks Log Table */}
      <Paper sx={{ p: 3, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Ripping Progress & History</Typography>
          <IconButton onClick={fetchSessions} size="small" title="Refresh list">
            <RefreshCw size={16} />
          </IconButton>
        </Box>
        
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date Started</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ruleset</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Target URL</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, width: '25%' }}>Progress</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No mass ripping tasks recorded.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => {
                  const percent = session.total_videos > 0 
                    ? Math.round((session.processed_videos / session.total_videos) * 100) 
                    : 0
                  
                  return (
                    <TableRow key={session.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(session.created_at)}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{getProviderName(session.provider_id)}</TableCell>
                      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" sx={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {session.url}
                          </Typography>
                          <IconButton size="small" component="a" href={session.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={12} />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>{getStatusChip(session.status)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <Typography variant="caption" color="text.secondary">
                              {session.processed_videos} / {session.total_videos || '?'} vids
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {percent}%
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={percent} 
                            color={session.status === 'failed' ? 'error' : 'primary'}
                            sx={{ height: 6, borderRadius: 3 }} 
                          />
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5, fontSize: '10px', color: 'text.secondary' }}>
                            <span>Queued: <strong>{session.queued_videos}</strong></span>
                            <span>•</span>
                            <span>Skipped: <strong>{session.skipped_videos}</strong></span>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {session.status === 'running' && (
                          <>
                            <Tooltip title="Pause ripping">
                              <IconButton size="small" onClick={() => handleSessionAction(session.id, 'pause')} color="warning">
                                <Pause size={16} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Stop ripping">
                              <IconButton size="small" onClick={() => handleSessionAction(session.id, 'stop')} color="error">
                                <Square size={16} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {session.status === 'paused' && (
                          <>
                            <Tooltip title="Resume ripping">
                              <IconButton size="small" onClick={() => handleSessionAction(session.id, 'resume')} color="primary">
                                <Play size={16} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Stop ripping">
                              <IconButton size="small" onClick={() => handleSessionAction(session.id, 'stop')} color="error">
                                <Square size={16} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {session.status === 'pending' && (
                          <Tooltip title="Cancel ripping">
                            <IconButton size="small" onClick={() => handleSessionAction(session.id, 'stop')} color="error">
                              <Square size={16} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {['completed', 'stopped', 'failed'].includes(session.status) && (
                          <Tooltip title="Delete record">
                            <IconButton size="small" onClick={() => handleSessionAction(session.id, 'delete')} color="default">
                              <Trash2 size={16} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}