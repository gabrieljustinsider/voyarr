import React, { useState } from 'react'
import { Box, Typography, IconButton, Paper } from '@mui/material'
import { X, Play, Pause, Maximize2, Volume2, VolumeX } from 'lucide-react'

export default function FloatingMiniPlayer({ mediaUrl, mediaTitle, onClose, onExpand }) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)

  if (!mediaUrl) return null

  return (
    <Paper
      elevation={12}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 320,
        zIndex: 1400,
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: '#0a0b10',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 16px 36px rgba(0,0,0,0.6)'
      }}
    >
      <Box sx={{ position: 'relative', width: '100%', height: 180, bgcolor: 'black' }}>
        <video
          src={mediaUrl}
          autoPlay
          controls={false}
          muted={isMuted}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 8, 
            right: 8, 
            display: 'flex', 
            gap: 0.5, 
            bgcolor: 'rgba(0,0,0,0.6)', 
            borderRadius: 2, 
            backdropFilter: 'blur(4px)' 
          }}
        >
          {onExpand && (
            <IconButton size="small" onClick={onExpand} sx={{ color: 'white' }}>
              <Maximize2 size={16} />
            </IconButton>
          )}
          <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
            <X size={16} />
          </IconButton>
        </Box>
      </Box>
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
          {mediaTitle || 'Playing Video'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => setIsMuted(!isMuted)} sx={{ color: 'white' }}>
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </IconButton>
        </Box>
      </Box>
    </Paper>
  )
}
