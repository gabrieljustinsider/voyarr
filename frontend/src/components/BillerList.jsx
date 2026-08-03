import React, { useState, useEffect, useCallback } from 'react'
import { 
  Card, CardContent, Typography, Button, Grid, TextField, Box, 
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip, Alert, Avatar
} from '@mui/material'
import { apiFetch } from '../api'
import { Landmark, Plus, Edit3, Trash2, Globe, Mail, Phone, Heart } from 'lucide-react'
import { MediaEntityCard } from './common'
import { getFaviconFromUrl } from '../utils/logoHelpers'

function BillerCardLogo({ biller }) {
  const [imgError, setImgError] = useState(false)
  const faviconUrl = getFaviconFromUrl(biller.url)

  useEffect(() => {
    setImgError(false)
  }, [biller.url])

  const initial = biller.name ? biller.name.charAt(0).toUpperCase() : '?'

  if (faviconUrl && !imgError) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 0.75,
          borderRadius: '12px',
          bgcolor: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}
      >
        <Box 
          component="img" 
          src={faviconUrl} 
          alt={biller.name}
          onError={() => setImgError(true)}
          sx={{ 
            width: 44, 
            height: 44, 
            objectFit: 'contain',
            filter: 'drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.65)) drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.4))'
          }} 
        />
      </Box>
    )
  }

  return (
    <Avatar
      sx={{ 
        width: 50, 
        height: 50, 
        bgcolor: 'secondary.main', 
        color: 'secondary.contrastText',
        fontSize: '1.5rem', 
        fontWeight: 'bold'
      }}
    >
      {initial}
    </Avatar>
  )
}

export default function BillerList() {
  const [billers, setBillers] = useState([])
  const [favBillers, setFavBillers] = useState([])
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
      const favRes = await apiFetch('/favorites')
      if (favRes.ok) {
        const favs = await favRes.json()
        setFavBillers(favs.biller || [])
      }
    } catch (error) {
      console.error('Failed to fetch billers:', error)
    }
  }, [])

  useEffect(() => {
    fetchBillers()
  }, [fetchBillers])

  const handleToggleFavorite = async (billerId, billerName) => {
    const stringId = String(billerId)
    try {
      const res = await apiFetch('/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ item_type: 'biller', item_id: stringId })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.favorited) {
          setFavBillers(prev => [...prev, stringId])
          window.dispatchEvent(new CustomEvent('show-toast', { 
            detail: { message: `Favorited ${billerName}!`, severity: 'success' } 
          }))
        } else {
          setFavBillers(prev => prev.filter(x => x !== stringId))
          window.dispatchEvent(new CustomEvent('show-toast', { 
            detail: { message: `Unfavorited ${billerName}.`, severity: 'info' } 
          }))
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

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

      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        icon={<Landmark size={20} />} 
        sx={{ 
          mb: 3, 
          borderRadius: '12px', 
          bgcolor: 'rgba(236, 72, 153, 0.08)', 
          color: '#f472b6',
          border: '1px solid rgba(236, 72, 153, 0.2)',
          '& .MuiAlert-icon': { color: '#ec4899' } 
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
          💳 Subscription Billers & Payment Processors (How Access is Paid For)
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          Billers represent the payment processing entities listed on bank/credit card statements (e.g. CCBill, Probiller, Epoch, SegPay). Use Billers to map paid site access to statement descriptors and track subscription renewals.
        </Typography>
      </Alert>

      <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
        {billers.map(biller => {
          return (
            <Grid size={{ xs: 12, sm: 6, md: 6, lg: 4 }} xs={12} sm={6} md={6} lg={4} key={biller.id} sx={{ display: 'flex', minWidth: 0 }}>
              <MediaEntityCard
                mediaHeader={<BillerCardLogo biller={biller} />}
                topBadges={
                  <Chip label="Biller" size="small" sx={{ fontWeight: 'bold', fontSize: '0.65rem', height: 22, bgcolor: 'rgba(236, 72, 153, 0.2)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.4)' }} />
                }
                topActions={
                  <IconButton 
                    size="small"
                    sx={{ 
                      backgroundColor: 'rgba(0,0,0,0.5)', 
                      backdropFilter: 'blur(6px)',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' } 
                    }}
                    onClick={() => handleToggleFavorite(biller.id, biller.name)}
                    color={favBillers.includes(String(biller.id)) ? "error" : "default"}
                  >
                    {favBillers.includes(String(biller.id)) ? <Heart size={18} fill="currentColor" /> : <Heart size={18} />}
                  </IconButton>
                }
                title={biller.name}
                subtitle={
                  biller.url && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, minWidth: 0, width: '100%' }}>
                      <Globe size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
                      <Typography 
                        variant="caption" 
                        component="a" 
                        href={biller.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        sx={{ 
                          textDecoration: 'none', 
                          color: '#818cf8', 
                          fontWeight: '600', 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0
                        }}
                      >
                        {biller.url.replace(/^https?:\/\/(www\.)?/, '')}
                      </Typography>
                    </Box>
                  )
                }
                description={biller.description}
                bodySections={
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
                    {biller.support_email && (
                      <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                        <Mail size={13} style={{ color: '#ec4899' }} /> {biller.support_email}
                      </Typography>
                    )}
                    {biller.support_phone && (
                      <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                        <Phone size={13} style={{ color: '#ec4899' }} /> {biller.support_phone}
                      </Typography>
                    )}
                  </Box>
                }
                footerActions={
                  <>
                    <IconButton size="small" color="primary" onClick={() => handleOpenEdit(biller)}>
                      <Edit3 size={16} />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(biller.id)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </>
                }
              />
            </Grid>
          )
        })}
      </Grid>

      <Dialog 
        open={openBillerForm} 
        onClose={() => setOpenBillerForm(false)} 
        maxWidth="sm" 
        fullWidth
        slotProps={{ paper: {
          sx: {
            borderRadius: '20px',
            background: 'rgba(30,30,40,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }
        } }}
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
              <Grid xs={12} sm={6}>
                <TextField fullWidth label="Support Email" type="email" value={billerForm.support_email} onChange={(e) => setBillerForm({ ...billerForm, support_email: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              </Grid>
              <Grid xs={12} sm={6}>
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