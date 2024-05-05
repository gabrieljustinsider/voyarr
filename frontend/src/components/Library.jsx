import { useState, useEffect } from 'react'
import { 
  Box, Typography, Card, CardContent, Grid, TextField, 
  Chip, FormControl, InputLabel, Select, MenuItem, Paper, CardMedia,
  Dialog, DialogTitle, DialogContent, IconButton
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'

export default function Library() {
  const [entries, setEntries] = useState([])
  const [filters, setFilters] = useState({
    resolution: '',
    performer: '',
    tag: ''
  })
  const [playingVideo, setPlayingVideo] = useState(null)

  const fetchLibrary = async () => {
    try {
      // Construct query parameters from active filters
      const params = new URLSearchParams()
      if (filters.resolution) params.append('resolution', filters.resolution)
      if (filters.performer) params.append('performer', filters.performer)
      if (filters.tag) params.append('tag', filters.tag)

      const res = await fetch(`http://localhost:8000/library?${params.toString()}`)
      if (res.ok) setEntries(await res.json())
    } catch (e) {
      console.error("Failed to fetch library entries:", e)
    }
  }

  useEffect(() => {
    fetchLibrary()
  }, [filters])

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  const handleClosePlayer = () => {
    setPlayingVideo(null)
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Media Library</Typography>
      
      {/* Filters Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
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
        </Grid>
      </Paper>

      {/* Media Grid */}
      {entries.length === 0 ? (
        <Typography color="textSecondary">No media found matching your criteria.</Typography>
      ) : (
        <Grid container spacing={3}>
          {entries.map(entry => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={entry.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                  <Typography variant="h6" noWrap title={entry.title}>{entry.title}</Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>{entry.resolution} • {entry.file_size ? (entry.file_size / (1024*1024)).toFixed(1) + ' MB' : 'Unknown Size'}</Typography>
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{entry.performers?.slice(0, 3).map(p => <Chip key={p} label={p} size="small" />)}</Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Video Player Modal */}
      <Dialog open={Boolean(playingVideo)} onClose={handleClosePlayer} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" noWrap sx={{ pr: 2 }}>{playingVideo?.title}</Typography>
          <IconButton onClick={handleClosePlayer} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, backgroundColor: 'black', display: 'flex', justifyContent: 'center' }}>
          {playingVideo && (
            <video 
              controls 
              autoPlay 
              style={{ width: '100%', maxHeight: '75vh', outline: 'none' }}
              src={`http://localhost:8000/library/${playingVideo.id}/stream`}
              controlsList="nodownload"
            >
              Your browser does not support the video tag.
            </video>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}