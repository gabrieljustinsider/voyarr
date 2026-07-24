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
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText
} from '@mui/material'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import LockIcon from '@mui/icons-material/Lock'
import PersonIcon from '@mui/icons-material/Person'
import PasswordChecklist from './PasswordChecklist'

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
  const [setupStep, setSetupStep] = useState('credentials') // 'credentials', 'passkey_prompt', 'passkey_setup', 'passkey_register'
  const [passkeyConfig, setPasskeyConfig] = useState({
    passkeys_rp_name: 'Voyarr Media Server',
    passkeys_rp_id: typeof window !== 'undefined' ? window.location.hostname : '',
    passkeys_authenticator_attachment: 'any',
    passkeys_resident_key: 'required',
    passkeys_user_verification: 'preferred',
    passkeys_timeout: 60,
    passkeys_attestation: 'none',
  })
  const [testSuccess, setTestSuccess] = useState(false)
  const [testError, setTestError] = useState('')
  const [testLoading, setTestLoading] = useState(false)

  // Custom states for passkey and SSO
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [authConfig, setAuthConfig] = useState({ passkeys_enabled: true, sso_enabled: false, oidc_enabled: false, auth_bypass_enabled: false, auth_bypass_proxy_header_enabled: false })

  const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api'

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

  const scanAaguid = (attestationObjectBuffer) => {
    const bytes = new Uint8Array(attestationObjectBuffer)
    const pattern = [0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61] // "authData"
    let authDataOffset = -1
    for (let i = 0; i <= bytes.length - pattern.length; i++) {
      let match = true
      for (let j = 0; j < pattern.length; j++) {
        if (bytes[i + j] !== pattern[j]) {
          match = false
          break;
        }
      }
      if (match) {
        const nextByte = bytes[i + pattern.length]
        if (nextByte === 0x58) {
          authDataOffset = i + pattern.length + 2
        } else if (nextByte === 0x59) {
          authDataOffset = i + pattern.length + 3
        } else if (nextByte >= 0x40 && nextByte <= 0x57) {
          authDataOffset = i + pattern.length + 1
        }
        break;
      }
    }
    if (authDataOffset !== -1 && authDataOffset + 53 <= bytes.length) {
      const flags = bytes[authDataOffset + 32]
      if (flags & 0x40) {
        const aaguidBytes = bytes.slice(authDataOffset + 37, authDataOffset + 37 + 16)
        const hex = Array.from(aaguidBytes, b => b.toString(16).padStart(2, '0')).join('')
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
      }
    }
    return null
  }

  const getClientInfo = () => {
    const ua = navigator.userAgent
    let browser = "Unknown Browser"
    let os_name = "Unknown OS"
    
    if (ua.includes("Firefox")) browser = "Firefox"
    else if (ua.includes("SamsungBrowser")) browser = "Samsung Browser"
    else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera"
    else if (ua.includes("Trident")) browser = "Internet Explorer"
    else if (ua.includes("Edge") || ua.includes("Edg")) browser = "Microsoft Edge"
    else if (ua.includes("Chrome")) browser = "Google Chrome"
    else if (ua.includes("Safari")) browser = "Apple Safari"
    
    if (ua.includes("Windows")) os_name = "Windows"
    else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os_name = "macOS"
    else if (ua.includes("Android")) os_name = "Android"
    else if (ua.includes("iPhone") || ua.includes("iPad")) os_name = "iOS"
    else if (ua.includes("Linux")) os_name = "Linux"
    
    return { browser, os_name }
  }

  const updateSettingApi = async (key, value) => {
    const jwt = localStorage.getItem('voyarr_jwt')
    return fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({ key, value })
    })
  }

  const handleDisablePasskeysAndFinish = async () => {
    setSetupLoading(true)
    setError('')
    try {
      await updateSettingApi('passkeys_enabled', 'false')
      setSnackbar({ open: true, message: 'Settings saved! Redirecting...', severity: 'success' })
      setTimeout(() => { window.location.reload() }, 800)
    } catch (err) {
      console.error(err)
      setError('Failed to disable passkeys setting, but account was created.')
      setTimeout(() => { window.location.reload() }, 1500)
    } finally {
      setSetupLoading(false)
    }
  }

  const handleTestPasskeySettings = async () => {
    setTestLoading(true)
    setTestError('')
    setTestSuccess(false)
    try {
      const jwt = localStorage.getItem('voyarr_jwt')
      const res = await fetch(`${API_BASE}/auth/passkeys/test-options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify(passkeyConfig)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to generate test options.')
      }
      const options = await res.json()
      
      // Perform Relying Party ID (RP ID) suffix validation client-side.
      // This validates that the domain suffix requirements are satisfied (preventing browser SecurityError)
      // without forcing the user to complete a dummy passkey registration on their device keychain.
      const rpId = options.rp?.id;
      const currentHost = window.location.hostname;
      
      const isValidRp = rpId && (currentHost === rpId || currentHost.endsWith('.' + rpId));
      if (!isValidRp) {
        throw new Error(
          `Security Validation Failed: Relying Party ID (${rpId || 'missing'}) is not equal to, nor a registrable domain suffix of, the current domain (${currentHost}).`
        );
      }
      
      setTestSuccess(true)
      setSnackbar({ open: true, message: 'Verification successful! Relying Party ID is valid for this domain.', severity: 'success' })
    } catch (err) {
      console.error('Test error:', err)
      setTestError(err.message || 'Verification failed. Please check your domain.')
    } finally {
      setTestLoading(false)
    }
  }

  const handleSaveAndRegisterPasskey = async () => {
    setSetupLoading(true)
    setError('')
    try {
      // 1. Save all passkey configuration settings to backend
      const settingsToSave = {
        passkeys_enabled: 'true',
        ...passkeyConfig,
        passkeys_timeout: String(passkeyConfig.passkeys_timeout)
      }
      for (const [k, v] of Object.entries(settingsToSave)) {
        await updateSettingApi(k, v)
      }

      // 2. Perform official passkey registration
      const jwt = localStorage.getItem('voyarr_jwt')
      const optionsRes = await fetch(`${API_BASE}/auth/passkeys/register/options`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}` }
      })
      if (!optionsRes.ok) {
        const err = await optionsRes.json()
        throw new Error(err.detail || 'Failed to retrieve register options')
      }
      const options = await optionsRes.json()
      
      options.challenge = base64ToBuffer(options.challenge)
      options.user.id = new TextEncoder().encode(options.user.id)
      
      const credential = await navigator.credentials.create({ publicKey: options })
      if (!credential) {
        throw new Error('Passkey registration cancelled.')
      }
      
      const attestationObject = credential.response.attestationObject
      const clientDataJSON = credential.response.clientDataJSON
      
      let publicKeyB64 = ''
      if (typeof credential.response.getPublicKey === 'function') {
        publicKeyB64 = bufferToBase64(credential.response.getPublicKey())
      }
      
      const aaguid = scanAaguid(attestationObject)
      const clientInfo = getClientInfo()
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const autoName = `Owner Key (${clientInfo.os_name} - ${timestamp})`
      
      const verifyPayload = {
        credential_id: credential.id,
        public_key: publicKeyB64,
        client_data_json: bufferToBase64(clientDataJSON),
        aaguid: aaguid || '',
        name: autoName,
        browser: clientInfo.browser,
        os_name: clientInfo.os_name,
        backup_eligible: true,
        backup_state: true
      }
      
      const verifyRes = await fetch(`${API_BASE}/auth/passkeys/register/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify(verifyPayload)
      })
      
      if (!verifyRes.ok) {
        const err = await verifyRes.json()
        throw new Error(err.detail || 'Failed to verify passkey registration')
      }
      
      setSnackbar({ open: true, message: 'Passkey registered successfully! Redirecting...', severity: 'success' })
      setTimeout(() => { window.location.reload() }, 800)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to complete passkey setup.')
    } finally {
      setSetupLoading(false)
    }
  }

  // Handle first-user admin registration
  const handleSetup = async (e) => {
    if (e) e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    const hasLength = password.length >= 8
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[^A-Za-z0-9]/.test(password)
    if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setError('Password does not meet all security requirements shown below.')
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
          setSnackbar({ open: true, message: 'Admin account created! Setting up login options...', severity: 'success' })
          setSetupStep('passkey_prompt')
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

  const handleSsoLogin = (provider) => {
    window.location.href = `${API_BASE}/auth/oidc/login?provider=${provider}`
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
        maxWidth: setupStep === 'passkey_setup' ? 760 : 420,
        transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
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
              label={`v${__APP_VERSION__}`}
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
          setupStep === 'credentials' ? (
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
                slotProps={{ input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: '10px' }
                }}}
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
                slotProps={{ input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: '10px' }
                }}}
              />
              <PasswordChecklist password={password} />
              <TextField
                fullWidth
                type="password"
                label="Confirm Password"
                margin="normal"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                slotProps={{ input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: '10px' }
                }}}
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
          ) : setupStep === 'passkey_prompt' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
              <FingerprintIcon sx={{ fontSize: 64, color: '#6366f1', mb: 2 }} />
              <Typography variant="h6" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
                Secure Your Account with Passkeys
              </Typography>
              <Typography variant="body2" align="center" sx={{ mb: 4, color: 'text.secondary', px: 2, lineHeight: 1.6 }}>
                Would you like to secure your account with Passkeys? Passkeys allow you to sign in passwordlessly using fingerprint unlock, face unlock, your device passcode, or external security keys.
              </Typography>
              <Button
                fullWidth
                variant="contained"
                onClick={() => setSetupStep('passkey_setup')}
                sx={{
                  mb: 2, py: 1.2, borderRadius: '10px', textTransform: 'none', fontWeight: '600',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)' }
                }}
              >
                Yes, Secure Account
              </Button>
              <Button
                fullWidth
                variant="outlined"
                disabled={setupLoading}
                onClick={handleDisablePasskeysAndFinish}
                sx={{
                  py: 1.2, borderRadius: '10px', textTransform: 'none', fontWeight: '600',
                  borderColor: 'rgba(255, 255, 255, 0.15)', color: 'text.primary',
                  '&:hover': { borderColor: 'rgba(255, 255, 255, 0.3)', background: 'rgba(255, 255, 255, 0.05)' }
                }}
              >
                {setupLoading ? <CircularProgress size={22} color="inherit" /> : 'No, Skip for Now'}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#6366f1' }}>
                🔑 Configure Passkeys
              </Typography>

              <Typography variant="body2" color="textSecondary" sx={{ mb: 1, fontSize: '0.85rem', lineHeight: 1.5 }}>
                💡 The default settings are optimized for most server environments. You can leave them exactly as they are unless you want to make custom changes.
              </Typography>
              
              {testError && (
                <Alert severity="error" sx={{ borderRadius: '10px', fontSize: '0.85rem' }}>
                  {testError}
                </Alert>
              )}

              <Box sx={{ maxHeight: '55vh', overflowY: 'auto', pr: 1, mr: -1, mb: 1 }}>
                <Grid container spacing={2}>
                  {/* Top Row: Display Name & Website Override */}
                  <Grid xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Display Name"
                      value={passkeyConfig.passkeys_rp_name}
                      onChange={e => setPasskeyConfig({...passkeyConfig, passkeys_rp_name: e.target.value})}
                      helperText="The name shown on your device prompt when logging in."
                      slotProps={{ input: { sx: { borderRadius: '10px' } } }}
                    />
                  </Grid>

                  <Grid xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Website Address Override"
                      value={passkeyConfig.passkeys_rp_id}
                      onChange={e => setPasskeyConfig({...passkeyConfig, passkeys_rp_id: e.target.value})}
                      placeholder="e.g. example.com"
                      helperText="Domain that will be validated. Auto-populated with your current domain."
                      slotProps={{ input: { sx: { borderRadius: '10px' } } }}
                    />
                  </Grid>

                  {/* Left Column (Remaining Fields) */}
                  <Grid xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl fullWidth>
                      <InputLabel id="attachment-label">Allowed Sign-In Devices</InputLabel>
                      <Select
                        labelId="attachment-label"
                        label="Allowed Sign-In Devices"
                        value={passkeyConfig.passkeys_authenticator_attachment}
                        onChange={e => setPasskeyConfig({...passkeyConfig, passkeys_authenticator_attachment: e.target.value})}
                        sx={{ borderRadius: '10px' }}
                      >
                        <MenuItem value="any">Any Device (Recommended)</MenuItem>
                        <MenuItem value="platform">This Device Only (built-in fingerprint/face unlock)</MenuItem>
                        <MenuItem value="cross-platform">Portable Keys Only (USB security keys)</MenuItem>
                      </Select>
                      <FormHelperText>Restrict passkey storage to specific device types.</FormHelperText>
                    </FormControl>

                    <FormControl fullWidth>
                      <InputLabel id="resident-key-label">Username-Free Sign-In</InputLabel>
                      <Select
                        labelId="resident-key-label"
                        label="Username-Free Sign-In"
                        value={passkeyConfig.passkeys_resident_key}
                        onChange={e => setPasskeyConfig({...passkeyConfig, passkeys_resident_key: e.target.value})}
                        sx={{ borderRadius: '10px' }}
                      >
                        <MenuItem value="required">Enabled (Recommended)</MenuItem>
                        <MenuItem value="preferred">Preferred</MenuItem>
                        <MenuItem value="discouraged">Disabled (Must type username first)</MenuItem>
                      </Select>
                      <FormHelperText>Permits logging in by scanning biometrics without typing username.</FormHelperText>
                    </FormControl>
                  </Grid>

                  {/* Right Column (Remaining Fields) */}
                  <Grid xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl fullWidth>
                      <InputLabel id="verification-label">Require Fingerprint/Face Verification</InputLabel>
                      <Select
                        labelId="verification-label"
                        label="Require Fingerprint/Face Verification"
                        value={passkeyConfig.passkeys_user_verification}
                        onChange={e => setPasskeyConfig({...passkeyConfig, passkeys_user_verification: e.target.value})}
                        sx={{ borderRadius: '10px' }}
                      >
                        <MenuItem value="preferred">Preferred (Recommended)</MenuItem>
                        <MenuItem value="required">Strictly Required</MenuItem>
                        <MenuItem value="discouraged">Not Required</MenuItem>
                      </Select>
                      <FormHelperText>Forces validation of biometrics/PIN before login completion.</FormHelperText>
                    </FormControl>

                    <TextField
                      fullWidth
                      type="number"
                      label="Setup Time Limit (seconds)"
                      value={passkeyConfig.passkeys_timeout}
                      onChange={e => setPasskeyConfig({...passkeyConfig, passkeys_timeout: Number(e.target.value)})}
                      helperText="Maximum allowed time to complete scanner verification."
                      slotProps={{ input: { sx: { borderRadius: '10px' } } }}
                    />

                    <FormControl fullWidth>
                      <InputLabel id="attestation-label">Security Device Verification</InputLabel>
                      <Select
                        labelId="attestation-label"
                        label="Security Device Verification"
                        value={passkeyConfig.passkeys_attestation}
                        onChange={e => setPasskeyConfig({...passkeyConfig, passkeys_attestation: e.target.value})}
                        sx={{ borderRadius: '10px' }}
                      >
                        <MenuItem value="none">Do Not Collect (Recommended)</MenuItem>
                        <MenuItem value="indirect">Collect Indirectly</MenuItem>
                        <MenuItem value="direct">Collect Directly</MenuItem>
                      </Select>
                      <FormHelperText>Verifies the physical hardware key authenticity against manufacturers.</FormHelperText>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleTestPasskeySettings}
                  disabled={testLoading}
                  sx={{
                    py: 1.2, borderRadius: '10px', textTransform: 'none', fontWeight: '600',
                    borderColor: '#6366f1', color: '#6366f1',
                    '&:hover': { borderColor: '#4f46e5', background: 'rgba(99, 102, 241, 0.08)' }
                  }}
                >
                  {testLoading ? <CircularProgress size={22} color="inherit" /> : 'Test Settings'}
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleSaveAndRegisterPasskey}
                  disabled={!testSuccess || setupLoading}
                  sx={{
                    py: 1.2, borderRadius: '10px', textTransform: 'none', fontWeight: '600',
                    background: testSuccess ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.1)',
                    boxShadow: testSuccess ? '0 4px 14px rgba(16, 185, 129, 0.4)' : 'none',
                    '&:hover': {
                      background: testSuccess ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  {setupLoading ? <CircularProgress size={22} color="inherit" /> : 'Register Owner Passkey'}
                </Button>
              </Box>
            </Box>
          )
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
            slotProps={{ input: {
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
              sx: { borderRadius: '10px' }
            }}}
          />
          
          <TextField 
            fullWidth 
            type="password" 
            autoComplete="current-password"
            label="Password" 
            margin="normal" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="••••••••"
            required 
            slotProps={{ input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
              sx: { borderRadius: '10px' }
            }}}
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
          <Grid xs={4}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => handleSsoLogin('google')}
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
          <Grid xs={4}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => handleSsoLogin('github')}
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
          <Grid xs={4}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => handleSsoLogin('discord')}
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