import { useState, useEffect } from 'react'
import {
  Box, Button, Card, CardContent, TextField, Typography, 
  Alert, CircularProgress, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, Avatar, IconButton, InputAdornment, Snackbar, Divider, Grid
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import KeyIcon from '@mui/icons-material/Key'
import PublicIcon from '@mui/icons-material/Public'
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
      {/* Sub-navigation Pill Tabs */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 0.5, 
          mb: 3, 
          display: 'inline-flex',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          TabIndicatorProps={{ style: { display: 'none' } }}
          sx={{ 
            minHeight: 38,
            '& .MuiTab-root': { 
              textTransform: 'none', 
              fontWeight: 'bold', 
              fontSize: '0.85rem',
              minHeight: 38,
              py: 0.75,
              px: 2.5,
              borderRadius: '8px',
              color: 'text.secondary',
              transition: 'all 0.2s',
              '&.Mui-selected': { 
                color: '#ffffff',
                backgroundColor: 'rgba(99, 102, 241, 0.25)',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
              } 
            } 
          }}
        >
          <Tab label="ThePornDB" />
          <Tab label="StashDB" />
          <Tab label="External API Keys" />
        </Tabs>
      </Paper>

      {/* ThePornDB */}
      <TabPanel value={tabValue} index={0}>
        <Card sx={{ mb: 3, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: '700' }} gutterBottom>ThePornDB Configuration</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flexGrow: 1, minWidth: 300 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="ThePornDB API Key"
                  type="password"
                  value={tpdbKey}
                  onChange={(e) => setTpdbKey(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Box>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => handleSaveGlobalKey('tpdb_api_key', tpdbKey)}
                sx={{ whiteSpace: 'nowrap', height: 40, px: 3, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
              >
                Save Key Globally
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              Get your API key from <a href="https://theporndb.net" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>theporndb.net</a>
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: '700' }} gutterBottom>Search &amp; Sync Metadata</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
              <Box sx={{ flexGrow: 1, minWidth: 280 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Title or Performer"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter scene title..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchThePornDB()}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Box>
              <Button 
                variant="contained" 
                color="secondary"
                onClick={handleSearchThePornDB}
                disabled={loading}
                sx={{ height: 40, px: 3, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Search Metadata'}
              </Button>
            </Box>

            {message && <Alert severity={message.includes('Error') ? 'error' : 'info'} sx={{ mb: 2, borderRadius: '10px' }}>{message}</Alert>}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress color="primary" />
              </Box>
            ) : results.length > 0 && (
              <TableContainer component={Paper} sx={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', py: 1.5, pl: 2 }}>Title &amp; Site</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', py: 1.5 }}>Performers</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', py: 1.5, pr: 2 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ pl: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{result.title}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {result.site} • {result.date}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {result.performers?.slice(0, 2).map(p => {
                            const name = p.name || p;
                            return (
                              <Chip 
                                key={name} 
                                label={name} 
                                size="small" 
                                sx={{ mr: 0.5, cursor: 'pointer', fontWeight: 'bold' }} 
                                onClick={() => handleViewPerformer(name)}
                              />
                            )
                          })}
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 2 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSelectedResult(result)
                              setOpenSyncDialog(true)
                            }}
                            sx={{ borderRadius: '8px', textTransform: 'none' }}
                          >
                            Sync Metadata
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
        <Card sx={{ mb: 3, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: '700' }} gutterBottom>StashDB Configuration</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flexGrow: 1, minWidth: 300 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="StashDB API Key"
                  type="password"
                  value={stashdbKey}
                  onChange={(e) => setStashdbKey(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Box>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => handleSaveGlobalKey('stashdb_api_key', stashdbKey)}
                sx={{ whiteSpace: 'nowrap', height: 40, px: 3, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
              >
                Save Key Globally
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              Configure your StashDB key to search performer profiles, studios, and scenes on StashDB endpoints.
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: '700' }} gutterBottom>Search Scenes</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
              <Box sx={{ flexGrow: 1, minWidth: 280 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Scene Name or Stash ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search scene..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchStashDB()}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Box>
              <Button 
                variant="contained" 
                color="secondary"
                onClick={handleSearchStashDB}
                disabled={loading}
                sx={{ height: 40, px: 3, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Search StashDB'}
              </Button>
            </Box>

            {message && <Alert severity={message.includes('Error') ? 'error' : 'info'} sx={{ mb: 2, borderRadius: '10px' }}>{message}</Alert>}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress color="primary" />
              </Box>
            ) : results.length > 0 && (
              <TableContainer component={Paper} sx={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', py: 1.5, pl: 2 }}>Title</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', py: 1.5 }}>Performers</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', py: 1.5, pr: 2 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ pl: 2, fontWeight: 'bold' }}>{result.title}</TableCell>
                        <TableCell align="center">
                          {result.performers?.slice(0, 2).map(p => (
                            <Chip key={p.name} label={p.name} size="small" sx={{ mr: 0.5, fontWeight: 'bold' }} />
                          ))}
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 2 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSelectedResult(result)
                              setOpenSyncDialog(true)
                            }}
                            sx={{ borderRadius: '8px', textTransform: 'none' }}
                          >
                            Sync Metadata
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
        <Paper sx={{ p: 3, mb: 3, borderRadius: '16px', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
          <Typography variant="h6" sx={{ fontWeight: '700' }} gutterBottom>External Scraper API Keys</Typography>
          <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
            Generate scoped API keys for external tools (e.g., third-party scrapers, automation scripts, or *arr stack) to interact with Voyarr securely without exposing master credentials.
          </Typography>
          <Divider sx={{ mb: 3, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
          
          <Grid container spacing={2} sx={{ mb: 3, alignItems: 'center' }}>
            <Grid item xs={12} md={9} sx={{ minWidth: 280 }}>
              <TextField 
                fullWidth 
                size="small" 
                label="New Key Identifier (e.g. 'Stash Webhook')" 
                value={newKeyName} 
                onChange={e => setNewKeyName(e.target.value)} 
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button 
                fullWidth 
                variant="contained" 
                color="primary"
                onClick={handleCreateApiKey} 
                disabled={!newKeyName}
                sx={{ height: 40, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
              >
                Generate Key
              </Button>
            </Grid>
          </Grid>

          <TableContainer component={Paper} sx={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', py: 1.5, pl: 2 }}>Key Identifier</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', py: 1.5 }}>Created Date</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', py: 1.5 }}>Last Used</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 1.5, pr: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No external API keys configured.</TableCell></TableRow>
                ) : (
                  apiKeys.map(key => (
                    <TableRow key={key.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ pl: 2, fontWeight: 'bold' }}>{key.name}</TableCell>
                      <TableCell align="center">{new Date(key.created_at).toLocaleDateString()}</TableCell>
                      <TableCell align="center">{key.last_used ? new Date(key.last_used).toLocaleString() : 'Never'}</TableCell>
                      <TableCell align="right" sx={{ pr: 2 }}>
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
      <Dialog 
        open={openSyncDialog} 
        onClose={() => setOpenSyncDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PublicIcon color="primary" sx={{ fontSize: 26 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Sync Metadata Target</Typography>
          </Box>
          <IconButton aria-label="close" onClick={() => setOpenSyncDialog(false)} sx={{ color: 'text.secondary', '&:hover': { color: 'white' } }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {selectedResult && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body1" sx={{ mb: 1 }}><strong>Title:</strong> {selectedResult.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Performers:</strong> {selectedResult.performers?.map(p => p.name || p).join(', ')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Tags:</strong> {selectedResult.tags?.map(t => t.name || t).join(', ')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button onClick={() => setOpenSyncDialog(false)} sx={{ borderRadius: '10px', textTransform: 'none', px: 2.5, color: 'text.secondary' }}>Cancel</Button>
          {tabValue === 0 && (
            <Button onClick={handleSyncToThePornDB} variant="contained" color="primary" sx={{ borderRadius: '10px', textTransform: 'none', px: 3, fontWeight: 'bold' }}>
              Sync to ThePornDB
            </Button>
          )}
          {tabValue === 1 && (
            <Button onClick={handleSyncToStashDB} variant="contained" color="primary" sx={{ borderRadius: '10px', textTransform: 'none', px: 3, fontWeight: 'bold' }}>
              Sync to StashDB
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Performer Bio Dialog */}
      <Dialog 
        open={openBioDialog} 
        onClose={() => setOpenBioDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Performer Biography</Typography>
          <IconButton aria-label="close" onClick={() => setOpenBioDialog(false)} sx={{ color: 'text.secondary', '&:hover': { color: 'white' } }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {bioLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
               <CircularProgress color="primary" />
            </Box>
          ) : performerBio ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                {performerBio.image && <Avatar src={performerBio.image} sx={{ width: 80, height: 80, border: '2px solid rgba(255,255,255,0.1)' }} />}
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{performerBio.name}</Typography>
                  {performerBio.aliases && performerBio.aliases.length > 0 && (
                     <Typography variant="body2" color="text.secondary">AKA: {performerBio.aliases.join(', ')}</Typography>
                  )}
                </Box>
              </Box>
              <Typography variant="body2" paragraph sx={{ lineHeight: 1.6 }}>{performerBio.bio}</Typography>
              {performerBio.measurements && (
                 <Typography variant="caption" color="text.secondary"><strong>Measurements:</strong> {performerBio.measurements}</Typography>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button onClick={() => setOpenBioDialog(false)} sx={{ borderRadius: '10px', textTransform: 'none', px: 2.5 }}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={!!generatedKey} 
        onClose={() => setGeneratedKey(null)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <KeyIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>API Key Generated</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="warning" sx={{ borderRadius: '10px' }}>Please copy this key now. For your security, it will never be shown again!</Alert>
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
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontFamily: 'monospace' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button onClick={handleCopyKey} variant="outlined" color="primary" startIcon={<ContentCopyIcon />} sx={{ borderRadius: '10px', textTransform: 'none' }}>Copy Key</Button>
          <Button variant="contained" onClick={() => setGeneratedKey(null)} sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}>I have copied it</Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={deleteConfirm.open} 
        onClose={() => setDeleteConfirm({ open: false, keyId: null })}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Revoke API Key</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">Revoke this API Key? Any scripts currently using it will immediately lose access.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirm({ open: false, keyId: null })} sx={{ borderRadius: '8px' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteApiKey} sx={{ borderRadius: '8px', fontWeight: 'bold' }}>Revoke Key</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity={snackbarSeverity} sx={{ width: '100%', borderRadius: '10px' }}>{snackbarMessage}</Alert>
      </Snackbar>
    </Box>
  )
}
