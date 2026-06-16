import { useState, useEffect } from 'react'
import { Box, TextField, IconButton, Typography, Tooltip } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'

export default function InlineTextField({ value, onSave, label = '', disabled = false, fullWidth = false, autoEdit = false }) {
  const [isEditing, setIsEditing] = useState(autoEdit)
  const [editValue, setEditValue] = useState(value)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true)
    }
  }, [autoEdit])

  const handleStart = () => {
    if (disabled) return
    setIsEditing(true)
    setEditValue(value)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue(value)
  }

  const handleConfirm = async () => {
    if (editValue.trim() === '') return
    setIsEditing(false)
    if (editValue !== value) {
      await onSave(editValue)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: fullWidth ? '100%' : 'auto' }}>
        <TextField
          size="small"
          label={label}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={disabled}
          sx={{
            flexGrow: 1,
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(5px)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }
          }}
        />
        <Tooltip title="Save Change">
          <IconButton color="success" onClick={handleConfirm} size="small" sx={{ p: '6px' }}>
            <CheckIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Cancel">
          <IconButton color="error" onClick={handleCancel} size="small" sx={{ p: '6px' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    )
  }

  return (
    <Box 
      onClick={handleStart}
      sx={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: 1.5, 
        cursor: disabled ? 'default' : 'pointer',
        p: '6px 12px',
        borderRadius: '10px',
        transition: 'background-color 0.2s, border-color 0.2s',
        border: '1px solid transparent',
        '&:hover': {
          backgroundColor: disabled ? 'transparent' : 'rgba(255, 255, 255, 0.04)',
          borderColor: disabled ? 'transparent' : 'rgba(255, 255, 255, 0.08)'
        }
      }}
    >
      <Typography variant="body1" sx={{ fontWeight: '500' }}>
        {value || <span style={{ opacity: 0.5 }}>Click to set...</span>}
      </Typography>
      {!disabled && (
        <EditIcon fontSize="inherit" sx={{ opacity: 0.3, transition: 'opacity 0.2s', '.MuiBox-root:hover &': { opacity: 0.8 } }} />
      )}
    </Box>
  )
}
