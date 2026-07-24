import { useState, useEffect } from 'react'
import {
  Box, Button, Card, CardContent, TextField, Typography, 
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Chip, CircularProgress, FormControl, InputLabel, Select, MenuItem
} from '@mui/material'
import { apiFetch } from '../api'
import { Tag } from 'lucide-react'
import UrlParseConfirmationModal from './UrlParseConfirmationModal'

export default function MetadataManager() {
  const [entryId, setEntryId] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(false)
  const [libraryEntries, setLibraryEntries] = useState([])
  const [message, setMessage] = useState('')

  // URL Parsing states
  const [parseUrl, setParseUrl] = useState('')
  const [parseLoading, setParseLoading] = useState(false)
  const [parsedMetadata, setParsedMetadata] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [urlParsingPermission, setUrlParsingPermission] = useState('edit')

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

    apiFetch('/auth/me')
      .then(res => {
        if (res.ok) return res.json()
      })
      .then(data => {
        if (data) {
          const userPerms = data.permissions || {}
          const perm = userPerms.url_parsing || (data.role === 'admin' ? 'edit' : 'no_access')
          setUrlParsingPermission(perm)
        }
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
  }

  const handleParseUrl = async () => {
    if (!parseUrl) {
      setMessage('Please enter a URL to parse')
      return
    }

    if (urlParsingPermission === 'no_access') {
      setMessage('Error: You do not have permissions to access the URL parsing feature.')
      return
    }

    setParseLoading(true)
    try {
      const response = await apiFetch('/scraper/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parseUrl })
      })

      if (response.ok) {
        const data = await response.json()
        setParsedMetadata(data.metadata)
        setModalOpen(true)
        setMessage('')
      } else {
        const errData = await response.json().catch(() => ({}))
        setMessage(`Error parsing URL: ${errData.detail || response.statusText}`)
      }
    } catch (error) {
      setMessage(`Error parsing URL: ${error.message}`)
    }
    setParseLoading(false)
  }

  const handleApplyParsedMetadata = (appliedData) => {
    setMetadata(prev => {
      const updated = { ...prev }
      if (appliedData.title) updated.title = appliedData.title
      if (appliedData.studio) updated.studio_name = appliedData.studio
      if (appliedData.performers) updated.performers = appliedData.performers
      if (appliedData.tags) updated.tags = appliedData.tags
      if (appliedData.description) {
        updated.entry_metadata = {
          ...updated.entry_metadata,
          description: appliedData.description
        }
      }
      return updated
    })
    setMessage('Parsed metadata successfully loaded into form! Click "Update Metadata" to save.')
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Metadata Management
      </Typography>

      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        icon={<Tag size={20} />} 
        sx={{ 
          mb: 3, 
          borderRadius: '12px', 
          bgcolor: 'rgba(99, 102, 241, 0.08)', 
          color: '#a5b4fc',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          '& .MuiAlert-icon': { color: '#818cf8' } 
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
          🏷️ Metadata Enrichment &amp; File Tagging Manager
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          The Metadata Manager fetches external scraper data (TPDB, StashDB), parses page URLs, enriches video titles, updates performer profiles, tags categories, and formats NFO files.
        </Typography>
      </Alert>

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
              {urlParsingPermission !== 'no_access' && (
                <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1, p: 2, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', alignItems: 'center' }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Paste adult video URL to parse metadata..."
                    value={parseUrl}
                    onChange={(e) => setParseUrl(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                  />
                  <Button variant="outlined" color="secondary" onClick={handleParseUrl} disabled={parseLoading} sx={{ borderRadius: '8px', whiteSpace: 'nowrap', py: 1 }}>
                    {parseLoading ? <CircularProgress size={20} /> : 'Parse URL'}
                  </Button>
                </Box>
              )}
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

      <UrlParseConfirmationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        parsedData={parsedMetadata}
        currentData={{
          title: metadata?.title || '',
          studio: metadata?.studio_name || '',
          performers: metadata?.performers || [],
          tags: metadata?.tags || [],
          description: metadata?.entry_metadata?.description || ''
        }}
        onApply={handleApplyParsedMetadata}
        permission={urlParsingPermission}
      />
    </Box>
  )
}
