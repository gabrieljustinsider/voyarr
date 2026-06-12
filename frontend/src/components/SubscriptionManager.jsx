import React, { useState, useEffect, useMemo } from 'react'
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
  Divider,
  Autocomplete,
  TablePagination,
  InputAdornment
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
  RotateCcw,
  Search
} from 'lucide-react'

const TIMEFRAME_OPTIONS = [
  {value: 'monthly', label: '1 Month'}, 
  {value: '3_months', label: '3 Months'}, 
  {value: '6_months', label: '6 Months'}, 
  {value: 'yearly', label: '1 Year'}, 
  {value: 'once', label: 'One-Time Pay'}
];

const STATUS_OPTIONS = [
  {value: 'active', label: 'Active'}, 
  {value: 'expired', label: 'Expired'}, 
  {value: 'cancelled', label: 'Cancelled'}, 
  {value: 'trial', label: 'Trial Mode'}
];

const CHARGE_TYPE_OPTIONS = [
  {value: 'bulk', label: '1 Bulk Charge'}, 
  {value: 'installments', label: 'Divide Cost (Installments)'}
];

const INSTALLMENT_FREQ_OPTIONS = [
  {value: 'weekly', label: 'Weekly'}, 
  {value: 'biweekly', label: 'Bi-Weekly'}, 
  {value: 'monthly', label: 'Monthly'}
];

export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState([])
  const [tiers, setTiers] = useState([])
  const [providers, setProviders] = useState([])
  const [billers, setBillers] = useState([])
  
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
    biller_id: '',
    billing_cycle: 'monthly',
    cost: 0.00,
    charge_type: 'bulk',
    installment_frequency: 'monthly'
  })
  
  const [subSearchQuery, setSubSearchQuery] = useState('')

  // Tier Form State
  const [newTier, setNewTier] = useState({ 
    provider_id: '', 
    name: '', 
    level: 0, 
    price: 0, 
    features: [] 
  })
  const [isEditingTier, setIsEditingTier] = useState(false)
  const [editingTierId, setEditingTierId] = useState(null)
  const [tierPage, setTierPage] = useState(0)
  const [tierRowsPerPage, setTierRowsPerPage] = useState(5)

  const fetchData = async () => {
    try {
      const [subsRes, tiersRes, provRes, billersRes] = await Promise.all([
        apiFetch('/subscriptions'),
        apiFetch('/subscriptions/tiers'),
        apiFetch('/providers'),
        apiFetch('/billers')
      ])
      if (subsRes.ok) setSubscriptions(await subsRes.json())
      if (tiersRes.ok) setTiers(await tiersRes.json())
      if (provRes.ok) setProviders(await provRes.json())
      if (billersRes.ok) setBillers(await billersRes.json())
    } catch (e) {
      console.error("Failed to fetch subscription data", e)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatDatetimeForInput = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return ''
      // The `datetime-local` input requires the value to be in the format YYYY-MM-DDTHH:MM
      // in the user's local timezone. `toISOString()` converts to UTC, which can display the wrong time.
      // We build the string manually from the local date components to ensure correctness.
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
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
      biller_id: subForm.biller_id ? parseInt(subForm.biller_id, 10) : null,
      cost: parseFloat(subForm.cost) || 0,
      trial_start: subForm.is_trial && subForm.trial_start ? new Date(subForm.trial_start).toISOString() : null,
      trial_end: subForm.is_trial && subForm.trial_end ? new Date(subForm.trial_end).toISOString() : null,
      start_date: subForm.start_date ? new Date(subForm.start_date).toISOString() : null,
      end_date: subForm.end_date ? new Date(subForm.end_date).toISOString() : null,
      charge_type: subForm.charge_type,
      installment_frequency: subForm.installment_frequency
    }

    try {
      let res
      if (isEditingSub) {
        res = await apiFetch(`/subscriptions/${editingSubId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        res = await apiFetch('/subscriptions', {
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
      biller_id: sub.biller_id || '',
      billing_cycle: sub.billing_cycle || 'monthly',
      cost: sub.cost || 0.00,
      charge_type: sub.charge_type || 'bulk',
      installment_frequency: sub.installment_frequency || 'monthly'
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
      biller_id: '',
      billing_cycle: 'monthly',
      cost: 0.00,
      charge_type: 'bulk',
      installment_frequency: 'monthly'
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
    
    const matchedBiller = billers.find(b => b.name.toLowerCase() === parseResult.biller?.toLowerCase())

    setSubForm(prev => ({
      ...prev,
      cost: parseResult.cost || 0.00,
      billing_cycle: parseResult.billing_cycle || 'monthly',
      biller_id: matchedBiller ? matchedBiller.id : '',
      is_trial: !!parseResult.is_trial,
      status: parseResult.status || 'active'
    }))
    setParseResult(null)
    setEmailText('')
    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message: 'Parsed details applied to the subscription form!', severity: 'info' } 
    }))
  }

  const resetTierForm = () => {
    setIsEditingTier(false)
    setEditingTierId(null)
    setNewTier({ provider_id: '', name: '', level: 0, price: 0, features: [] })
  }

  const handleEditTier = (tier) => {
    setIsEditingTier(true)
    setEditingTierId(tier.id)
    setNewTier({
      provider_id: tier.provider_id || '',
      name: tier.name || '',
      level: tier.level || 0,
      price: tier.price || 0,
      features: tier.features || []
    })
  }

  // Tier Save (Create & Update)
  const handleSaveTier = async (e) => {
    e.preventDefault()
    if (!newTier.provider_id) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Please select a provider for this tier.', severity: 'warning' } 
      }))
      return
    }
    try {
      const payload = {
        ...newTier,
        provider_id: parseInt(newTier.provider_id, 10),
        price: parseFloat(newTier.price) || 0
      }
      
      const url = isEditingTier ? `/subscriptions/tiers/${editingTierId}` : '/subscriptions/tiers'
      const method = isEditingTier ? 'PUT' : 'POST'
      
      const res = await apiFetch(url, { method, body: JSON.stringify(payload) })
      
      if (res.ok) {
        resetTierForm()
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: `Subscription tier ${isEditingTier ? 'updated' : 'added'} successfully!`, severity: 'success' } 
        }))
        fetchData()
      } else {
        throw new Error(`Failed to ${isEditingTier ? 'update' : 'create'} tier.`)
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
        if (editingTierId === id) resetTierForm()
      } else {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to delete subscription tier.')
      }
    } catch(e) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: e.message || 'Network error deleting tier.', severity: 'error' } 
      }))
    }
  }

  const handleChangeTierPage = (event, newPage) => {
    setTierPage(newPage)
  }

  const handleChangeTierRowsPerPage = (event) => {
    setTierRowsPerPage(parseInt(event.target.value, 10))
    setTierPage(0)
  }

  // Calculate estimated total monthly spend
  const totalMonthlySpend = useMemo(() => {
    return subscriptions.reduce((total, sub) => {
      if (sub.status !== 'active' || sub.is_trial) return total;
      const cost = parseFloat(sub.cost) || 0;
      
      let monthlyCost = cost;
      if (sub.billing_cycle === 'yearly') monthlyCost = cost / 12;
      else if (sub.billing_cycle === '6_months') monthlyCost = cost / 6;
      else if (sub.billing_cycle === '3_months') monthlyCost = cost / 3;
      else if (sub.billing_cycle === 'once') monthlyCost = 0;
      
      return total + monthlyCost;
    }, 0);
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const query = subSearchQuery.toLowerCase();
    return subscriptions.filter(sub => {
      const providerName = providers.find(p => p.id === sub.provider_id)?.name || '';
      const tierName = tiers.find(t => t.id === sub.tier_id)?.name || '';
      const billerName = billers.find(b => b.id === sub.biller_id)?.name || '';
      return providerName.toLowerCase().includes(query) ||
             tierName.toLowerCase().includes(query) ||
             billerName.toLowerCase().includes(query) ||
             sub.status.toLowerCase().includes(query);
    });
  }, [subscriptions, providers, tiers, billers, subSearchQuery]);

  // Memoize tier options based on the currently selected provider
  const tierOptions = useMemo(() => {
    return [
      { id: '', name: 'None / Free Tier' },
      ...tiers
        .filter(t => t.provider_id === parseInt(subForm.provider_id, 10))
        .map(t => ({ id: t.id, name: `${t.name} ($${t.price}/mo)` }))
    ];
  }, [tiers, subForm.provider_id]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 1400, mx: 'auto' }}>
      {/* Title */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1 }}>
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
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: '900', letterSpacing: '0.5px' }}>
            Subscription &amp; Trial Manager
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Manually track your active media subscriptions, trials, billers, and configured tiers.
          </Typography>
        </Box>
      </Box>

      {/* Main Grid Content */}
      <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
        
        {/* Left Side: Subscriptions List & Email Parser */}
        <Grid item xs={12} lg={7} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Active Subscriptions Card */}
          <Paper sx={{ 
            p: 3, 
            border: '1px solid rgba(255, 255, 255, 0.05)', 
            background: 'rgba(255, 255, 255, 0.01)', 
            borderRadius: '16px',
            backdropFilter: 'blur(16px)',
            mx: 'auto',
            width: '100%'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CreditCard size={20} className="text-primary-main" /> Active Subscriptions &amp; Trials
              </Typography>
              <Chip 
                label={`Est. Monthly Spend: $${totalMonthlySpend.toFixed(2)}`} 
                color="primary" 
                variant="outlined" 
                size="small" 
                sx={{ fontWeight: 'bold' }} 
              />
            </Box>
            
            <TextField
              fullWidth
              size="small"
              placeholder="Search subscriptions by provider, tier, biller, or status..."
              value={subSearchQuery}
              onChange={(e) => setSubSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>
              }}
              sx={{ mb: 2 }}
            />

            {filteredSubscriptions.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                <Typography variant="body2" color="textSecondary">
                  {subscriptions.length === 0 ? "No active subscriptions or trials tracked yet." : "No subscriptions match your search."}
                </Typography>
              </Box>
            ) : (
              <List sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 0 }}>
                {filteredSubscriptions.map(sub => {
                  const provider = providers.find(p => p.id === sub.provider_id)
                  const tier = tiers.find(t => t.id === sub.tier_id)
                  const biller = billers.find(b => b.id === sub.biller_id)
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
                              Biller: {biller?.name || 'Manual'} &bull; Timeframe: <span style={{ textTransform: 'capitalize' }}>{sub.billing_cycle.replace('_', ' ')}</span>
                              {['3_months', '6_months', 'yearly'].includes(sub.billing_cycle) ? ` (${sub.charge_type === 'installments' ? sub.installment_frequency + ' installments' : 'bulk charge'})` : ''}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, gap: 1.5 }}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="subtitle2" fontWeight="black" color="text.primary">
                            ${sub.cost.toFixed(2)} {sub.charge_type === 'installments' ? '(Total)' : ''}
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
            borderRadius: '16px',
            mx: 'auto',
            width: '100%'
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
            borderRadius: '16px',
            mx: 'auto',
            width: '100%'
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
                  <Autocomplete
                    options={providers}
                    getOptionLabel={(option) => option?.name || ''}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    value={providers.find(p => p.id === subForm.provider_id) || null}
                    onChange={(e, newValue) => setSubForm({ ...subForm, provider_id: newValue ? newValue.id : '', tier_id: '' })}
                    renderInput={(params) => <TextField {...params} label="Media Provider" size="small" required />}
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12}>
                  <Autocomplete
                    options={tierOptions}
                    getOptionLabel={(option) => option?.name || ''}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    value={tierOptions.find(t => t.id === subForm.tier_id) || tierOptions[0]}
                    onChange={(e, newValue) => setSubForm({ ...subForm, tier_id: newValue ? newValue.id : '' })}
                    disabled={!subForm.provider_id}
                    renderInput={(params) => <TextField {...params} label="Subscription Tier" size="small" />}
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={billers}
                    getOptionLabel={(option) => option?.name || ''}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    value={billers.find(b => b.id === subForm.biller_id) || null}
                    onChange={(e, newValue) => setSubForm({ ...subForm, biller_id: newValue ? newValue.id : '' })}
                    renderInput={(params) => <TextField {...params} label="Biller" size="small" />}
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Total Cost ($)"
                    type="number"
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: "0.01" }}
                    value={subForm.cost}
                    onChange={e => setSubForm({ ...subForm, cost: e.target.value })}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={TIMEFRAME_OPTIONS}
                    getOptionLabel={(option) => option?.label || ''}
                    isOptionEqualToValue={(option, value) => option?.value === value?.value}
                    value={TIMEFRAME_OPTIONS.find(o => o.value === subForm.billing_cycle) || null}
                    onChange={(e, newValue) => setSubForm({ ...subForm, billing_cycle: newValue ? newValue.value : 'monthly' })}
                    renderInput={(params) => <TextField {...params} label="Timeframe" size="small" />}
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={STATUS_OPTIONS}
                    getOptionLabel={(option) => option?.label || ''}
                    isOptionEqualToValue={(option, value) => option?.value === value?.value}
                    value={STATUS_OPTIONS.find(o => o.value === subForm.status) || null}
                    onChange={(e, newValue) => setSubForm({ ...subForm, status: newValue ? newValue.value : 'active' })}
                    renderInput={(params) => <TextField {...params} label="Status" size="small" />}
                    fullWidth
                  />
                </Grid>

                {['3_months', '6_months', 'yearly'].includes(subForm.billing_cycle) && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        options={CHARGE_TYPE_OPTIONS}
                        getOptionLabel={(option) => option?.label || ''}
                        isOptionEqualToValue={(option, value) => option?.value === value?.value}
                        value={CHARGE_TYPE_OPTIONS.find(o => o.value === subForm.charge_type) || null}
                        onChange={(e, newValue) => setSubForm({ ...subForm, charge_type: newValue ? newValue.value : 'bulk' })}
                        renderInput={(params) => <TextField {...params} label="Charge Type" size="small" />}
                        fullWidth
                      />
                    </Grid>
                    {subForm.charge_type === 'installments' && (
                      <Grid item xs={12} sm={6}>
                        <Autocomplete
                          options={INSTALLMENT_FREQ_OPTIONS}
                          getOptionLabel={(option) => option?.label || ''}
                          isOptionEqualToValue={(option, value) => option?.value === value?.value}
                          value={INSTALLMENT_FREQ_OPTIONS.find(o => o.value === subForm.installment_frequency) || null}
                          onChange={(e, newValue) => setSubForm({ ...subForm, installment_frequency: newValue ? newValue.value : 'monthly' })}
                          renderInput={(params) => <TextField {...params} label="Installment Frequency" size="small" />}
                          fullWidth
                        />
                      </Grid>
                    )}
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

                {/* Free Trial Row — toggle + dates on same row */}
                <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={subForm.is_trial} 
                        onChange={e => setSubForm({ ...subForm, is_trial: e.target.checked })} 
                      />
                    }
                    label="Free Trial?"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="datetime-local"
                    label="Trial Start"
                    InputLabelProps={{ shrink: true }}
                    disabled={!subForm.is_trial}
                    value={subForm.trial_start}
                    onChange={e => setSubForm({ ...subForm, trial_start: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="datetime-local"
                    label="Trial End"
                    InputLabelProps={{ shrink: true }}
                    disabled={!subForm.is_trial}
                    value={subForm.trial_end}
                    onChange={e => setSubForm({ ...subForm, trial_end: e.target.value })}
                  />
                </Grid>

                <Grid item xs={12} sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="secondary"
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
            borderRadius: '16px',
            mx: 'auto',
            width: '100%'
          }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Layers size={20} /> Manage Provider Tiers
            </Typography>

            <form onSubmit={handleSaveTier}>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                  <Autocomplete
                    options={providers}
                    getOptionLabel={(option) => option?.name || ''}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    value={providers.find(p => p.id === newTier.provider_id) || null}
                    onChange={(e, newValue) => setNewTier({...newTier, provider_id: newValue ? newValue.id : ''})}
                    renderInput={(params) => <TextField {...params} label="Select Provider" size="small" required />}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth
                    size="small" 
                    label="Tier Name (e.g. Gold)" 
                    required
                    InputLabelProps={{ shrink: true }}
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
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: "0.01" }}
                    value={newTier.price} 
                    onChange={e => setNewTier({...newTier, price: parseFloat(e.target.value) || 0})}
                  />
                </Grid>
                <Grid item xs={12} sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                  <Button type="submit" variant={isEditingTier ? "contained" : "outlined"} color="primary" startIcon={!isEditingTier && <Plus size={16} />}>
                    {isEditingTier ? 'Update Provider Tier' : 'Add Provider Tier'}
                  </Button>
                  {isEditingTier && (
                    <Button variant="outlined" color="inherit" onClick={resetTierForm}>
                      Cancel
                    </Button>
                  )}
                </Grid>
              </Grid>
            </form>

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px', overflowX: 'auto', mx: 'auto', width: '100%' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Provider</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Name</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Price</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
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
                    tiers
                      .slice(tierPage * tierRowsPerPage, tierPage * tierRowsPerPage + tierRowsPerPage)
                      .map(tier => (
                        <TableRow key={tier.id} hover>
                          <TableCell align="center" sx={{ fontSize: '0.8rem' }}>{providers.find(p => p.id === tier.provider_id)?.name || tier.provider_id}</TableCell>
                          <TableCell align="center" sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{tier.name}</TableCell>
                          <TableCell align="center" sx={{ fontSize: '0.8rem' }}>${Number(tier.price).toFixed(2)}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <IconButton color="primary" size="small" onClick={() => handleEditTier(tier)}>
                              <Edit3 size={14} />
                            </IconButton>
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
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={tiers.length}
              rowsPerPage={tierRowsPerPage}
              page={tierPage}
              onPageChange={handleChangeTierPage}
              onRowsPerPageChange={handleChangeTierRowsPerPage}
            />
          </Paper>

        </Grid>
        
      </Grid>
    </Box>
  )
}
