import { useState } from 'react'
import {
  Box, Button, Card, CardContent, TextField, Typography, 
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Chip, CircularProgress
} from '@mui/material'

export default function MetadataManager() {
  const [entryId, setEntryId] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [message, setMessage] = useState('')

  const API_BASE = 'http://localhost:8000'

  const handleFetchMetadata = async () => {
    if (!entryId) {
      setMessage('Please enter an entry ID')
      return
    }
    
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/metadata/entry/${entryId}`)
      if (response.ok) {
        const data = await response.json()
        setMetadata(data)
        setMessage('')
      } else {
        setMessage('Entry not found')
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }
    setLoading(false)
  }

  const handleUpdateMetadata = async () => {
    try {
      const response = await fetch(`${API_BASE}/metadata/entry/${entryId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: metadata.title,
          performers: metadata.performers,
          tags: metadata.tags,
          description: metadata.metadata?.description
        })
      })
      if (response.ok) {
        setMessage('Metadata updated successfully')
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }
  }

  const handleWriteToFile = async () => {
    if (!entryId) {
      setMessage('Please select an entry')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/metadata/entry/${entryId}/write-to-file`, {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        setMessage(`Metadata written to: ${data.sidecar_file}`)
      } else {
        setMessage('Failed to write metadata')
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }
    setLoading(false)
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Metadata Management
      </Typography>

      {/* Fetch Metadata */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Fetch & Edit Metadata</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              label="Library Entry ID"
              value={entryId}
              onChange={(e) => setEntryId(e.target.value)}
              type="number"
            />
            <Button variant="contained" onClick={handleFetchMetadata} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Fetch'}
            </Button>
          </Box>

          {message && (
            <Alert severity={message.includes('Error') ? 'error' : 'info'} sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}

          {metadata && (
            <Box>
              <TextField
                fullWidth
                label="Title"
                value={metadata.title}
                onChange={(e) => setMetadata({...metadata, title: e.target.value})}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Performers (comma-separated)"
                value={metadata.performers?.join(', ')}
                onChange={(e) => setMetadata({
                  ...metadata,
                  performers: e.target.value.split(',').map(p => p.trim())
                })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Tags (comma-separated)"
                value={metadata.tags?.join(', ')}
                onChange={(e) => setMetadata({
                  ...metadata,
                  tags: e.target.value.split(',').map(t => t.trim())
                })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Description"
                value={metadata.metadata?.description || ''}
                onChange={(e) => setMetadata({
                  ...metadata,
                  metadata: {...metadata.metadata, description: e.target.value}
                })}
                margin="normal"
                multiline
                rows={3}
              />

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button variant="contained" onClick={handleUpdateMetadata}>
                  Update Metadata
                </Button>
                <Button variant="outlined" onClick={handleWriteToFile}>
                  Write to File
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Metadata Caching</Typography>
          <Button variant="contained" sx={{ mr: 1 }}>
            Cache Metadata from ThePornDB
          </Button>
          <Button variant="contained">
            Cache Metadata from StashDB
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}
