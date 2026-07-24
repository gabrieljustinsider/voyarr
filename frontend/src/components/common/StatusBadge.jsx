import React from 'react'
import { Box, Chip } from '@mui/material'

const STATUS_MAP = {
  completed: { label: 'Completed', color: 'success', glow: '#10b981' },
  downloading: { label: 'Downloading', color: 'primary', glow: '#6366f1' },
  running: { label: 'Running', color: 'info', glow: '#3b82f6' },
  queued: { label: 'Queued', color: 'warning', glow: '#f59e0b' },
  failed: { label: 'Failed', color: 'error', glow: '#f43f5e' },
  active: { label: 'Active', color: 'success', glow: '#10b981' },
  idle: { label: 'Idle', color: 'default', glow: '#6b7280' }
}

export default function StatusBadge({ status, label: customLabel, pulse = true }) {
  const normalized = (status || '').toLowerCase()
  const config = STATUS_MAP[normalized] || { label: customLabel || status, color: 'default', glow: '#9ca3af' }

  return (
    <Chip
      size="small"
      color={config.color}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          {pulse && (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: config.glow,
                boxShadow: `0 0 8px ${config.glow}`,
                ...(normalized === 'downloading' || normalized === 'running' ? {
                  animation: 'pulse 1.5s infinite ease-in-out',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(0.8)', opacity: 0.6 },
                    '50%': { transform: 'scale(1.3)', opacity: 1 },
                    '100%': { transform: 'scale(0.8)', opacity: 0.6 }
                  }
                } : {})
              }}
            />
          )}
          <span>{customLabel || config.label}</span>
        </Box>
      }
      sx={{
        height: 24,
        fontSize: '0.72rem',
        fontWeight: 700,
        borderRadius: '8px',
        backdropFilter: 'blur(8px)',
        boxShadow: `0 2px 8px ${config.glow}30`
      }}
    />
  )
}
