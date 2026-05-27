import { useState, useEffect, useRef } from 'react'
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Alert, 
  Divider, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Snackbar, 
  CircularProgress, 
  InputAdornment, 
  IconButton,
  Grid,
  Chip
} from '@mui/material'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import LockIcon from '@mui/icons-material/Lock'
import PersonIcon from '@mui/icons-material/Person'
import packageJson from '../../package.json'

// SVG Branded Logos for SSO
const GoogleSvg = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
)

const GitHubSvg = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" style={{ fill: 'currentColor' }}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
)

const DiscordSvg = () => (
  <svg viewBox="0 0 127.14 96.36" width="20" height="20" style={{ fill: '#5865F2' }}>
    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.8,6.83,77.19,77.19,0,0,0,49.5,0,105.15,105.15,0,0,0,19.06,8.07C-3.81,42.23-1,75.52,10.6,92.63a105.86,105.86,0,0,0,32,16.15,79,79,0,0,0,6.79-11,68.6,68.6,0,0,1-10.74-5.12c.91-.66,1.8-1.34,2.65-2a75.58,75.58,0,0,0,71.72,0c.85.71,1.74,1.39,2.65,2a75.58,75.58,0,0,0,71.72,0c.85.71,1.74,1.39,2.65,2a68.6,68.6,0,0,1-10.74,5.12,79,79,0,0,0,6.79,11,105.86,105.86,0,0,0,32-16.15C129.5,75.52,132.3,42.23,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
  </svg>
)

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  // First-user admin setup states
  const [hasUsers, setHasUsers] = useState(true)
  const [setupLoading, setSetupLoading] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')

  // Custom states for passkey and SSO
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [ssoOpen, setSsoOpen] = useState(false)
  const [ssoProvider, setSsoProvider] = useState('')
  const [ssoEmail, setSsoEmail] = useState('')
  const [ssoLoading, setSsoLoading] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [authConfig, setAuthConfig] = useState({ passkeys_enabled: true, sso_enabled: false, oidc_enabled: false, auth_bypass_enabled: false, auth_bypass_proxy_header_enabled: false })

  const API_BASE = import.meta.env.VITE_API_BASE || '/api'

  // Base64 helper converters (identical to Settings.jsx)
  const base64ToBuffer = (b64) => {
    const bin = window.atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
    const len = bin.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i)
    }
    return bytes.buffer
  }

  const bufferToBase64 = (buf) => {
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  // Keep a persistent abort controller reference to cancel conflicting auth challenges
  const autofillAbortRef = useRef(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    autofillAbortRef.current = controller

    const initConditionalUI = async () => {
      try {
        if (
          window.PublicKeyCredential &&
          PublicKeyCredential.isConditionalMediationAvailable
        ) {
          const isAvailable = await PublicKeyCredential.isConditionalMediationAvailable()
          if (isAvailable && active && authConfig.passkeys_enabled) {
            // Fetch challenge assertion options from the backend (with null username for conditional flow)
            const optionsRes = await fetch(`${API_BASE}/auth/passkeys/login/options`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: null })
            })

            if (!optionsRes.ok || !active) return

            const options = await optionsRes.json()
            options.challenge = base64ToBuffer(options.challenge)

            if (options.allowCredentials) {
              options.allowCredentials = options.allowCredentials.map(cred => ({
                ...cred,
                id: base64ToBuffer(cred.id)
              }))
            }

            // Trigger conditional mediation (autofill suggestion list)
            const assertion = await navigator.credentials.get({
              publicKey: options,
              mediation: 'conditional',
              signal: controller.signal
            })

            if (assertion && active) {
              const credentialId = assertion.id
              const clientDataJSON = bufferToBase64(assertion.response.clientDataJSON)
              const authenticatorData = bufferToBase64(assertion.response.authenticatorData)
              const signature = bufferToBase64(assertion.response.signature)

              const verifyPayload = {
                credential_id: credentialId,
                client_data_json: clientDataJSON,
                authenticator_data: authenticatorData,
                signature: signature
              }

              const verifyRes = await fetch(`${API_BASE}/auth/passkeys/login/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(verifyPayload)
              })

              if (verifyRes.ok && active) {
                const verifyData = await verifyRes.json()
                localStorage.setItem('voyarr_jwt', verifyData.access_token)
                setSnackbar({ open: true, message: 'Welcome back! Authenticated with Passkey autofill.', severity: 'success' })
                setTimeout(() => {
                  window.location.reload()
                }, 800)
              }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
          console.error('Passkey autofill conditional error:', err)
        }
      }
    }

    initConditionalUI()

    return () => {
      active = false
      controller.abort()
    }
  }, [authConfig.passkeys_enabled, API_BASE])

  // Fetch public auth configuration on mount
  useEffect(() => {
    const fetchAuthConfig = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/config`)
        if (res.ok) {
          const data = await res.json()
          setAuthConfig(data)
          if (data.has_users === false) setHasUsers(false)

          // Attempt autologin if bypass is enabled
          if (data.auth_bypass_enabled || data.auth_bypass_proxy_header_enabled) {
            try {
              const autoRes = await fetch(`${API_BASE}/auth/autologin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              })
              if (autoRes.ok) {
                const autoData = await autoRes.json()
                localStorage.setItem('voyarr_jwt', autoData.access_token)
                setSnackbar({ open: true, message: 'Signed in automatically via trusted connection.', severity: 'success' })
                setTimeout(() => { window.location.reload() }, 800)
                return
              }
            } catch (autoErr) {
              console.log('Autologin not applicable:', autoErr.message)
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch auth config:', err)
      }
    }
    fetchAuthConfig()
  }, [API_BASE])

  // Handle first-user admin registration
  const handleSetup = async (e) => {
    if (e) e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSetupLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'admin' })
      })
      if (res.ok) {
        const formData = new URLSearchParams()
        formData.append('username', username)
        formData.append('password', password)
        const loginRes = await fetch(`${API_BASE}/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        })
        if (loginRes.ok) {
          const loginData = await loginRes.json()
          localStorage.setItem('voyarr_jwt', loginData.access_token)
          setSnackbar({ open: true, message: 'Admin account created! Signing you in...', severity: 'success' })
          setTimeout(() => { window.location.reload() }, 800)
        }
      } else {
        const errData = await res.json()
        setError(errData.detail || 'Failed to create admin account.')
      }
    } catch (err) {
      console.error('Setup error:', err)
      setError('Network error during setup.')
    } finally {
      setSetupLoading(false)
    }
  }

  // Handle standard Username & Password form login
  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    setError('')
    try {
      const formData = new URLSearchParams()
      formData.append('username', username)
      formData.append('password', password)

      const res = await fetch(`${API_BASE}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      })

      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('voyarr_jwt', data.access_token)
        window.location.reload()
      } else {
        setError('Invalid credentials')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Network error preventing login.')
    }
  }

  // Handle native WebAuthn passkey assertion
  const handlePasskeyLogin = async () => {
    setError('')
    setPasskeyLoading(true)
    
    // Abort pending client calls to avoid conflicts
    if (autofillAbortRef.current) {
      autofillAbortRef.current.abort()
    }
    autofillAbortRef.current = new AbortController()

    try {
      // 1. Fetch challenge assertion options from the backend
      const optionsRes = await fetch(`${API_BASE}/auth/passkeys/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() || null })
      })

      if (!optionsRes.ok) {
        const errData = await optionsRes.json()
        throw new Error(errData.detail || 'Failed to fetch passkey options.')
      }

      const options = await optionsRes.json()

      // Convert challenge from base64url to ArrayBuffer
      options.challenge = base64ToBuffer(options.challenge)
      
      // If user typed user and we received specific allowed credentials, format them
      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map(cred => ({
          ...cred,
          id: base64ToBuffer(cred.id)
        }))
      }

      // 2. Trigger native WebAuthn Credential Request Prompt
      const assertion = await navigator.credentials.get({
        publicKey: options,
        signal: autofillAbortRef.current.signal
      })

      if (!assertion) {
        throw new Error('WebAuthn prompt returned empty credential.')
      }

      // 3. Serialize outputs to base64url
      const credentialId = assertion.id
      const clientDataJSON = bufferToBase64(assertion.response.clientDataJSON)
      const authenticatorData = bufferToBase64(assertion.response.authenticatorData)
      const signature = bufferToBase64(assertion.response.signature)

      const verifyPayload = {
        credential_id: credentialId,
        client_data_json: clientDataJSON,
        authenticator_data: authenticatorData,
        signature: signature
      }

      // 4. Verify signature on the backend
      const verifyRes = await fetch(`${API_BASE}/auth/passkeys/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload)
      })

      if (verifyRes.ok) {
        const verifyData = await verifyRes.json()
        localStorage.setItem('voyarr_jwt', verifyData.access_token)
        setSnackbar({ open: true, message: 'Authenticated successfully using Passkey!', severity: 'success' })
        setTimeout(() => {
          window.location.reload()
        }, 800)
      } else {
        const errData = await verifyRes.json()
        throw new Error(errData.detail || 'Passkey signature verification failed.')
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        console.log('User cancelled passkey assertion.')
      } else {
        console.error('Passkey login error:', err)
        setError(err.message || 'Passkey authentication failed.')
      }
    } finally {
      setPasskeyLoading(false)
    }
  }

  // Open Simulated OAuth popups
  const handleOpenSso = (provider) => {
    setSsoProvider(provider)
    setSsoEmail(username ? `${username.toLowerCase()}@${provider}.com` : '')
    setSsoOpen(true)
  }

  // Execute Developer simulated OAuth session
  const handleExecuteSsoLogin = async () => {
    setSsoLoading(true)
    setError('')
    try {
      // 1. Lookup SsoLink record using the lookup helper endpoint
      const lookupRes = await fetch(`${API_BASE}/auth/sso/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: ssoProvider,
          email: ssoEmail.trim()
        })
      })

      if (!lookupRes.ok) {
        const errData = await lookupRes.json()
        throw new Error(errData.detail || `This ${ssoProvider} account is not linked to any user.`)
      }

      const lookupData = await lookupRes.json()

      // 2. Perform authenticating fast-access login using link credentials
      const loginRes = await fetch(`${API_BASE}/auth/sso/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: ssoProvider,
          provider_user_id: lookupData.provider_user_id,
          token: "mock_sso_oauth_flow_token"
        })
      })

      if (loginRes.ok) {
        const loginData = await loginRes.json()
        localStorage.setItem('voyarr_jwt', loginData.access_token)
        setSsoOpen(false)
        setSnackbar({ open: true, message: `Logged in with ${ssoProvider} successfully!`, severity: 'success' })
        setTimeout(() => {
          window.location.reload()
        }, 800)
      } else {
        const errData = await loginRes.json()
        throw new Error(errData.detail || 'SSO authentication failed.')
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'SSO login simulation failed.')
      setSsoOpen(false)
    } finally {
      setSsoLoading(false)
    }
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'linear-gradient(135deg, #090a0f 0%, #121420 100%)',
      px: 2
    }}>
      <Paper sx={{ 
        p: 4, 
        width: '100%', 
        maxWidth: 420,
        borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(28, 37, 65, 0.4) 0%, rgba(10, 11, 16, 0.6) 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Top glowing ambient accent */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '4px',
          background: 'linear-gradient(90deg, transparent, #6366f1, #a855f7, transparent)',
          opacity: 0.7
        }} />

        <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box
            component="img"
            src="/app_icon.png"
            alt="Voyarr"
            sx={{
              width: 64,
              height: 64,
              mb: 1.5,
              borderRadius: '16px',
              filter: 'drop-shadow(0 0 12px rgba(99, 102, 241, 0.4))'
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography
              variant="h5"
              sx={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 900,
                letterSpacing: '1.5px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              VOYARR
            </Typography>
            <Chip
              label={`v${packageJson.version}`}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 700,
                fontFamily: "'Outfit', sans-serif",
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#a78bfa',
                border: '1px solid rgba(139, 92, 246, 0.25)',
              }}
            />
          </Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 500,
              letterSpacing: '2px',
              color: 'rgba(148, 163, 184, 0.7)',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
            }}
          >
            {hasUsers ? 'Media Server' : 'Initial Setup'}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '10px', fontSize: '0.875rem' }}>
            {error}
          </Alert>
        )}

        {/* ── First-User Admin Setup Flow ── */}
        {!hasUsers ? (
          <form onSubmit={handleSetup}>
            <Typography variant="body2" align="center" sx={{ mb: 2, opacity: 0.7, color: 'text.secondary' }}>
              Welcome! Create your administrator account to get started.
            </Typography>
            <TextField
              fullWidth
              label="Admin Username"
              margin="normal"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. administrator"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: '10px' }
              }}
            />
            <TextField
              fullWidth
              type="password"
              label="Password"
              margin="normal"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: '10px' }
              }}
            />
            <TextField
              fullWidth
              type="password"
              label="Confirm Password"
              margin="normal"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: '10px' }
              }}
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={setupLoading}
              sx={{
                mt: 3,
                mb: 1,
                py: 1.2,
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
                }
              }}
            >
              {setupLoading ? <CircularProgress size={22} color="inherit" /> : 'Create Admin Account'}
            </Button>
          </form>
        ) : (
        /* ── Standard Sign-In Form ── */
        <>
        <Typography variant="body2" align="center" sx={{ mb: 1, opacity: 0.7, color: 'text.secondary' }}>
          Please sign in to continue to your dashboard
        </Typography>

        <form onSubmit={handleLogin}>
          <TextField 
            fullWidth 
            label="Username" 
            margin="normal" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            placeholder="e.g. administrator"
            autoComplete="username webauthn"
            required 
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
              sx: { borderRadius: '10px' }
            }}
          />
          
          <TextField 
            fullWidth 
            type="password" 
            label="Password" 
            margin="normal" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="••••••••"
            required 
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
              sx: { borderRadius: '10px' }
            }}
          />

          <Button 
            fullWidth 
            type="submit" 
            variant="contained" 
            color="primary"
            sx={{ 
              mt: 3, 
              mb: 2, 
              py: 1.2, 
              borderRadius: '10px', 
              textTransform: 'none',
              fontWeight: '600',
              boxShadow: '0 4px 14px rgba(63, 81, 181, 0.4)'
            }}
          >
            Sign In with Password
          </Button>
        </form>

        {authConfig.passkeys_enabled && (
        <Button 
          fullWidth 
          variant="outlined" 
          color="secondary"
          startIcon={passkeyLoading ? <CircularProgress size={20} color="secondary" /> : <FingerprintIcon />}
          onClick={handlePasskeyLogin}
          disabled={passkeyLoading}
          sx={{ 
            py: 1.2, 
            borderRadius: '10px', 
            textTransform: 'none',
            fontWeight: '600',
            borderWidth: '1.5px',
            '&:hover': {
              borderWidth: '1.5px',
              backgroundColor: 'rgba(0, 230, 118, 0.05)'
            }
          }}
        >
          {passkeyLoading ? 'Authenticating...' : 'Sign In with Passkey'}
        </Button>
        )}

        {(authConfig.sso_enabled || authConfig.oidc_enabled) && (
        <>
        <Box sx={{ my: 3, display: 'flex', alignItems: 'center' }}>
          <Divider sx={{ flexGrow: 1, opacity: 0.2 }} />
          <Typography variant="caption" sx={{ px: 2, color: 'text.secondary', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.7rem' }}>
            Or Sign In With
          </Typography>
          <Divider sx={{ flexGrow: 1, opacity: 0.2 }} />
        </Box>

        {/* SSO fast access badges grid */}
        {authConfig.sso_enabled && (
        <Grid container spacing={2} sx={{ mb: authConfig.oidc_enabled ? 2 : 0 }}>
          <Grid item xs={4}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => handleOpenSso('google')}
              sx={{ 
                py: 1.2, 
                borderRadius: '10px', 
                borderColor: 'rgba(255,255,255,0.1)', 
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.3)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)'
                }
              }}
            >
              <GoogleSvg />
            </Button>
          </Grid>
          <Grid item xs={4}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => handleOpenSso('github')}
              sx={{ 
                py: 1.2, 
                borderRadius: '10px', 
                borderColor: 'rgba(255,255,255,0.1)', 
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.3)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)'
                }
              }}
            >
              <GitHubSvg />
            </Button>
          </Grid>
          <Grid item xs={4}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => handleOpenSso('discord')}
              sx={{ 
                py: 1.2, 
                borderRadius: '10px', 
                borderColor: 'rgba(255,255,255,0.1)', 
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.3)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)'
                }
              }}
            >
              <DiscordSvg />
            </Button>
          </Grid>
        </Grid>
        )}

        {/* OIDC Sign In */}
        {authConfig.oidc_enabled && (
          <Button
            fullWidth
            variant="outlined"
            onClick={() => { window.location.href = `${API_BASE}/auth/oidc/login` }}
            sx={{
              py: 1.2,
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: '600',
              borderColor: 'rgba(255, 152, 0, 0.3)',
              color: '#ffb74d',
              '&:hover': {
                borderColor: 'rgba(255, 152, 0, 0.5)',
                backgroundColor: 'rgba(255, 152, 0, 0.05)'
              }
            }}
          >
            Sign In with OpenID Connect
          </Button>
        )}
        </>
        )}
        </>
      )}
      </Paper>

      {/* Simulated SSO Dialog */}
      <Dialog 
        open={ssoOpen} 
        onClose={() => setSsoOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #1e202c 0%, #11121a 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pt: 3, pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              p: 1.5, 
              borderRadius: '12px', 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              display: 'inline-flex',
              color: 'text.primary'
            }}>
              {ssoProvider === 'google' && <GoogleSvg />}
              {ssoProvider === 'github' && <GitHubSvg />}
              {ssoProvider === 'discord' && <DiscordSvg />}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
              Sign in with {ssoProvider}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }} color="textSecondary">
              to continue to <strong>Voyarr Media Server</strong>
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Linked SSO Email"
              type="email"
              value={ssoEmail}
              onChange={e => setSsoEmail(e.target.value)}
              placeholder="e.g. user@example.com"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            <Typography variant="caption" sx={{ opacity: 0.5 }} color="textSecondary">
              This simulates the standard callback token redirect. It checks if the email is linked to a Voyarr profile and issues a login token.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
          <Button 
            onClick={() => setSsoOpen(false)}
            variant="text" 
            sx={{ color: 'text.secondary', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleExecuteSsoLogin}
            variant="contained" 
            color="primary"
            disabled={ssoLoading || !ssoEmail.trim() || !ssoEmail.includes('@')}
            sx={{ borderRadius: '10px', textTransform: 'none', px: 3 }}
          >
            {ssoLoading ? <CircularProgress size={20} color="inherit" /> : 'Authorize & Sign In'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global notifications toast feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity} 
          sx={{ width: '100%', borderRadius: '10px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}