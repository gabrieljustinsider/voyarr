import { useState, useEffect, useCallback } from 'react'
import { Typography, Box, Card, CardContent, Grid, LinearProgress } from '@mui/material'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import apiFetch from '../api'

export default function Dashboard() {
  const [stats, setStats] = useState({
    total_downloads: 0,
    completed: 0,
    running: 0,
    failed: 0
  })
  const [cookies, setCookies] = useState([])
  const [providers, setProviders] = useState([])

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiFetch('/progress/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }

      const [cookieRes, provRes] = await Promise.all([
        apiFetch('/cookies').catch(() => ({ ok: false })),
        apiFetch('/providers').catch(() => ({ ok: false }))
      ])
      
      if (cookieRes.ok) setCookies(await cookieRes.json())
      if (provRes.ok) setProviders(await provRes.json())
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await fetchStats()
    }
    init()
  }, [fetchStats])

  const barData = [
    { name: 'Completed', value: stats.completed },
    { name: 'Running', value: stats.running },
    { name: 'Failed', value: stats.failed }
  ]

  const pieData = [
    { name: 'Completed', value: stats.completed, color: '#4caf50' },
    { name: 'Running', value: stats.running, color: '#2196f3' },
    { name: 'Failed', value: stats.failed, color: '#f44336' }
  ]

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Total Downloads</Typography>
              <Typography variant="h4">{stats?.total_downloads ?? 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Completed</Typography>
              <Typography variant="h4" color="success.main">{stats?.completed ?? 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Running</Typography>
              <Typography variant="h4" color="primary.main">{stats?.running ?? 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Failed</Typography>
              <Typography variant="h4" color="error.main">{stats?.failed ?? 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2, justifyContent: 'center' }}>
        <Grid xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Quota Usage (Session Cookies)</Typography>
              {(cookies || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">No session cookies configured.</Typography>
              ) : (
                <Grid container spacing={3}>
                  {(cookies || []).map(cookie => {
                    const provider = (providers || []).find(p => p.id === cookie?.provider_id);
                    const limit = cookie?.download_limit || 0;
                    const used = cookie?.downloads_used || 0;
                    const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                    const isUnlimited = limit === 0;
                    
                    return (
                      <Grid xs={12} md={6} key={cookie?.id || Math.random()}>
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">{provider?.name || `Provider ID: ${cookie?.provider_id}`}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={isUnlimited ? 100 : percentage} 
                            color={isUnlimited ? 'primary' : percentage >= 90 ? 'error' : percentage >= 75 ? 'warning' : 'primary'}
                            sx={{ height: 10, borderRadius: 5, ...(isUnlimited && { opacity: 0.5 }) }}
                          />
                        </Box>
                      </Grid>
                    )
                  })}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2, justifyContent: 'center' }}>
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Download Status</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Status Distribution</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}