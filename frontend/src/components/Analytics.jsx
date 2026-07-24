import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, Grid, Paper, Card, CardContent, Button, TextField, 
  CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Link, Divider, Chip
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import FavoriteIcon from '@mui/icons-material/Favorite'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
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
  const [stashUrl, setStashUrl] = useState('http://localhost:9999')
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
    // Prepend UTF-8 Byte Order Mark (BOM) to ensure Excel correctly renders special characters
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
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
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" sx={{ fontWeight: '800', mb: 4, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, width: '100%', textAlign: 'center' }}>
        <AssessmentIcon sx={{ fontSize: 36, color: 'primary.main' }} />
        Analytics Dashboard
      </Typography>

      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        icon={<AssessmentIcon fontSize="small" color="primary" />} 
        sx={{ 
          mb: 3, 
          width: '100%',
          borderRadius: '12px', 
          bgcolor: 'rgba(99, 102, 241, 0.08)', 
          color: '#a5b4fc',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          '& .MuiAlert-icon': { color: '#818cf8' } 
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
          📈 Bandwidth, Storage &amp; Playback Telemetry Analytics
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          Analytics provides aggregated usage statistics—tracking video watch counts, peak bandwidth consumption, top studios/performers, Stash API synchronizations, and downloadable CSV report exports.
        </Typography>
      </Alert>

      {/* Grid of Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4, justifyContent: 'center', maxWidth: 1200 }}>
        <Grid xs={12} sm={4} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%)',
            border: '1px solid rgba(25, 118, 210, 0.2)',
            borderRadius: '16px',
            textAlign: 'center',
            p: 2,
            width: '100%',
            maxWidth: 400
          }}>
            <CardContent>
              <AccessTimeIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1, mx: 'auto' }} />
              <Typography variant="h3" sx={{ fontWeight: '900', textAlign: 'center' }}>{metrics?.total_watch_hours || 0}</Typography>
              <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: '600', textAlign: 'center' }}>TOTAL WATCH HOURS</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={4} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%)',
            border: '1px solid rgba(0, 230, 118, 0.2)',
            borderRadius: '16px',
            textAlign: 'center',
            p: 2,
            width: '100%',
            maxWidth: 400
          }}>
            <CardContent>
              <PlayArrowIcon sx={{ fontSize: 40, color: '#00e676', mb: 1, mx: 'auto' }} />
              <Typography variant="h3" sx={{ fontWeight: '900', textAlign: 'center' }}>{metrics?.total_plays || 0}</Typography>
              <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: '600', textAlign: 'center' }}>PLAYBACK SESSION HITS</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={4} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%)',
            border: '1px solid rgba(229, 9, 20, 0.2)',
            borderRadius: '16px',
            textAlign: 'center',
            p: 2,
            width: '100%',
            maxWidth: 400
          }}>
            <CardContent>
              <FavoriteIcon sx={{ fontSize: 40, color: '#ff3333', mb: 1, mx: 'auto' }} />
              <Typography variant="h3" sx={{ fontWeight: '900', textAlign: 'center' }}>{metrics?.total_climax_count || 0}</Typography>
              <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: '600', textAlign: 'center' }}>O-METER CLIMAX CLICKS</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Charts & Top Tables */}
      <Grid container spacing={4} sx={{ mb: 4, justifyContent: 'center', maxWidth: 1200 }}>
        {/* Watch History Timeline */}
        <Grid xs={12} md={8} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Paper sx={{ p: 3, borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', height: '100%', width: '100%', mx: 'auto' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, textAlign: 'center' }}>Watch Activity (Last 14 Days)</Typography>
            {activity_timeline?.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
                <Typography color="textSecondary" sx={{ textAlign: 'center' }}>No playback history recorded in the last 2 weeks.</Typography>
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
                    <Legend wrapperStyle={{ textAlign: 'center' }} />
                    <Area type="monotone" dataKey="watch_minutes" name="Watch Duration (Mins)" stroke="#1976d2" fillOpacity={1} fill="url(#colorMinutes)" />
                    <Bar dataKey="plays" name="Play Sessions Count" fill="#00e676" barSize={12} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Top Lists Column */}
        <Grid xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
          {/* Top Performers Card */}
          <Paper sx={{ p: 3, borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', width: '100%', maxWidth: 400, mx: 'auto' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>Top Favorited Performers</Typography>
            {top_performers?.length === 0 ? (
              <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>No performers favorited yet.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
                {top_performers?.map((p, idx) => (
                  <Box key={p.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: '600' }}>{idx + 1}. {p.name}</Typography>
                    <Chip label={`${p.count} fans`} size="small" variant="outlined" color="primary" sx={{ fontSize: '0.7rem' }} />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          {/* Top Scenes Card */}
          <Paper sx={{ p: 3, borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', width: '100%', maxWidth: 400, mx: 'auto' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>Top Favorited Scenes</Typography>
            {top_scenes?.length === 0 ? (
              <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>No scenes favorited yet.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
                {top_scenes?.map((s, idx) => (
                  <Box key={s.item_id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, width: '100%' }}>
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
        border: '1px solid rgba(144, 202, 249, 0.15)',
        width: '100%',
        maxWidth: 1000,
        mx: 'auto'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2 }}>
          <img 
            src="https://avatars.githubusercontent.com/u/24867479?s=200&v=4" 
            alt="Stash Logo" 
            style={{ width: 32, height: 32, borderRadius: '6px', objectFit: 'cover' }} 
          />
          <Typography variant="h5" sx={{ fontWeight: '800', textAlign: 'center' }}>Stash App Two-Way Sync</Typography>
        </Box>
        
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3, textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
          Sync your pleasure statistics with the Stash app. We run a GraphQL query using the scene's OSHASH or title, pull Stash's <code>play_count</code> and <code>o_counter</code>, merge them (taking the maximum count), and write the merged stats back to both Voyarr and Stash.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <TextField 
            size="small" 
            label="Stash GraphQL URL" 
            value={stashUrl} 
            onChange={e => setStashUrl(e.target.value)} 
            sx={{ width: { xs: '100%', md: '350px' } }}
            inputProps={{ style: { textAlign: 'center' } }}
          />
          <TextField 
            size="small" 
            type="password" 
            label="Stash ApiKey (Optional)" 
            value={stashApiKey} 
            onChange={e => setStashApiKey(e.target.value)} 
            sx={{ width: { xs: '100%', md: '250px' } }}
            inputProps={{ style: { textAlign: 'center' } }}
          />
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={
              <img 
                src="https://avatars.githubusercontent.com/u/24867479?s=200&v=4" 
                alt="Stash Logo" 
                style={{ width: 20, height: 20, borderRadius: '4px', objectFit: 'cover' }} 
              />
            }
            onClick={handleSyncStash}
            disabled={syncing}
            sx={{ minWidth: 150, height: '40px' }}
          >
            {syncing ? <CircularProgress size={24} /> : 'Sync Stats'}
          </Button>
        </Box>

        {syncResult && (
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', mt: 3 }}>
            <Alert severity={syncResult.type} sx={{ maxWidth: 600 }}>{syncResult.message}</Alert>
          </Box>
        )}
      </Paper>

      {/* Admin raw reports */}
      {isAdmin && (
        <Paper sx={{ p: 4, borderRadius: '20px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', width: '100%', maxWidth: 1000, mx: 'auto' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: '800', textAlign: 'center' }}>Admin System Analytics Reports</Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, alignItems: 'center', width: '100%' }}>
              <Divider sx={{ width: '100%' }} />
              
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>Per-Video Usage & Climax Count Details</Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300, backgroundColor: 'rgba(0,0,0,0.2)', mx: 'auto', maxWidth: 900, overflowX: 'auto' }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell align="center" sx={{ backgroundColor: '#1e1e1e', whiteSpace: 'nowrap' }}>User</TableCell>
                        <TableCell align="center" sx={{ backgroundColor: '#1e1e1e', whiteSpace: 'nowrap' }}>Video Title</TableCell>
                        <TableCell align="center" sx={{ backgroundColor: '#1e1e1e', whiteSpace: 'nowrap' }}>Plays</TableCell>
                        <TableCell align="center" sx={{ backgroundColor: '#1e1e1e', whiteSpace: 'nowrap' }}>Climaxes</TableCell>
                        <TableCell align="center" sx={{ backgroundColor: '#1e1e1e', whiteSpace: 'nowrap' }}>Last Played</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportData.video_stats_breakdown.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.username}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.title}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.play_count}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.climax_count}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.last_played ? new Date(item.last_played).toLocaleString() : 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>Recent Watch History logs</Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300, backgroundColor: 'rgba(0,0,0,0.2)', mx: 'auto', maxWidth: 900, overflowX: 'auto' }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell align="center" sx={{ backgroundColor: '#1e1e1e', whiteSpace: 'nowrap' }}>Time</TableCell>
                        <TableCell align="center" sx={{ backgroundColor: '#1e1e1e', whiteSpace: 'nowrap' }}>User</TableCell>
                        <TableCell align="center" sx={{ backgroundColor: '#1e1e1e', whiteSpace: 'nowrap' }}>Scene Title</TableCell>
                        <TableCell align="center" sx={{ backgroundColor: '#1e1e1e', whiteSpace: 'nowrap' }}>Duration (Secs)</TableCell>
                        <TableCell align="center" sx={{ backgroundColor: '#1e1e1e', whiteSpace: 'nowrap' }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportData.recent_watch_logs.map((item) => (
                        <TableRow key={item.history_id}>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{new Date(item.watched_at).toLocaleString()}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.username}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.title}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.duration_seconds}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
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
