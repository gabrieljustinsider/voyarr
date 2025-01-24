import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Button, Paper, Grid, Checkbox, FormControlLabel, CircularProgress, Alert, Divider } from '@mui/material'
import apiFetch from '../api'

const BACKUP_API = '/backup'

export default function BackupManager() {
  const [tables, setTables] = useState([])
  const [selectedTables, setSelectedTables] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [verifyData, setVerifyData] = useState(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    apiFetch(`${BACKUP_API}/tables`)
      .then(res => res.json())
      .then(data => {
        if (data.tables) {
          setTables(data.tables)
          setSelectedTables(data.tables) // Select all by default
        }
      })
      .catch(err => console.error("Failed to fetch tables:", err))
  }, [])

  const handleToggleTable = (tableName) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    )
  }

  const handleToggleAll = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([])
    } else {
      setSelectedTables(tables)
    }
  }

  const handleExport = async (type) => {
    setLoading(true)
    setMessage(null)
    try {
      let url = `${BACKUP_API}/export?type=${type}`
      if (type === 'custom') {
        if (selectedTables.length === 0) {
          setMessage({ type: 'error', text: 'Please select at least one table for a custom backup.' })
          setLoading(false)
          return
        }
        url += `&tables=${selectedTables.join(',')}`
      }

      const res = await apiFetch(url)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Export failed')
      }
      
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `voyarr_${type}_backup_${new Date().toISOString().slice(0,10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)
      
      setMessage({ type: 'success', text: `Successfully exported ${type} backup!` })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
    setLoading(false)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadFile(file)
    setVerifyData(null)
    setRestoreMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await apiFetch(`${BACKUP_API}/verify`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok && data.valid) setVerifyData(data)
      else setRestoreMessage({ type: 'error', text: data.message || 'Invalid backup file' })
    } catch (err) {
      setRestoreMessage({ type: 'error', text: err.message })
    }
  }

  const handleRestore = async () => {
    if (!uploadFile) return
    setRestoreLoading(true)
    setRestoreMessage(null)

    const formData = new FormData()
    formData.append('file', uploadFile)

    try {
      const res = await apiFetch(`${BACKUP_API}/restore`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Restore failed')
      
      setRestoreMessage({ type: 'success', text: data.message || 'Restore completed successfully!' })
      setUploadFile(null)
      setVerifyData(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setRestoreMessage({ type: 'error', text: err.message })
    }
    setRestoreLoading(false)
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Backup & Restore</Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Export Data</Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Select the tables you wish to include in your custom backup.
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Button size="small" variant="outlined" onClick={handleToggleAll} sx={{ mb: 1 }}>
            Toggle All
          </Button>
          <Grid container spacing={1}>
            {tables.map(table => (
              <Grid item xs={12} sm={6} md={4} key={table}>
                <FormControlLabel
                  control={<Checkbox checked={selectedTables.includes(table)} onChange={() => handleToggleTable(table)} />}
                  label={table}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button variant="contained" color="primary" onClick={() => handleExport('full')} disabled={loading}>Full Backup</Button>
          <Button variant="contained" color="secondary" onClick={() => handleExport('custom')} disabled={loading || selectedTables.length === 0}>Custom Backup</Button>
          <Button variant="outlined" onClick={() => handleExport('settings')} disabled={loading}>Settings Only</Button>
        </Box>
        
        {loading && <CircularProgress size={24} sx={{ mt: 2 }} />}
        {message && <Alert severity={message.type} sx={{ mt: 2 }}>{message.text}</Alert>}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Restore Data</Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2" sx={{ mb: 2 }}>
          Upload a previously exported JSON backup to restore your data.
        </Typography>
        
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
          <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
          <Button variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={restoreLoading}>
            Select Backup File
          </Button>
          {uploadFile && <Typography component="span" sx={{ ml: 2, color: 'text.secondary' }}>{uploadFile.name}</Typography>}
        </Box>

        {verifyData && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Ready to restore <strong>{verifyData.type}</strong> backup. Includes {verifyData.table_count} tables and {verifyData.record_count} total records.
          </Alert>
        )}

        <Button variant="contained" color="warning" onClick={handleRestore} disabled={!verifyData || restoreLoading}>
          {restoreLoading ? <CircularProgress size={24} /> : 'Execute Restore'}
        </Button>

        {restoreMessage && <Alert severity={restoreMessage.type} sx={{ mt: 2 }}>{restoreMessage.text}</Alert>}
      </Paper>
    </Box>
  )
}