import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { 
  Box, Typography, Card, CardContent, Grid, TextField, 
  Chip, FormControl, InputLabel, Select, MenuItem, Paper, CardMedia, Tooltip,
  Dialog, DialogTitle, DialogContent, IconButton, Button, DialogActions,
  CircularProgress, Alert, Pagination, Checkbox, Slide, Autocomplete, createFilterOptions
} from '@mui/material'
import { X, PlayCircle, Settings, List, CloudUpload, Heart, Cast, Sparkles, Edit2, Plus, FolderOpen, FileUp, Trash2, Film, LayoutGrid, Clock, HardDrive, Filter, ArrowUpDown, SlidersHorizontal, Video, Layers } from 'lucide-react'
import ChapterManager from './ChapterManager'
import SecondScreenRemote from './SecondScreenRemote'
import SmartVideoPlayer from './SmartVideoPlayer'
import PathPicker from './PathPicker'
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
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'title' | 'size' | 'resolution'
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

  // Manual Import State
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importData, setImportData] = useState({
    provider_id: '',
    title: '',
    file_path: '',
    performers: '',
    tags: '',
    resolution: '1080p',
    studio_id: '',
    duration: '',
    file_size: ''
  })
  
  // Filesystem Explorer State
  const [fsExplorerPath, setFsExplorerPath] = useState('')
  const [fsDirs, setFsDirs] = useState([])
  const [fsFiles, setFsFiles] = useState([])
  const [fsMediaRoots, setFsMediaRoots] = useState([])
  const [fsShowSuggestions, setFsShowSuggestions] = useState(false)

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
    let key = localStorage.getItem('voyarr_api_key')
    if (key) {
      try {
        key = atob(key)
      } catch (e) {
        // fallback
      }
    }
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

  const sortedEntries = useMemo(() => {
    if (!entries || !Array.isArray(entries)) return []
    const list = [...entries]
    if (sortBy === 'title') {
      return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }
    if (sortBy === 'size') {
      return list.sort((a, b) => (b.file_size || 0) - (a.file_size || 0))
    }
    if (sortBy === 'resolution') {
      return list.sort((a, b) => (b.resolution || '').localeCompare(a.resolution || ''))
    }
    return list.sort((a, b) => (b.id || 0) - (a.id || 0))
  }, [entries, sortBy])

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
      if (scanProviderId) params.append('provider_id', scanProviderId)
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
      key = await window.appPrompt("Enter your StashDB API Key to submit this fingerprint:");
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
    const newName = await window.appPrompt(`Enter real performer name for ${oldName}:`)
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

  const exploreFilesystem = useCallback(async (pathQuery) => {
    try {
      const params = new URLSearchParams()
      if (pathQuery) params.append('path', pathQuery)
      const res = await apiFetch(`/library/fs/explore?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setFsExplorerPath(data.current_path)
        setFsDirs(data.dirs || [])
        setFsFiles(data.files || [])
        if (data.media_roots) setFsMediaRoots(data.media_roots)
      }
    } catch (e) {
      console.error('Failed to explore filesystem:', e)
    }
  }, [])

  // Hook to populate first media root when dialog opens
  useEffect(() => {
    if (importDialogOpen) {
      exploreFilesystem('')
    }
  }, [importDialogOpen, exploreFilesystem])

  const handleManualImportSubmit = async (e) => {
    e.preventDefault()
    if (!importData.provider_id) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please select a Provider ruleset for metadata context.', severity: 'error' } }))
      return
    }
    if (!importData.title.trim() || !importData.file_path.trim()) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Title and File Path/URL are required.', severity: 'error' } }))
      return
    }

    setImportLoading(true)
    const payload = {
      provider_id: parseInt(importData.provider_id, 10),
      title: importData.title.trim(),
      file_path: importData.file_path.trim(),
      performers: importData.performers ? importData.performers.split(',').map(p => p.trim()).filter(Boolean) : [],
      tags: importData.tags ? importData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      resolution: importData.resolution || '1080p',
      studio_id: importData.studio_id ? parseInt(importData.studio_id, 10) : null,
      duration: importData.duration ? parseInt(importData.duration, 10) : null,
      file_size: importData.file_size ? parseInt(importData.file_size, 10) : null
    }

    try {
      const res = await apiFetch('/library/import/manual', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Manual import registered successfully!', severity: 'success' } }))
        setImportDialogOpen(false)
        setImportData({
          provider_id: '',
          title: '',
          file_path: '',
          performers: '',
          tags: '',
          resolution: '1080p',
          studio_id: '',
          duration: '',
          file_size: ''
        })
        fetchLibrary()
      } else {
        const errData = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: errData.detail || 'Import registration failed.', severity: 'error' } }))
      }
    } catch (err) {
      console.error(err)
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message || 'Networking error performing manual import.', severity: 'error' } }))
    } finally {
      setImportLoading(false)
    }
  }

  const handleDeleteEntry = async (entry) => {
    const confirmed = await window.appConfirm(`Are you sure you want to remove "${entry.title}" from the library?`)
    if (!confirmed) return

    try {
      const res = await apiFetch(`/library/${entry.id}`, { method: 'DELETE' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Item removed from library.', severity: 'success' } }))
        fetchLibrary()
      } else {
        const err = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.detail || 'Failed to remove item', severity: 'error' } }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return
    const confirmed = await window.appConfirm(`Are you sure you want to remove ${selectedEntries.size} selected items from the library?`)
    if (!confirmed) return

    try {
      let count = 0
      for (const id of selectedEntries) {
        const res = await apiFetch(`/library/${id}`, { method: 'DELETE' })
        if (res.ok) count++
      }
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Removed ${count} items from library.`, severity: 'success' } }))
      handleClearSelection()
      fetchLibrary()
    } catch (err) {
      console.error(err)
    }
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
    const confirm = await window.appConfirm(`Queue ${selectedEntries.size} items for AI Auto-Tagging?`)
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

  const [directPickerOpen, setDirectPickerOpen] = useState(false)

  const handleDirectFileImport = async (selectedPath) => {
    if (!selectedPath) return
    const filename = selectedPath.substring(selectedPath.lastIndexOf('/') + 1)
    const title = filename.substring(0, filename.lastIndexOf('.')) || filename

    try {
      const res = await apiFetch('/library/import/manual', {
        method: 'POST',
        body: JSON.stringify({
          title: title,
          file_path: selectedPath
        })
      })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Imported "${title}" to library!`, severity: 'success' } }))
        fetchLibrary()
      } else {
        const errData = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: errData.detail || 'Import failed.', severity: 'error' } }))
      }
    } catch (err) {
      console.error(err)
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message || 'Network error performing import.', severity: 'error' } }))
    }
  }

  const API_BASE = import.meta.env.VITE_API_BASE || '/api'

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Media Library</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" color="primary" startIcon={<FileUp size={18} />} onClick={() => setDirectPickerOpen(true)}>
            Import Media
          </Button>
          <Button variant="outlined" color="info" startIcon={<Plus size={18} />} onClick={() => setImportDialogOpen(true)}>
            Register with Metadata
          </Button>
          <Button variant="outlined" color="secondary" onClick={handleRescanHashes} disabled={rescanLoading}>
            {rescanLoading ? <CircularProgress size={24} /> : 'Re-scan Hashes'}
          </Button>
          <Button variant="contained" color="inherit" sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} onClick={() => setScanDialogOpen(true)}>Scan Directory</Button>
        </Box>
      </Box>

      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        icon={<Film size={20} />} 
        sx={{ 
          mb: 3, 
          borderRadius: '12px', 
          bgcolor: 'rgba(99, 102, 241, 0.08)', 
          color: '#a5b4fc',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          '& .MuiAlert-icon': { color: '#818cf8' } 
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
          🎬 Media Library &amp; Video Content Explorer
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          The Media Library serves as your primary repository for streaming, searching, and managing all downloaded or imported video files. Filter content by resolution, performers, studio, and tags, or trigger AI auto-tagging and media imports.
        </Typography>
      </Alert>

      {/* Direct File Picker (Bypasses metadata modal) */}
      {directPickerOpen && (
        <PathPicker
          value=""
          onChange={(newPath) => {
            setDirectPickerOpen(false)
            if (newPath) handleDirectFileImport(newPath)
          }}
          label="Select Media File to Import"
          mode="both"
        />
      )}

      {/* Modernized Filters & Controls Bar */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 2.5, 
          mb: 3.5, 
          borderRadius: '16px', 
          background: 'rgba(255, 255, 255, 0.03)', 
          backdropFilter: 'blur(16px)', 
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Left: Search & Filter Inputs */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', flex: 1, width: { xs: '100%', md: 'auto' } }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ whiteSpace: 'nowrap', overflow: 'visible' }}>Resolution</InputLabel>
              <Select name="resolution" value={filters.resolution} label="Resolution" onChange={handleFilterChange} sx={{ borderRadius: '10px' }}>
                <MenuItem value=""><em>All Resolutions</em></MenuItem>
                <MenuItem value="4K">4K UHD</MenuItem>
                <MenuItem value="1080p">1080p FHD</MenuItem>
                <MenuItem value="720p">720p HD</MenuItem>
              </Select>
            </FormControl>

            <TextField 
              size="small" 
              label="Performer" 
              name="performer" 
              value={filters.performer} 
              onChange={handleFilterChange} 
              sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
            />
            
            <TextField 
              size="small" 
              label="Tag" 
              name="tag" 
              value={filters.tag} 
              onChange={handleFilterChange} 
              sx={{ minWidth: 130, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
            />

            <TextField 
              size="small" 
              label="Search ohash" 
              name="ohash" 
              value={filters.ohash} 
              onChange={handleFilterChange} 
              sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
            />

            {(filters.resolution || filters.performer || filters.tag || filters.ohash) && (
              <Button 
                size="small" 
                color="warning" 
                onClick={() => setFilters({ resolution: '', performer: '', tag: '', ohash: '' })}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
              >
                Clear Filters
              </Button>
            )}
          </Box>

          {/* Right: Sort Dropdown & View Mode Switcher */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', width: { xs: '100%', md: 'auto' }, justifyContent: 'flex-end' }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Sort By</InputLabel>
              <Select value={sortBy} label="Sort By" onChange={e => setSortBy(e.target.value)} sx={{ borderRadius: '10px' }}>
                <MenuItem value="newest">Newest Added</MenuItem>
                <MenuItem value="title">Title (A-Z)</MenuItem>
                <MenuItem value="size">File Size (Largest)</MenuItem>
                <MenuItem value="resolution">Resolution</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', bgcolor: 'rgba(255,255,255,0.06)', p: 0.5, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Tooltip title="Grid View">
                <IconButton 
                  size="small" 
                  onClick={() => setViewMode('grid')} 
                  color={viewMode === 'grid' ? 'primary' : 'default'}
                  sx={{ borderRadius: '8px', bgcolor: viewMode === 'grid' ? 'rgba(99, 102, 241, 0.2)' : 'transparent' }}
                >
                  <LayoutGrid size={18} />
                </IconButton>
              </Tooltip>
              <Tooltip title="List View">
                <IconButton 
                  size="small" 
                  onClick={() => setViewMode('list')} 
                  color={viewMode === 'list' ? 'primary' : 'default'}
                  sx={{ borderRadius: '8px', bgcolor: viewMode === 'list' ? 'rgba(99, 102, 241, 0.2)' : 'transparent' }}
                >
                  <List size={18} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Media Content Rendering */}
      {sortedEntries.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '16px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
          <Film size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>No media items found</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Try adjusting your search filters or click 'Import Media' to add content to your library.
          </Typography>
          <Button variant="contained" color="primary" startIcon={<FileUp size={18} />} onClick={() => setDirectPickerOpen(true)}>
            Import Media
          </Button>
        </Paper>
      ) : viewMode === 'grid' ? (
        /* Grid View Mode */
        <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
          {sortedEntries.map(entry => {
            const isFav = favScenes.includes(String(entry.id))
            const isSelected = selectedEntries.has(entry.id)
            const is4K = entry.resolution === '4K' || entry.resolution === '2160p'
            
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={entry.id}>
                <Card sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  position: 'relative',
                  borderRadius: '16px',
                  outline: isSelected ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isSelected ? '0 0 20px rgba(99, 102, 241, 0.4)' : '0 8px 24px rgba(0,0,0,0.3)',
                  transition: 'all 0.25s ease-in-out',
                  overflow: 'hidden',
                  background: 'linear-gradient(145deg, rgba(30,30,45,0.7) 0%, rgba(15,15,25,0.9) 100%)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(99, 102, 241, 0.3)'
                  }
                }}>
                  
                  {/* Media Thumbnail Container */}
                  <Box 
                    sx={{ 
                      height: 180, 
                      width: '100%',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover .play-overlay': { opacity: 1, transform: 'scale(1)' },
                      '&:hover .thumb-bg': { transform: 'scale(1.06)' }
                    }}
                    onClick={() => setPlayingVideo(entry)}
                  >
                    {/* Dark Vignette Gradient */}
                    <Box sx={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 1,
                      background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.2) 60%, transparent 100%)',
                      pointerEvents: 'none'
                    }} />

                    {/* Top Left: Checkbox & Resolution Pill */}
                    <Box sx={{ position: 'absolute', top: 10, left: 10, zIndex: 5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Checkbox 
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); handleToggleSelect(entry.id); }}
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                        sx={{
                          color: 'rgba(255,255,255,0.7)',
                          '&.Mui-checked': { color: '#818cf8' },
                          bgcolor: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(8px)',
                          borderRadius: '8px',
                          p: 0.5,
                          border: '1px solid rgba(255,255,255,0.15)',
                          '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.9)' }
                        }}
                      />
                      {entry.resolution && (
                        <Chip 
                          label={entry.resolution} 
                          size="small" 
                          sx={{ 
                            height: 22,
                            fontSize: '0.68rem',
                            fontWeight: 'bold',
                            borderRadius: '6px',
                            color: '#ffffff',
                            background: is4K ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            boxShadow: is4K ? '0 2px 8px rgba(245, 158, 11, 0.4)' : '0 2px 8px rgba(2, 132, 199, 0.3)'
                          }} 
                        />
                      )}
                    </Box>

                    {/* Top Right: Heart & Duration Pill */}
                    <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      {entry.duration && (
                        <Chip 
                          label={`${Math.floor(entry.duration / 60)}:${(entry.duration % 60).toString().padStart(2, '0')}`} 
                          size="small"
                          sx={{ 
                            height: 22,
                            fontSize: '0.68rem',
                            fontWeight: 'bold',
                            borderRadius: '6px',
                            bgcolor: 'rgba(15, 23, 42, 0.75)',
                            backdropFilter: 'blur(8px)',
                            color: '#e2e8f0',
                            border: '1px solid rgba(255,255,255,0.15)'
                          }}
                        />
                      )}
                      <IconButton 
                        onClick={(e) => { e.stopPropagation(); handleToggleFavoriteScene(entry.id); }}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: isFav ? '#ef4444' : '#94a3b8',
                          '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.95)', color: '#ef4444' }
                        }}
                      >
                        {isFav ? <Heart size={16} fill="currentColor" /> : <Heart size={16} />}
                      </IconButton>
                    </Box>

                    {/* Play Button Glowing Trigger Overlay */}
                    <Box 
                      className="play-overlay" 
                      sx={{ 
                        position: 'relative',
                        zIndex: 3, 
                        opacity: 0.85, 
                        transform: 'scale(0.9)',
                        transition: 'all 0.25s ease-in-out',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.5) 0%, rgba(99, 102, 241, 0) 70%)'
                      }}
                    >
                      <PlayCircle size={52} color="#ffffff" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} />
                    </Box>

                    {/* Poster Placeholder Icon */}
                    <Box className="thumb-bg" sx={{ position: 'absolute', opacity: 0.15, transition: 'transform 0.4s ease' }}>
                      <Video size={100} color="#cbd5e1" />
                    </Box>
                  </Box>

                  {/* Card Content Details */}
                  <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography 
                      variant="subtitle1" 
                      noWrap 
                      title={entry.title} 
                      sx={{ fontWeight: '700', letterSpacing: '-0.3px', color: '#f8fafc', fontSize: '0.95rem' }}
                    >
                      {entry.title || `Media Item #${entry.id}`}
                    </Typography>

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{entry.file_size ? (entry.file_size / (1024 * 1024)).toFixed(1) + ' MB' : 'Unknown Size'}</span>
                      {entry.ohash && <span>• ohash: {entry.ohash.substring(0, 10)}...</span>}
                    </Typography>

                    {/* Performers List Chips */}
                    {entry.performers && entry.performers.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {entry.performers.slice(0, 3).map(p => (
                          <Chip 
                            key={p} 
                            label={p} 
                            size="small" 
                            onClick={(e) => { e.stopPropagation(); setFilters(prev => ({ ...prev, performer: p })); }}
                            sx={{ 
                              height: 20, 
                              fontSize: '0.68rem', 
                              bgcolor: 'rgba(99, 102, 241, 0.12)', 
                              color: '#a5b4fc', 
                              border: '1px solid rgba(99, 102, 241, 0.2)',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.25)' }
                            }} 
                          />
                        ))}
                        {entry.performers.length > 3 && (
                          <Chip label={`+${entry.performers.length - 3}`} size="small" sx={{ height: 20, fontSize: '0.65rem', opacity: 0.6 }} />
                        )}
                      </Box>
                    )}
                  </CardContent>

                  {/* Card Footer Actions Row */}
                  <Box sx={{ 
                    p: 1.5, 
                    pt: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    bgcolor: 'rgba(0,0,0,0.15)'
                  }}>
                    <Button 
                      size="small" 
                      startIcon={<PlayCircle size={14} />} 
                      onClick={() => setPlayingVideo(entry)}
                      sx={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#818cf8', textTransform: 'none' }}
                    >
                      Stream
                    </Button>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Manage Video Chapters">
                        <IconButton size="small" onClick={() => setManagingChaptersFor(entry)} sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff' } }}>
                          <List size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Item">
                        <IconButton size="small" color="error" onClick={() => handleDeleteEntry(entry)} sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      ) : (
        /* Compact List View Mode */
        <Paper sx={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.4)' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Showing {sortedEntries.length} Items</Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', '& th, & td': { p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)' } }}>
              <Box component="thead" sx={{ bgcolor: 'rgba(255,255,255,0.02)', color: 'text.secondary', fontSize: '0.8rem', fontWeight: 'bold' }}>
                <Box component="tr">
                  <Box component="th" sx={{ width: 40 }}></Box>
                  <Box component="th">Title</Box>
                  <Box component="th">Resolution</Box>
                  <Box component="th">Performers</Box>
                  <Box component="th">Size</Box>
                  <Box component="th" sx={{ textAlign: 'right' }}>Actions</Box>
                </Box>
              </Box>
              <Box component="tbody" sx={{ fontSize: '0.875rem' }}>
                {sortedEntries.map(entry => {
                  const isFav = favScenes.includes(String(entry.id))
                  const isSelected = selectedEntries.has(entry.id)
                  return (
                    <Box component="tr" key={entry.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                      <Box component="td">
                        <Checkbox size="small" checked={isSelected} onChange={() => handleToggleSelect(entry.id)} />
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#f8fafc', cursor: 'pointer' }} onClick={() => setPlayingVideo(entry)}>
                          {entry.title}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Chip label={entry.resolution || 'Unknown'} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                      </Box>
                      <Box component="td">
                        {entry.performers?.join(', ') || '—'}
                      </Box>
                      <Box component="td" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {entry.file_size ? (entry.file_size / (1024 * 1024)).toFixed(1) + ' MB' : '—'}
                      </Box>
                      <Box component="td" sx={{ textAlign: 'right' }}>
                        <IconButton size="small" onClick={() => setPlayingVideo(entry)} color="primary"><PlayCircle size={16} /></IconButton>
                        <IconButton size="small" onClick={() => handleToggleFavoriteScene(entry.id)} color={isFav ? "error" : "default"}><Heart size={16} fill={isFav ? "currentColor" : "none"} /></IconButton>
                        <IconButton size="small" onClick={() => setManagingChaptersFor(entry)}><List size={16} /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteEntry(entry)}><Trash2 size={16} /></IconButton>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Floating Sticky Bulk Action Bar */}
      {selectedEntries.size > 0 && (
        <Paper
          elevation={12}
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            p: 1.5,
            px: 3,
            borderRadius: '20px',
            bgcolor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Chip 
            label={`${selectedEntries.size} Selected`} 
            color="primary" 
            size="small" 
            sx={{ fontWeight: 'bold', borderRadius: '10px' }} 
          />
          
          <Button 
            size="small" 
            variant="contained" 
            color="secondary" 
            startIcon={<Sparkles size={16} />} 
            onClick={handleBulkAI}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
          >
            AI Tag Selected
          </Button>

          <Button 
            size="small" 
            variant="outlined" 
            color="info" 
            startIcon={<Edit2 size={16} />} 
            onClick={() => setBulkEditOpen(true)}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
          >
            Bulk Edit
          </Button>

          <Button 
            size="small" 
            variant="outlined" 
            color="error" 
            startIcon={<Trash2 size={16} />} 
            onClick={handleBulkDelete}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
          >
            Remove Selected
          </Button>

          <Button 
            size="small" 
            color="inherit" 
            onClick={handleClearSelection}
            sx={{ borderRadius: '10px', textTransform: 'none', opacity: 0.7 }}
          >
            Clear Selection
          </Button>
        </Paper>
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
            Select a provider to apply specific naming rules, or select "Auto-Detect / General" to scan automatically and register files under their existing filenames.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel>Provider Ruleset</InputLabel>
            <Select value={scanProviderId} label="Provider Ruleset" onChange={e => setScanProviderId(e.target.value)}>
              <MenuItem value="">Auto-Detect / Keep Filename (General)</MenuItem>
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
          <Button onClick={handleScanDirectory} variant="contained" disabled={scanLoading}>
            {scanLoading ? <CircularProgress size={24} /> : 'Start Scan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Video Player Modal / Second Screen Remote Overlay */}
      <Dialog open={Boolean(playingVideo)} onClose={handleClosePlayer} maxWidth="lg" fullWidth>
        <DialogTitle component="div" sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="div" noWrap sx={{ pr: 2 }}>{playingVideo?.title}</Typography>
          <IconButton onClick={handleClosePlayer} size="small">
          <X size={20} />
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
                    <SmartVideoPlayer
                      key={playingVideo.id}
                      src={`${API_BASE}/library/${playingVideo.id}/stream?${getAuthQuery()}`}
                      onPlay={() => handleVideoPlay(playingVideo.id)}
                      autoPlay
                      controls
                      controlsList="nodownload"
                    />
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
                    <Box sx={{ color: 'primary.main', display: 'flex' }}><Cast size={18} /></Box>
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
                            <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem' }}>{person}</Typography>
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
                      startIcon={<CloudUpload size={20} />} 
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
              <Grid xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
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
                    <Grid xs={6}>
                      <Typography variant="caption" color="textSecondary">Gender</Typography>
                      <Typography variant="body2" sx={{ fontWeight: '500' }}>{performerDetails.gender || 'N/A'}</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="caption" color="textSecondary">Cup Size</Typography>
                      <Typography variant="body2" sx={{ fontWeight: '500' }}>{performerDetails.cup_size || 'N/A'}</Typography>
                    </Grid>
                    <Grid xs={12} sx={{ mt: 1 }}>
                      <Typography variant="caption" color="textSecondary">Measurements</Typography>
                      <Typography variant="body2" sx={{ fontWeight: '500' }}>{performerDetails.measurements || 'N/A'}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Right Column: Bio & Aliases */}
              <Grid xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
            startIcon={<Edit2 size={18} />} 
            onClick={() => setBulkEditOpen(true)}
            sx={{ borderRadius: '10px' }}
          >
            Bulk Edit
          </Button>
          <Button 
            variant="outlined" 
            color="info" 
            size="small" 
            startIcon={<Sparkles size={18} />} 
            onClick={handleBulkAI}
            sx={{ borderRadius: '10px' }}
          >
            AI Auto-Tag
          </Button>
          <IconButton onClick={handleClearSelection} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white' } }}>
            <X size={20} />
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
            <X size={20} />
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
              slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
              inputProps={{ style: { color: 'white' } }}
            />

            <TextField
              fullWidth
              label="Tags to Add (comma-separated)"
              value={bulkEditData.tags_to_add}
              onChange={(e) => setBulkEditData(prev => ({ ...prev, tags_to_add: e.target.value }))}
              slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
              inputProps={{ style: { color: 'white' } }}
            />

            <TextField
              fullWidth
              label="Tags to Remove (comma-separated)"
              value={bulkEditData.tags_to_remove}
              onChange={(e) => setBulkEditData(prev => ({ ...prev, tags_to_remove: e.target.value }))}
              slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
              inputProps={{ style: { color: 'white' } }}
            />

            <TextField
              fullWidth
              label="Performers to Add (comma-separated)"
              value={bulkEditData.performers_to_add}
              onChange={(e) => setBulkEditData(prev => ({ ...prev, performers_to_add: e.target.value }))}
              slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
              inputProps={{ style: { color: 'white' } }}
            />

            <TextField
              fullWidth
              label="Performers to Remove (comma-separated)"
              value={bulkEditData.performers_to_remove}
              onChange={(e) => setBulkEditData(prev => ({ ...prev, performers_to_remove: e.target.value }))}
              slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
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

      {/* Manual Import Dialog */}
      <Dialog 
        open={importDialogOpen} 
        onClose={() => !importLoading && setImportDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            color: 'white',
            width: '100%',
            maxWidth: '600px'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Import Video File / Stream
          <IconButton onClick={() => setImportDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white' } }}>
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <Box component="form" onSubmit={handleManualImportSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.6)">
              Directly add a local file path or a streaming URL (e.g. <code>.m3u8</code>, <code>.mpd</code>, or http stream) to your media library database.
            </Typography>

            {/* Searchable & Creatable Provider Selection */}
            <Autocomplete
              options={providers}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option
                if (option?.inputValue) return option.inputValue
                return option?.name || ''
              }}
              value={providers.find(p => String(p.id) === String(importData.provider_id)) || (importData.provider_name ? { name: importData.provider_name } : null)}
              onChange={(e, newValue) => {
                if (typeof newValue === 'string') {
                  setImportData(prev => ({ ...prev, provider_id: '', provider_name: newValue }))
                } else if (newValue && newValue.inputValue) {
                  setImportData(prev => ({ ...prev, provider_id: '', provider_name: newValue.inputValue }))
                } else if (newValue) {
                  setImportData(prev => ({ ...prev, provider_id: newValue.id, provider_name: newValue.name }))
                } else {
                  setImportData(prev => ({ ...prev, provider_id: '', provider_name: '' }))
                }
              }}
              filterOptions={(options, params) => {
                const filter = createFilterOptions()
                const filtered = filter(options, params)
                const { inputValue } = params
                const isExisting = options.some((option) => inputValue.toLowerCase() === option.name.toLowerCase())
                if (inputValue !== '' && !isExisting) {
                  filtered.push({
                    inputValue,
                    name: `+ Create "${inputValue}"`,
                  })
                }
                return filtered
              }}
              selectOnFocus
              clearOnBlur
              handleHomeEndKeys
              freeSolo
              fullWidth
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Provider context *"
                  placeholder="Search or type to create provider..."
                  required={!importData.provider_id && !importData.provider_name}
                  slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
                />
              )}
            />

            <TextField
              fullWidth
              label="Title *"
              value={importData.title}
              onChange={(e) => setImportData(prev => ({ ...prev, title: e.target.value }))}
              slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
              inputProps={{ style: { color: 'white' } }}
              required
            />

            {/* Integrated PathPicker File / Stream selector with real-time backend autocomplete & tree modal */}
            <PathPicker
              value={importData.file_path}
              onChange={(newPath) => {
                setImportData(prev => {
                  let updatedTitle = prev.title
                  if (!prev.title && newPath && !newPath.includes('://')) {
                    const filename = newPath.substring(newPath.lastIndexOf('/') + 1)
                    updatedTitle = filename.substring(0, filename.lastIndexOf('.')) || filename
                  }
                  return {
                    ...prev,
                    file_path: newPath,
                    title: updatedTitle
                  }
                })
              }}
              label="File Path / Stream URL *"
              helperText="Enter a local media file/folder path or a remote stream URL (.m3u8, .mpd)"
              mode="both"
              fullWidth
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Searchable & Creatable Studio Selection */}
              <Autocomplete
                options={studios}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') return option
                  if (option?.inputValue) return option.inputValue
                  return option?.name || ''
                }}
                value={studios.find(s => String(s.id) === String(importData.studio_id)) || (importData.studio_name ? { name: importData.studio_name } : null)}
                onChange={(e, newValue) => {
                  if (typeof newValue === 'string') {
                    setImportData(prev => ({ ...prev, studio_id: '', studio_name: newValue }))
                  } else if (newValue && newValue.inputValue) {
                    setImportData(prev => ({ ...prev, studio_id: '', studio_name: newValue.inputValue }))
                  } else if (newValue) {
                    setImportData(prev => ({ ...prev, studio_id: newValue.id, studio_name: newValue.name }))
                  } else {
                    setImportData(prev => ({ ...prev, studio_id: '', studio_name: '' }))
                  }
                }}
                filterOptions={(options, params) => {
                  const filter = createFilterOptions()
                  const filtered = filter(options, params)
                  const { inputValue } = params
                  const isExisting = options.some((option) => inputValue.toLowerCase() === option.name.toLowerCase())
                  if (inputValue !== '' && !isExisting) {
                    filtered.push({
                      inputValue,
                      name: `+ Create "${inputValue}"`,
                    })
                  }
                  return filtered
                }}
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
                freeSolo
                fullWidth
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Studio"
                    placeholder="Search or type to create studio..."
                    slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
                  />
                )}
              />

              {/* Searchable & Creatable Resolution Selection */}
              <Autocomplete
                options={['2160p (4K)', '1440p (2K)', '1080p', '720p', '480p', '360p']}
                value={importData.resolution}
                onChange={(e, newValue) => {
                  setImportData(prev => ({ ...prev, resolution: newValue || '' }))
                }}
                filterOptions={(options, params) => {
                  const filter = createFilterOptions()
                  const filtered = filter(options, params)
                  const { inputValue } = params
                  const isExisting = options.some((option) => inputValue.toLowerCase() === option.toLowerCase())
                  if (inputValue !== '' && !isExisting) {
                    filtered.push(`+ Create "${inputValue}"`)
                  }
                  return filtered
                }}
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
                freeSolo
                fullWidth
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Resolution"
                    placeholder="Search or enter resolution..."
                    slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
                  />
                )}
              />
            </Box>

            {/* Searchable & Creatable Multi-Select Performers */}
            <Autocomplete
              multiple
              freeSolo
              options={Array.from(new Set(entries.flatMap(e => e.performers || []))).filter(Boolean)}
              value={importData.performers ? importData.performers.split(',').map(p => p.trim()).filter(Boolean) : []}
              onChange={(e, newValue) => {
                const cleanedValues = newValue.map(v => v.replace(/^\+\s*Create\s*"([^"]+)"$/, '$1').trim())
                setImportData(prev => ({ ...prev, performers: cleanedValues.join(', ') }))
              }}
              filterOptions={(options, params) => {
                const filter = createFilterOptions()
                const filtered = filter(options, params)
                const { inputValue } = params
                const isExisting = options.some((option) => inputValue.toLowerCase() === option.toLowerCase())
                if (inputValue !== '' && !isExisting) {
                  filtered.push(`+ Create "${inputValue}"`)
                }
                return filtered
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index })
                  return (
                    <Chip
                      key={key || option}
                      size="small"
                      variant="outlined"
                      label={option}
                      {...tagProps}
                      sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}
                    />
                  )
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Performers"
                  placeholder="Search existing performers or type new ones..."
                  slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
                />
              )}
            />

            {/* Searchable & Creatable Multi-Select Tags */}
            <Autocomplete
              multiple
              freeSolo
              options={Array.from(new Set(entries.flatMap(e => e.tags || []))).filter(Boolean)}
              value={importData.tags ? importData.tags.split(',').map(t => t.trim()).filter(Boolean) : []}
              onChange={(e, newValue) => {
                const cleanedValues = newValue.map(v => v.replace(/^\+\s*Create\s*"([^"]+)"$/, '$1').trim())
                setImportData(prev => ({ ...prev, tags: cleanedValues.join(', ') }))
              }}
              filterOptions={(options, params) => {
                const filter = createFilterOptions()
                const filtered = filter(options, params)
                const { inputValue } = params
                const isExisting = options.some((option) => inputValue.toLowerCase() === option.toLowerCase())
                if (inputValue !== '' && !isExisting) {
                  filtered.push(`+ Create "${inputValue}"`)
                }
                return filtered
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index })
                  return (
                    <Chip
                      key={key || option}
                      size="small"
                      variant="outlined"
                      label={option}
                      {...tagProps}
                      sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}
                    />
                  )
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  placeholder="Search existing tags or type new ones..."
                  slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
                />
              )}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                type="number"
                label="Duration (seconds)"
                value={importData.duration}
                onChange={(e) => setImportData(prev => ({ ...prev, duration: e.target.value }))}
                slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
                inputProps={{ style: { color: 'white' } }}
              />
              <TextField
                fullWidth
                type="number"
                label="File size (bytes)"
                value={importData.file_size}
                onChange={(e) => setImportData(prev => ({ ...prev, file_size: e.target.value }))}
                slotProps={{ inputLabel: { style: { color: 'rgba(255,255,255,0.7)' } } }}
                inputProps={{ style: { color: 'white' } }}
              />
            </Box>

            <DialogActions sx={{ px: 0, pb: 0, pt: 2 }}>
              <Button 
                onClick={() => {
                  setImportDialogOpen(false)
                  setFsShowSuggestions(false)
                }} 
                disabled={importLoading} 
                sx={{ color: 'rgba(255,255,255,0.7)' }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="contained" 
                color="info"
                disabled={importLoading}
                startIcon={importLoading && <CircularProgress size={20} />}
              >
                Register Import
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  )
}