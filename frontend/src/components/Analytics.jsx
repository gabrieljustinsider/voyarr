import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, Grid, Paper, Card, CardContent, Button, TextField, 
  CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Link, Divider
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import FavoriteIcon from '@mui/icons-material/Favorite'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import AssessmentIcon from '@mui/icons-material/Assessment'
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts'
import { apiFetch } from '../api'

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Stash sync states
  const [stashUrl, setStashUrl] = useState('http://localhost:9000')
  const [stashApiKey, setStashApiKey] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  // Admin report states
  const [isAdmin, setIsAdmin] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/analytics/dashboard')
      if (res.ok) {
        setData(await res.json())
      } else {
        setError('Failed to fetch dashboard metrics.')
      }

      // Check if user is admin by probing `/settings`
      const settingsRes = await apiFetch('/settings')
      if (settingsRes.ok) {
        setIsAdmin(true)
      }
    } catch (e) {
      console.error(e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const handleSyncStash = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await apiFetch('/external-api/stash/sync-stats', {
        method: 'POST',
        body: JSON.stringify({
          stash_url: stashUrl,
          stash_api_key: stashApiKey || null
        })
      })
      const result = await res.json()
      if (res.ok) {
        setSyncResult({
          type: 'success',
          message: `Sync successful! Synced entries: ${result.synced_count}. Updated local records: ${result.updated_local}. Updated Stash app: ${result.updated_stash}.`
        })
        fetchAnalytics() // refresh numbers
      } else {
        setSyncResult({
          type: 'error',
          message: result.detail || 'Stash synchronization failed.'
        })
      }
    } catch (e) {
      setSyncResult({ type: 'error', message: e.message })
    } finally {
      setSyncing(false)
    }
  }

  const handlePullReport = async () => {
    setReportLoading(true)
    setReportData(null)
    try {
      const res = await apiFetch('/analytics/report')
      if (res.ok) {
        setReportData(await res.json())
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Unauthorized raw report access.', severity: 'error' } 
        }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setReportLoading(false)
    }
  }

  const handleDownloadReportCSV = () => {
    if (!reportData || !reportData.video_stats_breakdown) return

    const headers = ['Username', 'Video ID', 'Title', 'Play Count', 'Climax Count', 'Last Played']
    
    const sanitizeCSV = (str) => {
      if (typeof str !== 'string') return str;
      const cleanStr = str.replace(/"/g, '""');
      if (cleanStr.match(/^[=\-+@]/)) return `"'${cleanStr}"`;
      return `"${cleanStr}"`;
    }

    const rows = reportData.video_stats_breakdown.map(item => [
      sanitizeCSV(item.username),
      item.video_id,
      sanitizeCSV(item.title),
      item.play_count,
      item.climax_count,
      item.last_played || ''
    ])

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `voyarr_analytics_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress color="primary" />
      </Box>
    )
  }

  if (error) {
    return <Alert severity="error" sx={{ my: 3 }}>{error}</Alert>
  }

  const { metrics, activity_timeline, top_scenes, top_performers } = data || {}

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="h4" sx={{ fontWeight: '800', mb: 4, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <AssessmentIcon sx={{ fontSize: 36, color: 'primary.main' }} />
        Analytics Dashboard
      </Typography>

      {/* Grid of Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%)',
            border: '1px solid rgba(25, 118, 210, 0.2)',
            borderRadius: '16px',
            textAlign: 'center',
            p: 2
          }}>
            <CardContent>
              <AccessTimeIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h3" sx={{ fontWeight: '900' }}>{metrics?.total_watch_hours || 0}</Typography>
              <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: '600' }}>TOTAL WATCH HOURS</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%)',
            border: '1px solid rgba(0, 230, 118, 0.2)',
            borderRadius: '16px',
            textAlign: 'center',
            p: 2
          }}>
            <CardContent>
              <PlayArrowIcon sx={{ fontSize: 40, color: '#00e676', mb: 1 }} />
              <Typography variant="h3" sx={{ fontWeight: '900' }}>{metrics?.total_plays || 0}</Typography>
              <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: '600' }}>PLAYBACK SESSION HITS</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%)',
            border: '1px solid rgba(229, 9, 20, 0.2)',
            borderRadius: '16px',
            textAlign: 'center',
            p: 2
          }}>
            <CardContent>
              <FavoriteIcon sx={{ fontSize: 40, color: '#ff3333', mb: 1 }} />
              <Typography variant="h3" sx={{ fontWeight: '900' }}>{metrics?.total_climax_count || 0}</Typography>
              <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: '600' }}>O-METER CLIMAX CLICKS</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Charts & Top Tables */}
      <Grid container spacing={4} sx={{ mb: 4 }}>
        {/* Watch History Timeline */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>Watch Activity (Last 14 Days)</Typography>
            {activity_timeline?.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
                <Typography color="textSecondary">No playback history recorded in the last 2 weeks.</Typography>
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activity_timeline}>
                    <defs>
                      <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1976d2" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#1976d2" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)' }} />
                    <Legend />
                    <Area type="monotone" dataKey="watch_minutes" name="Watch Duration (Mins)" stroke="#1976d2" fillOpacity={1} fill="url(#colorMinutes)" />
                    <Bar dataKey="plays" name="Play Sessions Count" fill="#00e676" barSize={12} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Top Lists Column */}
        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Top Performers Card */}
          <Paper sx={{ p: 3, borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Top Favorited Performers</Typography>
            {top_performers?.length === 0 ? (
              <Typography variant="body2" color="textSecondary">No performers favorited yet.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {top_performers?.map((p, idx) => (
                  <Box key={p.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: '600' }}>{idx + 1}. {p.name}</Typography>
                    <Chip label={`${p.count} fans`} size="small" variant="outlined" color="primary" sx={{ fontSize: '0.7rem' }} />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          {/* Top Scenes Card */}
          <Paper sx={{ p: 3, borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Top Favorited Scenes</Typography>
            {top_scenes?.length === 0 ? (
              <Typography variant="body2" color="textSecondary">No scenes favorited yet.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {top_scenes?.map((s, idx) => (
                  <Box key={s.item_id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: '600' }} noWrap title={s.title}>
                      {idx + 1}. {s.title}
                    </Typography>
                    <Chip label={`${s.count} hearts`} size="small" variant="outlined" color="error" sx={{ fontSize: '0.7rem' }} />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Two-Way Stash App Sync Hub */}
      <Paper sx={{ 
        p: 4, 
        mb: 4, 
        borderRadius: '20px', 
        background: 'linear-gradient(135deg, rgba(144, 202, 249, 0.05) 0%, rgba(0, 0, 0, 0.2) 100%)',
        border: '1px solid rgba(144, 202, 249, 0.15)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <CloudSyncIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: '800' }}>Stash App Two-Way Sync</Typography>
        </Box>
        
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Sync your pleasure statistics with the Stash app. We run a GraphQL query using the scene's OSHASH or title, pull Stash's <code>play_count</code> and <code>o_counter</code>, merge them (taking the maximum count), and write the merged stats back to both Voyarr and Stash.
        </Typography>

        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField 
              fullWidth 
              size="small" 
              label="Stash GraphQL URL" 
              value={stashUrl} 
              onChange={e => setStashUrl(e.target.value)} 
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField 
              fullWidth 
              size="small" 
              type="password" 
              label="Stash ApiKey (Optional)" 
              value={stashApiKey} 
              onChange={e => setStashApiKey(e.target.value)} 
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button 
              fullWidth
              variant="contained" 
              color="primary" 
              size="large"
              startIcon={<CloudSyncIcon />}
              onClick={handleSyncStash}
              disabled={syncing}
            >
              {syncing ? <CircularProgress size={24} /> : 'Sync Stats'}
            </Button>
          </Grid>
        </Grid>

        {syncResult && (
          <Alert severity={syncResult.type} sx={{ mt: 3 }}>{syncResult.message}</Alert>
        )}
      </Paper>

      {/* Admin raw reports */}
      {isAdmin && (
        <Paper sx={{ p: 4, borderRadius: '20px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: '800' }}>Admin System Analytics Reports</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {reportData && (
                <Button variant="outlined" color="primary" onClick={handleDownloadReportCSV}>
                  Download CSV Report
                </Button>
              )}
              <Button variant="contained" color="secondary" onClick={handlePullReport} disabled={reportLoading}>
                {reportLoading ? <CircularProgress size={24} /> : 'Pull Raw Logs'}
              </Button>
            </Box>
          </Box>

          {reportData && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              <Divider />
              
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Per-Video Usage & Climax Count Details</Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300, backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: '#1e1e1e' }}>User</TableCell>
                        <TableCell sx={{ backgroundColor: '#1e1e1e' }}>Video Title</TableCell>
                        <TableCell sx={{ backgroundColor: '#1e1e1e' }} align="right">Plays</TableCell>
                        <TableCell sx={{ backgroundColor: '#1e1e1e' }} align="right">Climaxes</TableCell>
                        <TableCell sx={{ backgroundColor: '#1e1e1e' }}>Last Played</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportData.video_stats_breakdown.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.username}</TableCell>
                          <TableCell>{item.title}</TableCell>
                          <TableCell align="right">{item.play_count}</TableCell>
                          <TableCell align="right">{item.climax_count}</TableCell>
                          <TableCell>{item.last_played ? new Date(item.last_played).toLocaleString() : 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Recent Watch History logs</Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300, backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: '#1e1e1e' }}>Time</TableCell>
                        <TableCell sx={{ backgroundColor: '#1e1e1e' }}>User</TableCell>
                        <TableCell sx={{ backgroundColor: '#1e1e1e' }}>Scene Title</TableCell>
                        <TableCell sx={{ backgroundColor: '#1e1e1e' }} align="right">Duration (Secs)</TableCell>
                        <TableCell sx={{ backgroundColor: '#1e1e1e' }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportData.recent_watch_logs.map((item) => (
                        <TableRow key={item.history_id}>
                          <TableCell>{new Date(item.watched_at).toLocaleString()}</TableCell>
                          <TableCell>{item.username}</TableCell>
                          <TableCell>{item.title}</TableCell>
                          <TableCell align="right">{item.duration_seconds}</TableCell>
                          <TableCell>
                            <Chip 
                              label={item.completed ? "COMPLETED" : "INCOMPLETE"} 
                              size="small" 
                              color={item.completed ? "success" : "default"}
                              sx={{ fontSize: '0.6rem', fontWeight: 'bold' }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  )
}
