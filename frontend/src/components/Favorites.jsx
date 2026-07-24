import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, Grid, Card, CardContent, Chip, IconButton, Tabs, Tab, 
  CircularProgress, Alert, Paper, Button
} from '@mui/material'
import FavoriteIcon from '@mui/icons-material/Favorite'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined'
import { apiFetch } from '../api'

export default function Favorites() {
  const [favs, setFavs] = useState({
    scene: [],
    video: [],
    performer: [],
    movie: [],
    category: [],
    tag: [],
    studio: [],
    provider: [],
    biller: []
  })
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Entity maps for resolving names
  const [studiosMap, setStudiosMap] = useState({})
  const [providersMap, setProvidersMap] = useState({})
  const [billersMap, setBillersMap] = useState({})
  const [scenesMap, setScenesMap] = useState({})

  const fetchFavorites = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/favorites')
      if (res.ok) {
        const data = await res.json()
        setFavs({
          scene: data.scene || [],
          video: data.video || [],
          performer: data.performer || [],
          movie: data.movie || [],
          category: data.category || [],
          tag: data.tag || [],
          studio: data.studio || [],
          provider: data.provider || [],
          biller: data.biller || []
        })
      } else {
        setError('Failed to fetch favorites from server.')
      }

      // Fetch entity details to map IDs back to human readable titles/names
      const [studiosRes, providersRes, billersRes, libraryRes] = await Promise.all([
        apiFetch('/studios?limit=1000').catch(() => null),
        apiFetch('/providers').catch(() => null),
        apiFetch('/billers').catch(() => null),
        apiFetch('/library?limit=500').catch(() => null)
      ])

      if (studiosRes && studiosRes.ok) {
        const studios = await studiosRes.json()
        const map = {}
        studios.forEach(s => { map[String(s.id)] = s.name })
        setStudiosMap(map)
      }
      if (providersRes && providersRes.ok) {
        const providers = await providersRes.json()
        const map = {}
        providers.forEach(p => { map[String(p.id)] = p.name })
        setProvidersMap(map)
      }
      if (billersRes && billersRes.ok) {
        const billers = await billersRes.json()
        const map = {}
        billers.forEach(b => { map[String(b.id)] = b.name })
        setBillersMap(map)
      }
      if (libraryRes && libraryRes.ok) {
        const libData = await libraryRes.json()
        const items = libData.items || (Array.isArray(libData) ? libData : [])
        const map = {}
        items.forEach(item => { map[String(item.id)] = item.title || item.name })
        setScenesMap(map)
      }
    } catch (e) {
      console.error(e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  const handleRemove = async (type, id) => {
    try {
      const res = await apiFetch('/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ item_type: type, item_id: String(id) })
      })
      if (res.ok) {
        // Refresh local state
        setFavs(prev => ({
          ...prev,
          [type]: prev[type].filter(item => item !== id)
        }))
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Removed from favorites', severity: 'success' } 
        }))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const tabTypes = ['scene', 'video', 'performer', 'movie', 'category', 'tag', 'studio', 'provider', 'biller']
  const currentType = tabTypes[activeTab]
  const currentItems = favs[currentType] || []

  return (
    <Box sx={{ p: 1, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: '800', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', sm: 'flex-start' }, gap: 1.5, textAlign: { xs: 'center', sm: 'left' } }}>
          <FavoriteIcon color="error" sx={{ fontSize: 36, filter: 'drop-shadow(0 0 8px rgba(229, 9, 20, 0.4))' }} />
          Favorites Hub
        </Typography>
        <Button variant="outlined" onClick={fetchFavorites} size="small" sx={{ width: { xs: '100%', sm: 'auto' } }}>
          Refresh
        </Button>
      </Box>

      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        icon={<FavoriteIcon fontSize="small" color="error" />} 
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
          ❤️ Bookmarked Favorites &amp; Preferred Content
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          The Favorites Hub organizes all your starred media scenes, videos, performers, categories, tags, production studios, download providers, and payment billers in one dedicated bookmark collection for instant access.
        </Typography>
      </Alert>

      <Paper sx={{ 
        p: 0.5, 
        mb: 3, 
        background: 'rgba(255, 255, 255, 0.03)', 
        backdropFilter: 'blur(10px)', 
        border: '1px solid rgba(255, 255, 255, 0.05)', 
        borderRadius: '12px'
      }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          variant="scrollable" 
          scrollButtons="auto"
          sx={{
            '& .MuiTabs-indicator': {
              height: '3px',
              borderRadius: '3px'
            }
          }}
        >
          <Tab label={`Scenes (${favs.scene.length})`} />
          <Tab label={`Videos (${favs.video.length})`} />
          <Tab label={`Performers (${favs.performer.length})`} />
          <Tab label={`Movies (${favs.movie.length})`} />
          <Tab label={`Categories (${favs.category.length})`} />
          <Tab label={`Tags (${favs.tag.length})`} />
          <Tab label={`Studios (${favs.studio.length})`} />
          <Tab label={`Media Providers (${favs.provider.length})`} />
          <Tab label={`Payment Billers (${favs.biller.length})`} />
        </Tabs>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      ) : currentItems.length === 0 ? (
        <Paper sx={{ 
          p: 6, 
          textAlign: 'center', 
          background: 'rgba(255, 255, 255, 0.01)', 
          border: '1px dashed rgba(255, 255, 255, 0.1)', 
          borderRadius: '16px' 
        }}>
          <Typography color="textSecondary" variant="body1">
            No favorited {currentType}s yet. Go to your Library, Studios, or Media Providers Hub to add some!
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
          {currentItems.map(item => {
            let displayName = item;
            if (currentType === 'studio') {
              displayName = studiosMap[item] || `Studio ID: ${item}`;
            } else if (currentType === 'provider') {
              displayName = providersMap[item] || `Provider ID: ${item}`;
            } else if (currentType === 'biller') {
              displayName = billersMap[item] || `Biller ID: ${item}`;
            } else if (currentType === 'scene' || currentType === 'video') {
              displayName = scenesMap[item] || item;
            }

            return (
              <Grid xs={12} sm={6} md={4} lg={3} key={item} sx={{ display: 'flex' }}>
                <Card sx={{ 
                  height: '100%', 
                  width: '100%',
                  display: 'flex', 
                  flexDirection: 'column',
                  position: 'relative',
                  background: 'rgba(255, 255, 255, 0.02)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    borderColor: 'rgba(255,255,255,0.1)'
                  }
                }}>
                  <CardContent sx={{ flexGrow: 1, pt: 3, pb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: '600', mb: 1, pr: 4 }} noWrap title={displayName}>
                      {displayName}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 2 }}>
                      ID: {item}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip 
                        label={currentType.toUpperCase()} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                        sx={{ fontSize: '0.65rem', fontWeight: 'bold' }} 
                      />
                      <Box>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => handleRemove(currentType, item)}
                          title="Remove Favorite"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}
    </Box>
  )
}
