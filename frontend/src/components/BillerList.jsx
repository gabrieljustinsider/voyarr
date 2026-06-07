import React, { useState, useEffect, useCallback } from 'react'
import { 
  Card, CardContent, Typography, Button, Grid, TextField, Box, 
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import { apiFetch } from '../api'

export default function BillerList() {
  const [billers, setBillers] = useState([])
  const [openBillerForm, setOpenBillerForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [billerFormId, setBillerFormId] = useState(null)
  
  const [billerForm, setBillerForm] = useState({
    name: '',
    url: '',
    support_email: '',
    support_phone: '',
    description: ''
  })

  const fetchBillers = useCallback(async () => {
    try {
      const response = await apiFetch('/billers')
      if (response.ok) {
        setBillers(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch billers:', error)
    }
  }, [])

  useEffect(() => {
    fetchBillers()
  }, [fetchBillers])

  const handleOpenCreate = () => {
    setEditMode(false)
    setBillerFormId(null)
    setBillerForm({ name: '', url: '', support_email: '', support_phone: '', description: '' })
    setOpenBillerForm(true)
  }

  const handleOpenEdit = (biller) => {
    setEditMode(true)
    setBillerFormId(biller.id)
    setBillerForm({
      name: biller.name || '',
      url: biller.url || '',
      support_email: biller.support_email || '',
      support_phone: biller.support_phone || '',
      description: biller.description || ''
    })
    setOpenBillerForm(true)
  }

  const handleSaveBiller = async (e) => {
    e.preventDefault()
    try {
      const method = editMode ? 'PUT' : 'POST'
      const endpoint = editMode ? `/billers/${billerFormId}` : '/billers'
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(billerForm)
      })

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: `Biller successfully ${editMode ? 'updated' : 'created'}!`, severity: 'success' } 
        }))
        setOpenBillerForm(false)
        fetchBillers()
      } else {
        const err = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.detail, severity: 'error' } }))
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message, severity: 'error' } }))
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await window.appConfirm('Are you sure you want to delete this biller? Associated subscriptions will clear their biller assignment.')
    if (!confirmed) return

    try {
      const res = await apiFetch(`/billers/${id}`, { method: 'DELETE' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Biller deleted!', severity: 'success' } }))
        fetchBillers()
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Subscription Billers</Typography>
        <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Add Biller
        </Button>
      </Box>

      <Grid container spacing={3}>
        {billers.map(biller => (
          <Grid item xs={12} sm={6} md={4} key={biller.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>{biller.name}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" color="primary" onClick={() => handleOpenEdit(biller)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(biller.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </Box>
                </Box>
                {biller.url && <Typography variant="body2" color="text.secondary" gutterBottom>{biller.url}</Typography>}
                {biller.support_email && <Typography variant="caption" display="block">Email: {biller.support_email}</Typography>}
                {biller.support_phone && <Typography variant="caption" display="block">Phone: {biller.support_phone}</Typography>}
                {biller.description && <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>{biller.description}</Typography>}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={openBillerForm} onClose={() => setOpenBillerForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{editMode ? 'Edit Biller' : 'Add New Biller'}</DialogTitle>
        <Box component="form" onSubmit={handleSaveBiller}>
          <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Biller Name" required value={billerForm.name} onChange={(e) => setBillerForm({ ...billerForm, name: e.target.value })} />
            <TextField fullWidth label="Website URL" placeholder="https://ccbill.com" value={billerForm.url} onChange={(e) => setBillerForm({ ...billerForm, url: e.target.value })} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Support Email" type="email" value={billerForm.support_email} onChange={(e) => setBillerForm({ ...billerForm, support_email: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Support Phone" value={billerForm.support_phone} onChange={(e) => setBillerForm({ ...billerForm, support_phone: e.target.value })} />
              </Grid>
            </Grid>
            <TextField fullWidth label="Notes / Description" multiline rows={3} value={billerForm.description} onChange={(e) => setBillerForm({ ...billerForm, description: e.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenBillerForm(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="secondary">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}