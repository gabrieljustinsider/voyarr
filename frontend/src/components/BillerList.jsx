import React, { useState, useEffect, useCallback } from 'react'
import { 
  Card, CardContent, Typography, Button, Grid, TextField, Box, 
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip
} from '@mui/material'
import { apiFetch } from '../api'
import { Landmark, Plus, Edit3, Trash2 } from 'lucide-react'

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
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: '800', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', sm: 'flex-start' }, gap: 1.5, textAlign: { xs: 'center', sm: 'left' } }}>
          <Box sx={{ p: 1, borderRadius: '12px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', display: 'flex', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
            <Landmark size={28} />
          </Box>
          Subscription Billers
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<Plus size={20} />} 
          onClick={handleOpenCreate} 
          sx={{ 
            width: { xs: '100%', sm: 'auto' },
            borderRadius: '12px',
            py: 1,
            px: 3,
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
            boxShadow: '0 8px 20px rgba(236, 72, 153, 0.3)',
            '&:hover': { boxShadow: '0 12px 24px rgba(236, 72, 153, 0.5)' }
          }}
        >
          Add Biller
        </Button>
      </Box>

      <Grid container spacing={3}>
        {billers.map(biller => (
          <Grid item xs={12} sm={6} md={4} key={biller.id}>
            <Card sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              borderRadius: '20px', 
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)', 
              background: 'linear-gradient(145deg, rgba(30,30,40,0.6) 0%, rgba(15,15,25,0.9) 100%)', 
              border: '1px solid rgba(236, 72, 153, 0.2)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <Box sx={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, background: 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
              <CardContent sx={{ flexGrow: 1, position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>{biller.name}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" color="primary" onClick={() => handleOpenEdit(biller)}><Edit3 size={18} /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(biller.id)}><Trash2 size={18} /></IconButton>
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

      <Dialog 
        open={openBillerForm} 
        onClose={() => setOpenBillerForm(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            background: 'rgba(30,30,40,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5, pb: 2 }}>
          <Box sx={{ p: 1, borderRadius: '10px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', display: 'flex', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
            {editMode ? <Edit3 size={20} /> : <Plus size={20} />}
          </Box>
          {editMode ? 'Edit Biller' : 'Add New Biller'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveBiller}>
          <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, borderColor: 'rgba(255,255,255,0.05)' }}>
            <TextField fullWidth label="Biller Name" required value={billerForm.name} onChange={(e) => setBillerForm({ ...billerForm, name: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            <TextField fullWidth label="Website URL" placeholder="https://ccbill.com" value={billerForm.url} onChange={(e) => setBillerForm({ ...billerForm, url: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Support Email" type="email" value={billerForm.support_email} onChange={(e) => setBillerForm({ ...billerForm, support_email: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Support Phone" value={billerForm.support_phone} onChange={(e) => setBillerForm({ ...billerForm, support_phone: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              </Grid>
            </Grid>
            <TextField fullWidth label="Notes / Description" multiline rows={3} value={billerForm.description} onChange={(e) => setBillerForm({ ...billerForm, description: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setOpenBillerForm(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              sx={{ 
                borderRadius: '10px', 
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                boxShadow: '0 4px 14px rgba(236, 72, 153, 0.3)',
                '&:hover': { boxShadow: '0 6px 20px rgba(236, 72, 153, 0.5)' }
              }}
            >
              {editMode ? 'Save Changes' : 'Create Biller'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}