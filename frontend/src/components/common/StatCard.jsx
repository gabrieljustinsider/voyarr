import React from 'react'
import { Box, Typography } from '@mui/material'
import GlassCard from './GlassCard'

const COLOR_MAP = {
  primary: {
    gradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    text: '#818cf8',
    glow: 'rgba(99, 102, 241, 0.25)'
  },
  success: {
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    text: '#34d399',
    glow: 'rgba(16, 185, 129, 0.25)'
  },
  warning: {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    text: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.25)'
  },
  error: {
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    text: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.25)'
  },
  secondary: {
    gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
    text: '#f472b6',
    glow: 'rgba(236, 72, 153, 0.25)'
  }
}

export default function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = 'primary',
  subtitle,
  animate = true 
}) {
  const themeColors = COLOR_MAP[variant] || COLOR_MAP.primary

  return (
    <GlassCard animate={animate} hoverEffect sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography 
          variant="subtitle2" 
          sx={{ 
            color: 'text.secondary', 
            fontWeight: 700, 
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            fontSize: '0.75rem' 
          }}
        >
          {title}
        </Typography>

        {Icon && (
          <Box 
            sx={{ 
              p: 1, 
              borderRadius: '12px', 
              background: themeColors.gradient,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 14px ${themeColors.glow}`
            }}
          >
            <Icon size={20} />
          </Box>
        )}
      </Box>

      <Typography 
        variant="h3" 
        sx={{ 
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 900, 
          letterSpacing: '-1px',
          color: themeColors.text,
          lineHeight: 1.1
        }}
      >
        {value}
      </Typography>

      {subtitle && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block', fontSize: '0.75rem' }}>
          {subtitle}
        </Typography>
      )}
    </GlassCard>
  )
}
