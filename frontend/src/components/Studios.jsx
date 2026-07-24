import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, Grid, Card, CardContent, Button, TextField, Dialog, 
  DialogTitle, DialogContent, DialogActions, FormControlLabel, Switch, 
  FormControl, InputLabel, Select, MenuItem, Chip, CircularProgress, 
  Alert, IconButton, CardMedia, Tooltip, Paper, Autocomplete
} from '@mui/material'
import { Plus, Edit2, Trash2, Link, Building2, Heart, Globe, Upload, Image as ImageIcon } from 'lucide-react'
import { apiFetch } from '../api'
import { MediaEntityCard } from './common'
import UrlParseConfirmationModal from './UrlParseConfirmationModal'
import { getSafeLogoUrl, getFaviconFromUrl } from '../utils/logoHelpers'

function StudioCardLogo({ logoUrl, webUrl, altName, size = 46 }) {
  const [imgError, setImgError] = useState(false)
  const primarySrc = getSafeLogoUrl(logoUrl) || getFaviconFromUrl(webUrl)

  useEffect(() => {
    setImgError(false)
  }, [logoUrl, webUrl])

  if (!primarySrc || imgError) {
    return <Building2 size={size} style={{ opacity: 0.35 }} />
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 0.75,
        borderRadius: '12px',
        bgcolor: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        maxWidth: '85%',
        maxHeight: '85%'
      }}
    >
      <Box
        component="img"
        src={primarySrc}
        alt={altName}
        onError={() => setImgError(true)}
        sx={{ 
          maxWidth: '100%', 
          maxHeight: 70, 
          objectFit: 'contain', 
          width: 'auto', 
          height: 'auto', 
          display: 'block',
          filter: 'drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.65)) drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.4))'
        }}
      />
    </Box>
  )
}

export default function Studios() {
  const [studios, setStudios] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Favorites mapping
  const [favStudios, setFavStudios] = useState([])

  // Modal form states
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    url: '',
    details: '',
    tags: '',
    is_network: false,
    parent_id: ''
  })
  const [submitting, setSubmitting] = useState(false)

  // URL Parsing states
  const [parseUrl, setParseUrl] = useState('')
  const [parseLoading, setParseLoading] = useState(false)
  const [parsedMetadata, setParsedMetadata] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [urlParsingPermission, setUrlParsingPermission] = useState('edit')

  // Canvas Logo Editor State
  const [openLogoCanvas, setOpenLogoCanvas] = useState(false)
  const [logoScale, setLogoScale] = useState(100)
  const [logoPadding, setLogoPadding] = useState(15)
  const [logoOffset, setLogoOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [scrapingLogo, setScrapingLogo] = useState(false)

  // Current User Info for RBAC checks
  const [currentUserRole, setCurrentUserRole] = useState('viewer')

  const fetchUserRole = useCallback(async () => {
    try {
      const meRes = await apiFetch('/auth/me')
      if (meRes.ok) {
        const me = await meRes.json()
        const userPerms = me.permissions || {}
        const perm = userPerms.url_parsing || (me.role === 'admin' ? 'edit' : 'no_access')
        setUrlParsingPermission(perm)
      }
      const res = await apiFetch('/user/stats/preferences') // dummy call to verify login state and details
      if (res.ok) {
        // Assume admin if settings/write commands are enabled on backend or decode token if stored
        // A simple check on standard settings endpoint can also reveal roles
      }
      // Fetching from `/settings` is only allowed for admins, which can tell us if user is admin
      const settingsRes = await apiFetch('/settings')
      if (settingsRes.ok) {
        setCurrentUserRole('admin')
      } else {
        setCurrentUserRole('user')
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const fetchStudios = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.append('q', search)
      const res = await apiFetch(`/studios?${params.toString()}`)
      if (res.ok) {
        setStudios(await res.json())
      } else {
        setError('Failed to fetch studio profiles.')
      }

      // Also get favorites to highlight favorited studios
      const favRes = await apiFetch('/favorites')
      if (favRes.ok) {
        const favs = await favRes.json()
        setFavStudios(favs.studio || [])
      }
    } catch (e) {
      console.error(e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchUserRole()
    fetchStudios()
  }, [fetchStudios, fetchUserRole])

  const handleToggleFavorite = async (studioId, studioName) => {
    const stringId = String(studioId)
    try {
      const res = await apiFetch('/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ item_type: 'studio', item_id: stringId })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.favorited) {
          setFavStudios(prev => [...prev, stringId])
          window.dispatchEvent(new CustomEvent('show-toast', { 
            detail: { message: `Favorited ${studioName}!`, severity: 'success' } 
          }))
        } else {
          setFavStudios(prev => prev.filter(x => x !== stringId))
          window.dispatchEvent(new CustomEvent('show-toast', { 
            detail: { message: `Unfavorited ${studioName}.`, severity: 'info' } 
          }))
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setFormData({
      name: '',
      logo_url: '',
      url: '',
      details: '',
      tags: [],
      is_network: false,
      parent_id: ''
    })
    setOpen(true)
  }

  const handleOpenEdit = (studio) => {
    if (!studio) return
    setEditingId(studio.id)
    setFormData({
      name: studio.name || '',
      logo_url: studio.logo_url || '',
      url: studio.url || '',
      details: studio.details || '',
      tags: Array.isArray(studio.tags) ? studio.tags : (typeof studio.tags === 'string' ? studio.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      is_network: !!studio.is_network,
      parent_id: studio.parent_id ? String(studio.parent_id) : ''
    })
    setOpen(true)
  }

  const renderLogoCanvas = useCallback(() => {
    const canvas = document.getElementById('studio-logo-canvas')
    const logoSrc = getSafeLogoUrl(formData.logo_url) || getFaviconFromUrl(formData.url)
    if (!canvas || !logoSrc) return
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const padX = (canvas.width * (logoPadding / 100)) / 2
      const padY = (canvas.height * (logoPadding / 100)) / 2
      const availWidth = canvas.width - padX * 2
      const availHeight = canvas.height - padY * 2

      const scale = logoScale / 100
      const imgAspect = img.width / img.height || 1
      const boxAspect = availWidth / availHeight

      let drawW, drawH
      if (imgAspect > boxAspect) {
        drawW = availWidth * scale
        drawH = (availWidth / imgAspect) * scale
      } else {
        drawH = availHeight * scale
        drawW = (availHeight * imgAspect) * scale
      }

      const drawX = (canvas.width - drawW) / 2 + logoOffset.x
      const drawY = (canvas.height - drawH) / 2 + logoOffset.y

      ctx.drawImage(img, drawX, drawY, drawW, drawH)
    }
    img.src = logoSrc
  }, [formData.logo_url, formData.url, logoScale, logoPadding, logoOffset])

  useEffect(() => {
    if (openLogoCanvas) {
      // Delay slightly to ensure canvas DOM element is mounted
      const timer = setTimeout(() => {
        renderLogoCanvas()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [openLogoCanvas, renderLogoCanvas])

  const handleCanvasMouseDown = (e) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - logoOffset.x, y: e.clientY - logoOffset.y })
  }

  const handleCanvasMouseMove = (e) => {
    if (!isDragging) return
    setLogoOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const handleCanvasMouseUp = () => {
    setIsDragging(false)
  }

  const handleApplyLogoEdit = () => {
    const canvas = document.getElementById('studio-logo-canvas')
    if (canvas) {
      try {
        const dataUrl = canvas.toDataURL('image/png')
        setFormData(prev => ({ ...prev, logo_url: dataUrl }))
        setOpenLogoCanvas(false)
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Adjusted logo applied to studio!', severity: 'success' } }))
      } catch (err) {
        setOpenLogoCanvas(false)
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Logo adjustments saved!', severity: 'success' } }))
      }
    }
  }

  const handleScrapeStudioUrl = async () => {
    const targetUrl = formData.url || parseUrl;
    if (!targetUrl) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please enter a Web Address URL to scrape.', severity: 'warning' } }))
      return
    }
    setScrapingLogo(true)
    try {
      const res = await apiFetch('/providers/scrape-url', {
        method: 'POST',
        body: JSON.stringify({ url: targetUrl })
      })
      if (res.ok) {
        const data = await res.json()
        setFormData(prev => ({
          ...prev,
          name: data.site_name || prev.name,
          logo_url: data.logo_url || data.favicon_url || prev.logo_url,
          url: targetUrl,
          details: data.description || prev.details,
          tags: data.keywords ? data.keywords.split(',').map(k => k.trim()).filter(Boolean) : prev.tags
        }))
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Studio metadata & logo scraped successfully!', severity: 'success' } }))
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Could not scrape studio website.', severity: 'error' } }))
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message, severity: 'error' } }))
    } finally {
      setScrapingLogo(false)
    }
  }

  const handleDelete = async (id) => {
    const confirm = await window.appConfirm('Are you sure you want to delete this studio profile?')
    if (!confirm) return

    try {
      const res = await apiFetch(`/studios/${id}`, { method: 'DELETE' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Studio deleted successfully.', severity: 'success' } 
        }))
        fetchStudios()
      } else {
        const data = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: data.detail || 'Delete failed.', severity: 'error' } 
        }))
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
      if (appliedData.description) updated.details = appliedData.details || appliedData.description
      if (appliedData.thumbnail_url) updated.logo_url = appliedData.thumbnail_url
      if (appliedData.tags?.length > 0) updated.tags = appliedData.tags
      if (parseUrl) updated.url = parseUrl
      return updated
    })
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Parsed metadata successfully applied!', severity: 'info' } }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    // Format tags array
    const tagsArr = Array.isArray(formData.tags)
      ? formData.tags
      : (formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [])

    const payload = {
      name: formData.name,
      logo_url: formData.logo_url || null,
      url: formData.url || null,
      details: formData.details || null,
      tags: tagsArr,
      is_network: formData.is_network,
      parent_id: formData.parent_id ? parseInt(formData.parent_id, 10) : null
    }

    try {
      const url = editingId ? `/studios/${editingId}` : '/studios'
      const method = editingId ? 'PUT' : 'POST'
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: editingId ? 'Studio profile updated.' : 'Studio profile created.', severity: 'success' } 
        }))
        setOpen(false)
        fetchStudios()
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

  const isAdmin = currentUserRole === 'admin'

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: '800', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', sm: 'flex-start' }, gap: 1.5, textAlign: { xs: 'center', sm: 'left' } }}>
          <Box sx={{ color: 'primary.main', display: 'flex' }}><Building2 size={36} /></Box>
          Studio Profiles
        </Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<Plus size={20} />} onClick={handleOpenCreate} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Add Studio
          </Button>
        )}
      </Box>

      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        icon={<Building2 size={20} />} 
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
          🎬 Production Studios & Media Networks (Who Creates Content)
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          Studios represent the content creators, producers, and broadcast networks (e.g. Brazzers, MindGeek/Aylo). Use Studios to organize metadata, establish parent/subsidiary network hierarchies, and tag media in your Library.
        </Typography>
      </Alert>

      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 3, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
        <TextField
          fullWidth
          size="small"
          label="Search Studios & Networks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      ) : studios.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}>
          <Typography color="textSecondary">No studio profiles found.</Typography>
        </Paper>
      ) : (
        <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
          {studios.map(studio => {
            const stringId = String(studio.id)
            const isFavorited = favStudios.includes(stringId)
            return (
              <Grid size={{ xs: 12, sm: 6, md: 6, lg: 4 }} xs={12} sm={6} md={6} lg={4} key={studio.id} sx={{ display: 'flex', minWidth: 0 }}>
                <MediaEntityCard
                  mediaHeader={<StudioCardLogo logoUrl={studio.logo_url} webUrl={studio.url} altName={studio.name} size={46} />}
                  topBadges={
                    <>
                      {studio.is_network && (
                        <Chip label="Network" size="small" color="secondary" sx={{ fontWeight: 'bold', fontSize: '0.65rem', height: 22 }} />
                      )}
                      {studio.parent_name && (
                        <Chip label={`Sub of ${studio.parent_name}`} size="small" variant="outlined" sx={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'text.secondary', fontSize: '0.65rem', height: 22, backdropFilter: 'blur(4px)' }} />
                      )}
                    </>
                  }
                  topActions={
                    <IconButton 
                      size="small"
                      sx={{ 
                        backgroundColor: 'rgba(0,0,0,0.5)', 
                        backdropFilter: 'blur(6px)',
                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' } 
                      }}
                      onClick={() => handleToggleFavorite(studio.id, studio.name)}
                      color={isFavorited ? "error" : "default"}
                    >
                      {isFavorited ? <Heart size={20} fill="currentColor" /> : <Heart size={20} />}
                    </IconButton>
                  }
                  title={studio.name}
                  subtitle={
                    studio.url && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, minWidth: 0, width: '100%' }}>
                        <Link size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
                        <Typography 
                          variant="caption" 
                          component="a" 
                          href={studio.url} 
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
                          {studio.url.replace(/^https?:\/\/(www\.)?/, '')}
                        </Typography>
                      </Box>
                    )
                  }
                  description={studio.details || 'No additional profile details provided.'}
                  bodySections={
                    <>
                      {/* Interactive Linked Subsidiary Studios for Networks */}
                      {studio.is_network && (() => {
                        const linkedStudios = studios.filter(s => s.parent_id && String(s.parent_id) === String(studio.id));
                        if (linkedStudios.length === 0) return null;
                        return (
                          <Box sx={{ mb: 2, p: 1.5, borderRadius: '10px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                              <Building2 size={13} /> Linked Subsidiary Studios ({linkedStudios.length})
                            </Typography>
                            <Box sx={{ 
                              display: 'flex', 
                              flexWrap: 'wrap', 
                              gap: 0.5, 
                              maxHeight: 76, 
                              overflowY: 'auto',
                              pr: 0.5,
                              '&::-webkit-scrollbar': { width: '4px' },
                              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: '4px' }
                            }}>
                              {linkedStudios.map(sub => (
                                <Chip
                                  key={sub.id}
                                  label={sub.name}
                                  size="small"
                                  onClick={() => handleOpenEdit(sub)}
                                  icon={<Edit2 size={12} />}
                                  sx={{
                                    fontSize: '0.7rem',
                                    height: 24,
                                    cursor: 'pointer',
                                    bgcolor: 'rgba(255,255,255,0.06)',
                                    '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.3)', color: '#fff' }
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        );
                      })()}

                      {studio.tags && studio.tags.length > 0 && (
                        <Box sx={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: 0.75, 
                          mb: 2, 
                          maxHeight: 56, 
                          overflowY: 'auto',
                          pr: 0.5,
                          '&::-webkit-scrollbar': { width: '4px' },
                          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: '4px' }
                        }}>
                          {studio.tags.map(t => (
                            <Chip 
                              key={t} 
                              label={t} 
                              size="small" 
                              variant="outlined" 
                              sx={{ borderRadius: '6px', fontSize: '0.7rem', height: 22, backgroundColor: 'rgba(255,255,255,0.03)' }} 
                            />
                          ))}
                        </Box>
                      )}
                    </>
                  }
                  footerActions={
                    isAdmin && (
                      <>
                        <IconButton size="small" color="primary" onClick={() => handleOpenEdit(studio)}>
                          <Edit2 size={16} />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(studio.id)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </>
                    )
                  }
                />
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onClose={() => !submitting && setOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Edit Studio Profile' : 'Add Studio Profile'}</DialogTitle>
          <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {urlParsingPermission !== 'no_access' && (
              <Box sx={{ display: 'flex', gap: 1, mb: 1, p: 2, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', alignItems: 'center' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Paste URL to parse studio metadata..."
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
              label="Studio Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                fullWidth
                size="small"
                label="Web Address"
                value={formData.url}
                placeholder="https://example.com"
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
              <Button 
                variant="outlined" 
                color="secondary" 
                onClick={handleScrapeStudioUrl} 
                disabled={scrapingLogo || (!formData.url && !parseUrl)}
                sx={{ borderRadius: '8px', whiteSpace: 'nowrap', py: 1 }}
              >
                {scrapingLogo ? <CircularProgress size={18} /> : 'Scrape'}
              </Button>
            </Box>

            <TextField
              fullWidth
              size="small"
              label="Logo URL"
              value={formData.logo_url}
              placeholder="https://example.com/logo.png"
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              helperText="URL to logo image or base64 data URL"
            />

            {/* Logo & Favicon Preview & Adjustment Panel */}
            <Box sx={{ 
              p: 2, 
              borderRadius: '12px', 
              background: 'rgba(255, 255, 255, 0.02)', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                <ImageIcon size={16} color="#818cf8" /> Logo &amp; Favicon Preview &amp; Adjustment
              </Typography>

              <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Current Studio Logo Preview */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>Logo Preview</Typography>
                  <Box sx={{ 
                    width: 72, 
                    height: 72, 
                    borderRadius: '12px', 
                    bgcolor: 'rgba(0,0,0,0.4)', 
                    border: '1px dashed rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    p: 1
                  }}>
                    <StudioCardLogo logoUrl={formData.logo_url} webUrl={formData.url} altName="Logo Preview" size={28} />
                  </Box>
                </Box>

                {/* Site Favicon Preview */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>Site Favicon</Typography>
                  <Box sx={{ 
                    width: 72, 
                    height: 72, 
                    borderRadius: '12px', 
                    bgcolor: 'rgba(0,0,0,0.4)', 
                    border: '1px dashed rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    p: 1
                  }}>
                    {getFaviconFromUrl(formData.url) ? (
                      <img 
                        src={getFaviconFromUrl(formData.url)} 
                        alt="Favicon Preview" 
                        onError={(e) => { e.target.style.display = 'none'; }}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Globe size={30} style={{ opacity: 0.3 }} />
                    )}
                  </Box>
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1, justifyContent: 'center' }}>
                  {formData.url && getFaviconFromUrl(formData.url) && (
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="secondary"
                      startIcon={<Globe size={14} />}
                      onClick={() => setFormData({ ...formData, logo_url: getFaviconFromUrl(formData.url) })}
                      sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem', py: 0.75 }}
                    >
                      Use Favicon as Logo
                    </Button>
                  )}
                  {formData.logo_url && (
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => setOpenLogoCanvas(true)}
                      sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem', py: 0.75 }}
                    >
                      Adjust &amp; Crop Logo
                    </Button>
                  )}
                  <Button 
                    component="label" 
                    size="small" 
                    variant="outlined" 
                    startIcon={<Upload size={14} />}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem', py: 0.75 }}
                  >
                    Upload Custom Image
                    <input 
                      type="file" 
                      hidden 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            if (evt.target?.result) {
                              setFormData(prev => ({ ...prev, logo_url: evt.target.result }));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </Button>
                  {formData.logo_url && (
                    <Button
                      size="small"
                      color="error"
                      variant="text"
                      onClick={() => setFormData({ ...formData, logo_url: '' })}
                      sx={{ fontSize: '0.7rem', py: 0 }}
                    >
                      Clear Logo
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              size="small"
              label="Details / Description"
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
            />

            {/* Interactive Tag Chips Autocomplete */}
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={Array.isArray(formData.tags) ? formData.tags : (formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [])}
              onChange={(event, newValue) => {
                setFormData({ ...formData, tags: newValue })
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index })
                  return (
                    <Chip 
                      key={key || option} 
                      variant="outlined" 
                      label={option} 
                      size="small"
                      {...tagProps} 
                      sx={{ borderRadius: '6px', m: '2px' }}
                    />
                  )
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Tags"
                  placeholder="Type tag and press Enter..."
                  helperText="Press Enter to add chip tags"
                />
              )}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_network}
                  onChange={(e) => setFormData({ ...formData, is_network: e.target.checked })}
                />
              }
              label="Is parent network (contains subsidiary studios)"
            />

            <Autocomplete
              options={studios.filter(s => s.is_network && String(s.id) !== String(editingId))}
              getOptionLabel={(option) => typeof option === 'string' ? option : (option?.name || '')}
              isOptionEqualToValue={(option, val) => String(option.id) === String(val?.id || val)}
              value={studios.find(s => String(s.id) === String(formData.parent_id)) || null}
              onChange={(event, newValue) => {
                setFormData({ ...formData, parent_id: newValue ? newValue.id : '' })
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Parent Network (Searchable)"
                  placeholder="Search and select parent network..."
                  fullWidth
                />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting || !formData.name}>
              {submitting ? <CircularProgress size={24} /> : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Studio Canvas Logo Crop & Pad Editor Modal */}
      <Dialog open={openLogoCanvas} onClose={() => setOpenLogoCanvas(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Adjust Studio Logo</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Drag to position your logo and adjust scale/padding so it displays cleanly on the card header.
          </Typography>
          <Box sx={{ position: 'relative', width: 300, height: 120, bgcolor: '#0f172a', borderRadius: 2, overflow: 'hidden', border: '1px dashed rgba(255,255,255,0.2)' }}>
            <canvas 
              id="studio-logo-canvas" 
              width={300} 
              height={120} 
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              style={{ cursor: isDragging ? 'grabbing' : 'grab', display: 'block' }}
            />
          </Box>
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Zoom / Scale ({logoScale}%)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: '0.8rem' }}>➖</span>
                <input 
                  type="range" 
                  min="10" 
                  max="200" 
                  value={logoScale} 
                  onChange={(e) => setLogoScale(Number(e.target.value))} 
                  style={{ flexGrow: 1 }}
                />
                <span style={{ fontSize: '0.8rem' }}>➕</span>
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Card Padding ({logoPadding}%)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: '0.8rem' }}>🔲</span>
                <input 
                  type="range" 
                  min="0" 
                  max="80" 
                  value={logoPadding} 
                  onChange={(e) => setLogoPadding(Number(e.target.value))} 
                  style={{ flexGrow: 1 }}
                />
                <span style={{ fontSize: '0.8rem' }}>🔳</span>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setLogoScale(100)
            setLogoPadding(15)
            setLogoOffset({ x: 0, y: 0 })
          }} color="warning">Reset</Button>
          <Button onClick={() => setOpenLogoCanvas(false)}>Cancel</Button>
          <Button onClick={handleApplyLogoEdit} variant="contained" color="primary">Apply to Logo</Button>
        </DialogActions>
      </Dialog>

      <UrlParseConfirmationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        parsedData={parsedMetadata}
        currentData={{
          title: formData.name || '',
          studio: '',
          performers: [],
          tags: Array.isArray(formData.tags) ? formData.tags : (typeof formData.tags === 'string' ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
          description: formData.details || ''
        }}
        onApply={handleApplyParsedMetadata}
        permission={urlParsingPermission}
      />
    </Box>
  )
}
