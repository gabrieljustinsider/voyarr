import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, Button, TextField, CircularProgress, Dialog, 
  DialogTitle, DialogContent, DialogActions, Table, TableHead, 
  TableBody, TableRow, TableCell, TableContainer, Paper, Switch, IconButton,
  Snackbar, Alert
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import DeleteIcon from '@mui/icons-material/Delete'

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

const getAuthHeaders = () => {
  const token = localStorage.getItem('voyarr_jwt')
  if (token) return { 'Authorization': `Bearer ${token}` }
  const apiKey = localStorage.getItem('voyarr_api_key')
  if (apiKey) return { 'X-Voyarr-Api-Key': apiKey }
  return {}
}

export default function Schedules() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, scheduleId: null })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' })
  const [formData, setFormData] = useState({ name: '', provider_id: '', target_url: '', cron_expression: '0 0 * * *' })

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/schedules`, {
        headers: getAuthHeaders()
      })
      if (res.ok) setSchedules(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  const handleCreate = async () => {
    try {
      const res = await fetch(`${API_BASE}/schedules`, {
        method: 'POST',
        headers: { 
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          provider_id: formData.provider_id ? parseInt(formData.provider_id, 10) : null
        })
      })
      if (res.ok) {
        setOpenDialog(false)
        setFormData({ name: '', provider_id: '', target_url: '', cron_expression: '0 0 * * *' })
        fetchSchedules()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Error: ${err.detail}`, severity: 'error' })
      }
    } catch (e) {
      setSnackbar({ open: true, message: `Error creating schedule: ${e.message}`, severity: 'error' })
    }
  }

  const handleToggle = async (scheduleId, isActive) => {
    try {
      await fetch(`${API_BASE}/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !isActive })
      })
      fetchSchedules()
    } catch (e) {
      console.error(e)
    }
  }

  const confirmDelete = async () => {
    const scheduleId = deleteConfirm.scheduleId
    if (!scheduleId) return
    try {
      await fetch(`${API_BASE}/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      setDeleteConfirm({ open: false, scheduleId: null })
      fetchSchedules()
      setSnackbar({ open: true, message: 'Schedule deleted successfully', severity: 'success' })
    } catch (e) {
      console.error(e)
    }
  }

  const handleTrigger = async (scheduleId) => {
    try {
      const res = await fetch(`${API_BASE}/schedules/${scheduleId}/trigger`, {
        method: 'POST',
        headers: getAuthHeaders()
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Schedule triggered! Check the download queue shortly.', severity: 'success' })
        fetchSchedules()
      } else {
        setSnackbar({ open: true, message: 'Failed to trigger schedule.', severity: 'error' })
      }
    } catch (e) {
      setSnackbar({ open: true, message: `Error: ${e.message}`, severity: 'error' })
      console.error(e)
    }
  }

  // Convert Python naive UTC ISO strings to local browser time correctly
  const formatTime = (timeStr) => timeStr ? new Date(timeStr + 'Z').toLocaleString() : 'Never'

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Scrape Schedules</Typography>
        <Button variant="contained" onClick={() => setOpenDialog(true)}>Add Schedule</Button>
      </Box>

      {loading ? <CircularProgress /> : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Active</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Target URL</TableCell>
                <TableCell>Cron</TableCell>
                <TableCell>Last Run</TableCell>
                <TableCell>Next Run</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center">No schedules found.</TableCell></TableRow>
              ) : schedules.map(s => (
                <TableRow key={s.id}>
                  <TableCell><Switch checked={s.is_active} onChange={() => handleToggle(s.id, s.is_active)} /></TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.target_url}</TableCell>
                  <TableCell>{s.cron_expression}</TableCell>
                  <TableCell>
                    {formatTime(s.last_run)}<br />
                    <Typography variant="caption" color={s.last_run_status === 'error' ? 'error' : 'success.main'}>{s.last_run_status}</Typography>
                  </TableCell>
                  <TableCell>{s.next_run && s.is_active ? formatTime(s.next_run) : 'Paused'}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleTrigger(s.id)} color="primary" title="Trigger Now"><PlayArrowIcon /></IconButton>
                    <IconButton onClick={() => setDeleteConfirm({ open: true, scheduleId: s.id })} color="error" title="Delete"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Schedule</DialogTitle>
        <DialogContent dividers>
          <TextField fullWidth label="Name" sx={{ mb: 2 }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          <TextField fullWidth label="Provider ID" type="number" sx={{ mb: 2 }} value={formData.provider_id} onChange={e => setFormData({...formData, provider_id: e.target.value})} />
          <TextField fullWidth label="Target URL (e.g. Channel Page)" sx={{ mb: 2 }} value={formData.target_url} onChange={e => setFormData({...formData, target_url: e.target.value})} />
          <TextField fullWidth label="Cron Expression" value={formData.cron_expression} onChange={e => setFormData({...formData, cron_expression: e.target.value})} helperText="Standard Unix cron format. Defaults to daily at midnight." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>Save Schedule</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, scheduleId: null })}>
        <DialogTitle>Delete Schedule</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this schedule? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, scheduleId: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}