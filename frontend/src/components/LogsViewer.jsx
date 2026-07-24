import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Box, Typography, Paper, Button, CircularProgress, Select, MenuItem, 
  TextField, FormControl, InputLabel, Stack, Tabs, Tab, Chip, Card, CardContent, Divider, Alert 
} from '@mui/material'
import TerminalIcon from '@mui/icons-material/Terminal'
import TrashIcon from '@mui/icons-material/DeleteForever'
import RefreshIcon from '@mui/icons-material/Refresh'
import apiFetch, { API_BASE, getAuthHeaders } from '../api'

export default function LogsViewer() {
  const [activeTab, setActiveTab] = useState(0) // 0: Raw Console Logs, 1: Categorized System Errors
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [logSource, setLogSource] = useState('celery')
  const [logLevel, setLogLevel] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Categorized Error Logs state
  const [errorLogs, setErrorLogs] = useState([])
  const [errorCategory, setErrorCategory] = useState('ALL')
  const [errorLoading, setErrorLoading] = useState(false)

  const bottomRef = useRef(null)
  const wsRef = useRef(null)

  const fetchErrorLogs = useCallback(async () => {
    setErrorLoading(true)
    try {
      const url = errorCategory !== 'ALL' ? `/logs/errors?category=${errorCategory}` : '/logs/errors'
      const res = await apiFetch(url)
      if (res.ok) {
        setErrorLogs(await res.json())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setErrorLoading(false)
    }
  }, [errorCategory])

  useEffect(() => {
    if (activeTab === 1) {
      fetchErrorLogs()
    }
  }, [activeTab, fetchErrorLogs])

  useEffect(() => {
    if (activeTab !== 0) return
    setLogs([])

    const headers = getAuthHeaders()
    let authQuery = ''
    if (headers['Authorization']) {
      authQuery = `token=${encodeURIComponent(headers['Authorization'].replace('Bearer ', ''))}`
    } else if (headers['X-Voyarr-Api-Key']) {
      authQuery = `api_key=${encodeURIComponent(headers['X-Voyarr-Api-Key'])}`
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = API_BASE.startsWith('http') 
      ? API_BASE.replace(/^https?/, protocol.replace(':', '')) + `/logs/ws?source=${logSource}&${authQuery}`
      : `${protocol}//${window.location.host}${API_BASE}/logs/ws?source=${logSource}&${authQuery}`;

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      setLogs((prevLogs) => {
        const newLogs = [...prevLogs, event.data]
        return newLogs.slice(-1000)
      })
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return () => {
      ws.close()
    }
  }, [logSource, activeTab])

  useEffect(() => {
    if (activeTab === 0) {
      bottomRef.current?.scrollIntoView()
    }
  }, [logs, logLevel, searchQuery, activeTab])

  const clearLogs = async () => {
    setLoading(true)
    try {
      await apiFetch(`/logs?source=${logSource}`, { method: 'DELETE' })
      setLogs([])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleClearErrorsImmediately = async () => {
    setErrorLoading(true)
    try {
      const res = await apiFetch('/logs/errors', { method: 'DELETE' })
      if (res.ok) {
        setErrorLogs([])
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'All system error logs cleared immediately!', severity: 'success' } }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setErrorLoading(false)
    }
  }

  const filteredLogs = logs.filter(log => {
    if (logLevel !== 'ALL' && !log.includes(logLevel)) return false
    if (searchQuery && !log.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const filteredErrorLogs = errorLogs.filter(err => {
    if (searchQuery && !err.message.toLowerCase().includes(searchQuery.toLowerCase()) && !err.user_friendly_explanation.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    return true
  })

  const getCategoryBadge = (category) => {
    if (category === 'local_dev') {
      return <Chip label="Local Dev Limitation" color="info" size="small" sx={{ fontWeight: 'bold' }} />
    }
    if (category === 'external_service') {
      return <Chip label="Unconnected External Layer" color="warning" size="small" sx={{ fontWeight: 'bold' }} />
    }
    return <Chip label="Fixable Application Bug" color="error" size="small" sx={{ fontWeight: 'bold' }} />
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5 }}>
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
          <Tab label="Live Console Logs" sx={{ fontWeight: 'bold' }} />
          <Tab label="System Error Diagnostics" sx={{ fontWeight: 'bold' }} />
        </Tabs>
      </Box>

      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        icon={<TerminalIcon fontSize="small" color="primary" />} 
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
          📋 Real-Time System Logs &amp; Error Diagnostics Console
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          System Logs streams live stdout/stderr console output from FastAPI, Celery scrapers, and Redis workers. The Diagnostics tab isolates fixable bugs, unconnected external layers, and local dev limitations with retention pruning.
        </Typography>
      </Alert>

      {activeTab === 0 ? (
        <>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, gap: 2, mb: 2 }}>
            <Typography variant="h5">Console Logs</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="stretch" sx={{ width: { xs: '100%', md: 'auto' } }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Source</InputLabel>
                <Select value={logSource} label="Source" onChange={(e) => setLogSource(e.target.value)} sx={{ minWidth: 120 }}>
                  <MenuItem value="celery">Celery</MenuItem>
                  <MenuItem value="fastapi">FastAPI</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Level</InputLabel>
                <Select value={logLevel} label="Level" onChange={(e) => setLogLevel(e.target.value)} sx={{ minWidth: 120 }}>
                  <MenuItem value="ALL">All Levels</MenuItem>
                  <MenuItem value="INFO">INFO</MenuItem>
                  <MenuItem value="WARNING">WARNING</MenuItem>
                  <MenuItem value="ERROR">ERROR</MenuItem>
                  <MenuItem value="DEBUG">DEBUG</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Search Console Logs"
                variant="outlined"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ flex: 2 }}
              />

              <Button variant="outlined" color="error" onClick={clearLogs} disabled={loading} sx={{ height: '40px', flex: 1 }}>
                {loading ? <CircularProgress size={24} /> : 'Clear'}
              </Button>
            </Stack>
          </Box>
          <Paper sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#00ff00', fontFamily: 'monospace', height: '65vh', overflowY: 'auto' }}>
            {filteredLogs.length === 0 ? (
              <Typography>No console logs matching criteria.</Typography>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={index} style={{ whiteSpace: 'pre-wrap' }}>{log}</div>
              ))
            )}
            <div ref={bottomRef} />
          </Paper>
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, gap: 2, mb: 2 }}>
            <Typography variant="h5">Categorized System Errors</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="stretch" sx={{ width: { xs: '100%', md: 'auto' } }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Category</InputLabel>
                <Select value={errorCategory} label="Category" onChange={(e) => setErrorCategory(e.target.value)} sx={{ minWidth: 160 }}>
                  <MenuItem value="ALL">All Error Categories</MenuItem>
                  <MenuItem value="local_dev">Local Dev Limitation</MenuItem>
                  <MenuItem value="external_service">Unconnected External Layer</MenuItem>
                  <MenuItem value="app_bug">Fixable Application Bug</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Search Error Messages"
                variant="outlined"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ flex: 2 }}
              />

              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchErrorLogs} disabled={errorLoading}>
                Refresh
              </Button>

              <Button 
                variant="contained" 
                color="error" 
                startIcon={<TrashIcon />} 
                onClick={handleClearErrorsImmediately} 
                disabled={errorLoading || errorLogs.length === 0}
                sx={{ height: '40px', flex: 1, fontWeight: 'bold' }}
              >
                Clear Errors Now
              </Button>
            </Stack>
          </Box>

          <Paper sx={{ p: 2, height: '65vh', overflowY: 'auto', bgcolor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {errorLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            ) : filteredErrorLogs.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">No error entries logged matching current filter.</Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {filteredErrorLogs.map((err) => (
                  <Card key={err.id} variant="outlined" sx={{ bgcolor: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <CardContent sx={{ pb: '16px !important' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getCategoryBadge(err.category)}
                          <Chip label={err.source || 'frontend'} variant="outlined" size="small" sx={{ fontSize: '0.7rem' }} />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(err.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#f87171', mb: 0.5 }}>
                        {err.message}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#818cf8', fontWeight: '500', mb: 1 }}>
                        💡 {err.user_friendly_explanation}
                      </Typography>
                      {err.path && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Location: <code>{err.path}</code>
                        </Typography>
                      )}
                      {err.stack_trace && (
                        <Box sx={{ mt: 1, p: 1, bgcolor: '#0b0f19', borderRadius: 1, maxHeight: 100, overflowY: 'auto' }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap' }}>
                            {err.stack_trace}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Paper>
        </>
      )}
    </Box>
  )
}