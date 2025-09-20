import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Box, Typography, Grid, Card, CardContent, Button, TextField, Dialog, 
  DialogTitle, DialogContent, DialogActions, Chip, CircularProgress, 
  Alert, IconButton, Paper, Tooltip
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import StopIcon from '@mui/icons-material/Stop'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import KeyIcon from '@mui/icons-material/Key'
import StreamIcon from '@mui/icons-material/Stream'
import CloseIcon from '@mui/icons-material/Close'
import { apiFetch } from '../api'

export default function LiveStreams() {
  const [streams, setStreams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  // Admin Check
  const [isAdmin, setIsAdmin] = useState(false)

  const checkAdmin = useCallback(async () => {
    try {
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
    checkAdmin()
    fetchStreams()

    // Poll streams every 4 seconds to update recording file sizes and status
    const timer = setInterval(fetchStreams, 4000)
    return () => clearInterval(timer)
  }, [fetchStreams, checkAdmin])

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
          if (!video) return

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
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: '800', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <StreamIcon sx={{ fontSize: 36, color: 'error.main' }} />
          Live Stream Hub
        </Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            Monitor URL
          </Button>
        )}
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isRecording ? (
                          <Chip 
                            icon={<FiberManualRecordIcon color="error" sx={{ animation: 'pulse 1.5s infinite' }} />} 
                            label="Recording" 
                            color="error" 
                            size="small" 
                            sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                          />
                        ) : isFailed ? (
                          <Chip label="Failed" color="warning" size="small" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }} />
                        ) : (
                          <Chip label="Idle" size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        )}
                      </Box>
                    </Box>

                    <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 2, wordBreak: 'break-all' }}>
                      URL: {stream.url}
                    </Typography>

                    {isRecording && (
                      <Paper sx={{ p: 1.5, mb: 2, backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Captured Size</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{formatSize(stream.written_size)}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Elapsed Time</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'error.main' }}>{formatTime(stream.elapsed_seconds)}</Typography>
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
                          {isRecording ? (
                            <Tooltip title="Stop Capture">
                              <IconButton color="error" size="medium" onClick={() => handleStopRecord(stream.id)}>
                                <StopIcon />
                              </IconButton>
                            </Tooltip>
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
