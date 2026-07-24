import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, Grid, Paper, Slider, IconButton, Button, Chip, 
  CircularProgress, Alert, Card, CardContent, CardMedia
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import FavoriteIcon from '@mui/icons-material/Favorite'
import BusinessIcon from '@mui/icons-material/Business'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import TvIcon from '@mui/icons-material/Tv'
import { apiFetch } from '../api'

export default function SecondScreenRemote({ video, castDevice, onStopCasting, onSeek, onPlayToggle, onVolumeChange, isPlaying, currentTime, duration, volume }) {
  const [climaxCount, setClimaxCount] = useState(0)
  const [playCount, setPlayCount] = useState(0)
  const [chapters, setChapters] = useState([])
  const [performerBio, setPerformerBio] = useState(null)
  const [selectedPerformer, setSelectedPerformer] = useState('')
  const [bioLoading, setBioLoading] = useState(false)
  const [oButtonLoading, setOButtonLoading] = useState(false)

  // Fetch local play statistics
  const fetchVideoStats = useCallback(async () => {
    if (!video) return
    try {
      const res = await apiFetch(`/user/stats/video/${video.id}`)
      if (res.ok) {
        const data = await res.json()
        setClimaxCount(data.climax_count || 0)
        setPlayCount(data.play_count || 0)
      }
    } catch (e) {
      console.error(e)
    }
  }, [video])

  // Fetch chapters for instant hopping
  const fetchChapters = useCallback(async () => {
    if (!video) return
    try {
      const res = await apiFetch(`/chapters/video/${video.id}`)
      if (res.ok) {
        setChapters(await res.json())
      }
    } catch (e) {
      console.error(e)
    }
  }, [video])

  useEffect(() => {
    fetchVideoStats()
    fetchChapters()
  }, [fetchVideoStats, fetchChapters])

  // Handle performer bio lookup
  const handlePerformerClick = async (name) => {
    setSelectedPerformer(name)
    setBioLoading(true)
    setPerformerBio(null)
    try {
      // Attempt to retrieve TpDB API key from settings to query performer bio
      const settingsRes = await apiFetch('/settings')
      if (settingsRes.ok) {
        const settings = await settingsRes.json()
        const apiKey = settings.tpdb_api_key
        if (apiKey) {
          const res = await apiFetch('/external-api/theporndb/performer', {
            method: 'POST',
            body: JSON.stringify({ name })
          })
          if (res.ok) {
            const data = await res.json()
            if (data.results && data.results.length > 0) {
              setPerformerBio(data.results[0].bio || 'No biography details found.')
              setBioLoading(false)
              return
            }
          }
        }
      }
      setPerformerBio('Performer biography details could not be resolved from external index. Connect ThePornDB API key in settings.')
    } catch (e) {
      console.error(e)
      setPerformerBio('Error loading performer biography.')
    } finally {
      setBioLoading(false)
    }
  }

  // Handle touch Climax Click (orgasm tally incrementer)
  const handleClimaxClick = async () => {
    if (oButtonLoading) return
    setOButtonLoading(true)
    try {
      const res = await apiFetch('/user/stats/climax', {
        method: 'POST',
        body: JSON.stringify({ library_entry_id: video.id })
      })
      if (res.ok) {
        const data = await res.json()
        setClimaxCount(data.climax_count)
        
        // Premium tactile feedback sound or custom micro-animation dispatch
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: '❤️ Climax successfully cataloged to history!', severity: 'success' } 
        }))

        // Trigger dynamic confetti or CSS pulse classes on window
        const btn = document.getElementById('climax-btn-pulse')
        if (btn) {
          btn.classList.add('exploded')
          setTimeout(() => btn.classList.remove('exploded'), 600)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setOButtonLoading(false)
    }
  }

  const formatSecs = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  return (
    <Box sx={{ 
      p: { xs: 2, md: 4 }, 
      background: 'radial-gradient(circle at top, rgba(229, 9, 20, 0.05) 0%, transparent 60%)',
      borderRadius: '24px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      color: 'white',
      minHeight: '80vh'
    }}>
      {/* Top Header */}
      <Paper sx={{ 
        p: 2, 
        mb: 4, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2,
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '16px'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TvIcon color="error" sx={{ fontSize: 32, animation: 'glow 2s infinite alternate' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: '800' }}>Active Cast Session</Typography>
            <Typography variant="caption" color="textSecondary">
              Casting to: <span style={{ color: '#00e676', fontWeight: 'bold' }}>{castDevice || 'Smart Screen Device'}</span>
            </Typography>
          </Box>
        </Box>
        <Button 
          variant="contained" 
          color="error" 
          startIcon={<StopScreenShareIcon />} 
          onClick={onStopCasting}
          sx={{ fontWeight: 'bold', borderRadius: '12px' }}
        >
          Disconnect Remote
        </Button>
      </Paper>

      <Grid container spacing={4}>
        {/* Playback Controls & Pleasure metrics */}
        <Grid xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          {/* Main Controls Card */}
          <Paper sx={{ p: 4, borderRadius: '20px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }} color="textSecondary">MEDIA CONTROLLER</Typography>
            
            {/* Scrubber slider */}
            <Box sx={{ mb: 4 }}>
              <Slider 
                value={currentTime || 0}
                max={duration || 100}
                onChange={(e, v) => onSeek(v)}
                sx={{
                  color: 'error.main',
                  height: 6,
                  '& .MuiSlider-thumb': {
                    width: 14,
                    height: 14,
                    transition: '0.2s',
                    '&:hover, &.Mui-focusVisible': {
                      boxShadow: '0px 0px 0px 8px rgba(229, 9, 20, 0.16)'
                    }
                  }
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body2" color="textSecondary">{formatSecs(currentTime)}</Typography>
                <Typography variant="body2" color="textSecondary">{formatSecs(duration)}</Typography>
              </Box>
            </Box>

            {/* Play/Pause Buttons & Vol */}
            <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', mb: 3 }}>
              <IconButton size="large" onClick={() => onSeek((currentTime || 0) - 10)}>
                <SkipPreviousIcon sx={{ fontSize: 36 }} />
              </IconButton>

              <IconButton 
                onClick={onPlayToggle} 
                sx={{ 
                  width: 72, 
                  height: 72, 
                  backgroundColor: 'error.main', 
                  color: 'white', 
                  '&:hover': { backgroundColor: 'error.dark' },
                  boxShadow: '0 0 20px rgba(229, 9, 20, 0.4)'
                }}
              >
                {isPlaying ? <PauseIcon sx={{ fontSize: 40 }} /> : <PlayArrowIcon sx={{ fontSize: 40 }} />}
              </IconButton>

              <IconButton size="large" onClick={() => onSeek((currentTime || 0) + 10)}>
                <SkipNextIcon sx={{ fontSize: 36 }} />
              </IconButton>
            </Box>

            {/* Volume Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2 }}>
              <IconButton onClick={() => onVolumeChange(volume > 0 ? 0 : 50)}>
                {volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
              </IconButton>
              <Slider 
                value={volume ?? 50} 
                onChange={(e, v) => onVolumeChange(v)} 
                size="small" 
                sx={{ color: 'text.secondary' }} 
              />
              <Typography variant="body2" sx={{ minWidth: 30 }} color="textSecondary">{volume ?? 50}%</Typography>
            </Box>
          </Paper>

          {/* Chapters Hopper */}
          <Paper sx={{ p: 3, borderRadius: '20px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }} color="textSecondary">SCENE CHAPTERS</Typography>
            {chapters.length === 0 ? (
              <Typography variant="body2" color="textSecondary">No chapters configured for this media.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {chapters.map((ch, idx) => (
                  <Chip 
                    key={ch.id} 
                    label={`${idx + 1}. ${ch.title} (${formatSecs(ch.start_time)})`} 
                    onClick={() => onSeek(ch.start_time)}
                    variant={currentTime >= ch.start_time && (idx === chapters.length - 1 || currentTime < chapters[idx+1].start_time) ? 'filled' : 'outlined'}
                    color={currentTime >= ch.start_time && (idx === chapters.length - 1 || currentTime < chapters[idx+1].start_time) ? 'error' : 'default'}
                    sx={{ cursor: 'pointer', borderRadius: '8px' }}
                  />
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Media Metadata & Giant Climax O-Meter */}
        <Grid xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          {/* O-Meter/Pleasure Tracker */}
          <Paper sx={{ 
            p: 4, 
            borderRadius: '24px', 
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.1) 0%, rgba(0, 0, 0, 0.4) 100%)',
            border: '1px solid rgba(229, 9, 20, 0.2)',
            boxShadow: '0 8px 32px 0 rgba(229, 9, 20, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}>
            <Typography variant="subtitle1" sx={{ fontWeight: '800', letterSpacing: '2px', color: '#ff3333' }}>
              O-METER PLEASURE TRACKER
            </Typography>

            {/* Giant Touch Button */}
            <Box 
              id="climax-btn-pulse" 
              onClick={handleClimaxClick}
              sx={{
                width: 140,
                height: 140,
                borderRadius: '50%',
                backgroundColor: '#e50914',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 0 30px rgba(229, 9, 20, 0.6), inset 0 0 15px rgba(255,255,255,0.4)',
                userSelect: 'none',
                transition: 'transform 0.1s, box-shadow 0.2s',
                '&:active': { transform: 'scale(0.95)' },
                '&.exploded': { animation: 'boom 0.6s ease-out' }
              }}
            >
              <FavoriteIcon sx={{ fontSize: 60, color: 'white' }} />
            </Box>

            <Box>
              <Typography variant="h3" sx={{ fontWeight: '900', color: 'white' }}>{climaxCount}</Typography>
              <Typography variant="caption" color="textSecondary" display="block">TOTAL CLIMAX TALLIES</Typography>
            </Box>

            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-around', borderTop: '1px solid rgba(255,255,255,0.05)', pt: 2 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{playCount}</Typography>
                <Typography variant="caption" color="textSecondary">WATCH HITS</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{video?.resolution}</Typography>
                <Typography variant="caption" color="textSecondary">QUALITY</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Cast Details & Performer Lookups */}
          <Card sx={{ 
            borderRadius: '20px', 
            background: 'rgba(255, 255, 255, 0.01)', 
            border: '1px solid rgba(255,255,255,0.03)',
            overflow: 'hidden'
          }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }} color="textSecondary">CAST DETAILS</Typography>
              <Typography variant="h5" sx={{ fontWeight: '800', mb: 1 }}>{video?.title}</Typography>
              
              <Box sx={{ mt: 2.5 }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>Performers Profiles (Click for Bio)</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {video?.performers && video.performers.length > 0 ? (
                    video.performers.map(p => (
                      <Chip 
                        key={p} 
                        label={p} 
                        size="small" 
                        onClick={() => handlePerformerClick(p)} 
                        color={selectedPerformer === p ? "error" : "default"}
                        sx={{ cursor: 'pointer' }}
                      />
                    ))
                  ) : <Typography variant="caption" color="textSecondary">No performers listed.</Typography>}
                </Box>
              </Box>

              {/* Bio block */}
              {selectedPerformer && (
                <Paper sx={{ p: 2, mt: 2, backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'error.main', mb: 1 }}>
                    {selectedPerformer} Trait bio:
                  </Typography>
                  {bioLoading ? (
                    <Box sx={{ py: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                      <CircularProgress size={16} />
                      <Typography variant="caption" color="textSecondary">Fetching index...</Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ maxHeight: 120, overflowY: 'auto', fontSize: '0.8rem', lineHeight: 1.4 }}>
                      {performerBio}
                    </Typography>
                  )}
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dynamic Keyframes for glowing and climax boom animations */}
      <style>{`
        @keyframes glow {
          from { filter: drop-shadow(0 0 2px rgba(229,9,20,0.3)); }
          to { filter: drop-shadow(0 0 12px rgba(229,9,20,0.8)); }
        }
        @keyframes boom {
          0% { transform: scale(1); box-shadow: 0 0 30px rgba(229, 9, 20, 0.6); }
          50% { transform: scale(1.15); box-shadow: 0 0 60px rgba(229, 9, 20, 1), 0 0 120px rgba(229,9,20,0.6); }
          100% { transform: scale(1); box-shadow: 0 0 30px rgba(229, 9, 20, 0.6); }
        }
      `}</style>
    </Box>
  )
}
