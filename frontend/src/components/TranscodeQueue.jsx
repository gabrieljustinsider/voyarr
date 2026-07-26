import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Button, Typography, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, LinearProgress, IconButton, Chip, Tooltip, Card, 
  CardContent, Alert
} from '@mui/material'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CancelIcon from '@mui/icons-material/Cancel'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteIcon from '@mui/icons-material/Delete'
import StorageIcon from '@mui/icons-material/Storage'
import { apiFetch, getAuthHeaders } from '../api'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export default function TranscodeQueue() {
  const [jobs, setJobs] = useState([])
  const [statusFilter, setStatusFilter] = useState('')

  const fetchJobs = useCallback(async () => {
    try {
      const res = await apiFetch('/transcode')
      if (res.ok) {
        const data = await res.json()
        setJobs(data)
      }
    } catch (e) {
      console.error('Failed to fetch transcoding jobs:', e)
    }
  }, [])

  useEffect(() => {
    fetchJobs()

    const abortController = new AbortController()
    const startSSE = async () => {
      try {
        const res = await fetch(`${API_BASE}/transcode/stream`, {
          headers: getAuthHeaders(),
          signal: abortController.signal
        })
        if (res.status === 403) {
          console.warn('Access forbidden to /transcode/stream. SSE streaming disabled.')
          return
        }
        if (!res.ok) {
          throw new Error(`Transcode stream HTTP error! Status: ${res.status}`)
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const sseJobs = JSON.parse(line.substring(6))
                // Merge static completed/failed jobs from state or let fetchJobs handle full view
                // For a smooth experience, update local jobs state with SSE updates
                setJobs(prevJobs => {
                  const sseIds = sseJobs.map(j => j.id)
                  const completedOrFailed = prevJobs.filter(j => !sseIds.includes(j.id) && ['completed', 'failed', 'cancelled'].includes(j.status))
                  return [...sseJobs, ...completedOrFailed]
                })
              } catch (e) {
                console.debug('JSON Parse error', e)
              }
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError' && !abortController.signal.aborted) {
          setTimeout(() => {
            if (!abortController.signal.aborted) startSSE()
          }, 5000)
        }
      }
    }

    startSSE()
    return () => abortController.abort()
  }, [fetchJobs])

  const handleAction = async (jobId, action) => {
    try {
      const res = await apiFetch(`/transcode/${jobId}/${action}`, {
        method: 'POST'
      })
      if (res.ok) {
        fetchJobs()
      } else {
        const err = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.detail || 'Action failed.', severity: 'error' } }))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteJob = async (jobId) => {
    const confirm = await window.appConfirm('Are you sure you want to remove this transcode job from the database?')
    if (!confirm) return
    try {
      const res = await apiFetch(`/transcode/${jobId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setJobs(jobs.filter(j => j.id !== jobId))
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Transcode job removed.', severity: 'success' } }))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const filteredJobs = statusFilter ? (jobs || []).filter(j => j.status === statusFilter) : (jobs || [])

  return (
    <Card sx={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', maxWidth: 1400, mx: 'auto', width: '100%', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: 1.5, letterSpacing: '-0.5px' }}>
              <StorageIcon color="primary" sx={{ fontSize: 28 }} /> Transcoding Queue
            </Typography>
          </Box>
        </Box>

        {/* Purpose Banner */}
        <Alert 
          severity="info" 
          icon={<StorageIcon fontSize="small" />} 
          sx={{ 
            borderRadius: '12px', 
            bgcolor: 'rgba(14, 165, 233, 0.08)', 
            color: '#38bdf8',
            border: '1px solid rgba(14, 165, 233, 0.2)',
            '& .MuiAlert-icon': { color: '#0284c7' } 
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
            ⚙️ Hardware Transcoding &amp; Codec Optimization
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
            The Transcoding Queue optimizes downloaded video files into web-compatible formats (H.264/MP4, HEVC, AV1). This ensures universal stream playback across mobile devices and browsers without buffering or missing codec errors.
          </Typography>
        </Alert>

        {/* Status summary + filter */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {['all', 'running', 'pending', 'paused', 'completed', 'failed'].map(s => {
              const count = s === 'all' ? (jobs || []).length : (jobs || []).filter(j => j.status === s).length
              return (
                <Chip key={s} label={`${s.charAt(0).toUpperCase() + s.slice(1)} (${count})`} size="small"
                  clickable onClick={() => setStatusFilter(s === 'all' ? '' : s)}
                  color={statusFilter === s || (s === 'all' && !statusFilter) ? 'primary' : 'default'}
                  variant={statusFilter === s || (s === 'all' && !statusFilter) ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                />
              )
            })}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {(jobs || []).some(j => j.status === 'running') && (
              <Button size="small" variant="outlined" color="warning" onClick={() => (jobs || []).filter(j => j.status === 'running').forEach(j => handleAction(j.id, 'pause'))}
                sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem' }}>Pause All</Button>
            )}
            {(jobs || []).some(j => j.status === 'paused') && (
              <Button size="small" variant="outlined" color="success" onClick={() => (jobs || []).filter(j => j.status === 'paused').forEach(j => handleAction(j.id, 'resume'))}
                sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem' }}>Resume All</Button>
            )}
            {(jobs || []).some(j => ['completed', 'failed', 'cancelled'].includes(j.status)) && (
              <Button size="small" variant="outlined" color="default" onClick={() => (jobs || []).filter(j => ['completed', 'failed', 'cancelled'].includes(j.status)).forEach(j => handleAction(j.id, 'delete'))}
                sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem' }}>Clear All</Button>
            )}
          </Box>
        </Box>

        {(jobs || []).length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.08)', borderRadius: '14px' }}>
            <StorageIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography variant="body2" sx={{ opacity: 0.6 }}>No transcoding jobs currently active in queue.</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} sx={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
                <TableRow>
                  <TableCell align="left" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', py: 1.5, pl: 2 }}>Title & Details</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', py: 1.5 }}>Target Codec</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', py: 1.5 }}>Priority</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', py: 1.5 }}>Status</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', py: 1.5 }}>Progress</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', py: 1.5, pr: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow key={job.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell align="left" sx={{ maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pl: 2 }}>
                      <Tooltip title={job.title || `Entry ${job.library_entry_id}`}>
                        <Typography sx={{ fontWeight: '600', fontSize: '0.9rem' }} noWrap>
                          {job.title || `Entry ${job.library_entry_id}`}
                        </Typography>
                      </Tooltip>
                      {job.details && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                          {job.details}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Chip label={job.target_codec?.toUpperCase()} size="small" variant="outlined" color="primary" sx={{ fontWeight: 'bold' }} />
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: 20 }}>{job.priority}</Typography>
                        {['pending', 'paused'].includes(job.status) && (
                          <>
                            <IconButton size="small" onClick={() => handleAction(job.id, 'priority/up')} color="primary">
                              <ArrowUpwardIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleAction(job.id, 'priority/down')} color="primary">
                              <ArrowDownwardIcon fontSize="inherit" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Chip 
                        label={job.status.toUpperCase()} 
                        size="small" 
                        color={
                          job.status === 'completed' ? 'success' :
                          job.status === 'running' ? 'info' :
                          job.status === 'paused' ? 'warning' :
                          job.status === 'failed' ? 'error' : 'default'
                        }
                        sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ minWidth: '160px', whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={job.progress_percentage || 0} 
                            color={job.status === 'paused' ? 'warning' : 'primary'}
                            sx={{ borderRadius: 5, height: 6 }}
                          />
                        </Box>
                        <Box sx={{ minWidth: 35 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            {Math.round(job.progress_percentage || 0)}%
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: 2 }}>
                      <Box sx={{ display: 'inline-flex', gap: 1 }}>
                        {job.status === 'running' && (
                          <Tooltip title="Pause Task">
                            <IconButton color="warning" size="small" onClick={() => handleAction(job.id, 'pause')}>
                              <PauseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {job.status === 'paused' && (
                          <Tooltip title="Resume Task">
                            <IconButton color="success" size="small" onClick={() => handleAction(job.id, 'resume')}>
                              <PlayArrowIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {['running', 'paused', 'pending'].includes(job.status) && (
                          <Tooltip title="Cancel Task">
                            <IconButton color="error" size="small" onClick={() => handleAction(job.id, 'cancel')}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {['completed', 'failed', 'cancelled'].includes(job.status) && (
                          <Tooltip title="Remove Job">
                            <IconButton color="error" size="small" onClick={() => handleDeleteJob(job.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  )
}
