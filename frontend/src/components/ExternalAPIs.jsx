import { useState } from 'react'
import {
  Box, Button, Card, CardContent, TextField, Typography, 
  Alert, CircularProgress, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip
} from '@mui/material'
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
    <Box>
      <Typography variant="h4" gutterBottom>
        External API Integration
      </Typography>

      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="ThePornDB" />
        <Tab label="StashDB" />
      </Tabs>

      {/* ThePornDB */}
      <TabPanel value={tabValue} index={0}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>ThePornDB Configuration</Typography>
            <TextField
              fullWidth
              label="API Key"
              type="password"
              value={tpdbKey}
              onChange={(e) => setTpdbKey(e.target.value)}
              margin="normal"
            />
            <Typography variant="caption" color="textSecondary">
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
              />
              <Button variant="contained" onClick={handleSearchThePornDB} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : 'Search'}
              </Button>
            </Box>

            {message && (
              <Alert severity={message.includes('Error') ? 'error' : 'success'} sx={{ mb: 2 }}>
                {message}
              </Alert>
            )}

            {results.length > 0 && (
              <TableContainer component={Paper}>
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
                        <TableCell>{result.title}</TableCell>
                        <TableCell>
                          {result.performers?.slice(0, 2).map(p => (
                            <Chip key={p.name || p} label={p.name || p} size="small" sx={{ mr: 0.5 }} />
                          ))}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
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
            <TextField
              fullWidth
              label="API Key"
              type="password"
              value={stashdbKey}
              onChange={(e) => setStashdbKey(e.target.value)}
              margin="normal"
            />
            <Typography variant="caption" color="textSecondary">
              Get your API key from <a href="https://stashdb.org" target="_blank" rel="noreferrer">stashdb.org</a>
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
              />
              <Button variant="contained" onClick={handleSearchStashDB} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : 'Search'}
              </Button>
            </Box>

            {message && (
              <Alert severity={message.includes('Error') ? 'error' : 'success'} sx={{ mb: 2 }}>
                {message}
              </Alert>
            )}

            {results.length > 0 && (
              <TableContainer component={Paper}>
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
                        <TableCell>{result.title}</TableCell>
                        <TableCell>
                          {result.performers?.slice(0, 2).map(p => (
                            <Chip key={p.name} label={p.name} size="small" sx={{ mr: 0.5 }} />
                          ))}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
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
    </Box>
  )
}
