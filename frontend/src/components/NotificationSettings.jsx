import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Grid, Typography, Card, CardContent, Switch, FormControlLabel, 
  Button, TextField, Select, MenuItem, InputLabel, FormControl, Table, 
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, 
  IconButton, Chip, List, ListItem, ListItemText, ListItemIcon, 
  Divider, Tooltip
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import NotificationsIcon from '@mui/icons-material/Notifications'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import SendIcon from '@mui/icons-material/Send'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import { apiFetch } from '../api'

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState([])
  const [rules, setRules] = useState([])
  const [history, setHistory] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)

  // Rule creation state
  const [newRule, setNewRule] = useState({
    event_type: 'task_completed',
    discord_channel_id: '',
    webhook_url: '',
    is_active: true
  })

  // Load preferences
  const fetchPrefs = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications/preferences')
      if (res.ok) {
        const data = await res.json()
        setPreferences(data)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Load rules (admin only)
  const fetchRules = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications/rules')
      if (res.ok) {
        const data = await res.json()
        setRules(data)
        setIsAdmin(true)
      } else {
        setIsAdmin(false)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Load history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications/history')
      if (res.ok) {
        const data = await res.json()
        setHistory(data)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    fetchPrefs()
    fetchRules()
    fetchHistory()
  }, [fetchPrefs, fetchRules, fetchHistory])

  // Handle preference toggle
  const handlePrefChange = async (event_type, dispatch_method, enabled) => {
    const updated = preferences.map(p => 
      (p.event_type === event_type && p.dispatch_method === dispatch_method)
        ? { ...p, enabled }
        : p
    )
    setPreferences(updated)

    try {
      await apiFetch('/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      })
    } catch (e) {
      console.error('Failed to update preference:', e)
    }
  }

  // Handle rule submission
  const handleRuleSubmit = async (e) => {
    e.preventDefault()
    if (!newRule.discord_channel_id && !newRule.webhook_url) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Please specify either a Webhook URL or a Discord Channel ID.', severity: 'warning' } 
      }))
      return
    }
    try {
      const res = await apiFetch('/notifications/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Rule added successfully!', severity: 'success' } }))
        setNewRule({ event_type: 'task_completed', discord_channel_id: '', webhook_url: '', is_active: true })
        fetchRules()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Handle rule delete
  const handleRuleDelete = async (ruleId) => {
    const confirm = await window.appConfirm('Are you sure you want to delete this custom notification rule?')
    if (!confirm) return

    try {
      const res = await apiFetch(`/notifications/rules/${ruleId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Rule deleted.', severity: 'success' } }))
        fetchRules()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Mark history as read
  const handleMarkRead = async (ids = null) => {
    try {
      const res = await apiFetch('/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: ids })
      })
      if (res.ok) {
        fetchHistory()
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 3.5, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: 1.5, letterSpacing: '-0.5px' }}>
          <NotificationsIcon color="primary" sx={{ fontSize: 32 }} /> Notifications &amp; Webhooks
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage your personal notification preferences and system automation alerts.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Personal Preferences Card */}
        <Grid item xs={12}>
          <Card sx={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: '700' }}>Your Notification Channels</Typography>
              <Typography variant="body2" color="text.secondary">
                Choose where you'd like to receive notifications for background tasks and catalog updates.
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              {/* Task Completion Delivery */}
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TaskAltIcon fontSize="small" color="primary" /> Task Completed Alerts
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Fires when a queued download completes processing or metadata syncing finishes.
                </Typography>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.find(p => p.event_type === 'task_completed' && p.dispatch_method === 'toast')?.enabled || false}
                        onChange={(e) => handlePrefChange('task_completed', 'toast', e.target.checked)}
                      />
                    }
                    label="Browser Toast"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.find(p => p.event_type === 'task_completed' && p.dispatch_method === 'discord_dm')?.enabled || false}
                        onChange={(e) => handlePrefChange('task_completed', 'discord_dm', e.target.checked)}
                      />
                    }
                    label="Discord DM"
                  />
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              {/* Favorite Items Alerts */}
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FavoriteBorderIcon fontSize="small" color="error" /> Favorite Catalog Matches
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Fires when a newly scanned or downloaded item matches your favorited performers, tags, or studios.
                </Typography>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.find(p => p.event_type === 'favorite_updated' && p.dispatch_method === 'toast')?.enabled || false}
                        onChange={(e) => handlePrefChange('favorite_updated', 'toast', e.target.checked)}
                      />
                    }
                    label="Browser Toast"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.find(p => p.event_type === 'favorite_updated' && p.dispatch_method === 'discord_dm')?.enabled || false}
                        onChange={(e) => handlePrefChange('favorite_updated', 'discord_dm', e.target.checked)}
                      />
                    }
                    label="Discord DM"
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Discord Automation Rules (Admin Only) */}
        {isAdmin && (
          <Grid item xs={12}>
            <Card sx={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: '700' }}>Admin Broadcast Webhooks &amp; Rules</Typography>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Create rules to automatically broadcast specific system events to Discord channels via custom webhooks or channel post dispatches.
                </Typography>
                <Divider />

                {/* Add Rule Form */}
                <Box component="form" onSubmit={handleRuleSubmit} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Event Type</InputLabel>
                    <Select
                      value={newRule.event_type}
                      label="Event Type"
                      onChange={(e) => setNewRule({ ...newRule, event_type: e.target.value })}
                    >
                      <MenuItem value="task_completed">Background Tasks (Task Completed)</MenuItem>
                      <MenuItem value="favorite_updated">Favorite Matches (Favorite Catalog Matches)</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    size="small"
                    label="Discord Webhook URL"
                    value={newRule.webhook_url}
                    onChange={(e) => setNewRule({ ...newRule, webhook_url: e.target.value })}
                    sx={{ flexGrow: 1, minWidth: 250 }}
                    placeholder="https://discord.com/api/webhooks/..."
                  />

                  <Typography variant="body2" sx={{ opacity: 0.5 }}>or</Typography>

                  <TextField
                    size="small"
                    label="Discord Channel ID"
                    value={newRule.discord_channel_id}
                    onChange={(e) => setNewRule({ ...newRule, discord_channel_id: e.target.value })}
                    sx={{ width: 220 }}
                    placeholder="e.g. 112233445566778899"
                  />

                  <Button 
                    type="submit" 
                    variant="contained" 
                    color="primary"
                    startIcon={<SendIcon />}
                  >
                    Add Automation Rule
                  </Button>
                </Box>

                <Divider />

                {/* Rules List */}
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Active Automation Rules</Typography>
                {rules.length === 0 ? (
                  <Typography variant="body2" sx={{ opacity: 0.5, p: 2 }}>No active notification rules configured.</Typography>
                ) : (
                  <TableContainer component={Paper} sx={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                      <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Event Type</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Webhook URL</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Discord Channel ID</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Status</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rules.map((rule) => (
                          <TableRow key={rule.id}>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                              <Chip 
                                size="small"
                                label={rule.event_type === 'task_completed' ? 'Task Completed' : 'Favorite Updated'} 
                                color={rule.event_type === 'task_completed' ? 'primary' : 'secondary'}
                              />
                            </TableCell>
                        <TableCell align="center" sx={{ fontFamily: 'monospace', opacity: 0.8, whiteSpace: 'nowrap' }}>
                              {rule.webhook_url ? `${rule.webhook_url.substring(0, 35)}...` : '-'}
                            </TableCell>
                        <TableCell align="center" sx={{ fontFamily: 'monospace', opacity: 0.8, whiteSpace: 'nowrap' }}>
                              {rule.discord_channel_id || '-'}
                            </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                              <Chip 
                                size="small"
                                label={rule.is_active ? 'Active' : 'Disabled'} 
                                color={rule.is_active ? 'success' : 'default'} 
                                variant="outlined"
                              />
                            </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                              <IconButton color="error" size="small" onClick={() => handleRuleDelete(rule.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
