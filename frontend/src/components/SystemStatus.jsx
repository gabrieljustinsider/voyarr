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
import CircleIcon from '@mui/icons-material/Circle'
import { apiFetch } from '../api'

const LAYERS = [
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend_api', label: 'Backend API' },
  { key: 'workers', label: 'Workers' },
  { key: 'database', label: 'Database' },
  { key: 'redis', label: 'Redis' },
  { key: 'scraper', label: 'Scraper' },
]

const SERVICE_NAMES = {
  'cloudflare-pages': 'Cloudflare Pages',
  'docker': 'Docker',
  'neon': 'Neon',
  'browserless-io': 'browserless.io',
}

export default function SystemStatus() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [liveTime, setLiveTime] = useState(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/system/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      } else if (res.status === 404) {
        setError(
          'API returned 404 on system status request. This usually indicates that the ' +
          'backend router is running behind an Nginx or Cloudflare prefix but the ' +
          'ROOT_PATH environment variable is mismatched or missing in the backend .env configuration.'
        )
      } else {
        setError(`Failed to fetch system status from the API (Status ${res.status}).`)
      }
    } catch (err) {
      const isCors = err.message && (
        err.message.includes('CORS') || 
        err.message.includes('fetch') || 
        err.message.includes('Failed to fetch')
      )
      if (isCors) {
        setError(
          'Network connection blocked: This could be a CORS policy block or a networking resolution failure. ' +
          'Verify that the backend environment has CORS_ORIGINS configured correctly to allow your frontend origin: ' +
          `${window.location.origin}. Also check that ROOT_PATH is aligned if you run behind reverse proxies.`
        )
      } else {
        setError(err.message || 'Network error fetching system status.')
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 15000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    if (!status?.environment?.system_time) return

    const { date, time, timezone } = status.environment.system_time
    const serverDateStr = `${date}T${time}`
    const serverTimeMs = new Date(serverDateStr).getTime()
    const clientTimeMs = Date.now()
    const offsetMs = isNaN(serverTimeMs) ? 0 : serverTimeMs - clientTimeMs

    const updateClock = () => {
      const currentServerTime = new Date(Date.now() + offsetMs)
      
      const pad = (num) => String(num).padStart(2, '0')
      const yy = currentServerTime.getFullYear()
      const mm = pad(currentServerTime.getMonth() + 1)
      const dd = pad(currentServerTime.getDate())
      const hh = pad(currentServerTime.getHours())
      const min = pad(currentServerTime.getMinutes())
      const ss = pad(currentServerTime.getSeconds())

      setLiveTime({
        date: `${yy}-${mm}-${dd}`,
        time: `${hh}:${min}:${ss}`,
        timezone: timezone
      })
    }

    updateClock()
    const clockInterval = setInterval(updateClock, 1000)
    return () => clearInterval(clockInterval)
  }, [status])

  const getLayerStatus = (key) => {
    const config = status?.config?.[key]
    const target = config?.target || 'docker'
    const service = SERVICE_NAMES[target] || target

    switch (key) {
      case 'frontend':
        return { status: status ? 'healthy' : 'unknown', detail: service }
      case 'backend_api':
        return { status: status ? 'healthy' : 'unknown', detail: service }
      case 'workers':
        return {
          status: status?.celery?.status || 'unknown',
          detail: status?.celery?.details?.active_workers?.length
            ? `${status.celery.details.active_workers.length} worker(s) (${service})`
            : service
        }
      case 'database':
        return { status: status?.database?.status || 'unknown', detail: service }
      case 'redis':
        return { status: status?.redis?.status || 'unknown', detail: service }
      case 'scraper':
        return { status: status?.browserless?.status || 'unknown', detail: service }
      default:
        return { status: 'unknown', detail: service }
    }
  }

  const allHealthy = status ? LAYERS.every(l => getLayerStatus(l.key).status === 'healthy') : false
  const anyUnhealthy = status ? LAYERS.some(l => getLayerStatus(l.key).status === 'unhealthy') : false

  const getStatusIcon = (compStatus) => {
    if (compStatus === 'healthy') return <CheckCircleIcon color="success" />
    if (compStatus === 'unhealthy') return <ErrorIcon color="error" />
    return <HelpIcon color="action" />
  }

  const getStatusChipColor = (compStatus) => {
    if (compStatus === 'healthy') return 'success'
    if (compStatus === 'unhealthy') return 'error'
    return 'default'
  }

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

      {status?.version_check?.warnings?.map((warn, idx) => (
        <Alert severity="warning" sx={{ mb: 3, fontWeight: 'bold' }} key={idx}>
          ⚠️ {warn}
        </Alert>
      ))}

      {status && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CircleIcon sx={{ fontSize: 14, color: anyUnhealthy ? 'error.main' : (allHealthy ? 'success.main' : 'warning.main') }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  System Health — {anyUnhealthy ? 'Degraded' : (allHealthy ? 'All layers operational' : 'Unknown')}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {LAYERS.map(layer => {
                  const ls = getLayerStatus(layer.key)
                  return (
                    <Chip
                      key={layer.key}
                      icon={<CircleIcon sx={{ fontSize: 12, color: ls.status === 'healthy' ? 'success.main' : (ls.status === 'unhealthy' ? 'error.main' : 'action.disabled') }} />}
                      label={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span>{layer.label}</span>
                          <Typography component="span" variant="caption" sx={{ opacity: 0.7 }}>
                            {ls.detail ? `(${ls.detail})` : `(${layer.target})`}
                          </Typography>
                        </Box>
                      }
                      variant="outlined"
                      size="small"
                      sx={{
                        borderColor: ls.status === 'healthy' ? 'success.main' : (ls.status === 'unhealthy' ? 'error.main' : undefined),
                        '& .MuiChip-label': { fontWeight: 600 }
                      }}
                    />
                  )
                })}
              </Box>
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>System Environment</Typography>
                  
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }} color="textSecondary">System Date &amp; Time (Live)</Typography>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                      {liveTime ? (
                        <span>
                          {liveTime.date} &nbsp; {liveTime.time} &nbsp; <Chip label={liveTime.timezone} size="small" sx={{ fontSize: '11px', fontWeight: 'bold', height: '20px' }} />
                        </span>
                      ) : (
                        'Syncing...'
                      )}
                    </Typography>
                  </Box>

                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }} color="textSecondary">Host OS</Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>{status.environment?.os || 'Linux Container'}</Typography>
                      
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }} color="textSecondary">Python Runtime</Typography>
                      <Typography variant="body2" sx={{ fontStyle: 'italic', wordBreak: 'break-all' }}>
                        {status.environment?.python_version}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }} color="textSecondary">App Version (Backend)</Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>{status.environment?.app_version ? `v${status.environment.app_version}` : `v${__APP_VERSION__}`}</Typography>

                      <Typography variant="body2" sx={{ fontWeight: 'bold' }} color="textSecondary">Containerized Environment</Typography>
                      <Typography variant="body1">
                        {status.environment?.is_container || status.environment?.is_docker
                          ? `Yes (${status.environment.container_type || 'Docker'})`
                          : 'No (Host OS / Bare Metal)'}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Disk Usage</Typography>

                  {status.environment?.disks && status.environment.disks.length > 0 ? (
                    status.environment.disks.map((disk, idx) => (
                      <Box key={idx} sx={{ mb: idx === status.environment.disks.length - 1 ? 0 : 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {disk.mountpoint === '/' ? 'Root filesystem (/)' : disk.mountpoint} ({disk.device})
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {disk.percent_used}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={disk.percent_used} 
                          color={disk.percent_used > 85 ? 'error' : (idx % 2 === 0 ? 'primary' : 'secondary')}
                          sx={{ height: 10, borderRadius: 5, mb: 1 }}
                        />
                        <Typography variant="caption" color="textSecondary">
                          Used: {disk.used_gb} GB / Free: {disk.free_gb} GB (Total: {disk.total_gb} GB)
                        </Typography>
                      </Box>
                    ))
                  ) : (
                    <>
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
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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

                <Card>
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
              </Box>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', width: '100%' }}>
                <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 calc(50% - 12px)' }, minWidth: 0 }}>
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
                </Box>

                <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 calc(50% - 12px)' }, minWidth: 0 }}>
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
                </Box>
              </Box>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  )
}
