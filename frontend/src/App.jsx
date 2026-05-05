import { useState, useEffect } from 'react'
import ProviderList from './components/ProviderList'
import CredentialForm from './components/CredentialForm'
import DownloadQueue from './components/DownloadQueue'
import './App.css'

function App() {
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [credentials, setCredentials] = useState({ username: '', password: '', dailyLimit: '' })
  const [queue, setQueue] = useState([])

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
        alert('Credentials saved successfully!')
        setCredentials({ username: '', password: '', dailyLimit: '' })
      } else {
        alert('Failed to save credentials.')
      }
    } catch (error) {
      console.error('Error submitting credentials:', error)
      alert('Error saving credentials.')
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Jizzarr</h1>
        <p>Self-hosted media management ecosystem</p>
      </header>

      <main className="main">
        <ProviderList 
          providers={providers} 
          onSelectProvider={setSelectedProvider} 
        />

        {selectedProvider && (
          <CredentialForm 
            credentials={credentials} 
            setCredentials={setCredentials} 
            onSubmit={handleCredentialSubmit} 
          />
        )}

        <DownloadQueue queue={queue} />
      </main>
    </div>
  )
}

export default App
