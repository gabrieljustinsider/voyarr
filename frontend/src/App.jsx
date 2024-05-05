import { useState, useEffect } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { CssBaseline, AppBar, Toolbar, Typography, Container, Tabs, Tab, Box, Paper, Snackbar, Alert } from '@mui/material'
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

function App() {
  const [providers, setProviders] = useState([])
  const [filteredProviders, setFilteredProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [credentials, setCredentials] = useState({ username: '', password: '', dailyLimit: '' })
  const [queue, setQueue] = useState([])
  const [tabValue, setTabValue] = useState(0)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [searchQuery, setSearchQuery] = useState('')

  const API_BASE = 'http://localhost:8000'

  const fetchProviders = async () => {
    try {
      const response = await fetch(`${API_BASE}/providers`)
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
  }

  const fetchQueue = async () => {
    try {
      const response = await fetch(`${API_BASE}/progress/1`)
      if (response.ok) {
        const data = await response.json()
        setQueue([data])
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line
    fetchProviders()
    fetchQueue()
    const interval = setInterval(fetchQueue, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setFilteredProviders(
      providers.filter(provider =>
        provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.base_url.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
  }, [providers, searchQuery])

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
        headers: { 'Content-Type': 'application/json' },
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
            <Tab label="Rules & Lists" />
            <Tab label="Duplicates" />
            <Tab label="Adv. Preferences" />
            <Tab label="Metadata" />
            <Tab label="External APIs" />
            <Tab label="Settings" />
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
            {tabValue === 5 && <DownloadQueue queue={queue} />}
            {tabValue === 6 && <DownloadRules />}
            {tabValue === 7 && <Duplicates />}
            {tabValue === 8 && <PreferencesAdvanced />}
            {tabValue === 9 && <MetadataManager />}
            {tabValue === 10 && <ExternalAPIs />}
            {tabValue === 11 && <Settings />}
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
    </ThemeProvider>
  )
}

export default App
