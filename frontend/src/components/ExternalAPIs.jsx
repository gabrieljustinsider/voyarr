import { useState, useEffect } from 'react'
import {
  Box, Button, Card, CardContent, TextField, Typography, 
  Alert, CircularProgress, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, Avatar, IconButton, InputAdornment, Snackbar, Divider, Grid,
  Switch, FormControlLabel
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SearchIcon from '@mui/icons-material/Search'
import { apiFetch } from '../api'

function TabPanel({ children, value, index }) {
  return value === index ? <Box>{children}</Box> : null
}

export default function ExternalAPIs() {
  const [tabValue, setTabValue] = useState(0)
  const [tpdbKey, setTpdbKey] = useState('')
  const [stashdbKey, setStashdbKey] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [openSyncDialog, setOpenSyncDialog] = useState(false)
  const [selectedResult, setSelectedResult] = useState(null)
  const [performerBio, setPerformerBio] = useState(null)
  const [openBioDialog, setOpenBioDialog] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)

  // API Keys States
  const [apiKeys, setApiKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, keyId: null })
  const [generatedKey, setGeneratedKey] = useState(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [snackbarSeverity, setSnackbarSeverity] = useState('success')

  // Load API keys from global settings on mount
  useEffect(() => {
    const loadGlobalSettings = async () => {
      try {
        const response = await apiFetch('/settings')
        if (response.ok) {
          const data = await response.json()
          if (data.tpdb_api_key) setTpdbKey(data.tpdb_api_key)
          if (data.stashdb_api_key) setStashdbKey(data.stashdb_api_key)
        }
      } catch (error) {
        console.error('Failed to load global API keys in ExternalAPIs:', error)
      }
    }
    loadGlobalSettings()
  }, [])

  const fetchApiKeys = async () => {
    try {
      const res = await apiFetch('/apikeys')
      if (res.ok) setApiKeys(await res.json())
    } catch (err) { console.error('Failed to fetch API keys:', err) }
  }

  useEffect(() => {
    if (tabValue === 2) {
      fetchApiKeys()
    }
  }, [tabValue])

  const handleCreateApiKey = async () => {
    try {
      const res = await apiFetch('/apikeys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName })
      })
      if (res.ok) {
        const data = await res.json()
        setGeneratedKey(data.raw_key)
        setNewKeyName('')
        fetchApiKeys()
      } else {
        setSnackbarMessage(`Failed to create API key. Server returned ${res.status}`)
        setSnackbarSeverity('error')
        setSnackbarOpen(true)
      }
    } catch (err) {
      setSnackbarMessage('Network error creating API key.')
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
    }
  }

  const handleDeleteApiKey = (id) => {
    setDeleteConfirm({ open: true, keyId: id })
  }

  const confirmDeleteApiKey = async () => {
    if (!deleteConfirm.keyId) return
    try {
      await apiFetch(`/apikeys/${deleteConfirm.keyId}`, { 
        method: 'DELETE'
      })
      setDeleteConfirm({ open: false, keyId: null })
      fetchApiKeys()
    } catch (err) {
      console.error('Failed to revoke API key:', err)
    }
  }

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedKey || '')
    setSnackbarMessage('API Key copied to clipboard!')
    setSnackbarSeverity('success')
    setSnackbarOpen(true)
  }

  // Save key globally
  const handleSaveGlobalKey = async (key, value) => {
    try {
      const response = await apiFetch('/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value })
      })
      if (response.ok) {
        setMessage(`API Key saved to global settings!`)
      } else {
        setMessage('Failed to save API key globally')
      }
    } catch (error) {
      setMessage(`Error saving key: ${error.message}`)
    }
  }

  const handleTabChange = (e, value) => {
    setTabValue(value)
    setResults([])
    setSearchQuery('')
    setMessage('')
    setSelectedResult(null)
  }

  const handleSearchThePornDB = async () => {
    if (!tpdbKey) {
      setMessage('Please enter ThePornDB API key')
      return
    }

    setLoading(true)
    try {
      const response = await apiFetch('/external-api/theporndb/query', {
        method: 'POST',
        headers: { 'X-API-Key': tpdbKey },
        body: JSON.stringify({
          query: searchQuery
        })
      })

      if (response.ok) {
        const data = await response.json()
        setResults(data.results || [])
        setMessage('')
      } else {
        setMessage('Query failed')
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }
    setLoading(false)
  }

  const handleViewPerformer = async (performerName) => {
    if (!tpdbKey) return
    setBioLoading(true)
    setOpenBioDialog(true)
    setPerformerBio(null)
    
    try {
      const response = await apiFetch('/external-api/theporndb/performer', {
        method: 'POST',
        headers: { 'X-API-Key': tpdbKey },
        body: JSON.stringify({ name: performerName })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.results && data.results.length > 0) {
          setPerformerBio(data.results[0])
        } else {
          setPerformerBio({ name: performerName, bio: "No detailed biography found." })
        }
      }
    } catch (error) {
      console.error(error)
      setPerformerBio({ name: performerName, bio: "Error fetching biography." })
    }
    setBioLoading(false)
  }

  const handleSearchStashDB = async () => {
    if (!stashdbKey) {
      setMessage('Please enter StashDB API key')
      return
    }

    setLoading(true)
    try {
      const response = await apiFetch('/external-api/stashdb/query', {
        method: 'POST',
        headers: { 'X-API-Key': stashdbKey },
        body: JSON.stringify({
          query: searchQuery
        })
      })

      if (response.ok) {
        const data = await response.json()
        setResults(data.results || [])
        setMessage('')
      } else {
        setMessage('Query failed')
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }
    setLoading(false)
  }

  const handleSyncToThePornDB = async () => {
    if (!selectedResult) return
    
    setLoading(true)
    try {
      const response = await apiFetch('/external-api/theporndb/update', {
        method: 'POST',
        headers: { 'X-API-Key': tpdbKey },
        body: JSON.stringify({
          site_id: selectedResult.id,
          title: selectedResult.title,
          performers: selectedResult.performers,
          tags: selectedResult.tags,
          description: selectedResult.description
        })
      })

      if (response.ok) {
        setMessage('Synced to ThePornDB successfully')
        setOpenSyncDialog(false)
      } else {
        const errData = await response.json().catch(() => ({}))
        setMessage(`Failed to sync: ${errData.detail || response.statusText}`)
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }
    setLoading(false)
  }

  const handleSyncToStashDB = async () => {
    if (!selectedResult) return

    setLoading(true)
    try {
      const response = await apiFetch('/external-api/stashdb/update', {
        method: 'POST',
        headers: { 'X-API-Key': stashdbKey },
        body: JSON.stringify({
          site_id: selectedResult.id,
          title: selectedResult.title,
          performers: selectedResult.performers,
          tags: selectedResult.tags
        })
      })

      if (response.ok) {
        setMessage('Synced to StashDB successfully')
        setOpenSyncDialog(false)
      } else {
        const errData = await response.json().catch(() => ({}))
        setMessage(`Failed to sync: ${errData.detail || response.statusText}`)
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    }
    setLoading(false)
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        External API Integration
      </Typography>

      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="ThePornDB" />
        <Tab label="StashDB" />
        <Tab label="External API Keys" />
      </Tabs>

      {/* ThePornDB */}
      <TabPanel value={tabValue} index={0}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>ThePornDB Configuration</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 2 }}>
              <TextField
                fullWidth
                label="API Key"
                type="password"
                value={tpdbKey}
                onChange={(e) => setTpdbKey(e.target.value)}
              />
              <Button 
                variant="contained" 
                onClick={() => handleSaveGlobalKey('tpdb_api_key', tpdbKey)}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Save Globally
              </Button>
            </Box>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
              Get your API key from <a href="https://theporndb.net" target="_blank" rel="noreferrer">theporndb.net</a>
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Search & Sync</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="Search query"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter scene title..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearchThePornDB()}
              />
              <Button 
                variant="contained" 
                onClick={handleSearchThePornDB}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Search'}
              </Button>
            </Box>

            {message && <Alert severity={message.includes('Error') ? 'error' : 'info'} sx={{ mb: 2 }}>{message}</Alert>}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : results.length > 0 && (
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell>Title</TableCell>
                      <TableCell>Performers</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id}>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{result.title}</Typography>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            {result.site} • {result.date}
                          </Typography>
                        </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          {result.performers?.slice(0, 2).map(p => {
                            const name = p.name || p;
                            return (
                              <Chip 
                                key={name} 
                                label={name} 
                                size="small" 
                                sx={{ mr: 0.5, cursor: 'pointer' }} 
                                onClick={() => handleViewPerformer(name)}
                              />
                            )
                          })}
                        </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSelectedResult(result)
                              setOpenSyncDialog(true)
                            }}
                          >
                            Sync
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* StashDB */}
      <TabPanel value={tabValue} index={1}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>StashDB Configuration</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 2 }}>
              <TextField
                fullWidth
                label="API Key"
                type="password"
                value={stashdbKey}
                onChange={(e) => setStashdbKey(e.target.value)}
              />
              <Button 
                variant="contained" 
                onClick={() => handleSaveGlobalKey('stashdb_api_key', stashdbKey)}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Save Globally
              </Button>
            </Box>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
              Configure your StashDB key to search metadata on StashDB endpoints
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Search Scenes</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="Scene name or Stash ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scene..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearchStashDB()}
              />
              <Button 
                variant="contained" 
                onClick={handleSearchStashDB}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Search'}
              </Button>
            </Box>

            {message && <Alert severity={message.includes('Error') ? 'error' : 'info'} sx={{ mb: 2 }}>{message}</Alert>}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : results.length > 0 && (
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Title</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Performers</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>{result.title}</TableCell>
                        <TableCell>
                          {result.performers?.slice(0, 2).map(p => (
                            <Chip key={p.name} label={p.name} size="small" sx={{ mr: 0.5 }} />
                          ))}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSelectedResult(result)
                              setOpenSyncDialog(true)
                            }}
                          >
                            Sync
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* External API Keys */}
      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>External API Keys</Typography>
          <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
            Generate scoped API keys for external tools (e.g., third-party scrapers, automation scripts, or the *arr stack) to interact with Voyarr securely without exposing your MASTER_KEY.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={2} sx={{ mb: 3, alignItems: 'center' }}>
            <Grid xs={12} md={9}>
              <TextField fullWidth size="small" label="New Key Name (e.g. 'Stash Webhook')" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
            </Grid>
            <Grid xs={12} md={3}>
              <Button fullWidth variant="contained" onClick={handleCreateApiKey} disabled={!newKeyName}>Generate Key</Button>
            </Grid>
          </Grid>

          <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Name</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Created</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Last Used</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center">No external API keys configured.</TableCell></TableRow>
                ) : (
                  apiKeys.map(key => (
                    <TableRow key={key.id}>
                      <TableCell>{key.name}</TableCell>
                      <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{key.last_used ? new Date(key.last_used).toLocaleString() : 'Never'}</TableCell>
                      <TableCell align="right">
                        <IconButton color="error" size="small" onClick={() => handleDeleteApiKey(key.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>

      {/* Sync Dialog */}
      <Dialog open={openSyncDialog} onClose={() => setOpenSyncDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Sync Metadata</DialogTitle>
        <DialogContent dividers>
          {selectedResult && (
            <Box sx={{ pt: 2 }}>
              <Typography><strong>Title:</strong> {selectedResult.title}</Typography>
              <Typography>
                <strong>Performers:</strong> {selectedResult.performers?.map(p => p.name || p).join(', ')}
              </Typography>
              <Typography>
                <strong>Tags:</strong> {selectedResult.tags?.map(t => t.name || t).join(', ')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSyncDialog(false)}>Cancel</Button>
          {tabValue === 0 && (
            <Button onClick={handleSyncToThePornDB} variant="contained">
              Sync to ThePornDB
            </Button>
          )}
          {tabValue === 1 && (
            <Button onClick={handleSyncToStashDB} variant="contained">
              Sync to StashDB
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Performer Bio Dialog */}
      <Dialog open={openBioDialog} onClose={() => setOpenBioDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Performer Biography</DialogTitle>
        <DialogContent dividers>
          {bioLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
               <CircularProgress />
            </Box>
          ) : performerBio ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                {performerBio.image && <Avatar src={performerBio.image} sx={{ width: 80, height: 80 }} />}
                <Box>
                  <Typography variant="h5">{performerBio.name}</Typography>
                  {performerBio.aliases && performerBio.aliases.length > 0 && (
                     <Typography variant="body2" color="textSecondary">AKA: {performerBio.aliases.join(', ')}</Typography>
                  )}
                </Box>
              </Box>
              <Typography variant="body1" paragraph>{performerBio.bio}</Typography>
              {performerBio.measurements && (
                 <Typography variant="body2"><strong>Measurements:</strong> {performerBio.measurements}</Typography>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBioDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!generatedKey} onClose={() => setGeneratedKey(null)} maxWidth="sm" fullWidth>
        <DialogTitle>API Key Generated</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>Please copy this key now. For your security, it will never be shown again!</Alert>
          <TextField 
            fullWidth 
            value={generatedKey || ''} 
            slotProps={{ input: { 
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopyKey} edge="end" color="primary" title="Copy to Clipboard">
                    <ContentCopyIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCopyKey} variant="outlined" color="primary" startIcon={<ContentCopyIcon />}>Copy Key</Button>
          <Button variant="contained" onClick={() => setGeneratedKey(null)}>I have copied it</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, keyId: null })}>
        <DialogTitle>Revoke API Key</DialogTitle>
        <DialogContent>
          <Typography>Revoke this API Key? Any scripts currently using it will immediately lose access.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, keyId: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteApiKey}>Revoke</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert>
      </Snackbar>
    </Box>
  )
}
