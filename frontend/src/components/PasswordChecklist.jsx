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
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 2.5,
        borderRadius: '16px',
        backgroundColor: 'rgba(30, 41, 59, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        boxSizing: 'border-box',
        transition: 'all 0.3s ease'
      }}
    >
      <Box>
        {/* Strength Label & Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'rgba(255,255,255,0.7)', 
              fontWeight: 600, 
              fontSize: '0.8rem',
              letterSpacing: '0.2px'
            }}
          >
            Security Checklist
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              color: strengthColor, 
              fontWeight: 700, 
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
      </Box>

      {/* Vertical Checklist Column */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 1 }}>
        {criteria.map((item, index) => {
          const isMet = results[index]
          return (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              {/* Custom Animated Icon */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: isMet ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${isMet ? '#10b981' : 'rgba(255, 255, 255, 0.12)'}`,
                  transition: 'all 0.3s ease',
                  flexShrink: 0
                }}
              >
                {isMet ? (
                  <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ width: '12px', height: '12px' }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <Box 
                    sx={{ 
                      width: 5, 
                      height: 5, 
                      borderRadius: '50%', 
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      transition: 'all 0.3s ease'
                    }} 
                  />
                )}
              </Box>

              {/* Requirement Text */}
              <Typography
                variant="caption"
                sx={{
                  color: isMet ? '#10b981' : 'rgba(255, 255, 255, 0.55)',
                  fontWeight: isMet ? 600 : 400,
                  fontSize: '0.78rem',
                  lineHeight: 1.3,
                  transition: 'all 0.3s ease'
                }}
              >
                {item.label}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
