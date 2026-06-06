import React, { useState, useEffect } from 'react'
import { apiFetch } from '../api'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Switch,
  FormControlLabel,
  Divider
} from '@mui/material'
import { 
  Trash2, 
  Edit3, 
  Plus, 
  Sparkles, 
  CreditCard, 
  Calendar, 
  Layers, 
  Check, 
  X,
  AlertTriangle,
  RotateCcw
} from 'lucide-react'

export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState([])
  const [tiers, setTiers] = useState([])
  const [providers, setProviders] = useState([])
  
  // Email Parser State
  const [emailText, setEmailText] = useState('')
  const [parseResult, setParseResult] = useState(null)
  const [parseLoading, setParseLoading] = useState(false)

  // Subscription Form State (for Manual Create & Edit)
  const [isEditingSub, setIsEditingSub] = useState(false)
  const [editingSubId, setEditingSubId] = useState(null)
  const [subForm, setSubForm] = useState({
    provider_id: '',
    tier_id: '',
    status: 'active',
    is_trial: false,
    trial_start: '',
    trial_end: '',
    start_date: '',
    end_date: '',
    biller: '',
    billing_cycle: 'monthly',
    cost: 0.00
  })

  // Tier Form State
  const [newTier, setNewTier] = useState({ 
    provider_id: '', 
    name: '', 
    level: 0, 
    price: 0, 
    features: [] 
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [subsRes, tiersRes, provRes] = await Promise.all([
        apiFetch('/subscriptions/'),
        apiFetch('/subscriptions/tiers'),
        apiFetch('/providers/')
      ])
      if (subsRes.ok) setSubscriptions(await subsRes.json())
      if (tiersRes.ok) setTiers(await tiersRes.json())
      if (provRes.ok) setProviders(await provRes.json())
    } catch (e) {
      console.error("Failed to fetch subscription data", e)
    }
  }

  // Format Date for datetime-local Inputs (YYYY-MM-DDTHH:MM)
  const formatDatetimeForInput = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return ''
      return d.toISOString().slice(0, 16)
    } catch {
      return ''
    }
  }

  // Handle Save / Update Subscription
  const handleSaveSubscription = async (e) => {
    e.preventDefault()
    if (!subForm.provider_id) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Please select a media provider.', severity: 'warning' } 
      }))
      return
    }

    // Prepare Payload
    const payload = {
      ...subForm,
      provider_id: parseInt(subForm.provider_id, 10),
      tier_id: subForm.tier_id ? parseInt(subForm.tier_id, 10) : null,
      cost: parseFloat(subForm.cost) || 0,
      trial_start: subForm.is_trial && subForm.trial_start ? new Date(subForm.trial_start).toISOString() : null,
      trial_end: subForm.is_trial && subForm.trial_end ? new Date(subForm.trial_end).toISOString() : null,
      start_date: subForm.start_date ? new Date(subForm.start_date).toISOString() : null,
      end_date: subForm.end_date ? new Date(subForm.end_date).toISOString() : null,
    }

    try {
      let res
      if (isEditingSub) {
        res = await apiFetch(`/subscriptions/${editingSubId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        res = await apiFetch('/subscriptions/', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { 
            message: isEditingSub ? 'Subscription updated successfully!' : 'Subscription added successfully!', 
            severity: 'success' 
          } 
        }))
        resetSubForm()
        fetchData()
      } else {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to save subscription.')
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: e.message, severity: 'error' } 
      }))
    }
  }

  // Populate form to edit subscription
  const handleEditSubscription = (sub) => {
    setIsEditingSub(true)
    setEditingSubId(sub.id)
    setSubForm({
      provider_id: sub.provider_id || '',
      tier_id: sub.tier_id || '',
      status: sub.status || 'active',
      is_trial: !!sub.is_trial,
      trial_start: formatDatetimeForInput(sub.trial_start),
      trial_end: formatDatetimeForInput(sub.trial_end),
      start_date: formatDatetimeForInput(sub.start_date),
      end_date: formatDatetimeForInput(sub.end_date),
      biller: sub.biller || '',
      billing_cycle: sub.billing_cycle || 'monthly',
      cost: sub.cost || 0.00
    })
  }

  const resetSubForm = () => {
    setIsEditingSub(false)
    setEditingSubId(null)
    setSubForm({
      provider_id: '',
      tier_id: '',
      status: 'active',
      is_trial: false,
      trial_start: '',
      trial_end: '',
      start_date: '',
      end_date: '',
      biller: '',
      billing_cycle: 'monthly',
      cost: 0.00
    })
  }

  // Delete Subscription
  const handleDeleteSubscription = async (id) => {
    const confirmed = await window.appConfirm('Are you sure you want to delete this subscription?')
    if (!confirmed) return
    try {
      const res = await apiFetch(`/subscriptions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Subscription deleted successfully.', severity: 'success' } 
        }))
        fetchData()
        if (editingSubId === id) resetSubForm()
      } else {
        throw new Error('Delete failed')
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Failed to delete subscription.', severity: 'error' } 
      }))
    }
  }

  // Parse Email
  const handleParseEmail = async () => {
    if (!emailText.trim()) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Please paste email content first.', severity: 'warning' } 
      }))
      return
    }
    setParseLoading(true)
    try {
      const res = await apiFetch('/subscriptions/parse-email', {
        method: 'POST',
        body: JSON.stringify({ email_text: emailText }),
      })
      if (!res.ok) throw new Error('Parse failed')
      const data = await res.json()
      setParseResult(data.parsed_data)
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Email parsed successfully!', severity: 'success' } 
      }))
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Failed to parse email.', severity: 'error' } 
      }))
    } finally {
      setParseLoading(false)
    }
  }

  // Import parsed data directly into current manual form
  const handleApplyParsedResult = () => {
    if (!parseResult) return
    setSubForm(prev => ({
      ...prev,
      cost: parseResult.cost || 0.00,
      billing_cycle: parseResult.billing_cycle || 'monthly',
      biller: parseResult.biller || '',
      is_trial: !!parseResult.is_trial,
      status: parseResult.status || 'active'
    }))
    setParseResult(null)
    setEmailText('')
    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message: 'Parsed details applied to the subscription form!', severity: 'info' } 
    }))
  }

  // Tier Create
  const handleCreateTier = async (e) => {
    e.preventDefault()
    if (!newTier.provider_id) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Please select a provider for this tier.', severity: 'warning' } 
      }))
      return
    }
    try {
      const res = await apiFetch('/subscriptions/tiers', {
        method: 'POST',
        body: JSON.stringify({
          ...newTier,
          provider_id: parseInt(newTier.provider_id, 10)
        }),
      })
      if (res.ok) {
        setNewTier({ provider_id: '', name: '', level: 0, price: 0, features: [] })
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Subscription tier added successfully!', severity: 'success' } 
        }))
        fetchData()
      } else {
        throw new Error('Failed to create tier.')
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: e.message, severity: 'error' } 
      }))
    }
  }

  // Delete Tier
  const handleDeleteTier = async (id) => {
    const confirmed = await window.appConfirm('Are you sure you want to delete this subscription tier?')
    if (!confirmed) return
    try {
      const res = await apiFetch(`/subscriptions/tiers/${id}`, { method: 'DELETE' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Subscription tier deleted.', severity: 'success' } 
        }))
        fetchData()
      }
    } catch(e) {
      console.error(e)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Box sx={{ 
          p: 1.5, 
          borderRadius: '14px', 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'primary.main',
          display: 'inline-flex'
        }}>
          <CreditCard size={28} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: '900', letterSpacing: '0.5px' }}>
            Subscription &amp; Trial Manager
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Manually track your active media subscriptions, trials, billers, and configured tiers.
          </Typography>
        </Box>
      </Box>

      {/* Main Grid Content */}
      <Grid container spacing={3}>
        
        {/* Left Side: Subscriptions List & Email Parser */}
        <Grid item xs={12} lg={7} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Active Subscriptions Card */}
          <Paper sx={{ 
            p: 3, 
            border: '1px solid rgba(255, 255, 255, 0.05)', 
            background: 'rgba(255, 255, 255, 0.01)', 
            borderRadius: '16px',
            backdropFilter: 'blur(16px)'
          }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CreditCard size={20} className="text-primary-main" /> Active Subscriptions &amp; Trials
            </Typography>

            {subscriptions.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                <Typography variant="body2" color="textSecondary">No active subscriptions or trials tracked yet.</Typography>
              </Box>
            ) : (
              <List sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 0 }}>
                {subscriptions.map(sub => {
                  const provider = providers.find(p => p.id === sub.provider_id)
                  const tier = tiers.find(t => t.id === sub.tier_id)
                  return (
                    <Paper key={sub.id} variant="outlined" sx={{ 
                      p: 2, 
                      borderRadius: '12px', 
                      background: 'rgba(255,255,255,0.01)',
                      borderColor: 'rgba(255,255,255,0.05)',
                      '&:hover': { borderColor: 'rgba(255,255,255,0.12)' }
                    }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={8}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ 
                              width: 36, 
                              height: 36, 
                              borderRadius: '8px', 
                              backgroundColor: 'rgba(255,255,255,0.04)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              color: 'primary.main',
                              textTransform: 'uppercase'
                            }}>
                              {provider?.name ? provider.name.slice(0, 2) : 'SP'}
                            </Box>
                            <Box>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {provider?.name || `Provider ID: ${sub.provider_id}`}
                                {tier && <Chip label={tier.name} size="small" variant="outlined" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" display="block">
                                Biller: {sub.biller || 'Manual'} &bull; Cycle: <span style={{ textTransform: 'capitalize' }}>{sub.billing_cycle}</span>
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, gap: 1.5 }}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="subtitle2" fontWeight="black" color="text.primary">
                              ${sub.cost.toFixed(2)}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                              {sub.is_trial && <Chip label="Trial" color="warning" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
                              <Chip 
                                label={sub.status} 
                                size="small" 
                                color={sub.status === 'active' ? 'success' : sub.status === 'expired' ? 'error' : 'default'}
                                sx={{ height: 18, fontSize: '0.65rem' }} 
                              />
                            </Box>
                          </Box>
                          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, display: { xs: 'none', sm: 'block' } }} />
                          <Box>
                            <IconButton color="primary" size="small" onClick={() => handleEditSubscription(sub)}>
                              <Edit3 size={16} />
                            </IconButton>
                            <IconButton color="error" size="small" onClick={() => handleDeleteSubscription(sub.id)}>
                              <Trash2 size={16} />
                            </IconButton>
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  )
                })}
              </List>
            )}
          </Paper>

          {/* Email Import Card */}
          <Paper sx={{ 
            p: 3, 
            border: '1px solid rgba(255, 255, 255, 0.05)', 
            background: 'rgba(255, 255, 255, 0.01)', 
            borderRadius: '16px'
          }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Sparkles size={20} className="text-secondary-main" /> Fast Import from Email Parser
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Paste your raw confirmation email (e.g. from CCBill, Epoch, etc.) to autofill subscription details.
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="Paste subscription/trial email header and contents here..."
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
              sx={{ mb: 2 }}
            />
            
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button 
                variant="outlined" 
                onClick={handleParseEmail} 
                disabled={parseLoading || !emailText.trim()}
                startIcon={parseLoading ? <CircularProgress size={16} /> : <Sparkles size={16} />}
                sx={{ flex: 1 }}
              >
                {parseLoading ? 'Parsing...' : 'Analyze & Parse'}
              </Button>
              {emailText && (
                <Button variant="text" color="inherit" onClick={() => setEmailText('')}>
                  Clear
                </Button>
              )}
            </Box>

            {parseResult && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                <Typography variant="subtitle2" fontWeight="bold" color="primary.main" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Check size={16} /> Parsing Successful!
                </Typography>
                <Grid container spacing={1} sx={{ mb: 2 }}>
                  <Grid item xs={6}><Typography variant="caption" color="textSecondary">Biller:</Typography> <Typography variant="body2" fontWeight="bold">{parseResult.biller || 'Not detected'}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="textSecondary">Cycle:</Typography> <Typography variant="body2" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>{parseResult.billing_cycle || 'monthly'}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="textSecondary">Estimated Cost:</Typography> <Typography variant="body2" fontWeight="bold">${parseResult.cost?.toFixed(2) || '0.00'}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="textSecondary">Is Trial:</Typography> <Typography variant="body2" fontWeight="bold">{parseResult.is_trial ? 'Yes' : 'No'}</Typography></Grid>
                </Grid>
                <Button variant="contained" color="primary" fullWidth onClick={handleApplyParsedResult}>
                  Apply to Form Below
                </Button>
              </Paper>
            )}
          </Paper>

        </Grid>

        {/* Right Side: Create/Edit Form & Tiers Management */}
        <Grid item xs={12} lg={5} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Create/Edit Form Card */}
          <Paper sx={{ 
            p: 3, 
            border: '1px solid rgba(255, 255, 255, 0.05)', 
            background: 'rgba(255, 255, 255, 0.01)', 
            borderRadius: '16px'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Plus size={20} /> {isEditingSub ? 'Edit Subscription Profile' : 'Track New Subscription'}
              </Typography>
              {isEditingSub && (
                <IconButton size="small" onClick={resetSubForm}>
                  <RotateCcw size={16} />
                </IconButton>
              )}
            </Box>

            <form onSubmit={handleSaveSubscription}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Media Provider</InputLabel>
                    <Select
                      label="Media Provider"
                      value={subForm.provider_id}
                      onChange={e => setSubForm({ ...subForm, provider_id: e.target.value, tier_id: '' })}
                    >
                      {providers.map(p => (
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Subscription Tier</InputLabel>
                    <Select
                      label="Subscription Tier"
                      value={subForm.tier_id}
                      onChange={e => setSubForm({ ...subForm, tier_id: e.target.value })}
                      disabled={!subForm.provider_id}
                    >
                      <MenuItem value=""><em>None / Free Tier</em></MenuItem>
                      {tiers.filter(t => t.provider_id === parseInt(subForm.provider_id, 10)).map(t => (
                        <MenuItem key={t.id} value={t.id}>{t.name} (${t.price}/mo)</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Biller (e.g. Epoch, PayPal)"
                    value={subForm.biller}
                    onChange={e => setSubForm({ ...subForm, biller: e.target.value })}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Billing Cost ($)"
                    type="number"
                    inputProps={{ step: "0.01" }}
                    value={subForm.cost}
                    onChange={e => setSubForm({ ...subForm, cost: e.target.value })}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Billing Cycle</InputLabel>
                    <Select
                      label="Billing Cycle"
                      value={subForm.billing_cycle}
                      onChange={e => setSubForm({ ...subForm, billing_cycle: e.target.value })}
                    >
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="yearly">Yearly</MenuItem>
                      <MenuItem value="once">One-Time Pay</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={subForm.status}
                      onChange={e => setSubForm({ ...subForm, status: e.target.value })}
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="expired">Expired</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                      <MenuItem value="trial">Trial Mode</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={subForm.is_trial} 
                        onChange={e => setSubForm({ ...subForm, is_trial: e.target.checked })} 
                      />
                    }
                    label="Is this a free trial?"
                  />
                </Grid>

                {subForm.is_trial && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="datetime-local"
                        label="Trial Start"
                        InputLabelProps={{ shrink: true }}
                        value={subForm.trial_start}
                        onChange={e => setSubForm({ ...subForm, trial_start: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="datetime-local"
                        label="Trial End"
                        InputLabelProps={{ shrink: true }}
                        value={subForm.trial_end}
                        onChange={e => setSubForm({ ...subForm, trial_end: e.target.value })}
                      />
                    </Grid>
                  </>
                )}

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="datetime-local"
                    label="Start Date"
                    InputLabelProps={{ shrink: true }}
                    value={subForm.start_date}
                    onChange={e => setSubForm({ ...subForm, start_date: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="datetime-local"
                    label="Expiration / End Date"
                    InputLabelProps={{ shrink: true }}
                    value={subForm.end_date}
                    onChange={e => setSubForm({ ...subForm, end_date: e.target.value })}
                  />
                </Grid>

                <Grid item xs={12} sx={{ mt: 1 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="secondary"
                    fullWidth
                  >
                    {isEditingSub ? 'Update Subscription' : 'Create Subscription Profile'}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>

          {/* Subscription Tiers Card */}
          <Paper sx={{ 
            p: 3, 
            border: '1px solid rgba(255, 255, 255, 0.05)', 
            background: 'rgba(255, 255, 255, 0.01)', 
            borderRadius: '16px'
          }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Layers size={20} /> Manage Provider Tiers
            </Typography>

            <form onSubmit={handleCreateTier}>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Select Provider</InputLabel>
                    <Select 
                      value={newTier.provider_id}
                      label="Select Provider"
                      onChange={e => setNewTier({...newTier, provider_id: e.target.value})}
                    >
                      {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth
                    size="small" 
                    label="Tier Name (e.g. Gold)" 
                    required
                    value={newTier.name} 
                    onChange={e => setNewTier({...newTier, name: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth
                    size="small" 
                    label="Price ($)" 
                    type="number" 
                    inputProps={{ step: "0.01" }}
                    value={newTier.price} 
                    onChange={e => setNewTier({...newTier, price: parseFloat(e.target.value) || 0})}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button type="submit" variant="outlined" color="primary" fullWidth startIcon={<Plus size={16} />}>
                    Add Provider Tier
                  </Button>
                </Grid>
              </Grid>
            </form>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Provider</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tiers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="caption" color="textSecondary" display="block" sx={{ py: 2 }}>
                          No tiers configured yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tiers.map(tier => (
                      <TableRow key={tier.id} hover>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{providers.find(p => p.id === tier.provider_id)?.name || tier.provider_id}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{tier.name}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>${tier.price}</TableCell>
                        <TableCell align="right">
                          <IconButton color="error" size="small" onClick={() => handleDeleteTier(tier.id)}>
                            <Trash2 size={14} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

        </Grid>
        
      </Grid>
    </Box>
  )
}
