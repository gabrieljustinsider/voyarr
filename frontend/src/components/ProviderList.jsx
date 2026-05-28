import { useState, useEffect, useCallback } from 'react'
import { 
  Card, CardContent, CardActions, Typography, Button, Grid, TextField, Box, 
  LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, 
  IconButton, Alert, Paper 
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import apiFetch from '../api'

export default function ProviderList({ providers, searchQuery, setSearchQuery }) {
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

  // Open dialog and load existing credentials
  const handleOpenConfig = async (provider) => {
    setActiveProvider(provider)
    setDialogTab(0)
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
    } catch (error) {
      // 404 expected if no credentials exist yet
      console.log('No credentials configured yet for this provider.')
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

  return (
    <div>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Media Providers
      </Typography>
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Search Providers"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          variant="outlined"
        />
      </Box>
      <Grid container spacing={3}>
        {providers.map(provider => {
          const providerCookies = cookies.filter(c => c.provider_id === provider.id)
          
          return (
            <Grid item xs={12} sm={6} md={4} key={provider.id}>
              <Card>
                <CardContent>
                  <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                    {provider.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {provider.base_url}
                  </Typography>
                  {provider.automatic_limits && (
                    <Typography variant="body2" gutterBottom>
                      Default Daily Limit: {provider.automatic_limits.daily_downloads || 'None'}
                    </Typography>
                  )}
                  {providerCookies.length > 0 && (
                    <Box sx={{ mt: 2 }}>
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
                <CardActions>
                  <Button size="small" variant="contained" color="primary" onClick={() => handleOpenConfig(provider)}>
                    Manage Auth & Session
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {/* Unified Manage Auth & Session Modal */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Auth & Session: {activeProvider?.name}
        </DialogTitle>
        
        <Tabs 
          value={dialogTab} 
          onChange={(e, val) => setDialogTab(val)}
          variant="fullWidth"
          sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Tab label="API Credentials" />
          <Tab label="Session Cookies" />
        </Tabs>

        <DialogContent dividers>
          {dialogTab === 0 ? (
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
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Add netscape session cookie text to authenticate downloads, bypassed links, or rate-limited direct feeds securely.
              </Typography>
              
              {/* Existing Cookies list */}
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Configured Cookies
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 3, maxHeight: 180 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell>Usage / Limit</TableCell>
                      <TableCell align="right">Actions</TableCell>
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
                          <TableCell>
                            <Chip 
                              label={cookie.status} 
                              color={cookie.status === 'active' ? 'success' : cookie.status === 'expired' ? 'error' : 'warning'} 
                              size="small" 
                            />
                          </TableCell>
                          <TableCell>{cookie.downloads_used} / {cookie.download_limit || '∞'}</TableCell>
                          <TableCell align="right">
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
    </div>
  )
}
