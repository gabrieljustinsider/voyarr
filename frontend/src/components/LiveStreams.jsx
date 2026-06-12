import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Box, Typography, Grid, Card, CardContent, Button, TextField, Dialog, 
  DialogTitle, DialogContent, DialogActions, Chip, CircularProgress, 
  Alert, IconButton, Paper, Tooltip, Menu, MenuItem, ListItemText, Checkbox
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
import { apiFetch } from '../api'
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

  // Cleanup HLS and Video safely on component unmount
  useEffect(() => {
    const currentVideo = videoRef.current
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
      if (currentVideo) {
        currentVideo.pause()
      }
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

  // Load HLS Stream and Setup hls.js
  const handlePlayStream = async (stream) => {
    setPlayingStream(stream)
    setPlayerOpen(true)
    setPlayerLoading(true)
    setPlayerError(null)

    try {
      const res = await apiFetch(`/live-streams/${stream.id}/stream`)
      if (res.ok) {
        const data = await res.json()
        const playUrl = data.stream_url

        // Load hls.js from CDN dynamically if needed
        if (!window.Hls) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1'
            script.onload = resolve
            script.onerror = reject
            document.head.appendChild(script)
          })
        }

        setTimeout(() => {
          const video = videoRef.current
          if (!video || !video.isConnected) return

          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native support
            video.src = playUrl
            setPlayerLoading(false)
          } else if (window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls({
              enableWorker: true,
              lowLatencyMode: true
            })
            hlsRef.current = hls
            hls.loadSource(playUrl)
            hls.attachMedia(video)
            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
              video.play().catch(console.error)
              setPlayerLoading(false)
            })
            hls.on(window.Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                console.error('Fatal HLS error:', data)
              }
            })
          } else {
            setPlayerError('Your browser does not support HLS streaming.')
            setPlayerLoading(false)
          }
        }, 300)
      } else {
        setPlayerError('Failed to resolve stream link.')
        setPlayerLoading(false)
      }
    } catch (e) {
      console.error(e)
      setPlayerError(e.message)
      setPlayerLoading(false)
    }
  }

  const handleClosePlayer = () => {
    setPlayerOpen(false)
    setPlayingStream(null)
    setPlayerError(null)
    setPlayerLoading(false)

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }
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
          <StreamIcon sx={{ fontSize: 36, color: 'error.main' }} />
          Live Stream Hub
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<VisibilityIcon />}
            onClick={(e) => setFieldsMenuAnchor(e.currentTarget)}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
          >
            Display Options
          </Button>
          {isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              Monitor URL
            </Button>
          )}
        </Box>
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
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      ) : streams.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}>
          <Typography color="textSecondary">No live streams registered. Click Monitor URL to get started!</Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {streams.map(stream => {
            const isRecording = stream.status === 'recording'
            const isFailed = stream.status === 'failed'
            return (
              <Grid item xs={12} md={6} lg={4} key={stream.id}>
                <Card sx={{ 
                  background: isRecording ? 'rgba(229, 9, 20, 0.03)' : 'rgba(255, 255, 255, 0.02)',
                  backdropFilter: 'blur(10px)',
                  border: isRecording ? '1px solid rgba(229, 9, 20, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '16px',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'scale(1.01)' }
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h5" sx={{ fontWeight: '700' }} noWrap title={stream.name}>
                        {stream.name}
                      </Typography>
                      {visibleFields.statusChip && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {stream.status === 'recording' ? (
                            <Chip 
                              icon={<FiberManualRecordIcon color="error" sx={{ animation: 'pulse 1.5s infinite' }} />} 
                              label="Recording" 
                              color="error" 
                              size="small" 
                              sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                            />
                          ) : stream.status === 'paused' ? (
                            <Chip label="Paused" color="warning" size="small" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }} />
                          ) : isFailed ? (
                            <Chip label="Failed" color="warning" size="small" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }} />
                          ) : (
                            <Chip label="Idle" size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                          )}
                        </Box>
                      )}
                    </Box>

                    {visibleFields.url && (
                      <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 2, wordBreak: 'break-all' }}>
                        URL: {stream.url}
                      </Typography>
                    )}

                    {visibleFields.captureStats && (stream.status === 'recording' || stream.status === 'paused') && (
                      <Paper sx={{ p: 1.5, mb: 2, backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Captured Size</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{formatSize(stream.written_size)}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Elapsed Time</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: stream.status === 'paused' ? 'warning.main' : 'error.main' }}>{formatTime(stream.elapsed_seconds)}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, borderTop: '1px solid rgba(255,255,255,0.05)', pt: 2, mt: 1 }}>
                      <Tooltip title="View Live Stream">
                        <IconButton color="success" size="medium" onClick={() => handlePlayStream(stream)}>
                          <PlayArrowIcon />
                        </IconButton>
                      </Tooltip>

                      {isAdmin && (
                        <>
                          {(stream.status === 'recording' || stream.status === 'paused') ? (
                            <Box sx={{ display: 'inline-flex', gap: 1 }}>
                              <Tooltip title="Stop Capture">
                                <IconButton color="error" size="medium" onClick={() => handleStopRecord(stream.id)}>
                                  <StopIcon />
                                </IconButton>
                              </Tooltip>
                              {stream.status === 'recording' ? (
                                <Tooltip title="Pause Capture">
                                  <IconButton color="warning" size="medium" onClick={() => handlePauseRecord(stream.id)}>
                                    <PauseIcon />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Tooltip title="Resume Capture">
                                  <IconButton color="success" size="medium" onClick={() => handleResumeRecord(stream.id)}>
                                    <PlayArrowIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          ) : (
                            <Tooltip title="Start Capturing (Celery + streamlink)">
                              <IconButton color="error" size="medium" onClick={() => handleStartRecord(stream.id)}>
                                <FiberManualRecordIcon />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Tooltip title="Configure Vault Authorization Cookies/Headers">
                            <IconButton color="primary" size="medium" onClick={() => handleOpenAuth(stream)}>
                              <KeyIcon />
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
      <Dialog open={open} onClose={() => !submitting && setOpen(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Edit Live Monitor' : 'Monitor New Live URL'}</DialogTitle>
           <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {urlParsingPermission !== 'no_access' && (
              <Box sx={{ display: 'flex', gap: 1, mb: 1, p: 2, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', alignItems: 'center' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Paste URL to parse live monitor metadata..."
                  value={parseUrl}
                  onChange={(e) => setParseUrl(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
                <Button variant="outlined" color="secondary" onClick={handleParseUrl} disabled={parseLoading} sx={{ borderRadius: '8px', whiteSpace: 'nowrap', py: 1 }}>
                  {parseLoading ? <CircularProgress size={18} /> : 'Parse'}
                </Button>
              </Box>
            )}
            <TextField
              required
              fullWidth
              size="small"
              label="Stream Name / Identifier"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              required
              fullWidth
              size="small"
              label="Live URL (e.g. Chaturbate, Jasmin, m3u8...)"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting || !formData.name || !formData.url}>
              {submitting ? <CircularProgress size={24} /> : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Auth Credentials Modal */}
      <Dialog open={authOpen} onClose={() => !authLoading && setAuthOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Secure Credentials Vault: {selectedStreamName}</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="textSecondary">
            Decrypt and feed cookies or custom authorization headers to <code>streamlink</code> at runtime to capture private, premium, or ticket-locked live streams. Decryption is performed in backend memory; keys are encrypted at rest.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Cookies String (Cookie Header value)"
            placeholder="e.g. session=abc123xyz; login_token=uvw567"
            multiline
            rows={2}
            value={authData.cookies}
            onChange={(e) => setAuthData({ ...authData, cookies: e.target.value })}
          />
          <TextField
            fullWidth
            size="small"
            label="Authorization HTTP Headers (Semicolon-separated)"
            placeholder="e.g. X-Auth-Token=mytoken123; User-Agent=Custom"
            multiline
            rows={2}
            value={authData.headers}
            onChange={(e) => setAuthData({ ...authData, headers: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuthOpen(false)} disabled={authLoading}>Cancel</Button>
          <Button onClick={handleSaveAuth} variant="contained" color="secondary" disabled={authLoading}>
            {authLoading ? <CircularProgress size={24} /> : 'Save Encrypted'}
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
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10 }}>
              <CircularProgress color="primary" />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>Resolving HLS stream url...</Typography>
            </Box>
          )}
          {playerError && (
            <Box sx={{ p: 4 }}>
              <Alert severity="error">{playerError}</Alert>
            </Box>
          )}
          <Box sx={{ width: '100%', height: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <video 
              ref={videoRef}
              controls 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </Box>
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
