import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Box, Typography, Card, CardContent, Grid, TextField, 
  Chip, FormControl, InputLabel, Select, MenuItem, Paper, CardMedia, Tooltip,
  Dialog, DialogTitle, DialogContent, IconButton, Button, DialogActions,
  CircularProgress, Alert, Pagination, Checkbox, Slide
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined'
import SettingsIcon from '@mui/icons-material/Settings'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import FavoriteIcon from '@mui/icons-material/Favorite'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import CastIcon from '@mui/icons-material/Cast'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import EditIcon from '@mui/icons-material/Edit'
import ClearIcon from '@mui/icons-material/Clear'
import ChapterManager from './ChapterManager'
import SecondScreenRemote from './SecondScreenRemote'
import { apiFetch } from '../api'

export default function Library() {
  const [entries, setEntries] = useState([])
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
  const [managingChaptersFor, setManagingChaptersFor] = useState(null)

  // Favorites state
  const [favScenes, setFavScenes] = useState([])

  // Casting state
  const [isCasting, setIsCasting] = useState(false)
  const [castDevice, setCastDevice] = useState('')
  const [castCurrentTime, setCastCurrentTime] = useState(0)
  const [castDuration, setCastDuration] = useState(100)
  const [castVolume, setCastVolume] = useState(50)
  const [castIsPlaying, setCastIsPlaying] = useState(false)

  const castTimerRef = useRef(null)

  // Scanner State
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [providers, setProviders] = useState([])
  const [scanProviderId, setScanProviderId] = useState('')
  const [scanDirectory, setScanDirectory] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [rescanLoading, setRescanLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [submitFingerprintLoading, setSubmitFingerprintLoading] = useState(false)
  const [fingerprintResult, setFingerprintResult] = useState(null)

  // Performer Profile Modal State
  const [performerProfileOpen, setPerformerProfileOpen] = useState(false)
  const [selectedPerformer, setSelectedPerformer] = useState('')
  const [performerProfileLoading, setPerformerProfileLoading] = useState(false)
  const [performerProfileError, setPerformerProfileError] = useState(null)
  const [performerDetails, setPerformerDetails] = useState(null)

  // Facial Clustering State
  const [facialClusters, setFacialClusters] = useState(null)
  const [clusteringLoading, setClusteringLoading] = useState(false)

  // Bulk Operations State
  const [selectedEntries, setSelectedEntries] = useState(new Set())
  const [studios, setStudios] = useState([])
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkEditData, setBulkEditData] = useState({
    resolution: '',
    studio_id: '',
    tags_to_add: '',
    tags_to_remove: '',
    performers_to_add: '',
    performers_to_remove: ''
  })
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [streamingEnabled, setStreamingEnabled] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
    }, 500)
    return () => clearTimeout(timer)
  }, [filters])

  const getAuthQuery = () => {
    const token = localStorage.getItem('voyarr_jwt')
    if (token) return `token=${encodeURIComponent(token)}`
    const key = localStorage.getItem('voyarr_api_key')
    return `api_key=${encodeURIComponent(key || '')}`
  }

  // Fetch favorites list
  const fetchFavScenes = useCallback(async () => {
    try {
      const res = await apiFetch('/favorites')
      if (res.ok) {
        const data = await res.json()
        setFavScenes(data.scene || [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const fetchStudios = useCallback(async () => {
    try {
      const res = await apiFetch('/studios?limit=1000')
      if (res.ok) setStudios(await res.json())
    } catch (e) {
      console.error(e)
    }
  }, [])

  const fetchLibrary = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedFilters.resolution) params.append('resolution', debouncedFilters.resolution)
      if (debouncedFilters.performer) params.append('performer', debouncedFilters.performer)
      if (debouncedFilters.tag) params.append('tag', debouncedFilters.tag)
      if (debouncedFilters.ohash) params.append('ohash', debouncedFilters.ohash)
      params.append('page', page)
      params.append('limit', 50)

      const res = await apiFetch(`/library?${params.toString()}`)
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
  }, [debouncedFilters, page])

  useEffect(() => {
    fetchLibrary()
    fetchFavScenes()
    fetchStudios()
    apiFetch('/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.streaming_enabled === 'false') {
          setStreamingEnabled(false)
        }
      })
      .catch(console.error)
  }, [fetchLibrary, fetchFavScenes, fetchStudios])

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
    setPage(1)
  }

  // Toggle favorite scene
  const handleToggleFavoriteScene = async (entryId) => {
    try {
      const res = await apiFetch('/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ item_type: 'scene', item_id: String(entryId) })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.favorited) {
          setFavScenes(prev => [...prev, String(entryId)])
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Added to favorites!', severity: 'success' } }))
        } else {
          setFavScenes(prev => prev.filter(id => id !== String(entryId)))
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Removed from favorites.', severity: 'info' } }))
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Log playback start session
  const handleVideoPlay = async (entryId) => {
    try {
      await apiFetch('/user/stats/play', {
        method: 'POST',
        body: JSON.stringify({ library_entry_id: entryId, duration: 0, completed: false })
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleClosePlayer = () => {
    setPlayingVideo(null)
    setFingerprintResult(null)
    setFacialClusters(null)
    handleStopCasting()
  }

  // Casting Logic Controls
  const handleStartCasting = (protocol) => {
    setIsCasting(true)
    setCastDevice(`${protocol} Media Screen`)
    setCastDuration(playingVideo?.duration || 600)
    setCastCurrentTime(0)
    setCastVolume(50)
    setCastIsPlaying(true)

    // Log the cast play session
    handleVideoPlay(playingVideo.id)

    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message: `Casting session established via ${protocol}!`, severity: 'success' } 
    }))
  }

  const handleStopCasting = () => {
    setIsCasting(false)
    setCastDevice('')
    if (castTimerRef.current) {
      clearInterval(castTimerRef.current)
      castTimerRef.current = null
    }
  }

  // Simulated cast playback progress
  useEffect(() => {
    if (isCasting && castIsPlaying) {
      castTimerRef.current = setInterval(() => {
        setCastCurrentTime(prev => {
          if (prev >= castDuration) {
            handleStopCasting()
            return castDuration
          }
          return prev + 1
        })
      }, 1000)
    } else {
      if (castTimerRef.current) {
        clearInterval(castTimerRef.current)
        castTimerRef.current = null
      }
    }

    return () => {
      if (castTimerRef.current) clearInterval(castTimerRef.current)
    }
  }, [isCasting, castIsPlaying, castDuration])

  const handleCastSeek = (value) => {
    setCastCurrentTime(value)
  }

  const handleCastPlayToggle = () => {
    setCastIsPlaying(!castIsPlaying)
  }

  const handleCastVolumeChange = (value) => {
    setCastVolume(value)
  }

  const fetchProviders = useCallback(async () => {
    try {
      const res = await apiFetch('/providers')
      if (res.ok) setProviders(await res.json())
    } catch (e) {
      console.error(e)
    }
  }, [])

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

      const res = await apiFetch(`/library/scan?${params.toString()}`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok) {
        setScanResult({ type: 'success', message: `Scan complete! Added: ${data.result.added}, Matched: ${data.result.matched}, Errors: ${data.result.errors.length}` })
        fetchLibrary()
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
      const res = await apiFetch('/library/rescan-hashes', {
        method: 'POST'
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

  const handleSubmitFingerprint = async () => {
    if (!playingVideo || !playingVideo.ohash) return;
    setSubmitFingerprintLoading(true)
    setFingerprintResult(null)

    let key = '';
    try {
      const settingsRes = await apiFetch('/settings')
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        key = settingsData.stashdb_api_key || ''
      }
    } catch (err) {
      console.error('Failed to retrieve settings for StashDB API Key:', err)
    }

    if (!key) {
      key = window.appPrompt ? await window.appPrompt("Enter your StashDB API Key to submit this fingerprint:") : window.prompt("Enter your StashDB API Key to submit this fingerprint:");
      if (!key) {
        setSubmitFingerprintLoading(false)
        return;
      }
    }

    try {
      const res = await apiFetch('/external-api/stashdb/submit-fingerprint', {
        method: 'POST',
        headers: { 'X-API-Key': key },
        body: JSON.stringify({
          scene_id: playingVideo.site_id || "unknown",
          hash: playingVideo.ohash,
          algorithm: "OSHASH",
          duration: playingVideo.duration || 0
        })
      })

      const data = await res.json()
      if (res.ok) {
        setFingerprintResult({ type: 'success', message: data.message })
      } else {
        setFingerprintResult({ type: 'error', message: data.detail || 'Submission failed' })
      }
    } catch (e) {
      setFingerprintResult({ type: 'error', message: e.message })
    }
    setSubmitFingerprintLoading(false)
  }

  const handleOpenPerformerProfile = async (name) => {
    setSelectedPerformer(name)
    setPerformerProfileOpen(true)
    setPerformerProfileLoading(true)
    setPerformerProfileError(null)
    setPerformerDetails(null)

    try {
      const settingsRes = await apiFetch('/settings')
      if (!settingsRes.ok) throw new Error('Failed to retrieve external API settings')
      const settings = await settingsRes.json()
      const apiKey = settings.tpdb_api_key

      if (!apiKey) {
        throw new Error('Missing ThePornDB API Key. Please configure it in the Settings tab.')
      }

      const res = await apiFetch('/external-api/theporndb/performer', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      })

      if (!res.ok) throw new Error('Failed to fetch performer details from ThePornDB')
      const data = await res.json()
      
      if (data.results && data.results.length > 0) {
        const exactMatch = data.results.find(p => p.name?.toLowerCase() === name.toLowerCase()) || data.results[0]
        setPerformerDetails(exactMatch)
      } else {
        setPerformerDetails({
          name: name,
          bio: "No biography details found for this performer."
        })
      }
    } catch (err) {
      console.error(err)
      setPerformerProfileError(err.message)
    } finally {
      setPerformerProfileLoading(false)
    }
  }

  // Facial Clustering Logic
  const fetchFacialClusters = useCallback(async (id) => {
    try {
      const res = await apiFetch(`/library/${id}/facial-clusters`)
      if (res.ok) setFacialClusters(await res.json())
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    if (playingVideo) fetchFacialClusters(playingVideo.id)
  }, [playingVideo, fetchFacialClusters])

  const handleTriggerClustering = async () => {
    setClusteringLoading(true)
    try {
      const res = await apiFetch(`/library/${playingVideo.id}/cluster-faces`, { method: 'POST' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Facial scanning started in background', severity: 'success' } }))
      }
    } catch (e) { console.error(e) }
    setClusteringLoading(false)
  }

  const handleRenameCluster = async (oldName) => {
    const newName = window.prompt(`Enter real performer name for ${oldName}:`)
    if (!newName) return
    try {
      const res = await apiFetch(`/library/${playingVideo.id}/facial-clusters/${oldName}/rename`, {
        method: 'POST',
        body: JSON.stringify({ new_name: newName })
      })
      if (res.ok) {
        fetchFacialClusters(playingVideo.id)
        fetchLibrary() // Refresh library to update global performer lists
      }
    } catch (e) { console.error(e) }
  }

  const handleToggleSelect = (id) => {
    const newSet = new Set(selectedEntries)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedEntries(newSet)
  }

  const handleClearSelection = () => {
    setSelectedEntries(new Set())
  }

  const handleBulkAI = async () => {
    if (selectedEntries.size === 0) return
    const confirm = window.appConfirm ? await window.appConfirm(`Queue ${selectedEntries.size} items for AI Auto-Tagging?`) : window.confirm(`Queue ${selectedEntries.size} items for AI Auto-Tagging?`)
    if (!confirm) return

    try {
      const res = await apiFetch('/library/bulk-tag/ai', {
        method: 'POST',
        body: JSON.stringify({ entry_ids: Array.from(selectedEntries) })
      })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Queued ${selectedEntries.size} items for AI tagging!`, severity: 'success' } }))
        handleClearSelection()
      } else {
        const data = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: data.detail || 'Bulk action failed', severity: 'error' } }))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleBulkEditSubmit = async (e) => {
    e.preventDefault()
    setBulkSubmitting(true)

    const payload = {
      entry_ids: Array.from(selectedEntries),
      tags_to_add: bulkEditData.tags_to_add ? bulkEditData.tags_to_add.split(',').map(t => t.trim()).filter(Boolean) : [],
      tags_to_remove: bulkEditData.tags_to_remove ? bulkEditData.tags_to_remove.split(',').map(t => t.trim()).filter(Boolean) : [],
      performers_to_add: bulkEditData.performers_to_add ? bulkEditData.performers_to_add.split(',').map(p => p.trim()).filter(Boolean) : [],
      performers_to_remove: bulkEditData.performers_to_remove ? bulkEditData.performers_to_remove.split(',').map(p => p.trim()).filter(Boolean) : [],
      studio_id: bulkEditData.studio_id ? parseInt(bulkEditData.studio_id, 10) : null,
      resolution: bulkEditData.resolution || null
    }

    try {
      const res = await apiFetch('/library/bulk-edit/manual', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Successfully updated ${selectedEntries.size} items!`, severity: 'success' } }))
        setBulkEditOpen(false)
        handleClearSelection()
        fetchLibrary()
      } else {
        const data = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: data.detail || 'Bulk edit failed', severity: 'error' } }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setBulkSubmitting(false)
    }
  }

  const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Media Library</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
          {entries.map(entry => {
            const isFav = favScenes.includes(String(entry.id))
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={entry.id}>
                <Card sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  position: 'relative',
                  outline: selectedEntries.has(entry.id) ? '2px solid #90caf9' : 'none',
                  boxShadow: selectedEntries.has(entry.id) ? '0 0 15px rgba(144, 202, 249, 0.4)' : 'none',
                  transition: 'outline 0.15s, box-shadow 0.15s'
                }}>
                  
                  {/* Selection Checkbox */}
                  <Checkbox 
                    checked={selectedEntries.has(entry.id)}
                    onChange={() => handleToggleSelect(entry.id)}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      zIndex: 5,
                      color: 'rgba(255,255,255,0.7)',
                      '&.Mui-checked': {
                        color: 'primary.main',
                      },
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      borderRadius: 1,
                      p: 0.5,
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' }
                    }}
                  />
                  
                  {/* Heart Icon Toggle inside Card */}
                  <IconButton 
                    onClick={() => handleToggleFavoriteScene(entry.id)}
                    color={isFav ? "error" : "default"}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 5,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' }
                    }}
                  >
                    {isFav ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                  </IconButton>

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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="h6" noWrap title={entry.title} sx={{ flex: 1, mr: 1 }}>{entry.title}</Typography>
                      <Tooltip title="Manage Chapters">
                        <IconButton size="small" onClick={() => setManagingChaptersFor(entry)}>
                          <FormatListBulletedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
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
            )
          })}
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

      {/* Video Player Modal / Second Screen Remote Overlay */}
      <Dialog open={Boolean(playingVideo)} onClose={handleClosePlayer} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" noWrap sx={{ pr: 2 }}>{playingVideo?.title}</Typography>
          <IconButton onClick={handleClosePlayer} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
          {playingVideo && (
            isCasting ? (
              <Box sx={{ width: '100%', p: 2, backgroundColor: '#090a0f' }}>
                <SecondScreenRemote 
                  video={playingVideo}
                  castDevice={castDevice}
                  onStopCasting={handleStopCasting}
                  onSeek={handleCastSeek}
                  onPlayToggle={handleCastPlayToggle}
                  onVolumeChange={handleCastVolumeChange}
                  isPlaying={castIsPlaying}
                  currentTime={castCurrentTime}
                  duration={castDuration}
                  volume={castVolume}
                />
              </Box>
            ) : (
              <>
                <Box sx={{ flexGrow: 1, backgroundColor: 'black', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {streamingEnabled ? (
                    <video 
                      key={playingVideo.id}
                      controls 
                      autoPlay 
                      onPlay={() => handleVideoPlay(playingVideo.id)}
                      style={{ width: '100%', maxHeight: '75vh', outline: 'none' }}
                      src={`${API_BASE}/library/${playingVideo.id}/stream?${getAuthQuery()}`}
                      controlsList="nodownload"
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <Box sx={{ p: 4, textAlign: 'center', width: '80%' }}>
                      <Alert severity="warning" style={{ color: '#ff9800', background: 'rgba(255, 152, 0, 0.08)', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                        ⚠️ Video Playback / Streaming is globally disabled by the administrator. Please enable it in Settings.
                      </Alert>
                    </Box>
                  )}
                </Box>

                <Box sx={{ width: { xs: '100%', md: 300 }, minWidth: { md: 300 }, p: 2, backgroundColor: '#1e1e1e', overflowY: 'auto', maxHeight: { md: '75vh' } }}>
                  <Typography variant="h6" gutterBottom>File Details</Typography>
                  <Typography variant="body2" color="textSecondary">Resolution: {playingVideo.resolution || 'Unknown'}</Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Size: {playingVideo.file_size ? (playingVideo.file_size / (1024*1024)).toFixed(1) + ' MB' : 'Unknown'}
                  </Typography>

                  {/* Casting protocols selector */}
                  <Paper sx={{ p: 1.5, my: 2, backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CastIcon color="primary" fontSize="small" />
                      Casting Protocol
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Button variant="outlined" size="small" onClick={() => handleStartCasting('Chromecast')} sx={{ textTransform: 'none' }}>
                        Google Chromecast
                      </Button>
                      <Button variant="outlined" size="small" onClick={() => handleStartCasting('AirPlay')} sx={{ textTransform: 'none' }}>
                        Apple AirPlay
                      </Button>
                      <Button variant="outlined" size="small" onClick={() => handleStartCasting('DLNA')} sx={{ textTransform: 'none' }}>
                        DLNA TV Stream
                      </Button>
                    </Box>
                  </Paper>

                  <Box sx={{ mt: 2, mb: 2, p: 1.5, backgroundColor: 'rgba(255, 152, 0, 0.05)', border: '1px solid rgba(255, 152, 0, 0.2)', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" color="warning.main">Detected Faces</Typography>
                      <Button size="small" variant="outlined" color="warning" onClick={handleTriggerClustering} disabled={clusteringLoading} sx={{ textTransform: 'none', py: 0 }}>
                        {clusteringLoading ? <CircularProgress size={16} color="warning" /> : 'Scan Faces'}
                      </Button>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 } }}>
                      {facialClusters && Object.keys(facialClusters).length > 0 ? (
                        Object.keys(facialClusters).map(person => (
                          <Box key={person} sx={{ textAlign: 'center', minWidth: 60 }}>
                            <img 
                              src={`${API_BASE}/library/${playingVideo.id}/facial-clusters/${person}/thumbnail?${getAuthQuery()}`} 
                              alt={person} 
                              loading="lazy" 
                              style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid rgba(255, 255, 255, 0.2)' }}
                              onClick={() => handleRenameCluster(person)}
                              title={`Rename ${person}`}
                            />
                            <Typography variant="caption" display="block" noWrap sx={{ maxWidth: 60, fontSize: '0.65rem' }}>{person}</Typography>
                          </Box>
                        ))
                      ) : (
                        <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', fontSize: '0.8rem' }}>No faces scanned yet.</Typography>
                      )}
                    </Box>
                  </Box>

                  {playingVideo.ohash && (
                    <Box sx={{ mt: 2, mb: 2 }}>
                      <Button 
                        variant="outlined" 
                        color="secondary" 
                        size="small" 
                        startIcon={<CloudUploadIcon />} 
                        onClick={handleSubmitFingerprint}
                        disabled={submitFingerprintLoading}
                        fullWidth
                      >
                        {submitFingerprintLoading ? <CircularProgress size={20} /> : 'Submit to StashDB'}
                      </Button>
                      {fingerprintResult && (
                        <Alert severity={fingerprintResult.type} sx={{ mt: 1, p: 0.5, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                          {fingerprintResult.message}
                        </Alert>
                      )}
                    </Box>
                  )}

                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Performers</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    {playingVideo.performers?.length > 0 ? (
                      playingVideo.performers.map(p => (
                        <Chip 
                          key={p} 
                          label={p} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                          onClick={() => handleOpenPerformerProfile(p)}
                          sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(255, 152, 0, 0.1)', borderColor: 'warning.main' } }}
                        />
                      ))
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
            )
          )}
        </DialogContent>
      </Dialog>
      <ChapterManager open={!!managingChaptersFor} onClose={() => setManagingChaptersFor(null)} libraryEntry={managingChaptersFor} />

      {/* Performer Profile Dialog */}
      <Dialog 
        open={performerProfileOpen} 
        onClose={() => setPerformerProfileOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#141414',
            backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255, 152, 0, 0.05) 0%, transparent 40%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            color: '#fff'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Typography variant="h5" sx={{ fontWeight: '700', letterSpacing: '0.5px' }}>
            Performer Profile: {selectedPerformer}
          </Typography>
          <Button onClick={() => setPerformerProfileOpen(false)} sx={{ color: 'text.secondary' }}>Close</Button>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {performerProfileLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
              <CircularProgress color="warning" />
              <Typography variant="body2" color="textSecondary">Fetching biography & physical traits...</Typography>
            </Box>
          ) : performerProfileError ? (
            <Alert severity="error" variant="outlined" sx={{ my: 2 }}>
              {performerProfileError}
            </Alert>
          ) : performerDetails ? (
            <Grid container spacing={4}>
              {/* Left Column: Avatar & Quick Info */}
              <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Box 
                  component="img"
                  src={performerDetails.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&q=80"}
                  alt={performerDetails.name}
                  loading="lazy"
                  sx={{
                    width: '100%',
                    maxWidth: 240,
                    aspectRatio: '1/1',
                    objectFit: 'cover',
                    borderRadius: '12px',
                    border: '2px solid rgba(255, 152, 0, 0.5)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    transition: 'transform 0.3s ease',
                    '&:hover': {
                      transform: 'scale(1.03)'
                    }
                  }}
                />
                
                {/* Physical traits */}
                <Paper sx={{ width: '100%', p: 2, backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
                  <Typography variant="subtitle2" sx={{ color: 'warning.main', fontWeight: '600', mb: 1.5 }}>
                    Physical Details
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">Gender</Typography>
                      <Typography variant="body2" sx={{ fontWeight: '500' }}>{performerDetails.gender || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">Cup Size</Typography>
                      <Typography variant="body2" sx={{ fontWeight: '500' }}>{performerDetails.cup_size || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={12} sx={{ mt: 1 }}>
                      <Typography variant="caption" color="textSecondary">Measurements</Typography>
                      <Typography variant="body2" sx={{ fontWeight: '500' }}>{performerDetails.measurements || 'N/A'}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Right Column: Bio & Aliases */}
              <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {performerDetails.aliases && performerDetails.aliases.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'warning.main', fontWeight: '600', mb: 1 }}>
                      Aliases / Known As
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(Array.isArray(performerDetails.aliases) ? performerDetails.aliases : [performerDetails.aliases]).map(alias => (
                        <Chip key={alias} label={alias} size="small" variant="outlined" sx={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: 'text.secondary' }} />
                      ))}
                    </Box>
                  </Box>
                )}

                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'warning.main', fontWeight: '600', mb: 1 }}>
                    Biography
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      lineHeight: '1.6', 
                      color: 'rgba(255,255,255,0.85)',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      pr: 1,
                      whiteSpace: 'pre-line',
                      '&::-webkit-scrollbar': {
                        width: '6px'
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '3px'
                      }
                    }}
                  >
                    {performerDetails.bio || "No biography details available."}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 4 }}>
              No profile details loaded.
            </Typography>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Glassmorphic Bulk Operations Toolbar */}
      <Slide direction="up" in={selectedEntries.size > 0} mountOnEnter unmountOnExit>
        <Paper 
          sx={{ 
            position: 'fixed', 
            bottom: 24, 
            left: '50%', 
            transform: 'translateX(-50%)', 
            zIndex: 1000, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            px: 3, 
            py: 1.5, 
            borderRadius: '20px', 
            backdropFilter: 'blur(20px)', 
            backgroundColor: 'rgba(18, 18, 18, 0.75)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)'
          }}
        >
          <Typography variant="body1" sx={{ color: 'white', fontWeight: 'bold' }}>
            {selectedEntries.size} Selected
          </Typography>
          <Box sx={{ width: '1px', height: '24px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />
          <Button 
            variant="contained" 
            color="primary" 
            size="small" 
            startIcon={<EditIcon />} 
            onClick={() => setBulkEditOpen(true)}
            sx={{ borderRadius: '10px' }}
          >
            Bulk Edit
          </Button>
          <Button 
            variant="outlined" 
            color="info" 
            size="small" 
            startIcon={<AutoAwesomeIcon />} 
            onClick={handleBulkAI}
            sx={{ borderRadius: '10px' }}
          >
            AI Auto-Tag
          </Button>
          <IconButton onClick={handleClearSelection} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white' } }}>
            <ClearIcon />
          </IconButton>
        </Paper>
      </Slide>

      {/* Bulk Edit Modal */}
      <Dialog 
        open={bulkEditOpen} 
        onClose={() => setBulkEditOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            color: 'white',
            width: '100%',
            maxWidth: '500px'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Bulk Edit {selectedEntries.size} Videos
          <IconButton onClick={() => setBulkEditOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white' } }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <Box component="form" onSubmit={handleBulkEditSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="bulk-studio-label" sx={{ color: 'rgba(255,255,255,0.7)' }}>Assign Studio</InputLabel>
              <Select
                labelId="bulk-studio-label"
                value={bulkEditData.studio_id}
                label="Assign Studio"
                onChange={(e) => setBulkEditData(prev => ({ ...prev, studio_id: e.target.value }))}
                sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
              >
                <MenuItem value=""><em>None / Clear</em></MenuItem>
                {studios.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Set Resolution (e.g. 1080p, 4K)"
              value={bulkEditData.resolution}
              onChange={(e) => setBulkEditData(prev => ({ ...prev, resolution: e.target.value }))}
              InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
              inputProps={{ style: { color: 'white' } }}
            />

            <TextField
              fullWidth
              label="Tags to Add (comma-separated)"
              value={bulkEditData.tags_to_add}
              onChange={(e) => setBulkEditData(prev => ({ ...prev, tags_to_add: e.target.value }))}
              InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
              inputProps={{ style: { color: 'white' } }}
            />

            <TextField
              fullWidth
              label="Tags to Remove (comma-separated)"
              value={bulkEditData.tags_to_remove}
              onChange={(e) => setBulkEditData(prev => ({ ...prev, tags_to_remove: e.target.value }))}
              InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
              inputProps={{ style: { color: 'white' } }}
            />

            <TextField
              fullWidth
              label="Performers to Add (comma-separated)"
              value={bulkEditData.performers_to_add}
              onChange={(e) => setBulkEditData(prev => ({ ...prev, performers_to_add: e.target.value }))}
              InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
              inputProps={{ style: { color: 'white' } }}
            />

            <TextField
              fullWidth
              label="Performers to Remove (comma-separated)"
              value={bulkEditData.performers_to_remove}
              onChange={(e) => setBulkEditData(prev => ({ ...prev, performers_to_remove: e.target.value }))}
              InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
              inputProps={{ style: { color: 'white' } }}
            />

            <DialogActions sx={{ px: 0, pb: 0, pt: 2 }}>
              <Button onClick={() => setBulkEditOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="contained" 
                color="primary"
                disabled={bulkSubmitting}
                startIcon={bulkSubmitting && <CircularProgress size={20} />}
              >
                Apply Changes
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  )
}