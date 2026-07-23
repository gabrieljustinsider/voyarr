import { useState, useEffect, useMemo } from 'react'
import { Box, Typography, TextField, Button, Paper, Grid, Snackbar, Alert, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel, Tabs, Tab, Switch, FormControlLabel, InputAdornment, Autocomplete, Chip, LinearProgress, Stack, FormHelperText } from '@mui/material'
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
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TuneIcon from '@mui/icons-material/Tune'
import LanIcon from '@mui/icons-material/Lan'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { apiFetch } from '../api'
import PathPicker from './PathPicker'
import InlineTextField from './InlineTextField'
import PasswordChecklist from './PasswordChecklist'
import PermissionsManager from './PermissionsManager'
import AccountSecurity from './AccountSecurity'

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

function PillListInput({ label, value, onChange, placeholder = "Type and press enter..." }) {
  const [inputValue, setInputValue] = useState('')
  const pills = useMemo(() => {
    if (!value) return []
    return value.split(',').map(v => v.trim()).filter(Boolean)
  }, [value])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      const newPill = inputValue.trim()
      if (!pills.includes(newPill)) {
        const updated = [...pills, newPill].join(',')
        onChange(updated)
      }
      setInputValue('')
    }
  }

  const handleDelete = (pillToDelete) => {
    const updated = pills.filter(p => p !== pillToDelete).join(',')
    onChange(updated)
  }

  return (
    <Box sx={{ mt: 1.5, mb: 1.5 }}>
      <TextField
        fullWidth
        label={label}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        helperText="Press Enter to add items to the list"
        slotProps={{ input: {
          startAdornment: pills.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 0.5 }}>
              {pills.map((pill) => (
                <Chip
                  key={pill}
                  label={pill}
                  onDelete={() => handleDelete(pill)}
                  size="small"
                />
              ))}
            </Box>
          ) : null
        }}}
      />
    </Box>
  )
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
    global_user_agent: '',
    passkeys_enabled: 'true',
    passkeys_rp_name: 'Voyarr Media Server',
    passkeys_rp_id: '',
    passkeys_authenticator_attachment: 'any',
    passkeys_resident_key: 'required',
    passkeys_user_verification: 'preferred',
    passkeys_timeout: '60',
    passkeys_attestation: 'none',
    sso_enabled: 'false',
    oidc_enabled: 'false',
    auth_bypass_enabled: 'false',
    auth_bypass_subnets: '127.0.0.1',
    auth_bypass_default_user: '',
    auth_bypass_proxy_header_enabled: 'false',
    auth_bypass_proxy_header_name: 'Remote-User',
    streaming_enabled: 'true',
    scraping_enabled: 'false',
    ripping_enabled: 'false'
  })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [masterKeyInput, setMasterKeyInput] = useState(() => {
    const raw = localStorage.getItem('voyarr_api_key') || ''
    if (raw) {
      try {
        return atob(raw)
      } catch (e) {
        return raw
      }
    }
    return ''
  })
  const [diagnosticLoading, setDiagnosticLoading] = useState(false)
  const [diagnosticResult, setDiagnosticResult] = useState(null)
  const [showProxyUrl, setShowProxyUrl] = useState(false)
  const [bookmarkletCode, setBookmarkletCode] = useState('')



  const [passkeys, setPasskeys] = useState([])
  const [ssoLinks, setSsoLinks] = useState([])
  const [newPasskeyName, setNewPasskeyName] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [mockSsoOpen, setMockSsoOpen] = useState(false)
  const [mockSsoProvider, setMockSsoProvider] = useState('')
  const [mockSsoEmail, setMockSsoEmail] = useState('')
  const [newlyAddedPasskeyId, setNewlyAddedPasskeyId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const [settingsTab, setSettingsTab] = useState(0)

  // Local preferences state for UI Customizations
  const [themeName, setThemeName] = useState('dark')
  const [uiConfig, setUiConfig] = useState({
    showFavorites: true,
    showStudios: true,
    showAnalytics: true,
    showLive: true,
    rememberLastTab: false
  })
  const [isTvMode, setIsTvMode] = useState(false)

  // Load preferences from DB on mount
  useEffect(() => {
    const loadUserPreferences = async () => {
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
              showLive: data.ui_config.showLive !== false,
              rememberLastTab: !!data.ui_config.rememberLastTab
            })
            setIsTvMode(data.ui_config.isTvMode || false)
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    loadUserPreferences()
  }, [])

  const saveUserPreferences = async (newTheme, newUi, newTv) => {
    try {
      const res = await apiFetch('/user/stats/preferences', {
        method: 'POST',
        body: JSON.stringify({
          theme: newTheme,
          ui_config: { ...newUi, isTvMode: newTv }
        })
      })
      if (res.ok) {
        setThemeName(newTheme)
        setUiConfig(newUi)
        setIsTvMode(newTv)
        setSnackbar({ open: true, message: 'User UI customizations saved successfully!', severity: 'success' })
        window.dispatchEvent(new CustomEvent('preferences-updated'))
      }
    } catch (e) {
      console.error(e)
    }
  }

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
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const randomStr = array[0].toString(36).substring(0, 8);
      const providerUserId = `${mockSsoProvider}_usr_${randomStr}`
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
    let base64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      base64 += new Array(5 - pad).join('=');
    }
    const bin = window.atob(base64)
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
    } catch {
      return 'User'
    }
  }

  const handleAddPasskey = async () => {
    setPasskeyLoading(true)
    try {
      const existingIds = passkeys.map(pk => pk.id)
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
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const autoName = `${clientInfo.browser} Passkey (${timestamp})`
      
      const verifyPayload = {
        credential_id: credential.id,
        public_key: publicKeyB64,
        client_data_json: bufferToBase64(clientDataJSON),
        aaguid: aaguid,
        name: autoName,
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
      
      const res = await apiFetch('/auth/passkeys/')
      if (res.ok) {
        const freshPasskeys = await res.json()
        setPasskeys(freshPasskeys)
        const newPk = freshPasskeys.find(pk => !existingIds.includes(pk.id))
        if (newPk) {
          setNewlyAddedPasskeyId(newPk.id)
        }
      }
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
    apiFetch('/scraper/bookmarklet')
      .then(res => {
        if (res.ok) return res.json()
      })
      .then(data => {
        if (data && data.bookmarklet) setBookmarkletCode(data.bookmarklet)
      })
      .catch(console.error)
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
        fetchAdminLogs()
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

  const handleSaveMasterKey = () => {
    localStorage.setItem('voyarr_api_key', btoa(masterKeyInput))
    setSnackbar({ open: true, message: 'Master Key saved to browser securely!', severity: 'success' })
    // Refresh data with new key to force an updated fetch
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  const handleCreateUser = async () => {
    const password = newUser.password || ''
    const hasLength = password.length >= 8
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[^A-Za-z0-9]/.test(password)
    if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setSnackbar({ open: true, message: 'Password does not meet all security requirements.', severity: 'error' })
      return
    }
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser)
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `User ${newUser.username} created successfully!`, severity: 'success' })
        setNewUser({ username: '', password: '', role: 'user' })
        fetchUsersList()
        fetchAdminLogs()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
            console.error(err)
      setSnackbar({ open: true, message: 'Network error creating user.', severity: 'error' })
    }
  }
  const mediaPaths = useMemo(() => {
    if (!settings.media_root_path) return []
    return settings.media_root_path.split(',').map(p => p.trim()).filter(Boolean)
  }, [settings.media_root_path])

  const handleRemoveMediaPath = (pathToRemove) => {
    const updated = mediaPaths.filter(p => p !== pathToRemove).join(',')
    setSettings(prev => ({ ...prev, media_root_path: updated }))
    handleSave('media_root_path', updated)
  }

  const handleAddMediaPath = (newPath) => {
    if (!newPath) return
    const cleaned = newPath.trim()
    if (!mediaPaths.includes(cleaned)) {
      const updated = [...mediaPaths, cleaned].join(',')
      setSettings(prev => ({ ...prev, media_root_path: updated }))
      handleSave('media_root_path', updated)
    }
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" align="center" gutterBottom>Storage &amp; Directory Paths</Typography>
        <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }} color="textSecondary">
          Configure default filesystem paths for media scanning, downloads, and library structures.
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', gap: 3, width: '100%' }}>
          {/* Left Column (45%): All Input Fields Vertically Stacked */}
          <Box sx={{ width: '45%', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Media Root Scan Paths</Typography>
                <PathPicker
                  value=""
                  onChange={(val) => {
                    if (val) {
                      handleAddMediaPath(val);
                    }
                  }}
                  label="Add Media Root Path"
                  mode="folder"
                />
              </Box>

              <PathPicker
                value={settings.download_destination || ''}
                onChange={(val) => {
                  setSettings(prev => ({ ...prev, download_destination: val }));
                  handleSave('download_destination', val);
                }}
                label="Download Destination Path"
                helperText="Target directory for new downloads"
                mode="folder"
              />

              <PathPicker
                value={settings.library_folder || ''}
                onChange={(val) => {
                  setSettings(prev => ({ ...prev, library_folder: val }));
                  handleSave('library_folder', val);
                }}
                label="Library Folder Path"
                helperText="Root directory for sorted media library"
                mode="folder"
              />

              <PathPicker
                value={settings.scan_folder || ''}
                onChange={(val) => {
                  setSettings(prev => ({ ...prev, scan_folder: val }));
                  handleSave('scan_folder', val);
                }}
                label="Scan Folder Path"
                helperText="Directory to monitor for incoming files"
                mode="folder"
              />
            </Box>
          </Box>

          {/* Right Column (55%): Added Paths Chips */}
          <Box sx={{ width: '55%', flexGrow: 1 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Added Paths</Typography>
              {mediaPaths.length === 0 ? (
                <Typography variant="caption" color="textSecondary" display="block">No media root paths configured.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {mediaPaths.map((path) => (
                    <Chip
                      key={path}
                      label={path}
                      onDelete={() => handleRemoveMediaPath(path)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" align="center" gutterBottom>System-Wide Regional &amp; Localization Settings</Typography>
        <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }} color="textSecondary">
          Configure default language, time formats, and system timezone behaviors for users and schedules.
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 3, justifyContent: 'center', width: '100%', mt: 2 }}>
          <Box sx={{ flex: 1, maxWidth: 300, minWidth: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="global-locale-label">System Language</InputLabel>
              <Select
                labelId="global-locale-label"
                value={settings.global_locale || 'en'}
                label="System Language"
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, global_locale: e.target.value }));
                  handleSave('global_locale', e.target.value);
                }}
              >
                <MenuItem value="en">English (en)</MenuItem>
                <MenuItem value="es">Español (es)</MenuItem>
                <MenuItem value="fr">Français (fr)</MenuItem>
                <MenuItem value="de">Deutsch (de)</MenuItem>
                <MenuItem value="it">Italiano (it)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flex: 1, maxWidth: 300, minWidth: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="global-date-format-label">Date Format</InputLabel>
              <Select
                labelId="global-date-format-label"
                value={settings.global_date_format || 'YYYY-MM-DD'}
                label="Date Format"
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, global_date_format: e.target.value }));
                  handleSave('global_date_format', e.target.value);
                }}
              >
                <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-06-14)</MenuItem>
                <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (e.g. 06/14/2026)</MenuItem>
                <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (e.g. 14/06/2026)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flex: 1, maxWidth: 300, minWidth: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="global-time-format-label">Time Format</InputLabel>
              <Select
                labelId="global-time-format-label"
                value={settings.global_time_format || 'HH:mm:ss'}
                label="Time Format"
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, global_time_format: e.target.value }));
                  handleSave('global_time_format', e.target.value);
                }}
              >
                <MenuItem value="HH:mm:ss">24-hour (HH:mm:ss)</MenuItem>
                <MenuItem value="hh:mm:ss A">12-hour (hh:mm:ss AM/PM)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flex: 1, maxWidth: 300, minWidth: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="global-timezone-label">System Timezone</InputLabel>
              <Select
                labelId="global-timezone-label"
                value={settings.global_timezone || 'UTC'}
                label="System Timezone"
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, global_timezone: e.target.value }));
                  handleSave('global_timezone', e.target.value);
                }}
              >
                <MenuItem value="UTC">Coordinated Universal Time (UTC)</MenuItem>
                <MenuItem value="America/New_York">Eastern Time (America/New_York)</MenuItem>
                <MenuItem value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</MenuItem>
                <MenuItem value="Europe/London">Greenwich Mean Time (Europe/London)</MenuItem>
                <MenuItem value="Europe/Paris">Central European Time (Europe/Paris)</MenuItem>
                <MenuItem value="Asia/Tokyo">Japan Standard Time (Asia/Tokyo)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" align="center" gutterBottom>Browser Extension Integration</Typography>
        <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }} color="textSecondary">
          Integrate Voyarr directly with your web browser to dynamically trigger remote downloads while browsing media sites.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          <Box sx={{ p: 2, flex: 1, backgroundColor: 'rgba(33, 150, 243, 0.1)', borderRadius: 1, border: '1px solid #2196f3' }}>
            <Typography variant="subtitle2" color="info.main" gutterBottom style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <strong>Chrome / Edge Extension (Standard)</strong>
            </Typography>
            <Divider sx={{ my: 1, borderColor: 'info.main', opacity: 0.3 }} />
            <Typography variant="body2" sx={{ textAlign: 'left' }}>
              • Open Chrome or Edge and navigate to <code>chrome://extensions/</code><br/>
              • Enable <strong>Developer mode</strong> in the top right corner.<br/>
              • Click <strong>Load unpacked</strong> and select the <code>/extension</code> folder from your Voyarr installation directory.
            </Typography>
          </Box>
          
          <Box sx={{ p: 2, flex: 1, backgroundColor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1, border: '1px solid #4caf50' }}>
            <Typography variant="subtitle2" color="success.main" gutterBottom style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <strong>Meta Quest & Mobile (Universal Bookmarklet)</strong>
            </Typography>
            <Divider sx={{ my: 1, borderColor: 'success.main', opacity: 0.3 }} />
            <Typography variant="body2" sx={{ mb: 1.5, textAlign: 'left' }}>
              For VR Headsets (Meta Quest Browser) or mobile devices: Copy the bookmarklet code below, save it as a browser bookmark, and click it on any website to map selectors in 3D Space!
            </Typography>
            {bookmarkletCode ? (
              <Grid container spacing={2} sx={{ justifyContent: 'center' }}>
                <Grid item xs={12} sm={5} md={4}>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    color="success" 
                    href={bookmarkletCode} 
                    style={{ textTransform: 'none', cursor: 'grab' }}
                    onClick={(e) => {
                      e.preventDefault();
                      navigator.clipboard.writeText(bookmarkletCode);
                      setSnackbar({ open: true, message: 'Bookmarklet code copied! Dragging is not supported in all browsers, so paste it as a bookmark URL.', severity: 'success' });
                    }}
                  >
                    🎯 Voyarr Lens VR
                  </Button>
                </Grid>
                <Grid item xs={12} sm={5} md={4}>
                  <Button 
                    fullWidth 
                    variant="outlined" 
                    color="success"
                    onClick={() => {
                      navigator.clipboard.writeText(bookmarkletCode);
                      setSnackbar({ open: true, message: 'Bookmarklet code copied to clipboard!', severity: 'success' });
                    }}
                  >
                    Copy Bookmarklet
                  </Button>
                </Grid>
              </Grid>
            ) : (
              <Typography variant="body2" color="error">
                Failed to load bookmarklet code. Make sure your Voyarr server is fully updated and running.
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" align="center" gutterBottom>1Password Connect Integration</Typography>
        <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }} color="textSecondary">
          Sync your Voyarr credentials with a 1Password Connect server.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 3, justifyContent: 'center', width: '100%' }}>
            <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
              <TextField fullWidth label="1Password Connect Host" name="op_connect_host" value={settings.op_connect_host || ''} onChange={handleChange} helperText="e.g. http://localhost:8080" />
            </Box>
            <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
              <TextField fullWidth type="password" label="1Password Connect Token" name="op_connect_token" value={settings.op_connect_token || ''} onChange={handleChange} />
            </Box>
            <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
              <TextField fullWidth label="1Password Vault ID" name="op_vault_id" value={settings.op_vault_id || ''} onChange={handleChange} helperText="The ID of the vault to sync with." />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            <Button variant="contained" color="primary" onClick={() => {
              Promise.all([
                apiFetch('/settings', { method: 'POST', body: JSON.stringify({ key: 'op_connect_host', value: String(settings.op_connect_host ?? '') }) }),
                apiFetch('/settings', { method: 'POST', body: JSON.stringify({ key: 'op_connect_token', value: String(settings.op_connect_token ?? '') }) }),
                apiFetch('/settings', { method: 'POST', body: JSON.stringify({ key: 'op_vault_id', value: String(settings.op_vault_id ?? '') }) })
              ]).then(results => {
                if (results.every(r => r.ok)) setSnackbar({ open: true, message: '1Password settings saved!', severity: 'success' })
                else setSnackbar({ open: true, message: 'Some 1Password settings failed to save.', severity: 'warning' })
              }).catch(() => setSnackbar({ open: true, message: 'Failed to save 1Password settings.', severity: 'error' }))
            }}>Save 1Password Settings</Button>
            <Button variant="outlined" color="primary" onClick={() => handleSyncManager('1password', 'push')}>Push to 1Password</Button>
            <Button variant="outlined" color="secondary" onClick={() => handleSyncManager('1password', 'pull')}>Pull from 1Password</Button>
          </Box>
        </Box>
      </Paper>

    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" align="center" gutterBottom>Bitwarden Integration</Typography>
      <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }} color="textSecondary">
        Sync your Voyarr credentials with Bitwarden or Vaultwarden via the Bitwarden CLI REST server ('bw serve').
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 3, justifyContent: 'center', width: '100%' }}>
          <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
            <TextField fullWidth label="Bitwarden Serve Host" name="bw_connect_host" value={settings.bw_connect_host || ''} onChange={handleChange} helperText="e.g. http://localhost:8087" />
          </Box>
          <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
            <TextField fullWidth type="password" label="Bitwarden Session Token" name="bw_session_token" value={settings.bw_session_token || ''} onChange={handleChange} helperText="The BW_SESSION token generated upon unlocking your vault." />
          </Box>
          <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
            <TextField fullWidth label="Bitwarden Folder ID" name="bw_folder_id" value={settings.bw_folder_id || ''} onChange={handleChange} helperText="Optional: The ID of the folder to sync with." />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mt: 1 }}>
          <Button variant="contained" color="primary" onClick={() => {
            Promise.all([
              apiFetch('/settings', { method: 'POST', body: JSON.stringify({ key: 'bw_connect_host', value: String(settings.bw_connect_host ?? '') }) }),
              apiFetch('/settings', { method: 'POST', body: JSON.stringify({ key: 'bw_session_token', value: String(settings.bw_session_token ?? '') }) }),
              apiFetch('/settings', { method: 'POST', body: JSON.stringify({ key: 'bw_folder_id', value: String(settings.bw_folder_id ?? '') }) })
            ]).then(results => {
              if (results.every(r => r.ok)) setSnackbar({ open: true, message: 'Bitwarden settings saved!', severity: 'success' })
              else setSnackbar({ open: true, message: 'Some Bitwarden settings failed to save.', severity: 'warning' })
            }).catch(() => setSnackbar({ open: true, message: 'Failed to save Bitwarden settings.', severity: 'error' }))
          }}>Save Bitwarden Settings</Button>
          <Button variant="outlined" color="primary" onClick={() => handleSyncManager('bitwarden', 'push')}>Push to Bitwarden</Button>
          <Button variant="outlined" color="secondary" onClick={() => handleSyncManager('bitwarden', 'pull')}>Pull from Bitwarden</Button>
        </Box>
      </Box>
    </Paper>

    <Paper elevation={2} sx={{ 
      p: 3, 
      mb: 3, 
      borderRadius: 2
    }}>
        {/* Global Feature Controls */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <TuneIcon color="secondary" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Global Feature Controls</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7, textAlign: 'center' }} color="textSecondary">
            Enable or disable primary features system-wide. Disabling a feature will reject API requests and block access for all users.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 2, justifyContent: 'center', alignItems: 'stretch', width: '100%', mb: 2 }}>
            <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <FormControlLabel
                  control={<Switch checked={settings.streaming_enabled === 'true'} onChange={e => handleToggleSetting('streaming_enabled', e.target.checked)} color="primary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Streaming Features</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Video streaming, HLS and playback capabilities (Default: ON)
                </Typography>
              </Paper>
            </Box>
            <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <FormControlLabel
                  control={<Switch checked={settings.scraping_enabled === 'true'} onChange={e => handleToggleSetting('scraping_enabled', e.target.checked)} color="secondary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Scraping Features</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Dynamic browser metadata scraping & Map Mode (Default: OFF)
                </Typography>
              </Paper>
            </Box>
            <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <FormControlLabel
                  control={<Switch checked={settings.ripping_enabled === 'true'} onChange={e => handleToggleSetting('ripping_enabled', e.target.checked)} color="error" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Ripping Features</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Mass ripping and queue download engines (Default: OFF)
                </Typography>
              </Paper>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3, opacity: 0.2 }} />

        {/* Authentication Policies */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <TuneIcon color="info" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Global Authentication Policies</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7, textAlign: 'center' }} color="textSecondary">
            Control which sign-in methods are available on the login screen. Disabling an option will hide it from users and block API requests.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2, justifyContent: 'center' }}>
            <Grid item xs={12} md={4}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <FormControlLabel
                  control={<Switch checked={settings.passkeys_enabled === 'true'} onChange={e => handleToggleSetting('passkeys_enabled', e.target.checked)} color="secondary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Passkey Authentication</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  WebAuthn / FIDO2 passwordless logins
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <FormControlLabel
                  control={<Switch checked={settings.sso_enabled === 'true'} onChange={e => handleToggleSetting('sso_enabled', e.target.checked)} color="primary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Single Sign-On (SSO)</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Google, GitHub, Discord providers
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <FormControlLabel
                  control={<Switch checked={settings.oidc_enabled === 'true'} onChange={e => handleToggleSetting('oidc_enabled', e.target.checked)} color="primary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>OpenID Connect (OIDC)</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Keycloak, Authentik, Azure AD, etc.
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Passkeys Configuration Section */}
          {settings.passkeys_enabled === 'true' && (
            <Box sx={{
              p: 3, mb: 3, borderRadius: '12px', width: '100%', maxWidth: '600px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#00e676', mb: 2 }}>
                🔑 Passkey & WebAuthn Customization
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  fullWidth
                  label="Display Name"
                  name="passkeys_rp_name"
                  value={settings.passkeys_rp_name || ''}
                  onChange={handleChange}
                  onBlur={e => handleSave(e.target.name, e.target.value)}
                  helperText="The name shown on your device prompt when logging in."
                />

                <TextField
                  fullWidth
                  label="Website Address Override"
                  name="passkeys_rp_id"
                  value={settings.passkeys_rp_id || ''}
                  onChange={handleChange}
                  onBlur={e => handleSave(e.target.name, e.target.value)}
                  placeholder="e.g. example.com"
                  helperText="Leave blank to automatically detect your domain. Override only if using advanced routing."
                />

                <FormControl fullWidth>
                  <InputLabel id="settings-attachment-label">Allowed Sign-In Devices</InputLabel>
                  <Select
                    labelId="settings-attachment-label"
                    label="Allowed Sign-In Devices"
                    name="passkeys_authenticator_attachment"
                    value={settings.passkeys_authenticator_attachment || 'any'}
                    onChange={e => {
                      setSettings(prev => ({ ...prev, passkeys_authenticator_attachment: e.target.value }));
                      handleSave('passkeys_authenticator_attachment', e.target.value);
                    }}
                  >
                    <MenuItem value="any">Any Device (Recommended)</MenuItem>
                    <MenuItem value="platform">This Device Only (built-in fingerprint/face unlock)</MenuItem>
                    <MenuItem value="cross-platform">Portable Keys Only (USB security keys)</MenuItem>
                  </Select>
                  <FormHelperText>Restrict passkey storage to specific device types.</FormHelperText>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="settings-resident-key-label">Username-Free Sign-In</InputLabel>
                  <Select
                    labelId="settings-resident-key-label"
                    label="Username-Free Sign-In"
                    name="passkeys_resident_key"
                    value={settings.passkeys_resident_key || 'required'}
                    onChange={e => {
                      setSettings(prev => ({ ...prev, passkeys_resident_key: e.target.value }));
                      handleSave('passkeys_resident_key', e.target.value);
                    }}
                  >
                    <MenuItem value="required">Enabled (Recommended)</MenuItem>
                    <MenuItem value="preferred">Preferred</MenuItem>
                    <MenuItem value="discouraged">Disabled (Must type username first)</MenuItem>
                  </Select>
                  <FormHelperText>Permits logging in by scanning fingerprint/face without typing your username first.</FormHelperText>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="settings-verification-label">Require Fingerprint/Face Verification</InputLabel>
                  <Select
                    labelId="settings-verification-label"
                    label="Require Fingerprint/Face Verification"
                    name="passkeys_user_verification"
                    value={settings.passkeys_user_verification || 'preferred'}
                    onChange={e => {
                      setSettings(prev => ({ ...prev, passkeys_user_verification: e.target.value }));
                      handleSave('passkeys_user_verification', e.target.value);
                    }}
                  >
                    <MenuItem value="preferred">Preferred (Recommended)</MenuItem>
                    <MenuItem value="required">Strictly Required</MenuItem>
                    <MenuItem value="discouraged">Not Required</MenuItem>
                  </Select>
                  <FormHelperText>Forces validation of biometrics (fingerprint/face) or PIN code before completing login.</FormHelperText>
                </FormControl>

                <TextField
                  fullWidth
                  type="number"
                  label="Setup Time Limit (seconds)"
                  name="passkeys_timeout"
                  value={settings.passkeys_timeout || '60'}
                  onChange={handleChange}
                  onBlur={e => handleSave(e.target.name, e.target.value)}
                  helperText="Maximum allowed time to complete the scanner verification before it cancels."
                />

                <FormControl fullWidth>
                  <InputLabel id="settings-attestation-label">Security Device Verification</InputLabel>
                  <Select
                    labelId="settings-attestation-label"
                    label="Security Device Verification"
                    name="passkeys_attestation"
                    value={settings.passkeys_attestation || 'none'}
                    onChange={e => {
                      setSettings(prev => ({ ...prev, passkeys_attestation: e.target.value }));
                      handleSave('passkeys_attestation', e.target.value);
                    }}
                  >
                    <MenuItem value="none">Do Not Collect (Recommended)</MenuItem>
                    <MenuItem value="indirect">Collect Indirectly</MenuItem>
                    <MenuItem value="direct">Collect Directly</MenuItem>
                  </Select>
                  <FormHelperText>Verifies the authenticity of the physical hardware key against manufacturer databases.</FormHelperText>
                </FormControl>
              </Box>
            </Box>
          )}

          {/* SSO Notice */}
          {settings.sso_enabled === 'true' && (
            <Box sx={{
              p: 2, mb: 2, borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(63, 81, 181, 0.08) 0%, rgba(156, 39, 176, 0.05) 100%)',
              border: '1px solid rgba(63, 81, 181, 0.2)'
            }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#7c8dff', display: 'block', mb: 0.5 }}>ℹ️ SSO Configuration Required</Typography>
              <Typography variant="caption" component="div" sx={{ opacity: 0.8, lineHeight: 1.8 }} color="textSecondary">
                To enable SSO providers, configure the following environment variables in your host <code>.env</code> file and restart the backend:
                <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                  <li><code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> — from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" style={{ color: '#7c8dff' }}>Google Cloud Console <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} /></a></li>
                  <li><code>GITHUB_CLIENT_ID</code> / <code>GITHUB_CLIENT_SECRET</code> — from <a href="https://github.com/settings/developers" target="_blank" rel="noopener" style={{ color: '#7c8dff' }}>GitHub Developer Settings <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} /></a></li>
                  <li><code>DISCORD_CLIENT_ID</code> / <code>DISCORD_CLIENT_SECRET</code> — from <a href="https://discord.com/developers/applications" target="_blank" rel="noopener" style={{ color: '#7c8dff' }}>Discord Developer Portal <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} /></a></li>
                </Box>
              </Typography>
            </Box>
          )}

          {/* OIDC Notice */}
          {settings.oidc_enabled === 'true' && (
            <Box sx={{
              p: 2, mb: 2, borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.08) 0%, rgba(255, 87, 34, 0.05) 100%)',
              border: '1px solid rgba(255, 152, 0, 0.2)'
            }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#ffb74d', display: 'block', mb: 0.5 }}>ℹ️ OIDC Configuration Required</Typography>
              <Typography variant="caption" component="div" sx={{ opacity: 0.8, lineHeight: 1.8 }} color="textSecondary">
                Configure these environment variables in your host <code>.env</code> file:
                <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                  <li><code>OIDC_CLIENT_ID</code> — The client ID from your identity provider</li>
                  <li><code>OIDC_CLIENT_SECRET</code> — The client secret from your identity provider</li>
                  <li><code>OIDC_DISCOVERY_URL</code> — The OpenID Connect discovery endpoint (e.g., <code>https://auth.example.com/.well-known/openid-configuration</code>)</li>
                </Box>
                <Box sx={{ mt: 1 }}>
                  Set the <strong>Callback/Redirect URI</strong> in your identity provider to: <code>{`${window.location.protocol}//${window.location.hostname}:8000/auth/oidc/callback`}</code>
                </Box>
                <Box sx={{ mt: 1 }}>
                  Compatible with: Keycloak, Authentik, Authelia, Azure AD / Entra ID, Okta, Google Workspace, and any OpenID Connect compliant provider.
                </Box>
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 3, opacity: 0.2 }} />

        {/* Automatic Authentication Bypass (Autologin) */}
        <Box sx={{ p: 3, borderRadius: '12px', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <LanIcon color="warning" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Automatic Authentication Bypass</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7, textAlign: 'center' }} color="textSecondary">
            Allow users to skip the login screen entirely when connecting from a trusted network or through a trusted reverse proxy.
          </Typography>

          {(settings.auth_bypass_enabled === 'true' || settings.auth_bypass_proxy_header_enabled === 'true') && (
            <Box sx={{
              p: 2, mb: 3, borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.12) 0%, rgba(244, 67, 54, 0.08) 100%)',
              border: '1px solid rgba(255, 152, 0, 0.2)',
              display: 'flex', alignItems: 'flex-start', gap: 1.5
            }}>
              <WarningAmberIcon sx={{ color: '#ff9800', mt: 0.2 }} />
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#ff9800', display: 'block', mb: 0.5 }}>⚠️ Security Warning</Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, lineHeight: 1.6 }} color="textSecondary">
                  Authentication bypass should only be enabled on isolated, private networks. If you are exposing Voyarr to the internet, ensure your reverse proxy strips any spoofed authentication headers from external requests. Misconfigured bypass settings can allow unauthorized access.
                </Typography>
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'stretch', width: '100%' }}>
            {/* Trusted Subnet Bypass */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <FormControlLabel
                  control={<Switch checked={settings.auth_bypass_enabled === 'true'} onChange={e => handleToggleSetting('auth_bypass_enabled', e.target.checked)} color="warning" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Trusted Subnet Bypass</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mb: 2, opacity: 0.5 }} color="textSecondary">
                  Auto-login when connecting from a trusted IP range (e.g., your home LAN).
                </Typography>

                {settings.auth_bypass_enabled === 'true' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                      size="small"
                      label="Trusted Subnets (comma-separated)"
                      placeholder="127.0.0.1, 192.168.1.0/24, 10.0.0.0/8"
                      value={settings.auth_bypass_subnets}
                      onChange={e => setSettings(prev => ({ ...prev, auth_bypass_subnets: e.target.value }))}
                      onBlur={() => handleSave('auth_bypass_subnets', settings.auth_bypass_subnets)}
                      helperText="IPv4/IPv6 addresses or CIDR notation"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                    />
                    <TextField
                      size="small"
                      label="Default Auto-Login Username"
                      placeholder="e.g. local_viewer"
                      value={settings.auth_bypass_default_user}
                      onChange={e => setSettings(prev => ({ ...prev, auth_bypass_default_user: e.target.value }))}
                      onBlur={() => handleSave('auth_bypass_default_user', settings.auth_bypass_default_user)}
                      helperText="The user account to sign in as automatically"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                    />
                  </Box>
                )}
              </Paper>
            </Box>

            {/* Reverse Proxy Header Trust */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <FormControlLabel
                  control={<Switch checked={settings.auth_bypass_proxy_header_enabled === 'true'} onChange={e => handleToggleSetting('auth_bypass_proxy_header_enabled', e.target.checked)} color="warning" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Reverse Proxy Header Trust</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mb: 2, opacity: 0.5 }} color="textSecondary">
                  Trust an HTTP header set by your reverse proxy (Authelia, Authentik, Cloudflare Access) to auto-login.
                </Typography>

                {settings.auth_bypass_proxy_header_enabled === 'true' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                      size="small"
                      label="Trusted Header Name"
                      placeholder="Remote-User"
                      value={settings.auth_bypass_proxy_header_name}
                      onChange={e => setSettings(prev => ({ ...prev, auth_bypass_proxy_header_name: e.target.value }))}
                      onBlur={() => handleSave('auth_bypass_proxy_header_name', settings.auth_bypass_proxy_header_name)}
                      helperText="Common headers: Remote-User, X-Webauth-User, X-Forwarded-User"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                    />
                    <Typography variant="caption" sx={{ opacity: 0.6, lineHeight: 1.5 }} color="textSecondary">
                      If the specified user does not exist, a new account will be auto-provisioned with the "user" role.
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Box>
          </Box>
        </Box>
      </Paper>


      {/* Mock SSO Simulated OAuth Dialog */}
      <Dialog 
        open={mockSsoOpen} 
        onClose={() => setMockSsoOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          elevation: 6,
          sx: {
            borderRadius: 3
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

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>

    </Box>
  )
}