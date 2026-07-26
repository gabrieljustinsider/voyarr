import { useState, useEffect, useRef } from 'react'
import { Box, Typography, LinearProgress, Tooltip, Paper, Chip, CircularProgress } from '@mui/material'
import { apiFetch } from '../api'

const SCAN_API_BASE = import.meta.env.VITE_API_BASE || '/api'

export default function ScannerProgress({ taskId, onComplete }) {
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState('')
  const [currentFile, setCurrentFile] = useState('')
  const [scanned, setScanned] = useState(0)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('pending')
  const [result, setResult] = useState(null)
  const esRef = useRef(null)

  const getAuthQuery = () => {
    const token = localStorage.getItem('voyarr_jwt')
    if (token) return `token=${encodeURIComponent(token)}`
    let apiKey = localStorage.getItem('voyarr_api_key')
    if (apiKey) { try { apiKey = atob(apiKey) } catch {} }
    return `api_key=${encodeURIComponent(apiKey || '')}`
  }

  useEffect(() => {
    if (!taskId) return
    const es = new EventSource(`${SCAN_API_BASE}/external-api/library/scan/stream/${taskId}?${getAuthQuery()}`)
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.status === 'success') {
          setProgress(100)
          setStep('Complete')
          setStatus('success')
          setResult(data.result || {})
          es.close()
          if (onComplete) onComplete(data.result)
        } else if (data.status === 'failed') {
          setStatus('failed')
          setStep('Failed')
          es.close()
          if (onComplete) onComplete(null)
        } else {
          setStatus(data.status || 'running')
          if (data.progress !== undefined) setProgress(data.progress)
          if (data.step) setStep(data.step)
          if (data.current_file) setCurrentFile(data.current_file)
          if (data.scanned !== undefined) setScanned(data.scanned)
          if (data.total !== undefined) setTotal(data.total)
        }
      } catch {}
    }

    es.onerror = () => {}

    return () => { es.close() }
  }, [taskId])

  if (!taskId) return null

  const tooltipContent = (
    <Box sx={{ fontSize: '0.8rem' }}>
      {step && <div>{step}</div>}
      {currentFile && <div style={{ opacity: 0.7, fontFamily: 'monospace', fontSize: '0.75rem' }}>{currentFile}</div>}
      {total > 0 && <div style={{ marginTop: 4 }}>{scanned} / {total} files</div>}
    </Box>
  )

  return (
    <Paper sx={{ p: 2, mb: 2, borderRadius: '12px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        {status !== 'success' && status !== 'failed' ? (
          <CircularProgress size={18} color="primary" />
        ) : status === 'success' ? (
          <Chip label="Complete" color="success" size="small" />
        ) : (
          <Chip label="Failed" color="error" size="small" />
        )}
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Library Scan</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>{progress}%</Typography>
      </Box>
      <Tooltip title={tooltipContent} placement="bottom">
        <LinearProgress
          variant={progress > 0 && progress < 100 ? 'determinate' : 'indeterminate'}
          value={progress > 0 ? progress : undefined}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Tooltip>
      {step && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
          {step}
        </Typography>
      )}
      {result && result.processed_files !== undefined && (
        <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5, fontWeight: 'bold' }}>
          Processed {result.processed_files} new file(s)
        </Typography>
      )}
    </Paper>
  )
}
