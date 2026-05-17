import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel } from '@mui/material'

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

const getAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('voyarr_jwt')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else {
    const apiKey = localStorage.getItem('voyarr_api_key') || import.meta.env.VITE_MASTER_KEY
    if (apiKey) headers['X-Voyarr-Api-Key'] = apiKey
  }
  return headers
}

export default function RequestManager() {
  const [requests, setRequests] = useState([])
  const [openDialog, setOpenDialog] = useState(false)
  const [currentReq, setCurrentReq] = useState({ id: null, status: 'pending', notes: '' })

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/requests`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setRequests(data)
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleEdit = (req) => {
    setCurrentReq({ id: req.id, status: req.status, notes: req.notes || '' })
    setOpenDialog(true)
  }

  const handleSave = async () => {
    try {
      await fetch(`${API_BASE}/requests/${currentReq.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: currentReq.status, notes: currentReq.notes })
      })
      fetchRequests()
      setOpenDialog(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id) => {
    const confirmed = window.appConfirm ? await window.appConfirm('Are you sure you want to delete this request?') : window.confirm('Are you sure you want to delete this request?');
    if (confirmed) {
      try {
        await fetch(`${API_BASE}/requests/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        })
        fetchRequests()
      } catch (e) {
        console.error(e)
      }
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Media Request Manager</Typography>
      <TableContainer component={Paper}>
        <Table>
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
                  {req.title} 
                  {req.url && (req.url.toLowerCase().startsWith('http://') || req.url.toLowerCase().startsWith('https://')) && (
                    <a href={req.url} target="_blank" rel="noreferrer" style={{marginLeft: 8, color: '#aaa'}}>(Link)</a>
                  )}
                </TableCell>
                <TableCell>{req.requested_by || 'Anonymous'}</TableCell>
                <TableCell>{req.status.toUpperCase()}</TableCell>
                <TableCell>
                  <Button variant="outlined" size="small" onClick={() => handleEdit(req)} sx={{ mr: 1 }}>Review</Button>
                  <Button variant="outlined" color="error" size="small" onClick={() => handleDelete(req.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">No requests found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth>
        <DialogTitle>Review Request</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={currentReq.status}
              label="Status"
              onChange={(e) => setCurrentReq({ ...currentReq, status: e.target.value })}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
              <MenuItem value="downloaded">Downloaded</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Admin Notes"
            value={currentReq.notes}
            onChange={(e) => setCurrentReq({ ...currentReq, notes: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}