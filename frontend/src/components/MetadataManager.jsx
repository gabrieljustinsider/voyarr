import { useState, useEffect } from 'react'
import {
  Box, Button, Card, CardContent, TextField, Typography, 
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Chip, CircularProgress, FormControl, InputLabel, Select, MenuItem
} from '@mui/material'

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
}

export default function MetadataManager() {
  const [entryId, setEntryId] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(false)
  const [libraryEntries, setLibraryEntries] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/library`, { headers: HEADERS })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch library entries')
        return res.json()
      })
      .then(data => {
        if (Array.isArray(data)) setLibraryEntries(data)
      })
      .catch(console.error)
  }, [])

  const handleFetchMetadata = async () => {
    if (!entryId) {
      setMessage('Please enter an entry ID')
      return
    }
    
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/metadata/entry/${entryId}`, { headers: HEADERS })
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
        headers: HEADERS,
        body: JSON.stringify({
          title: metadata.title,
          performers: metadata.performers,
          tags: metadata.tags,
          description: metadata.metadata?.description
        })
      })
      if (response.ok) {
        setMessage('Metadata updated successfully')
      } else {
        const errData = await response.json().catch(() => ({}))
        setMessage(`Failed to update metadata: ${errData.detail || response.statusText}`)
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
        method: 'POST',
        headers: HEADERS
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

  const handleQuickCache = async (source) => {
    if (!metadata || !metadata.title) {
      setMessage('Please fetch an entry first to base the search on its title.')
      return
    }
    setLoading(true)
    try {
      const settingsRes = await fetch(`${API_BASE}/settings`, { headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY } })
      if (!settingsRes.ok) throw new Error('Failed to retrieve external API settings')
      const settings = await settingsRes.json()
      const apiKey = source === 'theporndb' ? settings.tpdb_api_key : settings.stashdb_api_key
      
      if (!apiKey) {
        throw new Error(`Missing API Key for ${source}. Please configure it in the Settings tab.`)
      }

      const res = await fetch(`${API_BASE}/external-api/${source}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
        },
        body: JSON.stringify({ query: metadata.title })
      })
      const data = await res.json()
      if (res.ok && data.results && data.results.length > 0) {
        const topResult = data.results[0]
        setMetadata(prev => ({
          ...prev,
          title: topResult.title || prev.title,
          performers: topResult.performers || prev.performers,
          tags: topResult.tags || prev.tags,
          metadata: { ...prev.metadata, description: topResult.description || prev.metadata?.description }
        }))
        setMessage(`Loaded top match from ${source}! Click 'Update Metadata' to save it.`)
      } else {
        setMessage(`No matches found on ${source}.`)
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
            <FormControl sx={{ minWidth: 300 }} size="small">
              <InputLabel>Select Library Entry</InputLabel>
              <Select
                value={entryId}
                label="Select Library Entry"
                onChange={(e) => setEntryId(e.target.value)}
              >
                {libraryEntries.map(entry => <MenuItem key={entry.id} value={entry.id}>{entry.title || `Entry ${entry.id}`}</MenuItem>)}
              </Select>
            </FormControl>
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
          <Button variant="contained" sx={{ mr: 1 }} onClick={() => handleQuickCache('theporndb')} disabled={loading}>
            Cache Metadata from ThePornDB
          </Button>
          <Button variant="contained" onClick={() => handleQuickCache('stashdb')} disabled={loading}>
            Cache Metadata from StashDB
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}
