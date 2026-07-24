import React from 'react'
import { Card, CardContent, Box, Typography } from '@mui/material'

export default function MediaEntityCard({
  mediaHeader,
  topBadges,
  topActions,
  title,
  subtitle,
  description,
  bodySections,
  footerActions,
  sx = {}
}) {
  return (
    <Card sx={{ 
      height: '100%', 
      width: '100%',
      minWidth: 0,
      display: 'flex', 
      flexDirection: 'column',
      background: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.3)'
      },
      ...sx
    }}>
      {/* Top Media Header Box (Height 120px, Dark Glassmorphism) */}
      <Box sx={{ 
        position: 'relative', 
        height: 120, 
        width: '100%', 
        background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.15) 0%, rgba(15, 23, 42, 0.75) 75%)', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        p: 1.5,
        overflow: 'hidden'
      }}>
        {mediaHeader}

        {/* Top Badges (Top-Left) */}
        {topBadges && (
          <Box sx={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexWrap: 'wrap', gap: 0.5, zIndex: 2, maxWidth: 'calc(100% - 54px)' }}>
            {topBadges}
          </Box>
        )}

        {/* Top Action Buttons (Top-Right) */}
        {topActions && (
          <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 2, display: 'flex', gap: 0.5 }}>
            {topActions}
          </Box>
        )}
      </Box>

      {/* Card Main Body Content */}
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2.5, minWidth: 0 }}>
        {title && (
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5, lineHeight: 1.3, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {title}
          </Typography>
        )}

        {subtitle}

        {description && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              flexGrow: 1, 
              mb: 2, 
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              lineHeight: 1.5
            }}
          >
            {description}
          </Typography>
        )}

        {bodySections}

        {footerActions && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)', pt: 1.5, mt: 'auto' }}>
            {footerActions}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
