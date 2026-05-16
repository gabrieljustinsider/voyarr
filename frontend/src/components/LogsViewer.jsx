import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material'

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

export default function LogsViewer() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    const wsUrl = API_BASE.replace(/^http/, 'ws') + `/logs/ws?api_key=${import.meta.env.VITE_MASTER_KEY}`
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
      await fetch(`${API_BASE}/logs`, {
        method: 'DELETE',
        headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
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