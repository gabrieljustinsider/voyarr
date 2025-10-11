import { useState, useEffect } from 'react'
import { Box, Typography, TextField, Button, Paper, Grid, Snackbar, Alert, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel, Tabs, Tab, Switch, FormControlLabel, InputAdornment } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import SyncIcon from '@mui/icons-material/Sync'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import AddIcon from '@mui/icons-material/Add'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import SecurityIcon from '@mui/icons-material/Security'
import { apiFetch } from '../api'
import PathPicker from './PathPicker'
import InlineTextField from './InlineTextField'

const AppleSvg = () => (
  <svg viewBox="0 0 170 170" width="20" height="20" style={{ fill: 'currentColor' }}>
    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.37.13-9.13-1.9-14.28-6.1-3.48-2.84-7.46-7.85-11.93-15.03-8.84-14.25-13.25-28.7-13.25-43.34 0-16.14 4.21-29.35 12.62-39.63 8.41-10.27 18.69-15.48 30.83-15.6 6.13 0 12.39 2.03 18.75 6.1 6.35 4.08 10.96 6.1 13.8 6.1 2.45 0 6.55-1.78 12.28-5.35 7.15-4.42 13.8-6.52 19.95-6.3 15.04.53 26.42 6.17 34.18 16.93-12.75 7.74-19.06 18.42-18.94 32.06.13 10.3 3.96 18.91 11.51 25.83 7.55 6.92 16.32 10.63 26.31 11.13-2.12 6.53-4.58 12.63-7.38 18.32zM120.3 33.16c0-8.13 2.87-15.44 8.62-21.93 5.75-6.5 12.87-10.23 21.36-11.23.12 8.62-2.73 16.13-8.55 22.51-5.83 6.38-13.1 9.94-21.43 10.65z"/>
  </svg>
)

const GoogleSvg = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
)

const YubicoSvg = () => (
  <svg viewBox="0 0 170 170" width="20" height="20" style={{ fill: '#33aa33' }}>
    <path d="M85 0C38.06 0 0 38.06 0 85c0 46.94 38.06 85 85 85 46.94 0 85-38.06 85-85 0-46.94-38.06-85-85-85zm33.3 118.8c-2.4 4.5-7.5 6.9-12.3 5.4-3.6-1.2-6-4.5-6.6-8.1l-6.3-37.5-17.7 23.4c-3.6 4.8-10.2 6-15.3 2.7-4.2-2.7-6-7.8-4.2-12.6l12.9-34.8-6.3 3.9c-4.5 2.7-10.5 1.8-13.8-2.4-3.3-4.2-3.3-10.2.3-14.1l20.4-22.5c4.5-4.8 12-5.4 17.1-1.2 3.6 3 5.1 7.5 3.9 12l-6 22.8 19.5-25.5c3.9-5.1 11.1-6 16.2-2.1 4.5 3.3 6.3 9 4.2 14.1l-10.8 26.4 12.3 2.1c5.1.9 9 5.1 9 10.2-.3 4.2-2.4 8.1-6.5 9.6z"/>
  </svg>
)

const WindowsHelloSvg = () => (
  <svg viewBox="0 0 23 23" width="20" height="20">
    <path fill="#f25022" d="M0 0h11v11H0z"/>
    <path fill="#7fba00" d="M12 0h11v11H12z"/>
    <path fill="#00a4ef" d="M0 12h11v11H0z"/>
    <path fill="#ffb900" d="M12 12h11v11H12z"/>
  </svg>
)

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && (
        <Box sx={{ pt: 1 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({
    media_root_path: '/media/storage',
    download_destination: '/media/storage/downloads',
    library_folder: '/media/storage/library',
    scan_folder: '/media/storage/downloads',
    concurrent_downloads: '3',
    global_speed_limit_kbps: '0',
    default_resolution: '1080p',
    theme: 'dark',
    extension_secret: '',
    tpdb_api_key: '',
    stashdb_api_key: '',
    op_connect_host: '',
    op_connect_token: '',
    op_vault_id: '',
    bw_connect_host: '',
    bw_session_token: '',
    bw_folder_id: '',
    pm_auto_sync_interval: 'disabled',
    pm_sync_direction: 'pull',
    yt_write_subs: 'false',
    yt_write_thumbs: 'false',
    yt_sponsorblock: 'false',
    yt_live_streams: 'false',
    yt_native_playlists: 'false',
    yt_custom_format: '',
    yt_browser_cookies: '',
    discord_allowed_users: '',
    global_proxy_enabled: 'false',
    global_proxy_url: '',
    global_user_agent: ''
  })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [apiKeys, setApiKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState(null)
  const [masterKeyInput, setMasterKeyInput] = useState(localStorage.getItem('voyarr_api_key') || '')
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, keyId: null })
  const [diagnosticLoading, setDiagnosticLoading] = useState(false)
  const [diagnosticResult, setDiagnosticResult] = useState(null)
  const [showProxyUrl, setShowProxyUrl] = useState(false)

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })

  const [passkeys, setPasskeys] = useState([])
  const [ssoLinks, setSsoLinks] = useState([])
  const [newPasskeyName, setNewPasskeyName] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [mockSsoOpen, setMockSsoOpen] = useState(false)
  const [mockSsoProvider, setMockSsoProvider] = useState('')
  const [mockSsoEmail, setMockSsoEmail] = useState('')

  const fetchPasskeys = async () => {
    try {
      const res = await apiFetch('/auth/passkeys/')
      if (res.ok) {
        setPasskeys(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch passkeys:', err)
    }
  }

  const fetchSsoLinks = async () => {
    try {
      const res = await apiFetch('/auth/sso/links')
      if (res.ok) {
        setSsoLinks(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch SSO links:', err)
    }
  }

  const handleRenamePasskey = async (id, newName) => {
    try {
      const res = await apiFetch(`/auth/passkeys/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Passkey renamed successfully!', severity: 'success' })
        fetchPasskeys()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed to rename: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error renaming passkey.', severity: 'error' })
    }
  }

  const handleDeletePasskey = async (id) => {
    try {
      const res = await apiFetch(`/auth/passkeys/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Passkey deleted successfully!', severity: 'success' })
        fetchPasskeys()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed to delete: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error deleting passkey.', severity: 'error' })
    }
  }

  const handleOpenMockSso = (provider) => {
    setMockSsoProvider(provider)
    const currentUsername = getUsernameFromJwt().toLowerCase()
    setMockSsoEmail(`${currentUsername}@${provider}.com`)
    setMockSsoOpen(true)
  }

  const handleExecuteMockSso = async () => {
    setMockSsoOpen(false)
    try {
      const providerUserId = `${mockSsoProvider}_usr_${Math.random().toString(36).substring(2, 10)}`
      const payload = {
        provider: mockSsoProvider,
        provider_user_id: providerUserId,
        email: mockSsoEmail,
        token: "mock_sso_oauth_flow_token"
      }
      
      const res = await apiFetch('/auth/sso/link', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        setSnackbar({ open: true, message: `${mockSsoProvider.charAt(0).toUpperCase() + mockSsoProvider.slice(1)} linked successfully!`, severity: 'success' })
        fetchSsoLinks()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed to link: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error linking SSO.', severity: 'error' })
    }
  }

  const handleUnlinkSso = async (provider) => {
    try {
      const res = await apiFetch(`/auth/sso/unlink/${provider}`, {
        method: 'POST'
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} unlinked successfully!`, severity: 'success' })
        fetchSsoLinks()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed to unlink: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error unlinking SSO.', severity: 'error' })
    }
  }

  // WebAuthn Client Helpers
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

  const getUsernameFromJwt = () => {
    const token = localStorage.getItem('voyarr_jwt')
    if (!token) return 'User'
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
      return JSON.parse(jsonPayload).sub || 'User'
    } catch (e) {
      return 'User'
    }
  }

  const handleAddPasskey = async () => {
    setPasskeyLoading(true)
    try {
      const optionsRes = await apiFetch('/auth/passkeys/register/options', { method: 'POST' })
      if (!optionsRes.ok) {
        const err = await optionsRes.json()
        throw new Error(err.detail || 'Failed to generate passkey options')
      }
      const options = await optionsRes.json()
      
      options.challenge = base64ToBuffer(options.challenge)
      options.user.id = new TextEncoder().encode(options.user.id)
      
      const credential = await navigator.credentials.create({ publicKey: options })
      if (!credential) {
        throw new Error('Passkey creation cancelled or failed.')
      }
      
      const attestationObject = credential.response.attestationObject
      const clientDataJSON = credential.response.clientDataJSON
      
      let publicKeyB64 = ''
      if (typeof credential.response.getPublicKey === 'function') {
        publicKeyB64 = bufferToBase64(credential.response.getPublicKey())
      }
      
      const aaguid = scanAaguid(attestationObject)
      const clientInfo = getClientInfo()
      
      const verifyPayload = {
        credential_id: credential.id,
        public_key: publicKeyB64,
        client_data_json: bufferToBase64(clientDataJSON),
        aaguid: aaguid,
        name: newPasskeyName || 'My Passkey',
        browser: clientInfo.browser,
        os_name: clientInfo.os_name,
        backup_eligible: true,
        backup_state: true
      }
      
      const verifyRes = await apiFetch('/auth/passkeys/register/verify', {
        method: 'POST',
        body: JSON.stringify(verifyPayload)
      })
      
      if (!verifyRes.ok) {
        const err = await verifyRes.json()
        throw new Error(err.detail || 'Failed to verify passkey')
      }
      
      setSnackbar({ open: true, message: 'Passkey registered successfully!', severity: 'success' })
      setNewPasskeyName('')
      fetchPasskeys()
    } catch (err) {
      console.error('Passkey registration error:', err)
      setSnackbar({ open: true, message: err.message || 'Passkey registration failed.', severity: 'error' })
    } finally {
      setPasskeyLoading(false)
    }
  }

  const handleRunDiagnostic = async () => {
    setDiagnosticLoading(true)
    setDiagnosticResult(null)
    try {
      const res = await apiFetch('/settings/network/diagnostic')
      if (res.ok) {
        const data = await res.json()
        setDiagnosticResult(data)
        if (data.status === 'online') {
          setSnackbar({ open: true, message: 'Network diagnostic completed successfully!', severity: 'success' })
        } else {
          setSnackbar({ open: true, message: `Network degraded or offline: ${data.error || 'Unknown error'}`, severity: 'warning' })
        }
      } else {
        setSnackbar({ open: true, message: 'Failed to run network diagnostic test.', severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error running diagnostic.', severity: 'error' })
    } finally {
      setDiagnosticLoading(false)
    }
  }

  const fetchApiKeys = async () => {
    try {
      const res = await apiFetch('/apikeys')
      if (res.ok) setApiKeys(await res.json())
    } catch (err) { console.error('Failed to fetch API keys:', err) }
  }

  useEffect(() => {
    apiFetch('/settings')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch settings')
        return res.json()
      })
      .then(data => {
        if (data.detail) return; // Prevent overwriting settings with error response payloads
        setSettings(prev => ({ ...prev, ...data }))
      })
      .catch(console.error)
    fetchApiKeys()
    fetchPasskeys()
    fetchSsoLinks()
  }, [])



  const handleSyncManager = async (provider, direction) => {
    try {
      const res = await apiFetch(`/settings/sync/${provider}`, {
        method: 'POST',
        body: JSON.stringify({ direction })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `Sync initiated for ${provider}`, severity: 'success' })
      } else {
        setSnackbar({ open: true, message: `Failed to sync ${provider}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error during sync.', severity: 'error' })
    }
  }

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value })
  }

  const handleSave = async (key, value) => {
    try {
      const res = await apiFetch('/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value: String(value) })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `Setting "${key}" updated successfully!`, severity: 'success' })
      } else {
        setSnackbar({ open: true, message: `Failed to update "${key}". Server returned ${res.status}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: `Failed to update "${key}".`, severity: 'error' })
    }
  }

  const handleToggleSetting = (name, checked) => {
    const value = checked ? 'true' : 'false';
    setSettings(prev => ({ ...prev, [name]: value }));
    handleSave(name, value);
  };

  const generateExtensionSecret = () => {
    const array = new Uint8Array(32)
    window.crypto.getRandomValues(array)
    const newKey = Array.from(array, byte => ('0' + byte.toString(16)).slice(-2)).join('')
    setSettings(prev => ({ ...prev, extension_secret: newKey }))
  }

  const handleCreateApiKey = async () => {
    try {
      const res = await apiFetch('/apikeys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName })
      })
      if (res.ok) {
        const data = await res.json()
        setGeneratedKey(data.raw_key)
        setNewKeyName('')
        fetchApiKeys()
      } else {
        setSnackbar({ open: true, message: `Failed to create API key. Server returned ${res.status}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error creating API key.', severity: 'error' })
      console.error(err) 
    }
  }

  const handleDeleteApiKey = (id) => {
    setDeleteConfirm({ open: true, keyId: id })
  }

  const confirmDeleteApiKey = async () => {
    if (!deleteConfirm.keyId) return
    try {
      await apiFetch(`/apikeys/${deleteConfirm.keyId}`, { 
        method: 'DELETE'
      })
      setDeleteConfirm({ open: false, keyId: null })
      fetchApiKeys()
    } catch (err) {
      console.error('Failed to revoke API key:', err)
    }
  }

  const handleSaveMasterKey = () => {
    localStorage.setItem('voyarr_api_key', masterKeyInput)
    setSnackbar({ open: true, message: 'Master Key saved to browser securely!', severity: 'success' })
    // Refresh data with new key to force an updated fetch
    window.location.reload()
  }

  const handleCreateUser = async () => {
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser)
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `User ${newUser.username} created successfully!`, severity: 'success' })
        setNewUser({ username: '', password: '', role: 'user' })
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error creating user.', severity: 'error' })
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Application Settings</Typography>
      
      <Paper sx={{ p: 3, mb: 3, border: '1px solid #ff9800' }}>
        <Typography variant="h6" color="warning.main" gutterBottom>Security: API Master Key</Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Your Master Key is required to communicate with the backend. It is stored securely in your browser's local storage and is never bundled in the source code.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={10}>
            <TextField fullWidth type="password" label="Master Key" value={masterKeyInput} onChange={e => setMasterKeyInput(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" color="warning" onClick={handleSaveMasterKey}>Save Key</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Storage & Paths</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={10}>
            <PathPicker
              label="Docker Media Root Mapping(s)"
              value={settings.media_root_path || ''}
              onChange={(val) => setSettings(prev => ({ ...prev, media_root_path: val }))}
              helperText="The physical directory path(s) where downloads will be organized inside the container. Comma-separate for multiple paths. (Note: Must match your container's MEDIA_ROOT environment variable)"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('media_root_path', settings.media_root_path)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={10}>
            <PathPicker
              label="Default Download Destination"
              value={settings.download_destination || ''}
              onChange={(val) => setSettings(prev => ({ ...prev, download_destination: val }))}
              helperText="Sub-directory where new, unprocessed files are initially downloaded."
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('download_destination', settings.download_destination)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={10}>
            <PathPicker
              label="Permanent Library Folder"
              value={settings.library_folder || ''}
              onChange={(val) => setSettings(prev => ({ ...prev, library_folder: val }))}
              helperText="Directory where organized and tagged media is permanently stored."
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('library_folder', settings.library_folder)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={10}>
            <PathPicker
              label="Existing Media Scan Target"
              value={settings.scan_folder || ''}
              onChange={(val) => setSettings(prev => ({ ...prev, scan_folder: val }))}
              helperText="Directory targeted by the Reverse Regex Engine when searching for existing local files."
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('scan_folder', settings.scan_folder)}>Save</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Network & Proxy Configuration</Typography>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Configure a global proxy or custom User-Agent to bypass provider scrapers, download streams geo-restricted in your region, or mask outbound metadata requests.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12}>
            <FormControlLabel 
              control={
                <Switch 
                  checked={settings.global_proxy_enabled === 'true'} 
                  onChange={e => handleToggleSetting('global_proxy_enabled', e.target.checked)} 
                />
              } 
              label="Route Outbound Traffic via Proxy" 
            />
          </Grid>

          {settings.global_proxy_enabled === 'true' && (
            <Grid item xs={12} md={10}>
              <TextField 
                fullWidth 
                size="small" 
                type={showProxyUrl ? 'text' : 'password'}
                label="Global Proxy Connection URL" 
                name="global_proxy_url" 
                value={settings.global_proxy_url || ''} 
                onChange={handleChange} 
                helperText="Supports SOCKS5, HTTP, and HTTPS protocols. Example: socks5://username:password@12.34.56.78:1080" 
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle proxy url visibility"
                        onClick={() => setShowProxyUrl(!showProxyUrl)}
                        edge="end"
                      >
                        {showProxyUrl ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          )}
          {settings.global_proxy_enabled === 'true' && (
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="contained" onClick={() => handleSave('global_proxy_url', settings.global_proxy_url)}>Save URL</Button>
            </Grid>
          )}

          <Grid item xs={12} md={10}>
            <TextField 
              fullWidth 
              size="small" 
              label="Custom Outbound User-Agent String" 
              name="global_user_agent" 
              value={settings.global_user_agent || ''} 
              onChange={handleChange} 
              helperText="Overrides the default Python requests and Playwright browser headers. Leave blank for default browser signature." 
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('global_user_agent', settings.global_user_agent)}>Save Agent</Button>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="subtitle1">Outbound Network Diagnostics</Typography>
              <Button 
                variant="outlined" 
                color="secondary" 
                startIcon={<SyncIcon className={diagnosticLoading ? 'spin-animation' : ''} />} 
                onClick={handleRunDiagnostic}
                disabled={diagnosticLoading}
              >
                {diagnosticLoading ? 'Testing Connections...' : 'Run Routing Diagnostics'}
              </Button>
            </Box>
          </Grid>

          {diagnosticResult && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: 'rgba(255, 255, 255, 0.12)' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Outbound Health Status</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                      <Box 
                        sx={{ 
                          width: 10, 
                          height: 10, 
                          borderRadius: '50%', 
                          mr: 1, 
                          backgroundColor: 
                            diagnosticResult.status === 'online' ? '#4caf50' : 
                            diagnosticResult.status === 'degraded' ? '#ff9800' : '#f44336'
                        }} 
                      />
                      <Typography variant="body2" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                        {diagnosticResult.status}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Public Exit IP</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', mt: 0.5 }}>
                      {diagnosticResult.public_ip}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Response Latency</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                      {diagnosticResult.latency_ms > 0 ? `${diagnosticResult.latency_ms} ms` : 'N/A'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Outbound Traffic Routing</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {diagnosticResult.proxy_configured ? (
                        diagnosticResult.proxy_working ? (
                          <span style={{ color: '#4caf50' }}>✓ Securely routed via external proxy Exit Node</span>
                        ) : (
                          <span style={{ color: '#f44336' }}>✗ Proxy configured but connection failed! (Bypassed or offline)</span>
                        )
                      ) : (
                        <span style={{ color: '#ff9800' }}>⚠ Routing directly via standard local network (Bypassing proxies)</span>
                      )}
                    </Typography>
                  </Grid>

                  {diagnosticResult.error && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="error" sx={{ display: 'block' }}>Connection Error Details</Typography>
                      <Typography variant="body2" color="error" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                        {diagnosticResult.error}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>yt-dlp Advanced Integrations</Typography>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Unlock native yt-dlp features. Note: Some features may override Voyarr's default behaviors.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <FormControlLabel control={<Switch checked={settings.yt_write_subs === 'true'} onChange={e => handleToggleSetting('yt_write_subs', e.target.checked)} />} label="Download Subtitles" />
            <br />
            <FormControlLabel control={<Switch checked={settings.yt_write_thumbs === 'true'} onChange={e => handleToggleSetting('yt_write_thumbs', e.target.checked)} />} label="Download Thumbnails" />
            <br />
            <FormControlLabel control={<Switch checked={settings.yt_sponsorblock === 'true'} onChange={e => handleToggleSetting('yt_sponsorblock', e.target.checked)} />} label="SponsorBlock Removal" />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel control={<Switch checked={settings.yt_live_streams === 'true'} onChange={e => handleToggleSetting('yt_live_streams', e.target.checked)} />} label="Live Stream Support" />
            <br />
            <FormControlLabel control={<Switch checked={settings.yt_native_playlists === 'true'} onChange={e => handleToggleSetting('yt_native_playlists', e.target.checked)} />} label="Native Playlist Downloading" />
          </Grid>

          <Grid item xs={12} md={10}>
            <FormControl fullWidth size="small">
              <InputLabel>Native Browser Cookie Extraction</InputLabel>
              <Select name="yt_browser_cookies" value={settings.yt_browser_cookies || ''} label="Native Browser Cookie Extraction" onChange={handleChange}>
                <MenuItem value=""><em>Disabled</em></MenuItem>
                <MenuItem value="chrome">Chrome</MenuItem>
                <MenuItem value="firefox">Firefox</MenuItem>
                <MenuItem value="edge">Edge</MenuItem>
                <MenuItem value="opera">Opera</MenuItem>
                <MenuItem value="safari">Safari</MenuItem>
                <MenuItem value="brave">Brave</MenuItem>
                <MenuItem value="vivaldi">Vivaldi</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('yt_browser_cookies', settings.yt_browser_cookies)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={10}>
            <TextField 
              fullWidth 
              size="small" 
              label="Advanced Format/Codec Selection" 
              name="yt_custom_format" 
              value={settings.yt_custom_format || ''} 
              onChange={handleChange} 
              helperText="Overrides preferred resolution. e.g., 'bestvideo[vcodec^=av1]+bestaudio/best'" 
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('yt_custom_format', settings.yt_custom_format)}>Save</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Global Download Defaults</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField fullWidth type="number" label="Max Concurrent Downloads" name="concurrent_downloads" value={settings.concurrent_downloads || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('concurrent_downloads', settings.concurrent_downloads)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField fullWidth type="number" label="Global Speed Limit (Kbps)" name="global_speed_limit_kbps" value={settings.global_speed_limit_kbps || ''} onChange={handleChange} helperText="Set 0 for unlimited" />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('global_speed_limit_kbps', settings.global_speed_limit_kbps)}>Save</Button>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Default Preferred Resolution" name="default_resolution" value={settings.default_resolution || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('default_resolution', settings.default_resolution)}>Save</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>External API Integrations</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={10}>
            <TextField fullWidth type="password" label="ThePornDB API Key" name="tpdb_api_key" value={settings.tpdb_api_key || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('tpdb_api_key', settings.tpdb_api_key)}>Save</Button>
          </Grid>
          <Grid item xs={12} md={10}>
            <TextField fullWidth type="password" label="StashDB API Key" name="stashdb_api_key" value={settings.stashdb_api_key || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('stashdb_api_key', settings.stashdb_api_key)}>Save</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Discord Webhook Security</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={10}>
            <TextField 
              fullWidth 
              label="Allowed Discord User IDs" 
              name="discord_allowed_users" 
              value={settings.discord_allowed_users || ''} 
              onChange={handleChange} 
              helperText="Comma-separated list of Discord user IDs allowed to run slash commands. If empty, all users are authorized." 
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('discord_allowed_users', settings.discord_allowed_users)}>Save</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Browser Extension Integration</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField fullWidth label="Extension Secret Key" name="extension_secret" value={settings.extension_secret || ''} onChange={handleChange} helperText="Used to securely authenticate the browser extension with your Voyarr backend." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="outlined" color="secondary" onClick={generateExtensionSecret}>Generate Key</Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('extension_secret', settings.extension_secret)}>Save</Button>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(25, 118, 210, 0.1)', borderRadius: 1, border: '1px solid #1976d2' }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            <strong>How to install the Browser Extension:</strong>
          </Typography>
          <Typography variant="body2">
            1. Open Chrome or Edge and navigate to <code>chrome://extensions/</code><br/>
            2. Enable <strong>Developer mode</strong> in the top right corner.<br/>
            3. Click <strong>Load unpacked</strong> and select the <code>/extension</code> folder from your Voyarr installation directory.
          </Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>1Password Connect Integration</Typography>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Sync your Voyarr credentials with a 1Password Connect server.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={10}>
            <TextField fullWidth label="1Password Connect Host" name="op_connect_host" value={settings.op_connect_host || ''} onChange={handleChange} helperText="e.g. http://localhost:8080" />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('op_connect_host', settings.op_connect_host)}>Save</Button>
          </Grid>
          
          <Grid item xs={12} md={10}>
            <TextField fullWidth type="password" label="1Password Connect Token" name="op_connect_token" value={settings.op_connect_token || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('op_connect_token', settings.op_connect_token)}>Save</Button>
          </Grid>
          
          <Grid item xs={12} md={10}>
            <TextField fullWidth label="1Password Vault ID" name="op_vault_id" value={settings.op_vault_id || ''} onChange={handleChange} helperText="The ID of the vault to sync with." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('op_vault_id', settings.op_vault_id)}>Save</Button>
          </Grid>
          <Grid item xs={12} md={6}>
          <Button fullWidth variant="outlined" color="primary" onClick={() => handleSyncManager('1password', 'push')}>Push to 1Password</Button>
          </Grid>
          <Grid item xs={12} md={6}>
          <Button fullWidth variant="outlined" color="secondary" onClick={() => handleSyncManager('1password', 'pull')}>Pull from 1Password</Button>
          </Grid>
        </Grid>
      </Paper>

    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>Bitwarden Integration</Typography>
      <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
        Sync your Voyarr credentials with Bitwarden or Vaultwarden via the Bitwarden CLI REST server ('bw serve').
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={3} alignItems="center">
        <Grid item xs={12} md={10}>
          <TextField fullWidth label="Bitwarden Serve Host" name="bw_connect_host" value={settings.bw_connect_host || ''} onChange={handleChange} helperText="e.g. http://localhost:8087" />
        </Grid>
        <Grid item xs={12} md={2}>
          <Button fullWidth variant="contained" onClick={() => handleSave('bw_connect_host', settings.bw_connect_host)}>Save</Button>
        </Grid>
        
        <Grid item xs={12} md={10}>
          <TextField fullWidth type="password" label="Bitwarden Session Token" name="bw_session_token" value={settings.bw_session_token || ''} onChange={handleChange} helperText="The BW_SESSION token generated upon unlocking your vault." />
        </Grid>
        <Grid item xs={12} md={2}>
          <Button fullWidth variant="contained" onClick={() => handleSave('bw_session_token', settings.bw_session_token)}>Save</Button>
        </Grid>
        
        <Grid item xs={12} md={10}>
          <TextField fullWidth label="Bitwarden Folder ID" name="bw_folder_id" value={settings.bw_folder_id || ''} onChange={handleChange} helperText="Optional: The ID of the folder to sync with." />
        </Grid>
        <Grid item xs={12} md={2}>
          <Button fullWidth variant="contained" onClick={() => handleSave('bw_folder_id', settings.bw_folder_id)}>Save</Button>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button fullWidth variant="outlined" color="primary" onClick={() => handleSyncManager('bitwarden', 'push')}>Push to Bitwarden</Button>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button fullWidth variant="outlined" color="secondary" onClick={() => handleSyncManager('bitwarden', 'pull')}>Pull from Bitwarden</Button>
        </Grid>
      </Grid>
    </Paper>

      <Paper sx={{ 
        p: 3, 
        mb: 3, 
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(28, 37, 65, 0.4) 0%, rgba(10, 11, 16, 0.6) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <SecurityIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h6" sx={{ fontWeight: '700', letterSpacing: '0.5px' }}>Account Security & Authentication</Typography>
        </Box>
        <Typography variant="body2" sx={{ mb: 3, opacity: 0.8 }} color="textSecondary">
          Secure your account using enterprise-grade passwordless passkeys (WebAuthn) or link external identity providers for one-click single sign-on access.
        </Typography>
        
        <Divider sx={{ mb: 3, opacity: 0.2 }} />
        
        {/* Passkeys Panel */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FingerprintIcon color="secondary" />
              <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Registered Passkeys</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TextField 
                size="small" 
                placeholder="Passkey Name (e.g. YubiKey)" 
                value={newPasskeyName} 
                onChange={e => setNewPasskeyName(e.target.value)} 
                disabled={passkeyLoading}
                sx={{ 
                  width: 220,
                  '& .MuiOutlinedInput-root': { borderRadius: '10px' }
                }}
              />
              <Button 
                variant="contained" 
                color="secondary"
                startIcon={<AddIcon />} 
                onClick={handleAddPasskey}
                disabled={passkeyLoading || !newPasskeyName.trim()}
                sx={{ borderRadius: '10px', textTransform: 'none' }}
              >
                {passkeyLoading ? 'Creating...' : 'Add Passkey'}
              </Button>
            </Box>
          </Box>
          
          {passkeys.length === 0 ? (
            <Box sx={{ 
              p: 4, 
              textAlign: 'center', 
              borderRadius: '12px', 
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              backgroundColor: 'rgba(255, 255, 255, 0.02)'
            }}>
              <FingerprintIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography variant="body2" sx={{ opacity: 0.6 }} color="textSecondary">No passkeys registered yet. Add one to enable secure, passwordless authentication.</Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {passkeys.map(pk => {
                const brand = pk.aaguid_info || { name: 'Generic Security Key', provider: 'Unknown Platform', icon: 'key', description: 'Standard WebAuthn authenticating device.' };
                return (
                  <Grid item xs={12} md={6} key={pk.id}>
                    <Paper sx={{ 
                      p: 2, 
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                        borderColor: 'rgba(255, 255, 255, 0.12)'
                      }
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ 
                            p: 1, 
                            borderRadius: '8px', 
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'text.primary'
                          }}>
                            {brand.icon === 'apple' && <AppleSvg />}
                            {brand.icon === 'google' && <GoogleSvg />}
                            {brand.icon === 'yubico' && <YubicoSvg />}
                            {brand.icon === 'windows' && <WindowsHelloSvg />}
                            {brand.icon !== 'apple' && brand.icon !== 'google' && brand.icon !== 'yubico' && brand.icon !== 'windows' && <FingerprintIcon />}
                          </Box>
                          <Box>
                            <InlineTextField 
                              value={pk.name} 
                              onSave={(val) => handleRenamePasskey(pk.id, val)}
                              label="Rename Passkey"
                            />
                            <Typography variant="caption" sx={{ opacity: 0.5, display: 'block', mt: 0.5 }} color="textSecondary">
                              {brand.name} • {brand.provider}
                            </Typography>
                          </Box>
                        </Box>
                        
                        <IconButton color="error" size="small" onClick={() => handleDeletePasskey(pk.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      
                      <Divider sx={{ my: 1.5, opacity: 0.1 }} />
                      
                      <Grid container spacing={1.5}>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }} color="textSecondary">Registered IP</Typography>
                          <Typography variant="body2" sx={{ fontWeight: '500', fontFamily: 'monospace' }}>
                            {pk.ip_address || '127.0.0.1'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }} color="textSecondary">Location</Typography>
                          <Typography variant="body2" sx={{ fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {pk.location || 'Local Host (Development)'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }} color="textSecondary">Created</Typography>
                          <Typography variant="body2" sx={{ fontWeight: '500' }}>
                            {new Date(pk.created_at).toLocaleDateString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }} color="textSecondary">Last Used</Typography>
                          <Typography variant="body2" sx={{ fontWeight: '500' }}>
                            {pk.last_used_at ? new Date(pk.last_used_at).toLocaleDateString() : 'Never'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                          {pk.backup_eligible && (
                            <Box sx={{ 
                              px: 1.2, 
                              py: 0.4, 
                              borderRadius: '6px', 
                              backgroundColor: 'rgba(0, 230, 118, 0.1)', 
                              border: '1px solid rgba(0, 230, 118, 0.2)',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}>
                              <Typography variant="caption" sx={{ color: '#00e676', fontWeight: 'bold' }}>Backup Eligible</Typography>
                            </Box>
                          )}
                          {pk.backup_state && (
                            <Box sx={{ 
                              px: 1.2, 
                              py: 0.4, 
                              borderRadius: '6px', 
                              backgroundColor: 'rgba(0, 176, 255, 0.1)', 
                              border: '1px solid rgba(0, 176, 255, 0.2)',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}>
                              <Typography variant="caption" sx={{ color: '#00b0ff', fontWeight: 'bold' }}>Backed Up</Typography>
                            </Box>
                          )}
                          <Box sx={{ 
                            px: 1.2, 
                            py: 0.4, 
                            borderRadius: '6px', 
                            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}>
                            <Typography variant="caption" sx={{ opacity: 0.7 }} color="textSecondary">{pk.browser} on {pk.os_name}</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                )
              })}
            </Grid>
          )}
        </Box>
        
        <Divider sx={{ my: 3, opacity: 0.2 }} />
        
        {/* SSO Linking Panel */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LinkIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Linked Identities (SSO)</Typography>
          </Box>
          
          <Grid container spacing={2}>
            {['google', 'github', 'discord'].map(provider => {
              const link = ssoLinks.find(l => l.provider === provider)
              const isLinked = !!link
              
              return (
                <Grid item xs={12} md={4} key={provider}>
                  <Paper sx={{ 
                    p: 2, 
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    background: isLinked ? 'rgba(0, 230, 118, 0.02)' : 'rgba(255, 255, 255, 0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: '8px', 
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'text.primary'
                      }}>
                        {provider === 'google' && <GoogleSvg />}
                        {provider === 'github' && (
                          <svg viewBox="0 0 24 24" width="20" height="20" style={{ fill: 'currentColor' }}>
                            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                          </svg>
                        )}
                        {provider === 'discord' && (
                          <svg viewBox="0 0 127.14 96.36" width="20" height="20" style={{ fill: '#5865F2' }}>
                            <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.8,6.83,77.19,77.19,0,0,0,49.5,0,105.15,105.15,0,0,0,19.06,8.07C-3.81,42.23-1,75.52,10.6,92.63a105.86,105.86,0,0,0,32,16.15,79,79,0,0,0,6.79-11,68.6,68.6,0,0,1-10.74-5.12c.91-.66,1.8-1.34,2.65-2a75.58,75.58,0,0,0,71.72,0c.85.71,1.74,1.39,2.65,2a75.58,75.58,0,0,0,71.72,0c.85.71,1.74,1.39,2.65,2a68.6,68.6,0,0,1-10.74,5.12,79,79,0,0,0,6.79,11,105.86,105.86,0,0,0,32-16.15C129.5,75.52,132.3,42.23,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
                          </svg>
                        )}
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                          {provider} Access
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <Box sx={{ 
                            width: 6, 
                            height: 6, 
                            borderRadius: '50%', 
                            backgroundColor: isLinked ? '#00e676' : '#9ca3af' 
                          }} />
                          <Typography variant="caption" sx={{ color: isLinked ? '#00e676' : 'text.secondary', fontWeight: isLinked ? 'bold' : 'normal' }}>
                            {isLinked ? 'Linked' : 'Not Linked'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    
                    {isLinked ? (
                      <Box>
                        <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mb: 1.5, wordBreak: 'break-all' }} color="textSecondary">
                          Linked as: <strong>{link.email || link.provider_user_id}</strong>
                        </Typography>
                        <Button 
                          fullWidth 
                          variant="outlined" 
                          color="error" 
                          size="small"
                          startIcon={<LinkOffIcon />}
                          onClick={() => handleUnlinkSso(provider)}
                          sx={{ borderRadius: '8px', textTransform: 'none' }}
                        >
                          Unlink
                        </Button>
                      </Box>
                    ) : (
                      <Button 
                        fullWidth 
                        variant="outlined" 
                        color="primary" 
                        size="small"
                        startIcon={<LinkIcon />}
                        onClick={() => handleOpenMockSso(provider)}
                        sx={{ borderRadius: '8px', textTransform: 'none' }}
                      >
                        Link Provider
                      </Button>
                    )}
                  </Paper>
                </Grid>
              )
            })}
          </Grid>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>User Management</Typography>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Create user accounts to grant access to the UI without sharing your Master Key.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField fullWidth size="small" label="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth size="small" type="password" label="Password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Role</InputLabel>
              <Select value={newUser.role} label="Role" onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="user">User</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={handleCreateUser} disabled={!newUser.username || !newUser.password}>Create User</Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Mock SSO Simulated OAuth Dialog */}
      <Dialog 
        open={mockSsoOpen} 
        onClose={() => setMockSsoOpen(false)}
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
              {mockSsoProvider === 'google' && <GoogleSvg />}
              {mockSsoProvider === 'github' && (
                <svg viewBox="0 0 24 24" width="20" height="20" style={{ fill: 'currentColor' }}>
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                </svg>
              )}
              {mockSsoProvider === 'discord' && (
                <svg viewBox="0 0 127.14 96.36" width="20" height="20" style={{ fill: '#5865F2' }}>
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.8,6.83,77.19,77.19,0,0,0,49.5,0,105.15,105.15,0,0,0,19.06,8.07C-3.81,42.23-1,75.52,10.6,92.63a105.86,105.86,0,0,0,32,16.15,79,79,0,0,0,6.79-11,68.6,68.6,0,0,1-10.74-5.12c.91-.66,1.8-1.34,2.65-2a75.58,75.58,0,0,0,71.72,0c.85.71,1.74,1.39,2.65,2a75.58,75.58,0,0,0,71.72,0c.85.71,1.74,1.39,2.65,2a68.6,68.6,0,0,1-10.74,5.12,79,79,0,0,0,6.79,11,105.86,105.86,0,0,0,32-16.15C129.5,75.52,132.3,42.23,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
                </svg>
              )}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
              Sign in with {mockSsoProvider}
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
              label="Email Address"
              type="email"
              value={mockSsoEmail}
              onChange={e => setMockSsoEmail(e.target.value)}
              placeholder="e.g. user@example.com"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            <Typography variant="caption" sx={{ opacity: 0.5 }} color="textSecondary">
              This simulates a secure identity validation callback by coupling your profile with the provider Exit API.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
          <Button 
            onClick={() => setMockSsoOpen(false)}
            variant="text" 
            sx={{ color: 'text.secondary', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleExecuteMockSso}
            variant="contained" 
            color="primary"
            disabled={!mockSsoEmail.trim() || !mockSsoEmail.includes('@')}
            sx={{ borderRadius: '10px', textTransform: 'none', px: 3 }}
          >
            Authorize Exit
          </Button>
        </DialogActions>
      </Dialog>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>External API Keys</Typography>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Generate scoped API keys for external tools (e.g., third-party scrapers, automation scripts, or the *arr stack) to interact with Voyarr securely without exposing your MASTER_KEY.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Grid item xs={12} md={9}>
            <TextField fullWidth size="small" label="New Key Name (e.g. 'Stash Webhook')" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={3}>
            <Button fullWidth variant="contained" onClick={handleCreateApiKey} disabled={!newKeyName}>Generate Key</Button>
          </Grid>
        </Grid>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last Used</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apiKeys.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center">No external API keys configured.</TableCell></TableRow>
              ) : (
                apiKeys.map(key => (
                  <TableRow key={key.id}>
                    <TableCell>{key.name}</TableCell>
                    <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{key.last_used ? new Date(key.last_used).toLocaleString() : 'Never'}</TableCell>
                    <TableCell align="right">
                      <IconButton color="error" size="small" onClick={() => handleDeleteApiKey(key.id)}><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>

      <Dialog open={!!generatedKey} onClose={() => setGeneratedKey(null)} maxWidth="sm" fullWidth>
        <DialogTitle>API Key Generated</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>Please copy this key now. For your security, it will never be shown again!</Alert>
          <TextField fullWidth value={generatedKey || ''} InputProps={{ readOnly: true }} />
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setGeneratedKey(null)}>I have copied it</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, keyId: null })}>
        <DialogTitle>Revoke API Key</DialogTitle>
        <DialogContent>
          <Typography>Revoke this API Key? Any scripts currently using it will immediately lose access.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, keyId: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteApiKey}>Revoke</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}