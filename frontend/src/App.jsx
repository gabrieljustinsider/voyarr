import { useState, useEffect, useCallback, useMemo } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { 
  CssBaseline, AppBar, Toolbar, Typography, Container, Tabs, Tab, Box, 
  Paper, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, IconButton, FormControl, InputLabel, Select, MenuItem, Switch, 
  FormControlLabel, Divider, Grid
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import SettingsIcon from '@mui/icons-material/Settings'
import TuneIcon from '@mui/icons-material/Tune'
import ProviderList from './components/ProviderList'
import CredentialForm from './components/CredentialForm'
import DownloadQueue from './components/DownloadQueue'
import Settings from './components/Settings'
import Dashboard from './components/Dashboard'
import Library from './components/Library'
import Duplicates from './components/Duplicates'
import PreferencesAdvanced from './components/PreferencesAdvanced'
import MetadataManager from './components/MetadataManager'
import ExternalAPIs from './components/ExternalAPIs'
import DownloadRules from './components/DownloadRules'
import CookiesManager from './components/CookiesManager'
import MassRip from './components/MassRip'
import ScheduleManager from './components/ScheduleManager'
import BackupManager from './components/BackupManager'
import LogsViewer from './components/LogsViewer'
import ScraperTester from './components/ScraperTester'
import RequestManager from './components/RequestManager'
import Login from './components/Login'

// New Feature components
import Favorites from './components/Favorites'
import Studios from './components/Studios'
import Analytics from './components/Analytics'
import LiveStreams from './components/LiveStreams'

import { apiFetch, getAuthHeaders } from './api'
import './App.css'

// 7 Premium Theme Configurations
const themeConfigs = {
  light: {
    palette: {
      mode: 'light',
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' },
      background: { default: '#f5f5f5', paper: '#ffffff' }
    }
  },
  dark: {
    palette: {
      mode: 'dark',
      primary: { main: '#90caf9' },
      secondary: { main: '#f48fb1' },
      background: { default: '#121212', paper: '#1e1e1e' }
    }
  },
  midnight_cyber: {
    palette: {
      mode: 'dark',
      primary: { main: '#00f0ff' }, // neon cyan
      secondary: { main: '#ff007f' }, // neon pink
      background: { default: '#0a0b10', paper: '#12131a' },
      text: { primary: '#ffffff', secondary: '#8a8d9b' }
    }
  },
  sunset_rose: {
    palette: {
      mode: 'dark',
      primary: { main: '#ff7b90' }, // rose gold
      secondary: { main: '#ffb86c' }, // peach
      background: { default: '#1e121e', paper: '#2c1a2c' },
      text: { primary: '#fff0f2', secondary: '#b5a1b5' }
    }
  },
  emerald_obsidian: {
    palette: {
      mode: 'dark',
      primary: { main: '#00e676' }, // glowing emerald
      secondary: { main: '#00b0ff' }, // electric blue
      background: { default: '#08100c', paper: '#0e1a14' },
      text: { primary: '#e0f2f1', secondary: '#80cbc4' }
    }
  },
  ocean_glass: {
    palette: {
      mode: 'dark',
      primary: { main: '#00b4d8' }, // ocean blue
      secondary: { main: '#90e0ef' },
      background: { default: '#0b132b', paper: 'rgba(28, 37, 65, 0.5)' },
      text: { primary: '#ffffff', secondary: '#a5a9b4' }
    }
  },
  crimson_obsidian: {
    palette: {
      mode: 'dark',
      primary: { main: '#e50914' }, // crimson red
      secondary: { main: '#ff3333' },
      background: { default: '#000000', paper: '#111111' },
      text: { primary: '#ffffff', secondary: '#888888' }
    }
  }
}

// Typography scaling settings for Smart TV mode
const getTypography = (isTv) => {
  if (isTv) {
    return {
      fontSize: 20,
      h1: { fontSize: '4.5rem', fontWeight: 800 },
      h2: { fontSize: '3.2rem', fontWeight: 700 },
      h3: { fontSize: '2.8rem', fontWeight: 700 },
      h4: { fontSize: '2.4rem', fontWeight: 700 },
      h5: { fontSize: '1.8rem', fontWeight: 700 },
      h6: { fontSize: '1.5rem', fontWeight: 700 },
      body1: { fontSize: '1.25rem' },
      body2: { fontSize: '1.15rem' },
      button: { fontSize: '1.15rem', fontWeight: 'bold' }
    }
  }
  return {
    fontSize: 14,
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 }
  }
}

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('voyarr_jwt') || !!localStorage.getItem('voyarr_api_key'))
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [credentials, setCredentials] = useState({ username: '', password: '', dailyLimit: '' })
  const [queue, setQueue] = useState([])
  const [tabValue, setTabValue] = useState(0)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', onConfirm: null, onCancel: null })

  // Custom Preferences state
  const [themeName, setThemeName] = useState('dark')
  const [uiConfig, setUiConfig] = useState({
    showFavorites: true,
    showStudios: true,
    showAnalytics: true,
    showLive: true
  })
  const [isTvMode, setIsTvMode] = useState(false)
  const [prefDialogOpen, setPrefDialogOpen] = useState(false)

  // Temp dialog preferences state
  const [tempTheme, setTempTheme] = useState('dark')
  const [tempUiConfig, setTempUiConfig] = useState({
    showFavorites: true,
    showStudios: true,
    showAnalytics: true,
    showLive: true
  })
  const [tempTvMode, setTempTvMode] = useState(false)

  // Load preferences from DB
  const loadPreferences = useCallback(async () => {
    try {
      const res = await apiFetch('/user/stats/preferences')
      if (res.ok) {
        const data = await res.json()
        setThemeName(data.theme || 'dark')
        if (data.ui_config) {
          setUiConfig({
            showFavorites: data.ui_config.showFavorites !== false,
            showStudios: data.ui_config.showStudios !== false,
            showAnalytics: data.ui_config.showAnalytics !== false,
            showLive: data.ui_config.showLive !== false
          })
          setIsTvMode(data.ui_config.isTvMode || false)
        }
      }
    } catch (e) {
      console.error('Failed to load user preferences:', e)
    }
  }, [])

  const savePreferences = async (newTheme, newUi, newTv) => {
    try {
      const res = await apiFetch('/user/stats/preferences', {
        method: 'POST',
        body: JSON.stringify({
          theme: newTheme,
          ui_config: {
            ...newUi,
            isTvMode: newTv
          }
        })
      })
      if (res.ok) {
        setThemeName(newTheme)
        setUiConfig(newUi)
        setIsTvMode(newTv)
        setSnackbar({ open: true, message: 'Interface preferences updated successfully!', severity: 'success' })
      }
    } catch (e) {
      console.error(e)
      setSnackbar({ open: true, message: 'Failed to save settings.', severity: 'error' })
    }
  }

  // Create MUI theme dynamically based on configurations and TV scaling mode
  const currentMuiTheme = useMemo(() => {
    const baseConfig = themeConfigs[themeName] || themeConfigs.dark
    return createTheme({
      ...baseConfig,
      breakpoints: {
        values: {
          xs: 0,
          sm: 600,
          md: 960,
          lg: 1280,
          xl: 1920,
          tv: 2560,
          '4k': 3840,
        }
      },
      typography: getTypography(isTvMode),
      components: {
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: '16px',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
              }
            }
          }
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 'bold',
              padding: isTvMode ? '14px 28px' : '8px 18px'
            }
          }
        }
      }
    })
  }, [themeName, isTvMode])

  const fetchProviders = useCallback(async () => {
    try {
      const response = await apiFetch('/providers')
      if (response.ok) {
        const data = await response.json()
        setProviders(data)
      } else {
        setProviders([
          { id: 1, name: 'Example Provider', base_url: 'https://example.com', automatic_limits: { daily_downloads: 50 } }
        ])
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
      setProviders([
        { id: 1, name: 'Example Provider', base_url: 'https://example.com', automatic_limits: { daily_downloads: 50 } }
      ])
    }
  }, [])

  const fetchQueue = useCallback(async () => {
    try {
      const response = await apiFetch('/download/')
      if (response.ok) {
        const data = await response.json()
        setQueue(data)
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return

    const init = async () => {
      await fetchProviders()
      await fetchQueue()
      await loadPreferences()
    }
    init()
    
    const abortController = new AbortController()
    const startSSE = async () => {
      try {
        const res = await fetch(`${API_BASE}/download/stream`, {
          headers: getAuthHeaders(),
          signal: abortController.signal
        })
        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try { setQueue(JSON.parse(line.substring(6))) } catch (e) { console.debug('JSON Parse error', e) }
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') setTimeout(startSSE, 5000)
      }
    }
    startSSE()

    return () => abortController.abort()
  }, [isLoggedIn, fetchProviders, fetchQueue, loadPreferences])

  const filteredProviders = useMemo(() => providers.filter(provider =>
    provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.base_url.toLowerCase().includes(searchQuery.toLowerCase())
  ), [providers, searchQuery])

  useEffect(() => {
    const handleToast = (e) => {
      setSnackbar({ open: true, message: e.detail.message, severity: e.detail.severity || 'info' })
    }
    window.addEventListener('show-toast', handleToast)

    window.alert = (message) => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: String(message), severity: 'info' } }))
    }
    
    window.appConfirm = (message) => new Promise((resolve) => {
      setConfirmModal({ open: true, message, onConfirm: () => resolve(true), onCancel: () => resolve(false) })
    })

    window.confirm = (message) => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Use await window.appConfirm() for async dialogs: ${message}`, severity: 'warning' } }))
      return false
    }
    window.prompt = (message) => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Prompt blocked: ${message}`, severity: 'error' } }))
      return null
    }

    return () => window.removeEventListener('show-toast', handleToast)
  }, [])

  const handleCredentialSubmit = async (e) => {
    e.preventDefault()
    
    const payload = {
      provider_id: selectedProvider,
      username: credentials.username,
      password: credentials.password,
    }
    
    if (credentials.dailyLimit) {
      payload.custom_limits = { daily_downloads: parseInt(credentials.dailyLimit, 10) }
    }

    try {
      const response = await apiFetch('/credentials', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        setSnackbar({ open: true, message: 'Credentials saved successfully!', severity: 'success' })
        setCredentials({ username: '', password: '', dailyLimit: '' })
      } else {
        setSnackbar({ open: true, message: 'Failed to save credentials.', severity: 'error' })
      }
    } catch (error) {
      console.error('Error submitting credentials:', error)
      setSnackbar({ open: true, message: 'Error saving credentials.', severity: 'error' })
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('voyarr_jwt')
    localStorage.removeItem('voyarr_api_key')
    setIsLoggedIn(false)
    window.location.reload()
  }

  const handleOpenPrefDialog = () => {
    setTempTheme(themeName)
    setTempUiConfig(uiConfig)
    setTempTvMode(isTvMode)
    setPrefDialogOpen(true)
  }

  const handleSavePrefDialog = () => {
    savePreferences(tempTheme, tempUiConfig, tempTvMode)
    setPrefDialogOpen(false)
  }

  // Dynamic conditional Tab Panel Builder
  const allTabs = useMemo(() => [
    { label: "Dashboard", component: <Dashboard />, visible: true },
    { label: "Library", component: <Library />, visible: true },
    { label: "Favorites", component: <Favorites />, visible: uiConfig.showFavorites },
    { label: "Studios", component: <Studios />, visible: uiConfig.showStudios },
    { label: "Live Streams", component: <LiveStreams />, visible: uiConfig.showLive },
    { label: "Analytics", component: <Analytics />, visible: uiConfig.showAnalytics },
    { label: "Providers", component: (
      <ProviderList 
        providers={filteredProviders} 
        onSelectProvider={(id) => {
          setSelectedProvider(id)
          // Find credentials index dynamically
          const credsIndex = visibleTabs.findIndex(t => t.label === "Credentials")
          if (credsIndex !== -1) setTabValue(credsIndex)
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    ), visible: true },
    { label: "Credentials", component: (
      selectedProvider ? (
        <CredentialForm 
          credentials={credentials} 
          setCredentials={setCredentials} 
          onSubmit={handleCredentialSubmit} 
        />
      ) : (
        <Typography sx={{ p: 3 }}>Please select a provider first in the Providers tab.</Typography>
      )
    ), visible: true },
    { label: "Session Cookies", component: <CookiesManager />, visible: true },
    { label: "Downloads", component: <DownloadQueue queue={queue} onRefresh={fetchQueue} />, visible: true },
    { label: "Mass Rip", component: <MassRip />, visible: true },
    { label: "Schedules", component: <ScheduleManager />, visible: true },
    { label: "Rules & Lists", component: <DownloadRules />, visible: true },
    { label: "Duplicates", component: <Duplicates />, visible: true },
    { label: "Adv. Preferences", component: <PreferencesAdvanced />, visible: true },
    { label: "Metadata", component: <MetadataManager />, visible: true },
    { label: "External APIs", component: <ExternalAPIs />, visible: true },
    { label: "Settings", component: <Settings />, visible: true },
    { label: "Backup", component: <BackupManager />, visible: true },
    { label: "Logs", component: <LogsViewer />, visible: true },
    { label: "Scraper Tester", component: <ScraperTester />, visible: true },
    { label: "Request Manager", component: <RequestManager />, visible: true },
  ], [uiConfig, filteredProviders, selectedProvider, credentials, queue, fetchQueue, searchQuery])

  const visibleTabs = useMemo(() => allTabs.filter(t => t.visible), [allTabs])

  if (!isLoggedIn) {
    return (
      <ThemeProvider theme={currentMuiTheme}>
        <CssBaseline />
        <Login onLogin={() => setIsLoggedIn(true)} />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={currentMuiTheme}>
      <CssBaseline />
      <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: '800', letterSpacing: '-0.5px' }}>
            Voyarr Media Manager
          </Typography>

          {/* Settings Tune Button */}
          <IconButton color="inherit" onClick={handleOpenPrefDialog} title="Interface Preferences" sx={{ mr: 1.5 }}>
            <TuneIcon />
          </IconButton>

          <IconButton color="inherit" onClick={handleLogout} title="Logout">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ 
          p: 2.5, 
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.01)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <Tabs 
            value={tabValue >= visibleTabs.length ? 0 : tabValue} 
            onChange={(e, newValue) => setTabValue(newValue)} 
            aria-label="voyarr tabs" 
            variant="scrollable" 
            scrollButtons="auto"
            sx={{
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              '& .MuiTabs-indicator': {
                height: '3px',
                borderRadius: '3px'
              }
            }}
          >
            {visibleTabs.map(t => <Tab key={t.label} label={t.label} sx={{ fontWeight: 'bold' }} />)}
          </Tabs>
          <Box sx={{ mt: 3 }}>
            {visibleTabs[tabValue >= visibleTabs.length ? 0 : tabValue]?.component}
          </Box>
        </Paper>
      </Container>

      {/* Preferences Tuning Modal */}
      <Dialog open={prefDialogOpen} onClose={() => setPrefDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>UI Customization & Themes</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          
          {/* Theme Selector */}
          <FormControl fullWidth size="small">
            <InputLabel>Visual Theme Palette</InputLabel>
            <Select
              value={tempTheme}
              label="Visual Theme Palette"
              onChange={(e) => setTempTheme(e.target.value)}
            >
              <MenuItem value="light">Vanilla Light Mode</MenuItem>
              <MenuItem value="dark">Vanilla Dark Mode</MenuItem>
              <MenuItem value="midnight_cyber">Midnight Cyber (Cyan/Neon)</MenuItem>
              <MenuItem value="sunset_rose">Sunset Rose (Peach/Warm Plums)</MenuItem>
              <MenuItem value="emerald_obsidian">Emerald Obsidian (Emerald/Deep dark)</MenuItem>
              <MenuItem value="ocean_glass">Ocean Glassmorphism (Ocean/Translucent)</MenuItem>
              <MenuItem value="crimson_obsidian">Crimson Obsidian (High contrast Red/Black)</MenuItem>
            </Select>
          </FormControl>

          {/* TV Breakpoints toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={tempTvMode}
                onChange={(e) => setTempTvMode(e.target.checked)}
              />
            }
            label="Optimized Smart TV Layout (Widescreen targets)"
          />

          <Divider sx={{ my: 1 }} />
          
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Conditional Feature Tabs</Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={tempUiConfig.showFavorites}
                  onChange={(e) => setTempUiConfig({ ...tempUiConfig, showFavorites: e.target.checked })}
                />
              }
              label="Enable Favorites Hub"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={tempUiConfig.showStudios}
                  onChange={(e) => setTempUiConfig({ ...tempUiConfig, showStudios: e.target.checked })}
                />
              }
              label="Enable Studios Profiles"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={tempUiConfig.showLive}
                  onChange={(e) => setTempUiConfig({ ...tempUiConfig, showLive: e.target.checked })}
                />
              }
              label="Enable Live Streams capture"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={tempUiConfig.showAnalytics}
                  onChange={(e) => setTempUiConfig({ ...tempUiConfig, showAnalytics: e.target.checked })}
                />
              }
              label="Enable Analytics dashboard"
            />
          </Box>

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrefDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePrefDialog} variant="contained" color="primary">
            Apply & Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog open={confirmModal.open} onClose={() => { confirmModal.onCancel?.(); setConfirmModal({ ...confirmModal, open: false }) }} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmation Required</DialogTitle>
        <DialogContent dividers>
          <Typography>{confirmModal.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { confirmModal.onCancel?.(); setConfirmModal({ ...confirmModal, open: false }) }}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => { confirmModal.onConfirm?.(); setConfirmModal({ ...confirmModal, open: false }) }}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  )
}

export default App
