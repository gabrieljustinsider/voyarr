import { useState, useEffect, useCallback } from 'react'
import { 
  Card, CardContent, CardActions, Typography, Button, Grid, TextField, Box, 
  LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, 
  IconButton, Alert, Paper, FormControlLabel, Switch, Avatar,
  Accordion, AccordionSummary, AccordionDetails, Menu, MenuItem, Checkbox, ListItemText, ListItemIcon
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SettingsIcon from '@mui/icons-material/Settings'
import apiFetch from '../api'

export default function ProviderList({ providers, searchQuery, setSearchQuery, onRefreshProviders }) {
  const [cookies, setCookies] = useState([])
  const [openDialog, setOpenDialog] = useState(false)
  const [activeProvider, setActiveProvider] = useState(null)
  const [dialogTab, setDialogTab] = useState(0)

  // Credentials form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [dailyLimit, setDailyLimit] = useState('')

  // Cookie form state
  const [cookieText, setCookieText] = useState('')
  const [cookieLimit, setCookieLimit] = useState('')

  // Provider CRUD Form State
  const [openProviderForm, setOpenProviderForm] = useState(false)
  const [editProviderMode, setEditProviderMode] = useState(false)
  const [providerFormId, setProviderFormId] = useState(null)
  const [providerForm, setProviderForm] = useState({
    name: '',
    base_url: '',
    logo_url: '',
    favicon_url: '',
    description: '',
    naming_pattern: '{title}_{performers}_{resolution}',
    separator: '_',
    space_replacement: '_',
    automatic_limits: { daily_downloads: 50 }
  })
  const [providerLimitEnabled, setProviderLimitEnabled] = useState(false)
  const [isScraping, setIsScraping] = useState(false)

  // Card Display Settings State
  const [cardPrefs, setCardPrefs] = useState({
    showLogo: true,
    showBaseUrl: true,
    showDailyLimit: true,
    showActiveSessions: true
  })
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null)

  useEffect(() => {
    const savedPrefs = localStorage.getItem('voyarr_provider_card_prefs')
    if (savedPrefs) {
      try {
        setCardPrefs(JSON.parse(savedPrefs))
      } catch (e) {
        console.error('Failed to parse card preferences', e)
      }
    }
  }, [])

  const handleToggleCardPref = (key) => {
    const newPrefs = { ...cardPrefs, [key]: !cardPrefs[key] }
    setCardPrefs(newPrefs)
    localStorage.setItem('voyarr_provider_card_prefs', JSON.stringify(newPrefs))
  }

  const fetchCookies = useCallback(async () => {
    try {
      const response = await apiFetch('/cookies')
      if (response.ok) {
        const data = await response.json()
        setCookies(data)
      }
    } catch (error) {
      console.error('Failed to fetch cookies:', error)
    }
  }, [])

  useEffect(() => {
    fetchCookies()
  }, [fetchCookies])

  // Open dialog and load existing credentials & details
  const handleOpenConfig = async (provider) => {
    setActiveProvider(provider)
    setDialogTab(0)

    // Load Provider Form for Details tab
    setProviderFormId(provider.id)
    setProviderForm({
      name: provider.name,
      base_url: provider.base_url,
      logo_url: provider.logo_url || '',
      favicon_url: provider.favicon_url || '',
      description: provider.description || '',
      naming_pattern: provider.naming_pattern || '{title}_{performers}_{resolution}',
      separator: provider.separator || '_',
      space_replacement: provider.space_replacement || '_',
      automatic_limits: provider.automatic_limits || { daily_downloads: 50 }
    })
    setProviderLimitEnabled(!!provider.automatic_limits?.daily_downloads)
    setEditProviderMode(true)

    setUsername('')
    setPassword('')
    setDailyLimit('')
    setCookieText('')
    setCookieLimit('')

    try {
      const response = await apiFetch(`/credentials/${provider.id}`)
      if (response.ok) {
        const data = await response.json()
        setUsername(data.username || '')
        setPassword(data.password || '')
        setDailyLimit(data.custom_limits?.daily_downloads || '')
      }
    } catch (err) {
      // 404 expected if no credentials exist yet
      console.log('No credentials configured yet for this provider.', err.message)
    }
    setOpenDialog(true)
  }

  // Save Credentials
  const handleSaveCredentials = async (e) => {
    e.preventDefault()
    if (!activeProvider) return

    const payload = {
      provider_id: activeProvider.id,
      username,
      password,
    }
    
    if (dailyLimit) {
      payload.custom_limits = { daily_downloads: parseInt(dailyLimit, 10) }
    }

    try {
      const response = await apiFetch('/credentials', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Credentials saved successfully!', severity: 'success' } 
        }))
        setOpenDialog(false)
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Failed to save credentials.', severity: 'error' } 
        }))
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: error.message, severity: 'error' } 
      }))
    }
  }

  // Add Cookie
  const handleAddCookie = async () => {
    if (!activeProvider) return

    try {
      const payload = {
        provider_id: activeProvider.id,
        cookie_text: cookieText,
        download_limit: cookieLimit ? parseInt(cookieLimit, 10) : null
      }
      
      const res = await apiFetch('/cookies', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Session cookie added successfully', severity: 'success' } 
        }))
        setCookieText('')
        setCookieLimit('')
        fetchCookies()
      } else {
        const err = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: err.detail || 'Failed to add cookie', severity: 'error' } 
        }))
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: e.message, severity: 'error' } 
      }))
    }
  }

  // Delete Cookie
  const handleDeleteCookie = async (id) => {
    const confirmed = await window.appConfirm('Are you sure you want to delete this session cookie?')
    if (!confirmed) return
    
    try {
      const res = await apiFetch(`/cookies/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCookies()
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Cookie deleted successfully', severity: 'success' } 
        }))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Provider CRUD actions
  const handleOpenCreateProvider = () => {
    setEditProviderMode(false)
    setProviderFormId(null)
    setProviderForm({
      name: '',
      base_url: '',
      logo_url: '',
      favicon_url: '',
      description: '',
      naming_pattern: '{title}_{performers}_{resolution}',
      separator: '_',
      space_replacement: '_',
      automatic_limits: { daily_downloads: 50 }
    })
    setProviderLimitEnabled(false)
    setOpenProviderForm(true)
  }

  const handleScrapeSiteDetails = async () => {
    if (!providerForm.base_url) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Please enter a Base URL first.', severity: 'warning' } 
      }))
      return
    }
    
    setIsScraping(true)
    try {
      const res = await apiFetch(`/providers/scrape-url`, {
        method: 'POST',
        body: JSON.stringify({ url: providerForm.base_url })
      })
      if (res.ok) {
        const data = await res.json()
        setProviderForm(prev => ({
          ...prev,
          name: data.site_name || prev.name,
          logo_url: data.logo_url || prev.logo_url,
          favicon_url: data.favicon_url || prev.favicon_url,
          description: data.description || prev.description
        }))
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Site details scraped successfully!', severity: 'success' } 
        }))
      } else {
        const err = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: err.detail || 'Failed to scrape site details.', severity: 'error' } 
        }))
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: err.message, severity: 'error' } 
      }))
    } finally {
      setIsScraping(false)
    }
  }

  const handleSaveProvider = async (e) => {
    e.preventDefault()
    try {
      const method = editProviderMode ? 'PUT' : 'POST'
      const endpoint = editProviderMode ? `/providers/${providerFormId}` : '/providers'
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(providerForm)
      })

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: `Provider successfully ${editProviderMode ? 'updated' : 'created'}!`, severity: 'success' } 
        }))
        setOpenProviderForm(false)
        if (onRefreshProviders) onRefreshProviders()
      } else {
        const err = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: err.detail || 'Failed to save provider.', severity: 'error' } 
        }))
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: err.message, severity: 'error' } 
      }))
    }
  }

  const handleDeleteProvider = async (provider) => {
    const confirmed = await window.appConfirm(`Are you sure you want to delete the provider "${provider.name}"?`)
    if (!confirmed) return

    try {
      const res = await apiFetch(`/providers/${provider.id}`, { method: 'DELETE' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: 'Provider deleted successfully!', severity: 'success' } 
        }))
        if (onRefreshProviders) onRefreshProviders()
      } else {
        const err = await res.json()
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: err.detail || 'Failed to delete provider.', severity: 'error' } 
        }))
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: err.message, severity: 'error' } 
      }))
    }
  }

  const renderProviderFormDetails = (isModal = false) => (
    <Box component="form" onSubmit={handleSaveProvider} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
      <TextField
        fullWidth
        label="Provider Name"
        required
        value={providerForm.name}
        onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
      />
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
        <TextField
          fullWidth
          label="Base URL"
          required
          value={providerForm.base_url}
          placeholder="https://example.com"
          onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })}
        />
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={handleScrapeSiteDetails}
          disabled={!providerForm.base_url || isScraping}
          sx={{ minWidth: { sm: '180px' } }}
        >
          {isScraping ? 'Scraping...' : 'Scrape Site Details'}
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          label="Logo URL"
          value={providerForm.logo_url}
          placeholder="https://example.com/logo.png"
          onChange={(e) => setProviderForm({ ...providerForm, logo_url: e.target.value })}
        />
        {(providerForm.logo_url || providerForm.favicon_url) && (
          <Avatar
            src={providerForm.logo_url || providerForm.favicon_url}
            alt="Logo preview"
            imgProps={{ style: { objectFit: 'contain', padding: '2px' } }}
            sx={{ width: 56, height: 56, mt: 0, bgcolor: 'action.hover' }}
          >
            {providerForm.name?.charAt(0)?.toUpperCase() || '?'}
          </Avatar>
        )}
      </Box>
      <TextField
        fullWidth
        label="Favicon URL"
        value={providerForm.favicon_url}
        placeholder="https://example.com/favicon.ico"
        onChange={(e) => setProviderForm({ ...providerForm, favicon_url: e.target.value })}
      />
      <TextField
        fullWidth
        label="Description"
        multiline
        rows={3}
        value={providerForm.description}
        placeholder="Site description..."
        onChange={(e) => setProviderForm({ ...providerForm, description: e.target.value })}
      />
      <Accordion variant="outlined" sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Advanced Settings</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 1, pb: 2 }}>
          <TextField
            fullWidth
            label="File Naming Pattern"
            required
            value={providerForm.naming_pattern}
            onChange={(e) => setProviderForm({ ...providerForm, naming_pattern: e.target.value })}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Separator"
              required
              value={providerForm.separator}
              onChange={(e) => setProviderForm({ ...providerForm, separator: e.target.value })}
            />
            <TextField
              fullWidth
              label="Space Replacement"
              required
              value={providerForm.space_replacement}
              onChange={(e) => setProviderForm({ ...providerForm, space_replacement: e.target.value })}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={providerLimitEnabled}
                  onChange={(e) => {
                    setProviderLimitEnabled(e.target.checked);
                    if (!e.target.checked) {
                      setProviderForm(prev => ({ ...prev, automatic_limits: { ...prev.automatic_limits, daily_downloads: 0 } }));
                    }
                  }}
                />
              }
              label="Enable Daily Limit"
              sx={{ minWidth: '180px', whiteSpace: 'nowrap' }}
            />
            <TextField
              fullWidth
              label="Daily Limit"
              type="number"
              disabled={!providerLimitEnabled}
              required={providerLimitEnabled}
              value={providerForm.automatic_limits.daily_downloads || ''}
              onChange={(e) => setProviderForm({ 
                ...providerForm, 
                automatic_limits: { daily_downloads: parseInt(e.target.value, 10) || 0 } 
              })}
            />
          </Box>
        </AccordionDetails>
      </Accordion>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        {isModal && (
          <Button onClick={() => setOpenProviderForm(false)} sx={{ mr: 2 }}>Cancel</Button>
        )}
        <Button type="submit" variant="contained" color="secondary">
          {providerFormId ? 'Save Details' : 'Create Provider'}
        </Button>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', textAlign: { xs: 'center', sm: 'left' } }}>
          Media Providers
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, width: { xs: '100%', sm: 'auto' }, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button 
            variant="outlined" 
            color="primary" 
            startIcon={<SettingsIcon />} 
            onClick={(e) => setSettingsAnchorEl(e.currentTarget)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Display
          </Button>
          <Menu
            anchorEl={settingsAnchorEl}
            open={Boolean(settingsAnchorEl)}
            onClose={() => setSettingsAnchorEl(null)}
          >
            <MenuItem onClick={() => handleToggleCardPref('showLogo')}>
              <ListItemIcon>
                <Checkbox checked={cardPrefs.showLogo} size="small" disableRipple />
              </ListItemIcon>
              <ListItemText primary="Show Logo" />
            </MenuItem>
            <MenuItem onClick={() => handleToggleCardPref('showBaseUrl')}>
              <ListItemIcon>
                <Checkbox checked={cardPrefs.showBaseUrl} size="small" disableRipple />
              </ListItemIcon>
              <ListItemText primary="Show Base URL" />
            </MenuItem>
            <MenuItem onClick={() => handleToggleCardPref('showDailyLimit')}>
              <ListItemIcon>
                <Checkbox checked={cardPrefs.showDailyLimit} size="small" disableRipple />
              </ListItemIcon>
              <ListItemText primary="Show Daily Limit" />
            </MenuItem>
            <MenuItem onClick={() => handleToggleCardPref('showActiveSessions')}>
              <ListItemIcon>
                <Checkbox checked={cardPrefs.showActiveSessions} size="small" disableRipple />
              </ListItemIcon>
              <ListItemText primary="Show Active Sessions" />
            </MenuItem>
          </Menu>
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={<AddIcon />} 
            onClick={handleOpenCreateProvider}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Create Provider
          </Button>
        </Box>
      </Box>
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Search Providers"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          variant="outlined"
        />
      </Box>
      <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
        {providers.map(provider => {
          const providerCookies = cookies.filter(c => c.provider_id === provider.id)
          
          return (
            <Grid item xs={12} sm={6} md={4} key={provider.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <IconButton 
                  size="small" 
                  color="error" 
                  onClick={() => handleDeleteProvider(provider)}
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1, textAlign: 'center', pt: 4 }}>
                  <Avatar
                    src={provider.logo_url || provider.favicon_url || ''}
                    alt={provider.name}
                    imgProps={{ style: { objectFit: 'contain', padding: '4px' } }}
                    sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: '2rem', fontWeight: 'bold', mb: 2 }}
                  >
                    {provider.name ? provider.name.charAt(0).toUpperCase() : '?'}
                  </Avatar>
                  <Typography variant="h5" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {provider.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {provider.base_url}
                  </Typography>
                  {provider.automatic_limits && (
                    <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                      Daily Limit: {provider.automatic_limits.daily_downloads || 'Unlimited'}
                    </Typography>
                  )}
                  {providerCookies.length > 0 && (
                    <Box sx={{ mt: 3, width: '100%' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>Active Session Quotas</Typography>
                      {providerCookies.map(cookie => {
                        const limit = cookie.download_limit || 0;
                        const used = cookie.downloads_used || 0;
                        const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                        const isUnlimited = limit === 0;

                        return (
                          <Box key={cookie.id} sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {cookie.status === 'active' ? 'Active' : cookie.status === 'expired' ? 'Expired' : cookie.status}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={isUnlimited ? 100 : percentage} 
                              color={isUnlimited ? 'primary' : percentage >= 90 ? 'error' : percentage >= 75 ? 'warning' : 'primary'}
                              sx={{ height: 6, borderRadius: 3, ...(isUnlimited && { opacity: 0.5 }) }}
                            />
                          </Box>
                        )
                      })}
                    </Box>
                  )}
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                  <Button 
                    size="small" 
                    variant="contained" 
                    color="primary" 
                    onClick={() => handleOpenConfig(provider)}
                  >
                    Edit Provider
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {/* Unified Manage Auth & Session Modal */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            src={activeProvider?.logo_url || activeProvider?.favicon_url || ''}
            alt={activeProvider?.name}
            imgProps={{ style: { objectFit: 'contain', padding: '2px' } }}
            sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.9rem' }}
          >
            {activeProvider?.name ? activeProvider.name.charAt(0).toUpperCase() : '?'}
          </Avatar>
          Manage: {activeProvider?.name}
        </DialogTitle>
        
        <Tabs 
          value={dialogTab} 
          onChange={(e, val) => setDialogTab(val)}
          variant="fullWidth"
          sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Tab label="Details" />
          <Tab label="Credentials" />
          <Tab label="Session Cookies" />
        </Tabs>

        <DialogContent dividers>
          {dialogTab === 0 && renderProviderFormDetails()}
          {dialogTab === 1 && (
            <Box component="form" onSubmit={handleSaveCredentials} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                Configure credentials to let Voyarr query metadata, index search categories, and authenticate API connections contextually.
              </Typography>
              <TextField
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Custom Daily Limit (Optional)"
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                margin="normal"
                placeholder="Override default limit"
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button type="submit" variant="contained" color="success">
                  Save Credentials
                </Button>
              </Box>
            </Box>
          )}

          {dialogTab === 2 && (
            <Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Add session cookie text to authenticate downloads, bypassed links, or rate-limited direct feeds securely.
              </Typography>
              
              <Box sx={{ mt: 3, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  Configured Cookies
                </Typography>
              </Box>
          <TableContainer component={Paper} sx={{ mb: 3, maxHeight: 180, overflowX: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Usage / Limit</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cookies.filter(c => c.provider_id === activeProvider?.id).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center">No active cookies found.</TableCell>
                      </TableRow>
                    ) : (
                      cookies.filter(c => c.provider_id === activeProvider?.id).map((cookie) => (
                        <TableRow key={cookie.id}>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <Chip 
                              label={cookie.status} 
                              color={cookie.status === 'active' ? 'success' : cookie.status === 'expired' ? 'error' : 'warning'} 
                              size="small" 
                            />
                          </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{cookie.downloads_used} / {cookie.download_limit || '∞'}</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <IconButton size="small" color="error" onClick={() => handleDeleteCookie(cookie.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Add Cookie Form */}
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Add Session Cookie
              </Typography>
              <TextField 
                fullWidth 
                margin="dense" 
                label="Netscape Cookie Text / Token" 
                multiline 
                rows={3} 
                value={cookieText} 
                onChange={e => setCookieText(e.target.value)} 
              />
              <TextField 
                fullWidth 
                margin="dense" 
                type="number" 
                label="Max Downloads Limit (Optional)" 
                value={cookieLimit} 
                onChange={e => setCookieLimit(e.target.value)} 
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button 
                  onClick={handleAddCookie} 
                  variant="contained" 
                  color="primary"
                  startIcon={<AddIcon />}
                  disabled={!cookieText}
                >
                  Add Cookie
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Provider Create Modal */}
      <Dialog open={openProviderForm} onClose={() => setOpenProviderForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Create Provider
        </DialogTitle>
        <DialogContent dividers>
          {renderProviderFormDetails(true)}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
