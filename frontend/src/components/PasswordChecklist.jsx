import React from 'react'
import { Box, Typography, Grid } from '@mui/material'

export default function PasswordChecklist({ password = '' }) {
  // Define criteria evaluation
  const criteria = [
    { label: 'At least 8 characters', test: (val) => val.length >= 8 },
    { label: 'At least one uppercase letter (A-Z)', test: (val) => /[A-Z]/.test(val) },
    { label: 'At least one lowercase letter (a-z)', test: (val) => /[a-z]/.test(val) },
    { label: 'At least one number (0-9)', test: (val) => /[0-9]/.test(val) },
    { label: 'At least one special character (e.g. !@#$%^&*)', test: (val) => /[^A-Za-z0-9]/.test(val) }
  ]

  // Calculate stats
  const results = criteria.map(c => c.test(password))
  const metCount = results.filter(Boolean).length
  
  // Calculate strength classification
  let strengthLabel = 'Very Weak'
  let strengthColor = '#ef4444' // Red
  
  if (metCount === 5) {
    strengthLabel = 'Strong & Secure'
    strengthColor = '#10b981' // Green
  } else if (metCount >= 3) {
    strengthLabel = 'Medium'
    strengthColor = '#f59e0b' // Amber
  } else if (metCount > 0) {
    strengthLabel = 'Weak'
    strengthColor = '#f87171' // Light Red
  }

  // Segmented bar rendering
  const renderBars = () => {
    return (
      <Box sx={{ display: 'flex', gap: '4px', my: 1.5, width: '100%' }}>
        {[1, 2, 3, 4, 5].map((index) => {
          const isActive = index <= metCount
          let barBg = 'rgba(255, 255, 255, 0.08)'
          if (isActive) {
            barBg = strengthColor
          }
          return (
            <Box
              key={index}
              sx={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                backgroundColor: barBg,
                transition: 'background-color 0.3s ease, transform 0.2s ease',
                transform: isActive ? 'scaleY(1.1)' : 'scaleY(1)',
              }}
            />
          )
        })}
      </Box>
    )
  }

  return (
    <Box
      sx={{
        mt: 1.5,
        mb: 1.5,
        p: 2,
        borderRadius: '12px',
        backgroundColor: 'rgba(30, 41, 59, 0.4)', // sleek slate/dark glass background
        border: '1px solid rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Strength Label */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'rgba(255,255,255,0.6)', 
            fontWeight: 500, 
            fontFamily: "'Outfit', sans-serif" 
          }}
        >
          Password Strength
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: strengthColor, 
            fontWeight: 700, 
            fontFamily: "'Outfit', sans-serif",
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'color 0.3s ease'
          }}
        >
          {strengthLabel}
        </Typography>
      </Box>

      {/* Segmented Progress Bars */}
      {renderBars()}

      {/* Checklist Grid */}
      <Grid container spacing={1} sx={{ mt: 1 }}>
        {criteria.map((item, index) => {
          const isMet = results[index]
          return (
            <Grid item xs={12} key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Custom Animated SVG Icon */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: isMet ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isMet ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                  transition: 'all 0.3s ease',
                  flexShrink: 0
                }}
              >
                {isMet ? (
                  // Elegant Checkmark SVG
                  <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ width: '11px', height: '11px' }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  // Sleek unfilled dot
                  <Box 
                    sx={{ 
                      width: 4, 
                      height: 4, 
                      borderRadius: '50%', 
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      transition: 'all 0.3s ease'
                    }} 
                  />
                )}
              </Box>

              {/* Requirement Text */}
              <Typography
                variant="caption"
                sx={{
                  color: isMet ? '#10b981' : 'rgba(255, 255, 255, 0.45)',
                  textDecoration: isMet ? 'none' : 'none',
                  fontWeight: isMet ? 600 : 400,
                  fontSize: '0.75rem',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'all 0.3s ease'
                }}
              >
                {item.label}
              </Typography>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
