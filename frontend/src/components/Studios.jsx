import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, Grid, Card, CardContent, Button, TextField, Dialog, 
  DialogTitle, DialogContent, DialogActions, FormControlLabel, Switch, 
  FormControl, InputLabel, Select, MenuItem, Chip, CircularProgress, 
  Alert, IconButton, CardMedia, Tooltip, Paper, Autocomplete
} from '@mui/material'
import { Plus, Edit2, Trash2, Link, Building2, Heart } from 'lucide-react'
import { apiFetch } from '../api'
import UrlParseConfirmationModal from './UrlParseConfirmationModal'

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
      tags: '',
      is_network: false,
      parent_id: ''
    })
    setOpen(true)
  }

  const handleOpenEdit = (studio) => {
    setEditingId(studio.id)
    setFormData({
      name: studio.name,
      logo_url: studio.logo_url || '',
      url: studio.url || '',
      details: studio.details || '',
      tags: studio.tags ? studio.tags.join(', ') : '',
      is_network: studio.is_network || false,
      parent_id: studio.parent_id || ''
    })
    setOpen(true)
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
      if (appliedData.tags?.length > 0) updated.tags = appliedData.tags.join(', ')
      if (parseUrl) updated.url = parseUrl
      return updated
    })
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Parsed metadata successfully applied!', severity: 'info' } }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    // Format tags from comma-separated string to array
    const tagsArr = formData.tags
      ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

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
        <Grid container spacing={3} alignItems="stretch">
          {studios.map(studio => {
            const stringId = String(studio.id)
            const isFavorited = favStudios.includes(stringId)
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={studio.id} sx={{ display: 'flex' }}>
                <Card sx={{ 
                  height: '100%', 
                  width: '100%',
                  display: 'flex', 
                  flexDirection: 'column',
                  background: 'rgba(255, 255, 255, 0.02)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {studio.logo_url ? (
                    <CardMedia
                      component="img"
                      height="140"
                      image={studio.logo_url}
                      alt={studio.name}
                      sx={{ objectFit: 'contain', p: 2, backgroundColor: 'rgba(0,0,0,0.2)' }}
                    />
                  ) : (
                    <Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <Building2 size={60} style={{ opacity: 0.3 }} />
                    </Box>
                  )}

                  {/* Badges */}
                  <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 0.5 }}>
                    {studio.is_network && (
                      <Chip label="Network" size="small" color="secondary" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
                    )}
                    {studio.parent_name && (
                      <Chip label={`Sub of ${studio.parent_name}`} size="small" variant="outlined" sx={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'text.secondary', fontSize: '0.65rem' }} />
                    )}
                  </Box>

                  {/* Favorite Button top right */}
                  <IconButton 
                    sx={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.4)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.6)' } }}
                    onClick={() => handleToggleFavorite(studio.id, studio.name)}
                    color={isFavorited ? "error" : "default"}
                  >
                  {isFavorited ? <Heart size={24} fill="currentColor" /> : <Heart size={24} />}
                  </IconButton>

                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h5" sx={{ fontWeight: '700', mb: 1 }}>{studio.name}</Typography>
                    
                    {studio.url && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <Link size={16} color="var(--accent, #6366f1)" />
                        <Typography 
                          variant="caption" 
                          component="a" 
                          href={studio.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          sx={{ textDecoration: 'none', color: 'primary.main', fontWeight: '500', wordBreak: 'break-all' }}
                        >
                          {studio.url}
                        </Typography>
                      </Box>
                    )}

                    <Typography variant="body2" color="textSecondary" sx={{ flexGrow: 1, mb: 2, minHeight: 40, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                      {studio.details || 'No details provided.'}
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                      {studio.tags?.map(t => <Chip key={t} label={t} size="small" variant="outlined" />)}
                    </Box>

                    {isAdmin && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, borderTop: '1px solid rgba(255, 255, 255, 0.05)', pt: 1.5 }}>
                        <IconButton size="small" color="primary" onClick={() => handleOpenEdit(studio)}>
                        <Edit2 size={18} />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(studio.id)}>
                        <Trash2 size={18} />
                        </IconButton>
                      </Box>
                    )}
                  </CardContent>
                </Card>
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
            <TextField
              fullWidth
              size="small"
              label="Logo URL"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              helperText="URL to image or local hosted assets"
            />
            <TextField
              fullWidth
              size="small"
              label="Web Address"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              size="small"
              label="Details / Description"
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
            />
            <TextField
              fullWidth
              size="small"
              label="Tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              helperText="Comma-separated strings"
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
              options={studios.filter(s => s.is_network && s.id !== editingId)}
              getOptionLabel={(option) => option.name || ''}
              value={studios.find(s => s.id === formData.parent_id) || null}
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

      <UrlParseConfirmationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        parsedData={parsedMetadata}
        currentData={{
          title: formData.name || '',
          studio: '',
          performers: [],
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
          description: formData.details || ''
        }}
        onApply={handleApplyParsedMetadata}
        permission={urlParsingPermission}
      />
    </Box>
  )
}
