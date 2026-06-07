import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, LinearProgress, IconButton, Chip, Tooltip, Card, 
  CardContent 
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

  const fetchJobs = useCallback(async () => {
    try {
      const res = await apiFetch('/transcode/')
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

  return (
    <Card sx={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon color="primary" /> Transcoding queue
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              Track active, pending, and completed h265 and AV1 transcode processes.
            </Typography>
          </Box>
        </Box>

        {jobs.length === 0 ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ opacity: 0.5 }}>No transcoding jobs currently in queue.</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Target Codec</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Priority</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Progress</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} hover>
                    <TableCell sx={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Tooltip title={job.title || `Entry ${job.library_entry_id}`}>
                        <Typography sx={{ fontWeight: '600', fontSize: '0.9rem' }}>
                          {job.title || `Entry ${job.library_entry_id}`}
                        </Typography>
                      </Tooltip>
                      {job.details && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {job.details}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={job.target_codec?.toUpperCase()} size="small" variant="outlined" color="primary" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                    <TableCell>
                      <Chip 
                        label={job.status.toUpperCase()} 
                        size="small" 
                        color={
                          job.status === 'completed' ? 'success' :
                          job.status === 'running' ? 'info' :
                          job.status === 'paused' ? 'warning' :
                          job.status === 'failed' ? 'error' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: '150px' }}>
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
                    <TableCell align="right">
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
