import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material'

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

export default function LogsViewer() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/logs?lines=300`, {
        headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [fetchLogs])

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