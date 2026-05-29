import React, { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton,
  Box, Typography, Checkbox, FormControlLabel, TextField, Chip, Divider,
  Grid, Card, CardContent, Autocomplete
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'

export default function UrlParseConfirmationModal({
  open,
  onClose,
  parsedData,
  currentData = {},
  onApply,
  permission = 'edit' // 'no_access', 'read_only', 'edit'
}) {
  const isReadOnly = permission === 'read_only'

  // Local state for parsed values
  const [title, setTitle] = useState('')
  const [studio, setStudio] = useState('')
  const [performers, setPerformers] = useState([])
  const [tags, setTags] = useState([])
  const [description, setDescription] = useState('')

  // State to track which fields the user wants to keep
  const [keepFields, setKeepFields] = useState({
    title: true,
    studio: true,
    performers: true,
    tags: true,
    description: true
  })

  // Synchronize local states when new data is parsed
  useEffect(() => {
    if (parsedData) {
      setTitle(parsedData.title || '')
      setStudio(parsedData.studio || '')
      setPerformers(Array.isArray(parsedData.performers) ? parsedData.performers : [])
      setTags(Array.isArray(parsedData.tags) ? parsedData.tags : [])
      setDescription(parsedData.description || '')
      
      // Default auto-select check to true if parsed value exists
      setKeepFields({
        title: Boolean(parsedData.title),
        studio: Boolean(parsedData.studio),
        performers: Boolean(parsedData.performers?.length),
        tags: Boolean(parsedData.tags?.length),
        description: Boolean(parsedData.description)
      })
    }
  }, [parsedData])

  const handleToggleField = (field) => {
    if (isReadOnly) return
    setKeepFields(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleSave = () => {
    if (isReadOnly) return
    
    // Construct final payload containing only selected fields
    const finalData = {}
    if (keepFields.title) finalData.title = title
    if (keepFields.studio) finalData.studio = studio
    if (keepFields.performers) finalData.performers = performers
    if (keepFields.tags) finalData.tags = tags
    if (keepFields.description) finalData.description = description

    onApply(finalData)
    onClose()
  }

  if (!parsedData) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          backdropFilter: 'blur(20px)',
          backgroundColor: 'rgba(30, 30, 30, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
          color: 'white'
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
          {isReadOnly ? 'Parsed URL Details (Read-Only)' : 'Confirm Parsed Metadata'}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white' } }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 3 }}>
        {isReadOnly && (
          <Box sx={{ mb: 2.5, p: 1.5, borderRadius: '8px', background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
            <Typography variant="body2" sx={{ color: '#ffa726' }}>
              Your account has read-only parsing privileges. You can view the extracted metadata below but cannot apply or modify it.
            </Typography>
          </Box>
        )}

        <Typography variant="body2" sx={{ opacity: 0.7, mb: 3 }}>
          Compare the parsed values from the URL with your current metadata. Choose which fields you wish to overwrite.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          {/* TITLE FIELD */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
              <Checkbox
                checked={keepFields.title}
                onChange={() => handleToggleField('title')}
                disabled={isReadOnly}
                sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-checked': { color: '#a855f7' } }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9 }}>
                Title
              </Typography>
            </Box>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={5.5}>
                <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', height: '100%' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="textSecondary" display="block">Current Value</Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all', opacity: currentData.title ? 1 : 0.4 }}>
                      {currentData.title || 'Empty'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={1} sx={{ display: 'flex', justifyContent: 'center' }}>
                <CompareArrowsIcon sx={{ opacity: 0.3, transform: { xs: 'rotate(90deg)', md: 'none' } }} />
              </Grid>
              <Grid item xs={12} md={5.5}>
                <TextField
                  fullWidth
                  size="small"
                  disabled={isReadOnly || !keepFields.title}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          {/* STUDIO FIELD */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
              <Checkbox
                checked={keepFields.studio}
                onChange={() => handleToggleField('studio')}
                disabled={isReadOnly}
                sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-checked': { color: '#a855f7' } }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9 }}>
                Studio
              </Typography>
            </Box>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={5.5}>
                <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', height: '100%' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="textSecondary" display="block">Current Value</Typography>
                    <Typography variant="body2" sx={{ opacity: currentData.studio ? 1 : 0.4 }}>
                      {currentData.studio || 'Empty'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={1} sx={{ display: 'flex', justifyContent: 'center' }}>
                <CompareArrowsIcon sx={{ opacity: 0.3, transform: { xs: 'rotate(90deg)', md: 'none' } }} />
              </Grid>
              <Grid item xs={12} md={5.5}>
                <TextField
                  fullWidth
                  size="small"
                  disabled={isReadOnly || !keepFields.studio}
                  value={studio}
                  onChange={(e) => setStudio(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          {/* PERFORMERS FIELD */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
              <Checkbox
                checked={keepFields.performers}
                onChange={() => handleToggleField('performers')}
                disabled={isReadOnly}
                sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-checked': { color: '#a855f7' } }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9 }}>
                Performers
              </Typography>
            </Box>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={5.5}>
                <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', height: '100%' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="textSecondary" display="block">Current Value</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {currentData.performers?.length > 0 ? (
                        currentData.performers.map((p, i) => <Chip key={i} size="small" label={p} sx={{ height: 20 }} />)
                      ) : (
                        <Typography variant="body2" sx={{ opacity: 0.4 }}>Empty</Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={1} sx={{ display: 'flex', justifyContent: 'center' }}>
                <CompareArrowsIcon sx={{ opacity: 0.3, transform: { xs: 'rotate(90deg)', md: 'none' } }} />
              </Grid>
              <Grid item xs={12} md={5.5}>
                <Autocomplete
                  multiple
                  freeSolo
                  size="small"
                  disabled={isReadOnly || !keepFields.performers}
                  options={[]}
                  value={performers}
                  onChange={(event, newValue) => setPerformers(newValue)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip size="small" label={option} {...getTagProps({ index })} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Add Performers" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                  )}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          {/* TAGS FIELD */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
              <Checkbox
                checked={keepFields.tags}
                onChange={() => handleToggleField('tags')}
                disabled={isReadOnly}
                sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-checked': { color: '#a855f7' } }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9 }}>
                Tags
              </Typography>
            </Box>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={5.5}>
                <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', height: '100%' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="textSecondary" display="block">Current Value</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {currentData.tags?.length > 0 ? (
                        currentData.tags.map((t, i) => <Chip key={i} size="small" label={t} sx={{ height: 20 }} />)
                      ) : (
                        <Typography variant="body2" sx={{ opacity: 0.4 }}>Empty</Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={1} sx={{ display: 'flex', justifyContent: 'center' }}>
                <CompareArrowsIcon sx={{ opacity: 0.3, transform: { xs: 'rotate(90deg)', md: 'none' } }} />
              </Grid>
              <Grid item xs={12} md={5.5}>
                <Autocomplete
                  multiple
                  freeSolo
                  size="small"
                  disabled={isReadOnly || !keepFields.tags}
                  options={[]}
                  value={tags}
                  onChange={(event, newValue) => setTags(newValue)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip size="small" label={option} {...getTagProps({ index })} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Add Tags" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                  )}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          {/* DESCRIPTION FIELD */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
              <Checkbox
                checked={keepFields.description}
                onChange={() => handleToggleField('description')}
                disabled={isReadOnly}
                sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-checked': { color: '#a855f7' } }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9 }}>
                Description
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={5.5}>
                <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', height: '100%' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="textSecondary" display="block">Current Value</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', opacity: currentData.description ? 1 : 0.4 }}>
                      {currentData.description || 'Empty'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={1} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CompareArrowsIcon sx={{ opacity: 0.3, transform: { xs: 'rotate(90deg)', md: 'none' } }} />
              </Grid>
              <Grid item xs={12} md={5.5}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  size="small"
                  disabled={isReadOnly || !keepFields.description}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>
            </Grid>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
          Close
        </Button>
        {!isReadOnly && (
          <Button
            variant="contained"
            onClick={handleSave}
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              fontWeight: 'bold',
              borderRadius: '8px',
              px: 3,
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)'
              }
            }}
          >
            Apply Selected Fields
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
