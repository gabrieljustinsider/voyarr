import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Button, CircularProgress, Select, MenuItem, TextField, FormControl, InputLabel, Stack } from '@mui/material'
import apiFetch, { API_BASE, getAuthHeaders } from '../api'

export default function LogsViewer() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [logSource, setLogSource] = useState('celery')
  const [logLevel, setLogLevel] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const bottomRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    // Reset logs when source changes
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
  }, [logSource])

  useEffect(() => {
    bottomRef.current?.scrollIntoView() // Remove smooth scrolling to prevent animation queue thrashing on high volume logs
  }, [logs, logLevel, searchQuery])

  const clearLogs = async () => {
    setLoading(true)
    try {
      await apiFetch(`/logs?source=${logSource}`, {
        method: 'DELETE'
      })
      setLogs([])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const filteredLogs = logs.filter(log => {
    if (logLevel !== 'ALL' && !log.includes(logLevel)) return false
    if (searchQuery && !log.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, gap: 2, mb: 2 }}>
        <Typography variant="h4" sx={{ textAlign: { xs: 'center', md: 'left' } }}>System Logs</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="stretch" sx={{ width: { xs: '100%', md: 'auto' } }}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Source</InputLabel>
            <Select
              value={logSource}
              label="Source"
              onChange={(e) => setLogSource(e.target.value)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="celery">Celery</MenuItem>
              <MenuItem value="fastapi">FastAPI</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Level</InputLabel>
            <Select
              value={logLevel}
              label="Level"
              onChange={(e) => setLogLevel(e.target.value)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="ALL">All Levels</MenuItem>
              <MenuItem value="INFO">INFO</MenuItem>
              <MenuItem value="WARNING">WARNING</MenuItem>
              <MenuItem value="ERROR">ERROR</MenuItem>
              <MenuItem value="DEBUG">DEBUG</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Search"
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
      <Paper sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#00ff00', fontFamily: 'monospace', height: '70vh', overflowY: 'auto' }}>
        {filteredLogs.length === 0 ? (
          <Typography>No logs available matching criteria.</Typography>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} style={{ whiteSpace: 'pre-wrap' }}>{log}</div>
          ))
        )}
        <div ref={bottomRef} />
      </Paper>
    </Box>
  )
}