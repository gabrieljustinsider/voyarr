import React, { useState, useEffect, useCallback } from 'react'
import { Typography, Box, Grid, Alert } from '@mui/material'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Download, CheckCircle2, PlayCircle, AlertCircle, HardDrive, LayoutDashboard } from 'lucide-react'
import StatCard from './common/StatCard'
import GlassCard from './common/GlassCard'
import GradientProgressBar from './common/GradientProgressBar'
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
    fetchStats()
  }, [fetchStats])

  const barData = [
    { name: 'Completed', value: stats.completed },
    { name: 'Running', value: stats.running },
    { name: 'Failed', value: stats.failed }
  ]

  const pieData = [
    { name: 'Completed', value: stats.completed, color: '#10b981' },
    { name: 'Running', value: stats.running, color: '#6366f1' },
    { name: 'Failed', value: stats.failed, color: '#f43f5e' }
  ]

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ mb: 3 }}>
        <Typography 
          variant="h4" 
          sx={{ 
            fontFamily: "'Outfit', sans-serif", 
            fontWeight: 900, 
            letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          System Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Real-time metrics, media queue status, and provider quota consumption.
        </Typography>
      </Box>

      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        icon={<LayoutDashboard size={20} />} 
        sx={{ 
          mb: 3, 
          borderRadius: '12px', 
          bgcolor: 'rgba(99, 102, 241, 0.08)', 
          color: '#a5b4fc',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          '& .MuiAlert-icon': { color: '#818cf8' } 
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
          📊 System Overview &amp; Real-Time Operational Telemetry
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          The Dashboard provides a consolidated high-level view of your entire server ecosystem—monitoring live download queues, active provider quota usage, disk storage health, and system processing metrics.
        </Typography>
      </Alert>
      
      {/* KPI Cards Row using reusable StatCard primitive */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid xs={12} sm={6} md={3}>
          <StatCard 
            title="Total Downloads" 
            value={stats?.total_downloads ?? 0} 
            icon={Download}
            variant="primary"
            subtitle="All-time queued & processed"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard 
            title="Completed" 
            value={stats?.completed ?? 0} 
            icon={CheckCircle2}
            variant="success"
            subtitle="Successfully downloaded"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard 
            title="Running" 
            value={stats?.running ?? 0} 
            icon={PlayCircle}
            variant="warning"
            subtitle="Active tasks in progress"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard 
            title="Failed" 
            value={stats?.failed ?? 0} 
            icon={AlertCircle}
            variant="error"
            subtitle="Tasks requiring attention"
          />
        </Grid>
      </Grid>

      {/* Quota Usage Section */}
      <GlassCard sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <HardDrive size={22} style={{ color: '#a78bfa' }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Provider Quota Consumption (Session Cookies)
          </Typography>
        </Box>
        
        {(cookies || []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No session cookies or provider quotas configured.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {(cookies || []).map((cookie) => {
              const provider = (providers || []).find((p) => p.id === cookie?.provider_id)
              const limit = cookie?.download_limit || 0
              const used = cookie?.downloads_used || 0
              const isUnlimited = limit === 0
              const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100)
              
              return (
                <Grid xs={12} md={6} key={cookie?.id || Math.random()}>
                  <GradientProgressBar
                    label={provider?.name || `Provider ID: ${cookie?.provider_id}`}
                    sublabel={isUnlimited ? `${used} / ∞` : `${used} / ${limit} (${percentage.toFixed(0)}%)`}
                    value={percentage}
                    isUnlimited={isUnlimited}
                  />
                </Grid>
              )
            })}
          </Grid>
        )}
      </GlassCard>

      {/* Visualization Analytics Charts */}
      <Grid container spacing={3}>
        <Grid xs={12} md={6}>
          <GlassCard sx={{ height: 380 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
              Download Task Volume
            </Typography>
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(18, 19, 26, 0.9)', 
                    borderRadius: 12, 
                    borderColor: 'rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                  }} 
                />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[8, 8, 0, 0]}>
                  {barData.map((entry, idx) => (
                    <Cell key={idx} fill={idx === 0 ? '#10b981' : idx === 1 ? '#6366f1' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </Grid>
        
        <Grid xs={12} md={6}>
          <GlassCard sx={{ height: 380 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
              Status Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={290}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(18, 19, 26, 0.9)', 
                    borderRadius: 12, 
                    borderColor: 'rgba(255,255,255,0.1)'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </GlassCard>
        </Grid>
      </Grid>
    </Box>
  )
}