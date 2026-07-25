import { useState, useEffect } from 'react'
import {
  Box, Typography, TextField, Grid, Chip, Pagination, CircularProgress, Alert, InputAdornment, IconButton
} from '@mui/material'
import { Search, X } from 'lucide-react'
import { apiFetch } from '../../api'
import GlassCard from './GlassCard'

export default function EntityListPage({
  title,
  icon: Icon,
  fetchUrl,
  filterField,
  overviewDescription,
  emptyMessage = 'No items found in your library.',
  onNavigate,
}) {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [fetchUrl, search, page])

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" sx={{ fontWeight: '800', letterSpacing: '-0.5px', mb: 3 }}>
        {title}
      </Typography>

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
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
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
                <GlassCard
                  hoverEffect
                  onClick={() => onNavigate && onNavigate(item.name)}
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap sx={{ fontWeight: '700', fontSize: '0.9rem' }}>
                      {item.name}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${item.count} ${item.count === 1 ? 'entry' : 'entries'}`}
                    size="small"
                    sx={{ ml: 1, flexShrink: 0, borderRadius: '6px', fontWeight: 'bold', fontSize: '0.65rem', bgcolor: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }}
                  />
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
    </Box>
  )
}
