import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Select, FormControl,
  InputLabel, Grid, Chip, Snackbar, Alert, CircularProgress
} from '@mui/material'
import { apiFetch } from '../api'
import GlassCard from './common/GlassCard'

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } }
const accentSx = { bgcolor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', p: 2 }

export default function RequestManager({ userRole }) {
  const isAdmin = userRole === 'admin'
  const [requests, setRequests] = useState([])
  const [providers, setProviders] = useState([])
  const [newRequest, setNewRequest] = useState({ title: '', url: '' })
  
  const [openApproveDialog, setOpenApproveDialog] = useState(false)
  const [selectedReq, setSelectedReq] = useState(null)
  const [selectedProviderId, setSelectedProviderId] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const fetchRequests = useCallback(async () => {
    try {
      const res = await apiFetch('/requests')
      if (res.ok) setRequests(await res.json())
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    }
  }, [])

  const fetchProviders = useCallback(async () => {
    try {
      const res = await apiFetch('/providers')
      if (res.ok) setProviders(await res.json())
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
    if (isAdmin) fetchProviders()
  }, [fetchRequests, fetchProviders, isAdmin])

  const handleSubmitRequest = async (e) => {
    e.preventDefault()
    if (!newRequest.title.trim()) {
      setSnackbar({ open: true, message: 'Please enter a title', severity: 'error' })
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/requests', {
        method: 'POST', body: JSON.stringify(newRequest)
      })
      if (res.ok) {
        setNewRequest({ title: '', url: '' })
        setSnackbar({ open: true, message: 'Media request submitted!', severity: 'success' })
        fetchRequests()
      } else {
        const data = await res.json()
        setSnackbar({ open: true, message: `Failed: ${data.detail || res.statusText}`, severity: 'error' })
      }
    } catch (error) {
      setSnackbar({ open: true, message: `Error: ${error.message}`, severity: 'error' })
    }
    setLoading(false)
  }

  const handleOpenApprove = (req) => {
    setSelectedReq(req)
    if (providers.length > 0) setSelectedProviderId(providers[0].id)
    setOpenApproveDialog(true)
  }

  const handleApprove = async () => {
    if (!selectedProviderId) {
      setSnackbar({ open: true, message: 'Select a provider', severity: 'error' })
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch(`/requests/${selectedReq.id}/approve?provider_id=${selectedProviderId}`, { method: 'POST' })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Request approved and queued!', severity: 'success' })
        setOpenApproveDialog(false)
        fetchRequests()
      } else {
        const data = await res.json()
        setSnackbar({ open: true, message: `Approval failed: ${data.detail || res.statusText}`, severity: 'error' })
      }
    } catch (error) {
      setSnackbar({ open: true, message: `Error: ${error.message}`, severity: 'error' })
    }
    setLoading(false)
  }

  const handleReject = async (id) => {
    const confirmed = await window.appConfirm('Reject this request?')
    if (!confirmed) return
    setLoading(true)
    try {
      const res = await apiFetch(`/requests/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Request rejected.', severity: 'info' })
        fetchRequests()
      } else {
        setSnackbar({ open: true, message: 'Failed to reject.', severity: 'error' })
      }
    } catch (error) {
      setSnackbar({ open: true, message: `Error: ${error.message}`, severity: 'error' })
    }
    setLoading(false)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'info'
      case 'downloaded': return 'success'
      case 'rejected': return 'error'
      default: return 'warning'
    }
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" sx={{ fontWeight: '800', letterSpacing: '-0.5px', mb: 3 }}>
        Media Requests Portal
      </Typography>

      <Alert severity="info" sx={{ mb: 3, borderRadius: '12px', bgcolor: 'rgba(99,102,241,0.08)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)', '& .MuiAlert-icon': { color: '#818cf8' } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>🎯 Media Request Hub</Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          Submit requests for media you want added to your library. Administrators can approve, reject, and queue requests for automatic download.
        </Typography>
      </Alert>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid xs={12} md={4}>
          <GlassCard>
            <Typography variant="h6" sx={{ fontWeight: '700', mb: 2 }}>Submit Media Request</Typography>
            <Box sx={{ ...accentSx, mb: 2 }}>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Can't find a video or channel? Paste the source URL below to request it for scanning and ripping.
              </Typography>
            </Box>
            <Box component="form" onSubmit={handleSubmitRequest} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField fullWidth label="Title / Channel Name" required value={newRequest.title} onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })} sx={inputSx} />
              <TextField fullWidth label="Source URL (e.g. OnlyFans/Fansly link)" placeholder="https://..." value={newRequest.url} onChange={(e) => setNewRequest({ ...newRequest, url: e.target.value })} sx={inputSx} />
              <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ mt: 1, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}>
                {loading ? <CircularProgress size={24} /> : 'Submit Request'}
              </Button>
            </Box>
          </GlassCard>
        </Grid>

        <Grid xs={12} md={8}>
          <GlassCard>
            <Typography variant="h6" sx={{ fontWeight: '700', mb: 2 }}>
              {isAdmin ? 'Centralized Approval Dashboard' : 'Your Requested Media'}
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Requested By</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req.id} sx={{ '&:hover': { bgcolor: 'rgba(99,102,241,0.06)' } }}>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ display: 'inline' }}>{req.title}</Typography>
                        {req.url && (
                          <Typography variant="caption" sx={{ ml: 1 }}>
                            <a href={req.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#818cf8' }}>(Source Link)</a>
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{req.requested_by || 'Anonymous'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={req.status ? req.status.toUpperCase() : 'PENDING'} color={getStatusColor(req.status)} sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
                      </TableCell>
                      <TableCell>
                        {isAdmin && (req.status === 'pending' || !req.status) ? (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button variant="contained" color="success" size="small" onClick={() => handleOpenApprove(req)} sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem' }}>
                              Approve
                            </Button>
                            <Button variant="outlined" color="error" size="small" onClick={() => handleReject(req.id)} sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.75rem' }}>
                              Reject
                            </Button>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            {req.status === 'approved' ? 'Queued for rip' : req.status === 'downloaded' ? 'Ready!' : 'No actions'}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {requests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        <Typography color="text.secondary">No media requests found.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </GlassCard>
        </Grid>
      </Grid>

      <Dialog open={openApproveDialog} onClose={() => setOpenApproveDialog(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: '12px', bgcolor: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' } } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Approve & Queue Media</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
            Select the provider to trigger automatic scraping and download.
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Provider</InputLabel>
            <Select value={selectedProviderId} label="Provider" onChange={(e) => setSelectedProviderId(e.target.value)} sx={{ borderRadius: '10px' }}>
              {providers.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name} ({p.base_url})</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenApproveDialog(false)} sx={{ borderRadius: '8px', textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleApprove} disabled={loading} sx={{ borderRadius: '8px', textTransform: 'none' }}>
            {loading ? <CircularProgress size={20} /> : 'Approve & Rip'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: '10px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
