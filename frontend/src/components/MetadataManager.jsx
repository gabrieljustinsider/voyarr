import { useState, useEffect } from 'react'
import {
  Box, Button, Card, CardContent, TextField, Typography, 
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Chip, CircularProgress, FormControl, InputLabel, Select, MenuItem
} from '@mui/material'
import { apiFetch } from '../api'

export default function MetadataManager() {
  const [entryId, setEntryId] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(false)
  const [libraryEntries, setLibraryEntries] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    apiFetch('/library?limit=1000')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch library entries')
        return res.json()
      })
      .then(data => {
        if (Array.isArray(data)) setLibraryEntries(data)
        else if (data && data.items) setLibraryEntries(data.items)
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
      const response = await apiFetch(`/metadata/entry/${entryId}`)
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
      const response = await apiFetch(`/metadata/entry/${entryId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: metadata.title,
          performers: metadata.performers,
          tags: metadata.tags,
          studio: metadata.studio_name,
          description: metadata.entry_metadata?.description
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
      const response = await apiFetch(`/metadata/entry/${entryId}/write-to-file`, {
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

  const handleQuickCache = async (source) => {
    if (!metadata || !metadata.title) {
      setMessage('Please fetch an entry first to base the search on its title.')
      return
    }
    setLoading(true)
    try {
      const settingsRes = await apiFetch('/settings')
      if (!settingsRes.ok) throw new Error('Failed to retrieve external API settings')
      const settings = await settingsRes.json()
      const apiKey = source === 'theporndb' ? settings.tpdb_api_key : settings.stashdb_api_key
      
      if (!apiKey) {
        throw new Error(`Missing API Key for ${source}. Please configure it in the Settings tab.`)
      }

      const res = await apiFetch(`/external-api/${source}/query`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
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
          studio_name: topResult.studio?.name || prev.studio_name,
          entry_metadata: { ...prev.entry_metadata, description: topResult.description || prev.entry_metadata?.description }
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
                label="Studio"
                value={metadata.studio_name || ''}
                onChange={(e) => setMetadata({...metadata, studio_name: e.target.value})}
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
                value={metadata.entry_metadata?.description || ''}
                onChange={(e) => setMetadata({
                  ...metadata,
                  entry_metadata: {...metadata.entry_metadata, description: e.target.value}
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

