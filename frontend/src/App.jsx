import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [credentials, setCredentials] = useState({ username: '', password: '' })

  useEffect(() => {
    // TODO: Fetch providers from API
    setProviders([
      { id: 1, name: 'Example Provider', base_url: 'https://example.com' }
    ])
  }, [])

  const handleCredentialSubmit = async (e) => {
    e.preventDefault()
    // TODO: Send to API
    console.log('Submitting credentials for provider', selectedProvider, credentials)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Jizzarr</h1>
        <p>Self-hosted media management ecosystem</p>
      </header>

      <main className="main">
        <section className="section">
          <h2>Providers</h2>
          <div className="providers-list">
            {providers.map(provider => (
              <div key={provider.id} className="provider-card">
                <h3>{provider.name}</h3>
                <p>{provider.base_url}</p>
                <button onClick={() => setSelectedProvider(provider.id)}>
                  Configure Credentials
                </button>
              </div>
            ))}
          </div>
        </section>

        {selectedProvider && (
          <section className="section">
            <h2>Credentials</h2>
            <form onSubmit={handleCredentialSubmit} className="credentials-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  required
                />
              </div>
              <button type="submit">Save Credentials</button>
            </form>
          </section>
        )}

        <section className="section">
          <h2>Download Queue</h2>
          <p>Progress indicators will appear here</p>
          {/* TODO: Add download queue component */}
        </section>
      </main>
    </div>
  )
}

export default Appimport { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [credentials, setCredentials] = useState({ username: '', password: '' })

  useEffect(() => {
    // TODO: Fetch providers from API
    setProviders([
      { id: 1, name: 'Example Provider', base_url: 'https://example.com' }
    ])
  }, [])

  const handleCredentialSubmit = async (e) => {
    e.preventDefault()
    // TODO: Send to API
    console.log('Submitting credentials for provider', selectedProvider, credentials)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Jizzarr</h1>
        <p>Self-hosted media management ecosystem</p>
      </header>

      <main className="main">
        <section className="section">
          <h2>Providers</h2>
          <div className="providers-list">
            {providers.map(provider => (
              <div key={provider.id} className="provider-card">
                <h3>{provider.name}</h3>
                <p>{provider.base_url}</p>
                <button onClick={() => setSelectedProvider(provider.id)}>
                  Configure Credentials
                </button>
              </div>
            ))}
          </div>
        </section>

        {selectedProvider && (
          <section className="section">
            <h2>Credentials</h2>
            <form onSubmit={handleCredentialSubmit} className="credentials-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  required
                />
              </div>
              <button type="submit">Save Credentials</button>
            </form>
          </section>
        )}

        <section className="section">
          <h2>Download Queue</h2>
          <p>Progress indicators will appear here</p>
          {/* TODO: Add download queue component */}
        </section>
      </main>
    </div>
  )
}

export default App
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
