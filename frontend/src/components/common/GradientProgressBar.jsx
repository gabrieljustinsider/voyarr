import React from 'react'
import { Box, Typography, LinearProgress } from '@mui/material'

export default function GradientProgressBar({ 
  value, 
  label, 
  sublabel, 
  isUnlimited = false, 
  height = 10,
  variant = 'primary'
}) {
  const percentage = isUnlimited ? 100 : Math.min(Math.max(value, 0), 100)

  const getGradient = () => {
    if (percentage >= 90) return 'linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)'
    if (percentage >= 75) return 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
    return 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)'
  }

  return (
    <Box sx={{ width: '100%' }}>
      {(label || sublabel) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
          {label && (
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {label}
            </Typography>
          )}
          {sublabel && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {sublabel}
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ position: 'relative', borderRadius: height, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.06)' }}>
        <LinearProgress 
          variant="determinate" 
          value={percentage} 
          sx={{ 
            height, 
            borderRadius: height,
            bgcolor: 'transparent',
            '& .MuiLinearProgress-bar': {
              borderRadius: height,
              background: getGradient(),
              transition: 'transform 0.4s ease'
            }
          }}
        />
      </Box>
    </Box>
  )
}
