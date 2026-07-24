import React from 'react'
import { Box } from '@mui/material'
import { motion } from 'framer-motion'

export default function GlassCard({ 
  children, 
  sx = {}, 
  hoverEffect = true,
  animate = true,
  ...props 
}) {
  const content = (
    <Box
      sx={{
        p: 2.5,
        borderRadius: '16px',
        bgcolor: (theme) => 
          theme.palette.mode === 'dark' 
            ? 'rgba(18, 19, 26, 0.75)' 
            : 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid',
        borderColor: (theme) => 
          theme.palette.mode === 'dark' 
            ? 'rgba(255, 255, 255, 0.08)' 
            : 'rgba(0, 0, 0, 0.08)',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.3)'
            : '0 8px 32px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        ...(hoverEffect && {
          '&:hover': {
            borderColor: (theme) => 
              theme.palette.mode === 'dark' 
                ? 'rgba(99, 102, 241, 0.4)' 
                : 'rgba(99, 102, 241, 0.3)',
            transform: 'translateY(-3px)',
            boxShadow: '0 12px 36px rgba(99, 102, 241, 0.2)'
          }
        }),
        ...sx
      }}
      {...props}
    >
      {children}
    </Box>
  )

  if (!animate) return content

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {content}
    </motion.div>
  )
}
