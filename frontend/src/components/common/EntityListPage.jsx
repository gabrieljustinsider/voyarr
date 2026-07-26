import { useState, useEffect } from 'react'
import {
  Box, Typography, TextField, Grid, Chip, Pagination, CircularProgress, Alert,
  InputAdornment, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import { Search, X, Plus, Edit2, Trash2, Merge } from 'lucide-react'
import { apiFetch } from '../../api'
import GlassCard from './GlassCard'

export default function EntityListPage({
  title,
  icon: Icon,
  fetchUrl,
  createUrl,
  overviewDescription,
  emptyMessage = 'No items found.',
  onNavigate,
  onCreate,
  onRename,
  onDelete,
  onMerge,
}) {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)

  // CRUD dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSource, setMergeSource] = useState(null)
  const [mergeTarget, setMergeTarget] = useState('')

  const fetchItems = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), per_page: '20' })
    if (search) params.append('q', search)
    apiFetch(`${fetchUrl}?${params}`)
      .then(res => res.json())
      .then(data => {
        setItems(data.items || [])
        setTotalPages(data.total_pages || 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchItems() }, [fetchUrl, search, page])

  const handleCreate = async () => {
    if (!createName.trim()) return
    try {
      await apiFetch(createUrl || fetchUrl, { method: 'POST', body: { name: createName.trim() } })
      setCreateOpen(false)
      setCreateName('')
      setPage(1)
      fetchItems()
    } catch (e) { /* toast would go here */ }
  }

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return
    try {
      await apiFetch(`${fetchUrl}/rename`, {
        method: 'PUT', body: { old_name: renameTarget.name, new_name: renameValue.trim() }
      })
      setRenameOpen(false)
      setRenameTarget(null)
      setRenameValue('')
      fetchItems()
    } catch (e) {}
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiFetch(`${fetchUrl}/${encodeURIComponent(deleteTarget.name)}`, { method: 'DELETE' })
      setDeleteOpen(false)
      setDeleteTarget(null)
      fetchItems()
    } catch (e) {}
  }

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget.trim()) return
    try {
      await apiFetch(`${fetchUrl}/merge`, {
        method: 'POST', body: { source: mergeSource.name, target: mergeTarget.trim() }
      })
      setMergeOpen(false)
      setMergeSource(null)
      setMergeTarget('')
      fetchItems()
    } catch (e) {}
  }

  const hasCrud = onCreate || onRename || onDelete || onMerge

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: '800', letterSpacing: '-0.5px' }}>
          {title}
        </Typography>
        {onCreate && (
          <Button variant="contained" size="small" startIcon={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold', whiteSpace: 'nowrap', height: 36 }}>
            Add {title.slice(0, -1)}
          </Button>
        )}
      </Box>

      <Alert severity="info" sx={{ mb: 3, borderRadius: '12px', bgcolor: 'rgba(99,102,241,0.08)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)', '& .MuiAlert-icon': { color: '#818cf8' } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
          {Icon && <Icon size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />}{title}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          {overviewDescription}
        </Typography>
      </Alert>

      <GlassCard sx={{ mb: 3 }}>
        <TextField
          fullWidth size="small"
          placeholder={`Search ${title.toLowerCase()}...`}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search size={18} style={{ opacity: 0.5 }} /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}><X size={14} /></IconButton>
              </InputAdornment>
            ) : null
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
      </GlassCard>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <GlassCard sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700, mb: 1 }}>
            {emptyMessage}
          </Typography>
        </GlassCard>
      ) : (
        <>
          <Grid container spacing={2}>
            {items.map(item => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.name}>
                <GlassCard hoverEffect sx={{ cursor: onNavigate ? 'pointer' : 'default', p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
                    <Box
                      sx={{ minWidth: 0, flex: 1, onClick: onNavigate ? () => onNavigate(item.name) : undefined }}
                    >
                      <Typography variant="subtitle2" noWrap sx={{ fontWeight: '700', fontSize: '0.9rem' }}>
                        {item.name}
                      </Typography>
                    </Box>
                    <Chip label={`${item.count}`} size="small"
                      sx={{ ml: 1, flexShrink: 0, borderRadius: '6px', fontWeight: 'bold', fontSize: '0.65rem', bgcolor: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }} />
                  </Box>
                  {hasCrud && (
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {onRename && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setRenameTarget(item); setRenameValue(item.name); setRenameOpen(true) }}
                          sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#818cf8' } }}>
                          <Edit2 size={14} />
                        </IconButton>
                      )}
                      {onMerge && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMergeSource(item); setMergeTarget(''); setMergeOpen(true) }}
                          sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#a78bfa' } }}>
                          <Merge size={14} />
                        </IconButton>
                      )}
                      {onDelete && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); setDeleteOpen(true) }}
                          sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ef4444' } }}>
                          <Trash2 size={14} />
                        </IconButton>
                      )}
                    </Box>
                  )}
                </GlassCard>
              </Grid>
            ))}
          </Grid>
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination count={totalPages} page={page} onChange={(e, v) => setPage(v)} color="primary" />
            </Box>
          )}
        </>
      )}

      {/* Create Dialog */}
      {onCreate && (
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: '12px', bgcolor: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' } }}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>Create {title.slice(0, -1)}</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth size="small" label="Name" value={createName}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)} sx={{ borderRadius: '8px', textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" onClick={handleCreate} disabled={!createName.trim()}
              sx={{ borderRadius: '8px', textTransform: 'none' }}>Create</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Rename Dialog */}
      {onRename && (
        <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: '12px', bgcolor: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' } }}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>Rename</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth size="small" label="New name" value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRenameOpen(false)} sx={{ borderRadius: '8px', textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" onClick={handleRename} disabled={!renameValue.trim()}
              sx={{ borderRadius: '8px', textTransform: 'none' }}>Save</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Dialog */}
      {onDelete && (
        <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: '12px', bgcolor: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' } }}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>Delete {title.slice(0, -1)}</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Delete "<strong>{deleteTarget?.name}</strong>"? It will be removed from all library entries.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteOpen(false)} sx={{ borderRadius: '8px', textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDelete}
              sx={{ borderRadius: '8px', textTransform: 'none' }}>Delete</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Merge Dialog */}
      {onMerge && (
        <Dialog open={mergeOpen} onClose={() => setMergeOpen(false)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: '12px', bgcolor: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' } }}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>Merge {title.slice(0, -1)}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Merge "<strong>{mergeSource?.name}</strong>" into:
            </Typography>
            <TextField autoFocus fullWidth size="small" label="Target name" value={mergeTarget}
              onChange={e => setMergeTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleMerge()}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMergeOpen(false)} sx={{ borderRadius: '8px', textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" onClick={handleMerge} disabled={!mergeTarget.trim()}
              sx={{ borderRadius: '8px', textTransform: 'none' }}>Merge</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}
