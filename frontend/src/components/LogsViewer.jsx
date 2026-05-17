import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material'
import apiFetch, { API_BASE, getAuthHeaders } from '../api'

export default function LogsViewer() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    const headers = getAuthHeaders()
    let authQuery = ''
    if (headers['Authorization']) {
      authQuery = `token=${encodeURIComponent(headers['Authorization'].replace('Bearer ', ''))}`
    } else if (headers['X-Voyarr-Api-Key']) {
      authQuery = `api_key=${encodeURIComponent(headers['X-Voyarr-Api-Key'])}`
    }

    const wsUrl = API_BASE.replace(/^http/, 'ws') + `/logs/ws?${authQuery}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      setLogs((prevLogs) => {
        const newLogs = [...prevLogs, event.data]
        // Keep only the last 1000 logs to prevent memory issues
        return newLogs.slice(-1000)
      })
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const clearLogs = async () => {
    setLoading(true)
    try {
      await apiFetch('/logs', {
        method: 'DELETE'
      })
      setLogs([])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">System Logs</Typography>
        <Button variant="outlined" color="error" onClick={clearLogs} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Clear Logs'}
        </Button>
      </Box>
      <Paper sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#00ff00', fontFamily: 'monospace', height: '70vh', overflowY: 'auto' }}>
        {logs.length === 0 ? (
          <Typography>No logs available.</Typography>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ whiteSpace: 'pre-wrap' }}>{log}</div>
          ))
        )}
        <div ref={bottomRef} />
      </Paper>
    </Box>
  )
}