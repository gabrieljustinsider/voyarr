import { useState, useEffect, useCallback } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, LinearProgress, 
  Button, CircularProgress, Chip, Table, TableBody, TableCell, 
  TableContainer, TableRow, Paper, Alert, Accordion, AccordionSummary, AccordionDetails, Divider
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HelpIcon from '@mui/icons-material/Help'
import { apiFetch } from '../api'

export default function SystemStatus() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/system/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      } else {
        setError('Failed to fetch system status from the API.')
      }
    } catch (err) {
      setError(err.message || 'Network error fetching system status.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStatus()
    // Poll status every 15 seconds
    const interval = setInterval(fetchStatus, 15000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const getStatusIcon = (compStatus) => {
    if (compStatus === 'healthy') return <CheckCircleIcon color="success" />
    if (compStatus === 'unhealthy') return <ErrorIcon color="error" />
    return <HelpIcon color="action" />
  };

  const getStatusChipColor = (compStatus) => {
    if (compStatus === 'healthy') return 'success'
    if (compStatus === 'unhealthy') return 'error'
    return 'default'
  };

  if (loading && !status) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8 }}>
        <CircularProgress size={50} sx={{ mb: 2 }} />
        <Typography variant="body1" color="textSecondary">Querying project component health...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          System Status
        </Typography>
        <Button 
          variant="contained" 
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
          onClick={fetchStatus}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {status && (
        <Grid container spacing={3}>
          {/* Row 1: System Environment & Headless Scraper */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>System Environment</Typography>
                
                <Typography variant="body2" sx={{ fontWeight: 'bold' }} color="textSecondary">Host OS</Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>{status.environment?.os || 'Linux Container'}</Typography>
                
                <Typography variant="body2" sx={{ fontWeight: 'bold' }} color="textSecondary">Python Runtime</Typography>
                <Typography variant="body2" sx={{ mb: 3, fontStyle: 'italic', wordBreak: 'break-all' }}>
                  {status.environment?.python_version}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Disk Usage</Typography>

                {status.environment?.media_storage_disk?.total_gb && (
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Media Storage (/media/storage)</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {status.environment.media_storage_disk.percent_used}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={status.environment.media_storage_disk.percent_used} 
                      color={status.environment.media_storage_disk.percent_used > 85 ? 'error' : 'primary'}
                      sx={{ height: 10, borderRadius: 5, mb: 1 }}
                    />
                    <Typography variant="caption" color="textSecondary">
                      Used: {status.environment.media_storage_disk.used_gb} GB / Free: {status.environment.media_storage_disk.free_gb} GB (Total: {status.environment.media_storage_disk.total_gb} GB)
                    </Typography>
                  </Box>
                )}

                {status.environment?.app_disk?.total_gb && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Application Container Disk (/app)</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {status.environment.app_disk.percent_used}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={status.environment.app_disk.percent_used} 
                      color={status.environment.app_disk.percent_used > 85 ? 'error' : 'secondary'}
                      sx={{ height: 10, borderRadius: 5, mb: 1 }}
                    />
                    <Typography variant="caption" color="textSecondary">
                      Used: {status.environment.app_disk.used_gb} GB / Free: {status.environment.app_disk.free_gb} GB (Total: {status.environment.app_disk.total_gb} GB)
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Headless Browserless</Typography>
                  <Chip 
                    icon={getStatusIcon(status.browserless?.status)} 
                    label={status.browserless?.status?.toUpperCase()} 
                    color={getStatusChipColor(status.browserless?.status)}
                    variant="outlined"
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Dockerized Chromium engine providing headless scraping capabilities.
                </Typography>
                {status.browserless?.details && (
                  <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableBody>
                        {status.browserless.details.type && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Service Type</TableCell>
                            <TableCell>
                              <Chip 
                                label={status.browserless.details.type} 
                                color={status.browserless.details.type.includes("Cloud") ? "secondary" : "primary"} 
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Target WebSocket Endpoint</TableCell>
                          <TableCell sx={{ wordBreak: 'break-all' }}>{status.browserless.details.url}</TableCell>
                        </TableRow>
                        {status.browserless.details.error && (
                          <TableRow>
                            <TableCell colSpan={2} sx={{ color: 'error.main', fontSize: '0.85rem' }}>
                              <strong>Error:</strong> {status.browserless.details.error}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Row 2: Database & Redis */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Database</Typography>
                  <Chip 
                    icon={getStatusIcon(status.database?.status)} 
                    label={status.database?.status?.toUpperCase()} 
                    color={getStatusChipColor(status.database?.status)}
                    variant="outlined"
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Primary relational store for user accounts, credentials, and settings.
                </Typography>
                {status.database?.details && (
                  <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Engine / Dialect</TableCell>
                          <TableCell>{status.database.details.dialect || 'sqlite'}</TableCell>
                        </TableRow>
                        {status.database.details.url && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Host Connection</TableCell>
                            <TableCell sx={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>
                              {status.database.details.url}
                            </TableCell>
                          </TableRow>
                        )}
                        {status.database.details.error && (
                          <TableRow>
                            <TableCell colSpan={2} sx={{ color: 'error.main', fontSize: '0.85rem' }}>
                              <strong>Error:</strong> {status.database.details.error}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Redis</Typography>
                  <Chip 
                    icon={getStatusIcon(status.redis?.status)} 
                    label={status.redis?.status?.toUpperCase()} 
                    color={getStatusChipColor(status.redis?.status)}
                    variant="outlined"
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  In-memory data store used as the Celery task broker and rate limiter.
                </Typography>
                {status.redis?.details && (
                  <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableBody>
                        {status.redis.details.url && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Broker Address</TableCell>
                            <TableCell sx={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>
                              {status.redis.details.url}
                            </TableCell>
                          </TableRow>
                        )}
                        {status.redis.details.error && (
                          <TableRow>
                            <TableCell colSpan={2} sx={{ color: 'error.main', fontSize: '0.85rem' }}>
                              <strong>Error:</strong> {status.redis.details.error}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Row 3: Celery Background Workers */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Celery Workers</Typography>
                  <Chip 
                    icon={getStatusIcon(status.celery?.status)} 
                    label={status.celery?.status?.toUpperCase()} 
                    color={getStatusChipColor(status.celery?.status)}
                    variant="outlined"
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Asynchronous task daemon executing background metadata scans, transcodes, downloads, and scraping.
                </Typography>

                {status.celery?.details && (
                  <Box sx={{ mt: 2 }}>
                    {status.celery.details.active_workers?.length > 0 ? (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>Active Worker Daemons:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                          {status.celery.details.active_workers.map(worker => (
                            <Chip key={worker} label={worker} color="primary" size="small" variant="outlined" />
                          ))}
                        </Box>
                        
                        {/* Expandable worker details */}
                        {Object.keys(status.celery.details.stats || {}).map(workerKey => {
                          const workerStats = status.celery.details.stats[workerKey]
                          return (
                            <Accordion key={workerKey} variant="outlined" sx={{ mt: 1 }}>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                  Detailed Stats: {workerKey}
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <TableContainer component={Paper} variant="outlined">
                                  <Table size="small">
                                    <TableBody>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Concurrency</TableCell>
                                        <TableCell>{workerStats.pool?.max_concurrency || 'N/A'}</TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Broker Transport</TableCell>
                                        <TableCell>{workerStats.broker?.transport || 'redis'}</TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Processed Tasks Count</TableCell>
                                        <TableCell>
                                          {Object.values(workerStats.total || {}).reduce((a, b) => a + b, 0)}
                                        </TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </AccordionDetails>
                            </Accordion>
                          )
                        })}
                      </Box>
                    ) : (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        No active background task workers are connected to the broker. Background downloads and scans will remain queued.
                      </Alert>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  )
}
