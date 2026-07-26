import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { 
  Box, Typography, Grid, Card, CardContent, Button, TextField, Dialog, 
  DialogTitle, DialogContent, DialogActions, Chip, CircularProgress, 
  Alert, IconButton, Paper, Tooltip, Menu, MenuItem, ListItemText, Checkbox,
  FormControl, InputLabel, Select
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import StopIcon from '@mui/icons-material/Stop'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import KeyIcon from '@mui/icons-material/Key'
import StreamIcon from '@mui/icons-material/Stream'
import CloseIcon from '@mui/icons-material/Close'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { Globe, Link as LinkIcon, Radio, Search } from 'lucide-react'
import { apiFetch } from '../api'
import SmartVideoPlayer from './SmartVideoPlayer'
import GlassCard from './common/GlassCard'
import UrlParseConfirmationModal from './UrlParseConfirmationModal'

export default function LiveStreams() {
  const [streams, setStreams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Card Fields Visibility state
  const [visibleFields, setVisibleFields] = useState(() => {
    const saved = localStorage.getItem('voyarr_livestream_card_fields')
    return saved ? JSON.parse(saved) : { url: true, statusChip: true, captureStats: true }
  })
  const [fieldsMenuAnchor, setFieldsMenuAnchor] = useState(null)

  // Auth Dialog States
  const [authOpen, setAuthOpen] = useState(false)
  const [selectedStreamId, setSelectedStreamId] = useState(null)
  const [selectedStreamName, setSelectedStreamName] = useState('')
  const [authData, setAuthData] = useState({ cookies: '', headers: '' })
  const [authLoading, setAuthLoading] = useState(false)

  // Stream Player Dialog States
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playingStream, setPlayingStream] = useState(null)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [playerError, setPlayerError] = useState(null)
  const [activeStreamUrl, setActiveStreamUrl] = useState(null)
  const videoRef = useRef(null)
  const hlsRef = useRef(null)

  // Monitor Form States
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ name: '', url: '' })
  const [submitting, setSubmitting] = useState(false)

  // URL Parsing states
  const [parseUrl, setParseUrl] = useState('')
  const [parseLoading, setParseLoading] = useState(false)
  const [parsedMetadata, setParsedMetadata] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [urlParsingPermission, setUrlParsingPermission] = useState('edit')

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [extractUrl, setExtractUrl] = useState('')
  const [extractedStream, setExtractedStream] = useState(null)
  const [extracting, setExtracting] = useState(false)

  const processedStreams = useMemo(() => {
    return streams.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (s.name && s.name.toLowerCase().includes(q)) || (s.url && s.url.toLowerCase().includes(q))
    })
  }, [streams, searchQuery, statusFilter])

  // Admin Check
  const [isAdmin, setIsAdmin] = useState(false)

  const checkAdmin = useCallback(async () => {
    try {
      const meRes = await apiFetch('/auth/me')
      if (meRes.ok) {
        const me = await meRes.json()
        const userPerms = me.permissions || {}
        const perm = userPerms.url_parsing || (me.role === 'admin' ? 'edit' : 'no_access')
        setUrlParsingPermission(perm)
      }
      const res = await apiFetch('/settings')
      setIsAdmin(res.ok)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const fetchStreams = useCallback(async () => {
    setError(null)
    try {
      const res = await apiFetch('/live-streams')
      if (res.ok) {
        setStreams(await res.json())
      } else {
        setError('Failed to fetch monitored streams.')
      }
    } catch (e) {
      console.error(e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('voyarr_livestream_card_fields', JSON.stringify(visibleFields))
  }, [visibleFields])

  useEffect(() => {
    checkAdmin()
    fetchStreams()

    // Poll streams every 4 seconds to update recording file sizes and status
    const timer = setInterval(fetchStreams, 4000)
    return () => clearInterval(timer)
  }, [fetchStreams, checkAdmin])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) videoRef.current.pause()
    }
  }, [])

  const handleOpenCreate = () => {
    setEditingId(null)
    setFormData({ name: '', url: '' })
    setOpen(true)
  }

  const handleOpenEdit = (stream) => {
    setEditingId(stream.id)
    setFormData({ name: stream.name, url: stream.url })
    setOpen(true)
  }

  const handleDelete = async (id) => {
    const confirm = await window.appConfirm('Are you sure you want to delete this live stream monitor?')
    if (!confirm) return

    try {
      const res = await apiFetch(`/live-streams/${id}`, { method: 'DELETE' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Monitor deleted.', severity: 'success' } 
        }))
        fetchStreams()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleOpenAuth = async (stream) => {
    setSelectedStreamId(stream.id)
    setSelectedStreamName(stream.name)
    setAuthOpen(true)
    setAuthLoading(true)
    setAuthData({ cookies: '', headers: '' })

    try {
      // We don't fetch decrypted secrets directly in UI (security best practice),
      // but we let the user overwrite them if they want.
      // We just indicate if credentials exist.
      const res = await apiFetch(`/live-streams/${stream.id}/auth`)
      if (res.ok) {
        const statusData = await res.json()
        setAuthData({
          cookies: statusData.has_cookies ? '********' : '',
          headers: statusData.has_headers ? '********' : ''
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSaveAuth = async () => {
    setAuthLoading(true)
    try {
      const payload = {
        cookies: authData.cookies === '********' ? null : authData.cookies,
        headers: authData.headers === '********' ? null : authData.headers
      }
      const res = await apiFetch(`/live-streams/${selectedStreamId}/auth`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Secure credentials successfully encrypted in Vault.', severity: 'success' } 
        }))
        setAuthOpen(false)
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Failed to configure auth credentials.', severity: 'error' } 
        }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleStartRecord = async (id) => {
    try {
      const res = await apiFetch(`/live-streams/${id}/record`, { method: 'POST' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Celery streamlink recording started.', severity: 'success' } 
        }))
        fetchStreams()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleStopRecord = async (id) => {
    try {
      const res = await apiFetch(`/live-streams/${id}/stop`, { method: 'POST' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Sent termination signal to recording process.', severity: 'info' } 
        }))
        fetchStreams()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handlePauseRecord = async (id) => {
    try {
      const res = await apiFetch(`/live-streams/${id}/pause`, { method: 'POST' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Recording paused successfully.', severity: 'warning' } 
        }))
        fetchStreams()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleResumeRecord = async (id) => {
    try {
      const res = await apiFetch(`/live-streams/${id}/resume`, { method: 'POST' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Recording resumed successfully.', severity: 'success' } 
        }))
        fetchStreams()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleParseUrl = async () => {
    if (!parseUrl) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please enter a URL to parse', severity: 'warning' } }))
      return
    }

    if (urlParsingPermission === 'no_access') {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'You do not have permissions to access URL parsing.', severity: 'error' } }))
      return
    }

    setParseLoading(true)
    try {
      const response = await apiFetch('/scraper/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parseUrl })
      })

      if (response.ok) {
        const data = await response.json()
        setParsedMetadata(data.metadata)
        setModalOpen(true)
      } else {
        const errData = await response.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Error parsing URL: ${errData.detail || response.statusText}`, severity: 'error' } }))
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Error parsing URL: ${error.message}`, severity: 'error' } }))
    }
    setParseLoading(false)
  }

  const handleApplyParsedMetadata = (appliedData) => {
    setFormData(prev => {
      const updated = { ...prev }
      if (appliedData.title) updated.name = appliedData.title
      if (parseUrl) updated.url = parseUrl
      return updated
    })
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Parsed metadata successfully applied!', severity: 'info' } }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const url = editingId ? `/live-streams/${editingId}` : '/live-streams'
      const method = editingId ? 'PUT' : 'POST'
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: editingId ? 'Monitor updated.' : 'Monitor configured.', severity: 'success' } 
        }))
        setOpen(false)
        fetchStreams()
      } else {
        const data = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: data.detail || 'Save failed.', severity: 'error' } 
        }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePlayStream = async (stream) => {
    setPlayingStream(stream)
    setPlayerOpen(true)
    setPlayerLoading(true)
    setPlayerError(null)
    setActiveStreamUrl(null)

    try {
      const res = await apiFetch(`/live-streams/${stream.id}/stream`)
      if (res.ok) {
        const data = await res.json()
        setActiveStreamUrl(data.stream_url)
      } else {
        setPlayerError('Failed to resolve stream link.')
      }
    } catch (e) {
      console.error(e)
      setPlayerError(e.message)
    } finally {
      setPlayerLoading(false)
    }
  }

  const handleClosePlayer = () => {
    setPlayerOpen(false)
    setPlayingStream(null)
    setPlayerError(null)
    setPlayerLoading(false)
    setActiveStreamUrl(null)
  }

  const handleExtractUrl = async () => {
    if (!extractUrl) return
    setExtracting(true); setExtractedStream(null)
    try {
      const res = await apiFetch('/download/extract-stream', { method: 'POST', body: JSON.stringify({ url: extractUrl }) })
      const data = await res.json()
      if (res.ok) setExtractedStream(data)
      else window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: data.detail || 'Extraction failed', severity: 'error' } }))
    } catch (e) { window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: e.message, severity: 'error' } })) }
    setExtracting(false)
  }

  const handleSaveExtractedStream = async () => {
    if (!extractedStream) return
    try {
      const res = await apiFetch('/download/save-stream', { method: 'POST', body: JSON.stringify({ title: extractedStream.title, url: extractedStream.stream_url }) })
      const data = await res.json()
      if (res.ok) window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Stream saved!', severity: 'success' } }))
      else window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: data.detail || 'Failed to save', severity: 'error' } }))
    } catch (e) { window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: e.message, severity: 'error' } })) }
  }

  const formatSize = (bytes) => {
    if (!bytes) return '0.00 MB'
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatTime = (secs) => {
    if (!secs) return '00:00:00'
    const h = Math.floor(secs / 3600).toString().padStart(2, '0')
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
    const s = Math.floor(secs % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: '800', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', sm: 'flex-start' }, gap: 1.5, textAlign: { xs: 'center', sm: 'left' } }}>
          <StreamIcon sx={{ fontSize: 36, color: 'error.main', filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))' }} />
          Live Stream Hub
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<VisibilityIcon />}
            onClick={(e) => setFieldsMenuAnchor(e.currentTarget)}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0, width: { xs: '100%', sm: 'auto' }, borderRadius: '10px', textTransform: 'none' }}
          >
            Display Options
          </Button>
          {isAdmin && (
            <Button 
              variant="contained" 
              color="primary"
              startIcon={<AddIcon />} 
              onClick={handleOpenCreate} 
              sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
            >
              Monitor Live URL
            </Button>
          )}
        </Box>
      </Box>

      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        icon={<StreamIcon fontSize="small" />} 
        sx={{ 
          mb: 3, 
          borderRadius: '12px', 
          bgcolor: 'rgba(239, 68, 68, 0.08)', 
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          '& .MuiAlert-icon': { color: '#ef4444' } 
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
          📡 Live Stream Recording &amp; DVR Monitor
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          The Live Stream Hub tracks, previews, and records real-time HLS broadcasts, live webcams, and network streams. Automated recorders monitor active stream states and capture video feeds directly into your library.
        </Typography>
      </Alert>

      {/* Summary KPI Stats Panel */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(12px)' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>Monitored Streams</Typography>
            <Typography variant="h5" sx={{ fontWeight: '800', mt: 0.5 }}>{streams.length}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.2)', bgcolor: 'rgba(239, 68, 68, 0.06)', backdropFilter: 'blur(12px)' }}>
            <Typography variant="caption" color="error.main" sx={{ fontWeight: 'bold' }}>Active Recordings</Typography>
            <Typography variant="h5" color="error.main" sx={{ fontWeight: '800', mt: 0.5 }}>
              {streams.filter(s => s.status === 'recording').length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, borderRadius: '14px', border: '1px solid rgba(245, 158, 11, 0.2)', bgcolor: 'rgba(245, 158, 11, 0.06)', backdropFilter: 'blur(12px)' }}>
            <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'bold' }}>Paused Recorders</Typography>
            <Typography variant="h5" color="warning.main" sx={{ fontWeight: '800', mt: 0.5 }}>
              {streams.filter(s => s.status === 'paused').length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, borderRadius: '14px', border: '1px solid rgba(14, 165, 233, 0.2)', bgcolor: 'rgba(14, 165, 233, 0.06)', backdropFilter: 'blur(12px)' }}>
            <Typography variant="caption" color="#38bdf8" sx={{ fontWeight: 'bold' }}>Captured Storage</Typography>
            <Typography variant="h5" sx={{ fontWeight: '800', mt: 0.5, color: '#38bdf8' }}>
              {formatSize(streams.reduce((acc, s) => acc + (s.written_size || 0), 0))}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Search & Filter Controls Toolbar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(12px)' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <TextField
            fullWidth
            size="small"
            label="Search Live Streams"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by stream identifier or URL..."
            sx={{ flex: 1, minWidth: { xs: '100%', md: 280 }, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <FormControl size="small" sx={{ minWidth: 200, width: { xs: '100%', md: 'auto' } }}>
            <InputLabel id="stream-status-label">Filter Status</InputLabel>
            <Select
              labelId="stream-status-label"
              value={statusFilter}
              label="Filter Status"
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ borderRadius: '10px' }}
            >
              <MenuItem value="all">All Statuses ({streams.length})</MenuItem>
              <MenuItem value="recording">Recording ({streams.filter(s => s.status === 'recording').length})</MenuItem>
              <MenuItem value="paused">Paused ({streams.filter(s => s.status === 'paused').length})</MenuItem>
              <MenuItem value="idle">Idle ({streams.filter(s => s.status === 'idle').length})</MenuItem>
              <MenuItem value="failed">Failed ({streams.filter(s => s.status === 'failed').length})</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Stream URL Extractor */}
      <GlassCard sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ p: 1, borderRadius: '10px', background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', color: '#fff', display: 'flex' }}>
            <Radio size={20} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: '700' }}>Stream URL Extractor</Typography>
            <Typography variant="caption" color="text.secondary">Extract direct stream URLs (.m3u8 / .mp4) from supported sites.</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', bgcolor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', p: 2 }}>
          <Box sx={{ flexGrow: 1, minWidth: 280 }}>
            <TextField fullWidth size="small" label="Webcam Page URL" placeholder="e.g. https://chaturbate.com/room_name/" value={extractUrl} onChange={e => setExtractUrl(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          </Box>
          <Button variant="outlined" color="secondary" onClick={handleExtractUrl} disabled={extracting || !extractUrl} sx={{ height: 40, px: 3, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}>
            {extracting ? <CircularProgress size={20} color="inherit" /> : 'Extract Stream URL'}
          </Button>
        </Box>
        {extractedStream && (
          <Box sx={{ mt: 2.5, p: 2, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 'bold' }} gutterBottom>{extractedStream.title}</Typography>
            <Typography variant="caption" sx={{ wordBreak: 'break-all', display: 'block', mb: 2, fontFamily: 'monospace', p: 1.5, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {extractedStream.stream_url}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button size="small" variant="contained" onClick={() => { navigator.clipboard.writeText(extractedStream.stream_url); window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Stream URL copied!', severity: 'success' } })) }} sx={{ borderRadius: '8px', textTransform: 'none', px: 2 }}>Copy Link</Button>
              <Button size="small" variant="contained" color="secondary" onClick={handleSaveExtractedStream} sx={{ borderRadius: '8px', textTransform: 'none', px: 2 }}>Save to Streams</Button>
            </Box>
          </Box>
        )}
      </GlassCard>

      <Menu
        anchorEl={fieldsMenuAnchor}
        open={Boolean(fieldsMenuAnchor)}
        onClose={() => setFieldsMenuAnchor(null)}
      >
        <MenuItem onClick={() => setVisibleFields(prev => ({ ...prev, url: !prev.url }))}>
          <Checkbox checked={visibleFields.url} size="small" />
          <ListItemText primary="Stream URL" />
        </MenuItem>
        <MenuItem onClick={() => setVisibleFields(prev => ({ ...prev, statusChip: !prev.statusChip }))}>
          <Checkbox checked={visibleFields.statusChip} size="small" />
          <ListItemText primary="Status Badge" />
        </MenuItem>
        <MenuItem onClick={() => setVisibleFields(prev => ({ ...prev, captureStats: !prev.captureStats }))}>
          <Checkbox checked={visibleFields.captureStats} size="small" />
          <ListItemText primary="Capture Stats" />
        </MenuItem>
      </Menu>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      ) : processedStreams.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}>
          <StreamIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1.5 }} />
          <Typography variant="h6" color="text.secondary">No live streams found matching your criteria.</Typography>
        </Paper>
      ) : (
        <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
          {processedStreams.map(stream => {
            const isRecording = stream.status === 'recording'
            const isPaused = stream.status === 'paused'
            const isFailed = stream.status === 'failed'

            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} xs={12} md={6} lg={4} key={stream.id} sx={{ display: 'flex', minWidth: 0 }}>
                <Card sx={{ 
                  width: '100%',
                  background: isRecording ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                  backdropFilter: 'blur(10px)',
                  border: isRecording ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  boxShadow: isRecording ? '0 8px 32px rgba(239, 68, 68, 0.15)' : '0 8px 32px rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-3px)' }
                }}>
                  <CardContent sx={{ flexGrow: 1, p: 2.5, display: 'flex', flexDirection: 'column' }}>
                    {/* Top Status & Title Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', fontSize: '1.1rem' }} noWrap title={stream.name}>
                        {stream.name}
                      </Typography>
                      {visibleFields.statusChip && (
                        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {isRecording ? (
                            <Chip 
                              icon={<FiberManualRecordIcon color="error" sx={{ animation: 'pulse 1.5s infinite' }} />} 
                              label="RECORDING" 
                              color="error" 
                              size="small" 
                              sx={{ fontWeight: 'bold', fontSize: '0.65rem', height: 22 }}
                            />
                          ) : isPaused ? (
                            <Chip label="PAUSED" color="warning" size="small" sx={{ fontWeight: 'bold', fontSize: '0.65rem', height: 22 }} />
                          ) : isFailed ? (
                            <Chip label="FAILED" color="warning" size="small" sx={{ fontWeight: 'bold', fontSize: '0.65rem', height: 22 }} />
                          ) : (
                            <Chip label="IDLE" size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 22, color: 'text.secondary' }} />
                          )}
                        </Box>
                      )}
                    </Box>

                    {/* Stream Domain URL Link */}
                    {visibleFields.url && stream.url && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2, minWidth: 0, width: '100%' }}>
                        <LinkIcon size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
                        <Typography 
                          variant="caption" 
                          component="a" 
                          href={stream.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          sx={{ 
                            textDecoration: 'none', 
                            color: '#818cf8', 
                            fontWeight: '600', 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0
                          }}
                        >
                          {stream.url.replace(/^https?:\/\/(www\.)?/, '')}
                        </Typography>
                      </Box>
                    )}

                    {/* Real-time Capture Statistics Panel */}
                    {visibleFields.captureStats && (isRecording || isPaused) && (
                      <Paper sx={{ p: 1.5, mb: 2, borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>Captured Data</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#38bdf8' }}>{formatSize(stream.written_size)}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>Elapsed Time</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: isPaused ? 'warning.main' : 'error.main' }}>
                              {formatTime(stream.elapsed_seconds)}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    )}

                    <Box sx={{ flexGrow: 1 }} />

                    {/* Controls & Actions Toolbar */}
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', pt: 2, mt: 1 }}>
                      <Tooltip title="View Live Broadcast Stream">
                        <IconButton size="small" color="success" onClick={() => handlePlayStream(stream)} sx={{ bgcolor: 'rgba(34, 197, 94, 0.1)', '&:hover': { bgcolor: 'rgba(34, 197, 94, 0.2)' } }}>
                          <PlayArrowIcon size={18} />
                        </IconButton>
                      </Tooltip>

                      {isAdmin && (
                        <>
                          {(isRecording || isPaused) ? (
                            <>
                              <Tooltip title="Stop Recording Session">
                                <IconButton size="small" color="error" onClick={() => handleStopRecord(stream.id)} sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' } }}>
                                  <StopIcon size={18} />
                                </IconButton>
                              </Tooltip>
                              {isRecording ? (
                                <Tooltip title="Pause Recording">
                                  <IconButton size="small" color="warning" onClick={() => handlePauseRecord(stream.id)} sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.2)' } }}>
                                    <PauseIcon size={18} />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Tooltip title="Resume Recording">
                                  <IconButton size="small" color="success" onClick={() => handleResumeRecord(stream.id)} sx={{ bgcolor: 'rgba(34, 197, 94, 0.1)', '&:hover': { bgcolor: 'rgba(34, 197, 94, 0.2)' } }}>
                                    <PlayArrowIcon size={18} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </>
                          ) : (
                            <Tooltip title="Start Recording Stream (streamlink Engine)">
                              <IconButton size="small" color="error" onClick={() => handleStartRecord(stream.id)} sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' } }}>
                                <FiberManualRecordIcon size={18} />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Tooltip title="Configure Secure Vault Auth Cookies & Headers">
                            <IconButton size="small" color="primary" onClick={() => handleOpenAuth(stream)} sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.2)' } }}>
                              <KeyIcon size={18} />
                            </IconButton>
                          </Tooltip>

                          <Box sx={{ flexGrow: 1 }} />

                          <IconButton size="small" color="primary" onClick={() => handleOpenEdit(stream)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDelete(stream.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* Monitor Dialog */}
      <Dialog 
        open={open} 
        onClose={() => !submitting && setOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogTitle sx={{ m: 0, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <StreamIcon color="primary" sx={{ fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {editingId ? 'Edit Live Stream Monitor' : 'Monitor New Live URL'}
              </Typography>
            </Box>
            <IconButton
              aria-label="close"
              onClick={() => !submitting && setOpen(false)}
              sx={{ color: 'text.secondary', '&:hover': { color: 'white' } }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {urlParsingPermission !== 'no_access' && (
              <Box 
                sx={{ 
                  p: 2, 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.08))', 
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⚡ Auto-Fill Metadata via Live URL Scraper
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Paste Live Stream URL (e.g. Chaturbate, Stripchat, Jasmin, m3u8...)"
                    value={parseUrl}
                    onChange={(e) => setParseUrl(e.target.value)}
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        borderRadius: '10px',
                        bgcolor: 'rgba(0,0,0,0.3)'
                      } 
                    }}
                  />
                  <Button 
                    variant="contained" 
                    color="secondary" 
                    onClick={handleParseUrl} 
                    disabled={parseLoading || !parseUrl}
                    sx={{ borderRadius: '10px', whiteSpace: 'nowrap', px: 2.5, height: 40, textTransform: 'none', fontWeight: 'bold' }}
                  >
                    {parseLoading ? <CircularProgress size={20} color="inherit" /> : 'Parse URL'}
                  </Button>
                </Box>
              </Box>
            )}

            <TextField
              required
              fullWidth
              label="Stream Name / Identifier"
              placeholder="e.g. Model / Performer Name or Channel Identifier"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              helperText="Give this live stream monitor a recognizable display name."
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />

            <TextField
              required
              fullWidth
              label="Live Stream URL / Streamlink Target"
              placeholder="https://chaturbate.com/room_name/ or https://domain.com/live/index.m3u8"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              helperText="Supports live webcam links (Chaturbate, Stripchat, Jasmin) or raw HLS (.m3u8) feeds."
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Button 
              onClick={() => setOpen(false)} 
              disabled={submitting}
              sx={{ borderRadius: '10px', textTransform: 'none', px: 2.5, color: 'text.secondary' }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              disabled={submitting || !formData.name || !formData.url}
              sx={{ borderRadius: '10px', textTransform: 'none', px: 3, fontWeight: 'bold' }}
            >
              {submitting ? <CircularProgress size={22} color="inherit" /> : editingId ? 'Update Monitor' : 'Save Live Monitor'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Auth Credentials Modal */}
      <Dialog 
        open={authOpen} 
        onClose={() => !authLoading && setAuthOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <KeyIcon color="primary" sx={{ fontSize: 26 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Secure Credentials Vault: {selectedStreamName}
            </Typography>
          </Box>
          <IconButton
            aria-label="close"
            onClick={() => !authLoading && setAuthOpen(false)}
            sx={{ color: 'text.secondary', '&:hover': { color: 'white' } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Alert severity="info" sx={{ borderRadius: '10px', bgcolor: 'rgba(99, 102, 241, 0.08)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.4 }}>
              Cookies and custom authorization headers are securely encrypted in backend storage and passed to <code>streamlink</code> at runtime to capture private or ticket-locked broadcasts.
            </Typography>
          </Alert>

          <TextField
            fullWidth
            label="Cookies String (Cookie Header Value)"
            placeholder="e.g. session=abc123xyz; login_token=uvw567"
            multiline
            rows={2}
            value={authData.cookies}
            onChange={(e) => setAuthData({ ...authData, cookies: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <TextField
            fullWidth
            label="Authorization HTTP Headers (Semicolon-Separated)"
            placeholder="e.g. X-Auth-Token=mytoken123; User-Agent=Custom"
            multiline
            rows={2}
            value={authData.headers}
            onChange={(e) => setAuthData({ ...authData, headers: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button 
            onClick={() => setAuthOpen(false)} 
            disabled={authLoading}
            sx={{ borderRadius: '10px', textTransform: 'none', px: 2.5, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveAuth} 
            variant="contained" 
            color="primary" 
            disabled={authLoading}
            sx={{ borderRadius: '10px', textTransform: 'none', px: 3, fontWeight: 'bold' }}
          >
            {authLoading ? <CircularProgress size={22} color="inherit" /> : 'Save Encrypted Vault Credentials'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* HLS Video Player Modal */}
      <Dialog open={playerOpen} onClose={handleClosePlayer} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{playingStream?.name}</Typography>
          <IconButton onClick={handleClosePlayer}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, backgroundColor: 'black', position: 'relative' }}>
          {playerLoading && (
            <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <CircularProgress color="primary" />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>Resolving stream URL…</Typography>
            </Box>
          )}
          {playerError && (
            <Box sx={{ p: 4 }}>
              <Alert severity="error">{playerError}</Alert>
            </Box>
          )}
          {!playerLoading && !playerError && activeStreamUrl && (
            <SmartVideoPlayer
              key={activeStreamUrl}
              src={activeStreamUrl}
              autoPlay
              controls
              style={{ height: '60vh' }}
            />
          )}
        </DialogContent>
      </Dialog>

      <UrlParseConfirmationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        parsedData={parsedMetadata}
        currentData={{
          title: formData.name || '',
          studio: '',
          performers: [],
          tags: [],
          description: ''
        }}
        onApply={handleApplyParsedMetadata}
        permission={urlParsingPermission}
      />

      {/* Pulse Animation styling */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </Box>
  )
}
