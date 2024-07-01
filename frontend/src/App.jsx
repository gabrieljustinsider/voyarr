import { useState, useEffect, useCallback, useMemo } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { CssBaseline, AppBar, Toolbar, Typography, Container, Tabs, Tab, Box, Paper, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
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
import './App.css'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
})

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

function App() {
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [credentials, setCredentials] = useState({ username: '', password: '', dailyLimit: '' })
  const [queue, setQueue] = useState([])
  const [tabValue, setTabValue] = useState(0)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', onConfirm: null, onCancel: null })

  const fetchProviders = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/providers`, {
        headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
      })
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
      const response = await fetch(`${API_BASE}/download/`, {
        headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
      })
      if (response.ok) {
        const data = await response.json()
        setQueue(data)
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
    fetchQueue()
    
    const abortController = new AbortController()
    const startSSE = async () => {
      try {
        const res = await fetch(`${API_BASE}/download/stream`, {
          headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY },
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
        if (e.name !== 'AbortError') setTimeout(startSSE, 5000) // Reconnect after 5 seconds on fail
      }
    }
    startSSE()

    return () => abortController.abort()
  }, [fetchProviders, fetchQueue])

  const filteredProviders = useMemo(() => providers.filter(provider =>
    provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.base_url.toLowerCase().includes(searchQuery.toLowerCase())
  ), [providers, searchQuery])

  useEffect(() => {
    const handleToast = (e) => {
      setSnackbar({ open: true, message: e.detail.message, severity: e.detail.severity || 'info' })
    }
    window.addEventListener('show-toast', handleToast)

    // Block native dialogs globally and pipe to toasts
    window.alert = (message) => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: String(message), severity: 'info' } }))
    }
    
    window.appConfirm = (message) => new Promise((resolve) => {
      setConfirmModal({ open: true, message, onConfirm: () => resolve(true), onCancel: () => resolve(false) })
    })

    window.confirm = (message) => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Use await window.appConfirm() for async dialogs: ${message}`, severity: 'warning' } }))
      return false // Safely reject native execution
    }
    window.prompt = (message) => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Prompt blocked: ${message}`, severity: 'error' } }))
      return null // Safely block native input
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
      const response = await fetch(`${API_BASE}/credentials`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
        },
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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Voyarr - Self-hosted Media Management
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 2 }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} aria-label="voyarr tabs" variant="scrollable" scrollButtons="auto">
            <Tab label="Dashboard" />
            <Tab label="Library" />
            <Tab label="Providers" />
            <Tab label="Credentials" />
            <Tab label="Session Cookies" />
            <Tab label="Downloads" />
            <Tab label="Mass Rip" />
            <Tab label="Schedules" />
            <Tab label="Rules & Lists" />
            <Tab label="Duplicates" />
            <Tab label="Adv. Preferences" />
            <Tab label="Metadata" />
            <Tab label="External APIs" />
            <Tab label="Settings" />
            <Tab label="Backup" />
            <Tab label="Logs" />
            <Tab label="Scraper Tester" />
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {tabValue === 0 && <Dashboard />}
            {tabValue === 1 && <Library />}
            {tabValue === 2 && (
              <ProviderList 
                providers={filteredProviders} 
                onSelectProvider={(id) => {
                  setSelectedProvider(id)
                  setTabValue(3)
                }}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
            {tabValue === 3 && (
              selectedProvider ? (
                <CredentialForm 
                  credentials={credentials} 
                  setCredentials={setCredentials} 
                  onSubmit={handleCredentialSubmit} 
                />
              ) : (
                <Typography>Please select a provider first.</Typography>
              )
            )}
            {tabValue === 4 && <CookiesManager />}
          {tabValue === 5 && <DownloadQueue queue={queue} onRefresh={fetchQueue} />}
            {tabValue === 6 && <MassRip />}
            {tabValue === 7 && <ScheduleManager />}
            {tabValue === 8 && <DownloadRules />}
            {tabValue === 9 && <Duplicates />}
            {tabValue === 10 && <PreferencesAdvanced />}
            {tabValue === 11 && <MetadataManager />}
            {tabValue === 12 && <ExternalAPIs />}
            {tabValue === 13 && <Settings />}
            {tabValue === 14 && <BackupManager />}
            {tabValue === 15 && <LogsViewer />}
            {tabValue === 16 && <ScraperTester />}
          </Box>
        </Paper>
      </Container>
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
