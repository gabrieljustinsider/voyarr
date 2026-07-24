import { useState, useEffect } from 'react'
import {
  Box, Button, Card, CardContent, TextField, Typography, 
  Alert, CircularProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, IconButton, InputAdornment, Grid,
  Switch, FormControlLabel, Divider
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { apiFetch } from '../api'

export default function UniversalSearch() {
  const [universalQuery, setUniversalQuery] = useState('')
  const [universalResults, setUniversalResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [tpdbKey, setTpdbKey] = useState('')
  const [stashdbKey, setStashdbKey] = useState('')
  const [onlyfansEnabled, setOnlyfansEnabled] = useState(true)
  const [fanslyEnabled, setFanslyEnabled] = useState(true)
  const [patreonEnabled, setPatreonEnabled] = useState(true)
  const [loyalfansEnabled, setLoyalfansEnabled] = useState(true)

  const [openSyncDialog, setOpenSyncDialog] = useState(false)
  const [selectedResult, setSelectedResult] = useState(null)
  const [selectedResultSource, setSelectedResultSource] = useState('') // 'theporndb' or 'stashdb'

  // Load API keys & platform settings from global settings on mount
  useEffect(() => {
    const loadGlobalSettings = async () => {
      try {
        const response = await apiFetch('/settings')
        if (response.ok) {
          const data = await response.json()
          if (data.tpdb_api_key) setTpdbKey(data.tpdb_api_key)
          if (data.stashdb_api_key) setStashdbKey(data.stashdb_api_key)
          if (data.universal_search_onlyfans !== undefined) setOnlyfansEnabled(data.universal_search_onlyfans === 'true')
          if (data.universal_search_fansly !== undefined) setFanslyEnabled(data.universal_search_fansly === 'true')
          if (data.universal_search_patreon !== undefined) setPatreonEnabled(data.universal_search_patreon === 'true')
          if (data.universal_search_loyalfans !== undefined) setLoyalfansEnabled(data.universal_search_loyalfans === 'true')
        }
      } catch (error) {
        console.error('Failed to load global API keys in UniversalSearch:', error)
      }
    }
    loadGlobalSettings()
  }, [])

  const handleSaveGlobalSetting = async (key, value) => {
    try {
      await apiFetch('/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value })
      })
    } catch (error) {
      console.error(`Error saving global setting ${key}:`, error)
    }
  }

  const handleTogglePlatform = async (platformName, enabled) => {
    if (platformName === 'onlyfans') setOnlyfansEnabled(enabled)
    if (platformName === 'fansly') setFanslyEnabled(enabled)
    if (platformName === 'patreon') setPatreonEnabled(enabled)
    if (platformName === 'loyalfans') setLoyalfansEnabled(enabled)
    
    await handleSaveGlobalSetting(`universal_search_${platformName}`, String(enabled))
  }

  const handleUniversalSearch = async () => {
    if (!universalQuery) {
      setMessage('Please enter a search query')
      return
    }

    setLoading(true)
    setUniversalResults(null)
    try {
      const response = await apiFetch('/external-api/universal-search', {
        method: 'POST',
        body: JSON.stringify({
          query: universalQuery
        })
      })

      if (response.ok) {
        const data = await response.json()
        setUniversalResults(data)
        setMessage('')
      } else {
        setMessage('Universal search failed')
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
        Universal Search
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Universal Aggregated Search</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Search across local media, remote standard databases, and active subscription platforms in a single interface.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
            <TextField
              fullWidth
              label="Search handle, performer or scene..."
              value={universalQuery}
              onChange={(e) => setUniversalQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUniversalSearch()}
              slotProps={{ input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleUniversalSearch} disabled={loading}>
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}}
            />
            <Button 
              variant="contained" 
              onClick={handleUniversalSearch}
              disabled={loading}
              sx={{ height: 56, px: 4 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Search'}
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Enabled Subscription Search Indices:</Typography>
          <Grid container spacing={2}>
            <Grid xs={6} sm={3}>
              <FormControlLabel
                control={<Switch checked={onlyfansEnabled} onChange={(e) => handleTogglePlatform('onlyfans', e.target.checked)} />}
                label="OnlyFans"
              />
            </Grid>
            <Grid xs={6} sm={3}>
              <FormControlLabel
                control={<Switch checked={fanslyEnabled} onChange={(e) => handleTogglePlatform('fansly', e.target.checked)} />}
                label="Fansly"
              />
            </Grid>
            <Grid xs={6} sm={3}>
              <FormControlLabel
                control={<Switch checked={patreonEnabled} onChange={(e) => handleTogglePlatform('patreon', e.target.checked)} />}
                label="Patreon"
              />
            </Grid>
            <Grid xs={6} sm={3}>
              <FormControlLabel
                control={<Switch checked={loyalfansEnabled} onChange={(e) => handleTogglePlatform('loyalfans', e.target.checked)} />}
                label="LoyalFans"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {message && (
        <Alert severity={message.includes('Error') || message.includes('Failed') ? 'error' : 'info'} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      {universalResults && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Local Library Hits */}
          {universalResults.local?.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>Local Library Matches</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>Performers</TableCell>
                        <TableCell>File Path</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {universalResults.local.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell><strong>{entry.title}</strong></TableCell>
                          <TableCell>{entry.performers?.map(p => p.name || p).join(', ') || 'None'}</TableCell>
                          <TableCell sx={{ fontStyle: 'italic', fontSize: '0.8rem' }}>{entry.url}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Subscription Matches */}
          {universalResults.subscriptions?.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" color="secondary" gutterBottom>Subscription Platforms Matches</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Platform</TableCell>
                        <TableCell>Handle</TableCell>
                        <TableCell>Display Name</TableCell>
                        <TableCell>Teaser / Preview Metadata</TableCell>
                        <TableCell>Cross-Referencing</TableCell>
                        <TableCell>Cookie Sync</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {universalResults.subscriptions.map((sub, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Chip 
                              size="small" 
                              label={sub.platform} 
                              color={sub.platform === 'OnlyFans' ? 'info' : sub.platform === 'Fansly' ? 'secondary' : 'default'}
                            />
                          </TableCell>
                          <TableCell><strong>{sub.handle}</strong></TableCell>
                          <TableCell>{sub.name}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontStyle: sub.metadata.subscriber_only ? 'italic' : 'normal', color: sub.metadata.subscriber_only ? 'text.secondary' : 'text.primary' }}>
                              {sub.metadata.teaser_preview}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {sub.cross_referenced_performers?.length > 0 ? (
                              sub.cross_referenced_performers.map((p, i) => (
                                <Chip key={i} size="small" variant="outlined" label={`Matched: ${p}`} color="success" sx={{ mr: 0.5 }} />
                              ))
                            ) : (
                              <Typography variant="caption" color="text.secondary">No cross-ref matched</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              size="small" 
                              label={sub.metadata.subscriber_only ? 'No Active Cookie' : 'Synced'} 
                              color={sub.metadata.subscriber_only ? 'default' : 'success'} 
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Remote StashDB Hits */}
          {universalResults.stashdb?.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#9c27b0' }} gutterBottom>StashDB Registry Matches</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>Performers</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {universalResults.stashdb.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell><strong>{item.title}</strong></TableCell>
                          <TableCell>{item.performers?.map(p => p.name || p).join(', ') || 'None'}</TableCell>
                          <TableCell>
                            <Button size="small" onClick={() => { setSelectedResult(item); setSelectedResultSource('stashdb'); setOpenSyncDialog(true); }}>
                              Sync Stats
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Remote ThePornDB Hits */}
          {universalResults.theporndb?.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#009688' }} gutterBottom>ThePornDB Registry Matches</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>Performers</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {universalResults.theporndb.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell><strong>{item.title}</strong></TableCell>
                          <TableCell>{item.performers?.map(p => p.name || p).join(', ') || 'None'}</TableCell>
                          <TableCell>
                            <Button size="small" onClick={() => { setSelectedResult(item); setSelectedResultSource('theporndb'); setOpenSyncDialog(true); }}>
                              Sync Stats
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

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
          {selectedResultSource === 'theporndb' && (
            <Button onClick={handleSyncToThePornDB} variant="contained">
              Sync to ThePornDB
            </Button>
          )}
          {selectedResultSource === 'stashdb' && (
            <Button onClick={handleSyncToStashDB} variant="contained">
              Sync to StashDB
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
