import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Select, FormControl,
  InputLabel, Card, CardContent, Grid, Chip, Divider, Snackbar, Alert, CircularProgress
} from '@mui/material'
import { apiFetch } from '../api'

export default function RequestManager({ userRole }) {
  const isAdmin = userRole === 'admin'
  const [requests, setRequests] = useState([])
  const [providers, setProviders] = useState([])
  const [newRequest, setNewRequest] = useState({ title: '', url: '' })
  
  // Dialog controls
  const [openApproveDialog, setOpenApproveDialog] = useState(false)
  const [selectedReq, setSelectedReq] = useState(null)
  const [selectedProviderId, setSelectedProviderId] = useState('')
  
  // Loading & Alerts
  const [loading, setLoading] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const fetchRequests = useCallback(async () => {
    try {
      const res = await apiFetch('/requests')
      if (res.ok) {
        setRequests(await res.json())
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    }
  }, [])

  const fetchProviders = useCallback(async () => {
    try {
      const res = await apiFetch('/providers')
      if (res.ok) {
        setProviders(await res.json())
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
    if (isAdmin) {
      fetchProviders()
    }
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
        method: 'POST',
        body: JSON.stringify(newRequest)
      })
      if (res.ok) {
        setNewRequest({ title: '', url: '' })
        setSnackbar({ open: true, message: 'Media request submitted successfully!', severity: 'success' })
        fetchRequests()
      } else {
        const data = await res.json()
        setSnackbar({ open: true, message: `Failed to submit request: ${data.detail || res.statusText}`, severity: 'error' })
      }
    } catch (error) {
      setSnackbar({ open: true, message: `Error submitting request: ${error.message}`, severity: 'error' })
    }
    setLoading(false)
  }

  const handleOpenApprove = (req) => {
    setSelectedReq(req)
    if (providers.length > 0) {
      setSelectedProviderId(providers[0].id)
    }
    setOpenApproveDialog(true)
  }

  const handleApprove = async () => {
    if (!selectedProviderId) {
      setSnackbar({ open: true, message: 'Please select a provider', severity: 'error' })
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch(`/requests/${selectedReq.id}/approve?provider_id=${selectedProviderId}`, {
        method: 'POST'
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Request approved and queued for download!', severity: 'success' })
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
    const confirmed = await window.appConfirm('Are you sure you want to reject this request?')
    if (!confirmed) return

    setLoading(true)
    try {
      const res = await apiFetch(`/requests/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Request marked as rejected.', severity: 'info' })
        fetchRequests()
      } else {
        setSnackbar({ open: true, message: 'Failed to reject request.', severity: 'error' })
      }
    } catch (error) {
      setSnackbar({ open: true, message: `Error: ${error.message}`, severity: 'error' })
    }
    setLoading(false)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'info'
      case 'downloaded':
        return 'success'
      case 'rejected':
        return 'error'
      default:
        return 'warning'
    }
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Media Requests Portal
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* User Submission Form */}
        <Grid xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Submit Media Request</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Can't find a video or channel? Paste the source URL below to request it for scanning/ripping.
              </Typography>
              
              <Box component="form" onSubmit={handleSubmitRequest} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Title / Channel Name"
                  required
                  value={newRequest.title}
                  onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Source URL (e.g. OnlyFans/Fansly link)"
                  placeholder="https://..."
                  value={newRequest.url}
                  onChange={(e) => setNewRequest({ ...newRequest, url: e.target.value })}
                />
                <Button 
                  type="submit" 
                  variant="contained" 
                  fullWidth 
                  disabled={loading}
                  sx={{ mt: 1 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Submit Request'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Requests Status & Approval Dashboard */}
        <Grid xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {isAdmin ? 'Centralized Approval Dashboard' : 'Your Requested Media'}
              </Typography>
              
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Requested By</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <Typography variant="subtitle2" sx={{ display: 'inline' }}>
                            {req.title}
                          </Typography>
                          {req.url && (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              <a href={req.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#1976d2' }}>
                                (Source Link)
                              </a>
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{req.requested_by || 'Anonymous'}</TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={req.status ? req.status.toUpperCase() : 'PENDING'} 
                            color={getStatusColor(req.status)}
                          />
                        </TableCell>
                        <TableCell>
                          {isAdmin && (req.status === 'pending' || !req.status) ? (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button 
                                variant="contained" 
                                color="success" 
                                size="small" 
                                onClick={() => handleOpenApprove(req)}
                              >
                                Approve
                              </Button>
                              <Button 
                                variant="outlined" 
                                color="error" 
                                size="small" 
                                onClick={() => handleReject(req.id)}
                              >
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
                          No media requests found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Admin Approve Dialog */}
      <Dialog open={openApproveDialog} onClose={() => setOpenApproveDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Approve & Queue Media</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Select the Media Provider that matches this request to trigger automatic scraping and download.
          </Typography>
          
          <FormControl fullWidth>
            <InputLabel>Provider</InputLabel>
            <Select
              value={selectedProviderId}
              label="Provider"
              onChange={(e) => setSelectedProviderId(e.target.value)}
            >
              {providers.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name} ({p.base_url})</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenApproveDialog(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleApprove} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Approve & Rip'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}