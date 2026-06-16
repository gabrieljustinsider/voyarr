import { useState, useEffect, useMemo } from 'react'
import { Box, Typography, TextField, Button, Paper, Grid, Snackbar, Alert, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel, Tabs, Tab, Switch, FormControlLabel, InputAdornment, Autocomplete, Chip, LinearProgress, Stack } from '@mui/material'
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
        InputProps={{
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
        }}
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

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })
  const [usersList, setUsersList] = useState([])
  const [adminLogs, setAdminLogs] = useState([])

  // Advanced User Management states
  const [selectedUserForManage, setSelectedUserForManage] = useState(null)
  const [manageUserOpen, setManageUserOpen] = useState(false)
  const [manageUserTab, setManageUserTab] = useState(0)
  const [manageUserLoading, setManageUserLoading] = useState(false)
  const [adminResetPasswordOpen, setAdminResetPasswordOpen] = useState(false)
  const [adminResetPasswordNew, setAdminResetPasswordNew] = useState('')
  const [mergeTargetUserId, setMergeTargetUserId] = useState('')
  const [userActivitySearch, setUserActivitySearch] = useState('')
  const [userActivityActionFilter, setUserActivityActionFilter] = useState('all')

  const [editUsername, setEditUsername] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editPermissions, setEditPermissions] = useState({
    can_stream: true,
    can_scrape: false,
    can_rip: false,
    url_parsing: 'edit'
  })

  const [passkeys, setPasskeys] = useState([])
  const [ssoLinks, setSsoLinks] = useState([])
  const [newPasskeyName, setNewPasskeyName] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [mockSsoOpen, setMockSsoOpen] = useState(false)
  const [mockSsoProvider, setMockSsoProvider] = useState('')
  const [mockSsoEmail, setMockSsoEmail] = useState('')

  const [settingsTab, setSettingsTab] = useState(0)

  // Local preferences state for UI Customizations
  const [themeName, setThemeName] = useState('dark')
  const [uiConfig, setUiConfig] = useState({
    showFavorites: true,
    showStudios: true,
    showAnalytics: true,
    showLive: true
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
              showLive: data.ui_config.showLive !== false
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

  const fetchUsersList = async () => {
    try {
      const res = await apiFetch('/auth/users')
      if (res.ok) {
        setUsersList(await res.json())
      }
    } catch (err) { console.error('Failed to fetch users list:', err) }
  }

  const fetchAdminLogs = async () => {
    try {
      const res = await apiFetch('/auth/admin-logs')
      if (res.ok) {
        setAdminLogs(await res.json())
      }
    } catch (err) { console.error('Failed to fetch admin logs:', err) }
  }

  const handleUpdateUserPermissions = async (userId, newRole, newPermissions) => {
    try {
      const res = await apiFetch(`/auth/users/${userId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole, permissions: newPermissions })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'User role and permissions updated successfully!', severity: 'success' })
        fetchUsersList()
        fetchAdminLogs()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error updating user.', severity: 'error' })
    }
  }

  const handleOpenManageUser = async (userId) => {
    setManageUserLoading(true)
    setManageUserOpen(true)
    try {
      const res = await apiFetch(`/auth/users/${userId}`)
      if (res.ok) {
        setSelectedUserForManage(await res.json())
      } else {
        setSnackbar({ open: true, message: 'Failed to retrieve user details.', severity: 'error' })
        setManageUserOpen(false)
      }
    } catch (e) {
      console.error(e)
      setSnackbar({ open: true, message: 'Error retrieving user details.', severity: 'error' })
      setManageUserOpen(false)
    }
    setManageUserLoading(false)
  }

  const handleAdminResetPassword = async (newPassword) => {
    if (!newPassword || newPassword.length < 8) {
      setSnackbar({ open: true, message: 'Password must be at least 8 characters long.', severity: 'error' })
      return
    }
    try {
      const res = await apiFetch(`/auth/users/${selectedUserForManage.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Password reset successfully.', severity: 'success' })
        setAdminResetPasswordOpen(false)
        setAdminResetPasswordNew('')
        handleOpenManageUser(selectedUserForManage.id)
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Error resetting password.', severity: 'error' })
    }
  }

  const handleAdminResetMfa = async () => {
    try {
      const res = await apiFetch(`/auth/users/${selectedUserForManage.id}/reset-mfa`, { method: 'POST' })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Successfully revoked all enrolled passkeys.', severity: 'success' })
        handleOpenManageUser(selectedUserForManage.id)
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Error revoking passkeys.', severity: 'error' })
    }
  }

  const handleAdminResetSso = async () => {
    try {
      const res = await apiFetch(`/auth/users/${selectedUserForManage.id}/reset-sso`, { method: 'POST' })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Successfully unlinked all SSO connections.', severity: 'success' })
        handleOpenManageUser(selectedUserForManage.id)
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Error unlinking SSO links.', severity: 'error' })
    }
  }

  const handleAdminSavePermissions = async (updatedUsername, updatedRole, updatedActive, updatedPermissions) => {
    try {
      const res = await apiFetch(`/auth/users/${selectedUserForManage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: updatedUsername,
          role: updatedRole,
          is_active: updatedActive,
          permissions: updatedPermissions
        })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Profile, role, and permissions updated successfully!', severity: 'success' })
        fetchUsersList()
        handleOpenManageUser(selectedUserForManage.id)
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Error updating user configuration.', severity: 'error' })
    }
  }

  const handleAdminDeleteUser = async () => {
    try {
      const res = await apiFetch(`/auth/users/${selectedUserForManage.id}`, { method: 'DELETE' })
      if (res.ok) {
        setSnackbar({ open: true, message: `User account deleted successfully!`, severity: 'success' })
        setManageUserOpen(false)
        fetchUsersList()
        fetchAdminLogs()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Error deleting user account.', severity: 'error' })
    }
  }

  const handleAdminMergeUsers = async (targetUserId) => {
    if (!targetUserId) {
      setSnackbar({ open: true, message: 'Please select a destination user to merge into.', severity: 'warning' })
      return
    }
    try {
      const res = await apiFetch('/auth/users/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_user_id: selectedUserForManage.id,
          target_user_id: targetUserId
        })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Users merged successfully! History has been consolidated.', severity: 'success' })
        setManageUserOpen(false)
        fetchUsersList()
        fetchAdminLogs()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Error merging user accounts.', severity: 'error' })
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
    fetchUsersList()
    fetchAdminLogs()
  }, [])

  useEffect(() => {
    if (selectedUserForManage) {
      setEditUsername(selectedUserForManage.username || '')
      setEditRole(selectedUserForManage.role || '')
      setEditIsActive(selectedUserForManage.is_active !== false)
      setEditPermissions(selectedUserForManage.permissions || {
        can_stream: true,
        can_scrape: false,
        can_rip: false,
        url_parsing: 'edit'
      })
    }
  }, [selectedUserForManage])

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
        <Typography variant="h6" gutterBottom>Storage &amp; Directory Paths</Typography>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Configure default filesystem paths for media scanning, downloads, and library structures.
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={3}>
          {/* Left Column: All Input Fields Vertically Stacked */}
          <Grid item xs={12} md={4}>
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
          </Grid>

          {/* Right Column: Added Paths Chips */}
          <Grid item xs={12} md={8}>
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
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>System-Wide Regional &amp; Localization Settings</Typography>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Configure default regional formats, timezone, and language preferences for the entire system dashboard.
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
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
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
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
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
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
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
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
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Browser Extension Integration</Typography>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Connect your Voyarr Lens browser extension to easily map CSS selectors on live websites.
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
        <Typography variant="h6" gutterBottom>1Password Connect Integration</Typography>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Sync your Voyarr credentials with a 1Password Connect server.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} md={8}>
            <TextField fullWidth label="1Password Connect Host" name="op_connect_host" value={settings.op_connect_host || ''} onChange={handleChange} helperText="e.g. http://localhost:8080" />
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField fullWidth type="password" label="1Password Connect Token" name="op_connect_token" value={settings.op_connect_token || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField fullWidth label="1Password Vault ID" name="op_vault_id" value={settings.op_vault_id || ''} onChange={handleChange} helperText="The ID of the vault to sync with." />
          </Grid>
          <Grid item xs={12}>
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
          </Grid>
        </Grid>
      </Paper>

    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>Bitwarden Integration</Typography>
      <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
        Sync your Voyarr credentials with Bitwarden or Vaultwarden via the Bitwarden CLI REST server ('bw serve').
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={3} justifyContent="center">
        <Grid item xs={12} md={8}>
          <TextField fullWidth label="Bitwarden Serve Host" name="bw_connect_host" value={settings.bw_connect_host || ''} onChange={handleChange} helperText="e.g. http://localhost:8087" />
        </Grid>
        <Grid item xs={12} md={8}>
          <TextField fullWidth type="password" label="Bitwarden Session Token" name="bw_session_token" value={settings.bw_session_token || ''} onChange={handleChange} helperText="The BW_SESSION token generated upon unlocking your vault." />
        </Grid>
        <Grid item xs={12} md={8}>
          <TextField fullWidth label="Bitwarden Folder ID" name="bw_folder_id" value={settings.bw_folder_id || ''} onChange={handleChange} helperText="Optional: The ID of the folder to sync with." />
        </Grid>
        <Grid item xs={12}>
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
        </Grid>
      </Grid>
    </Paper>

      <Paper elevation={2} sx={{ 
        p: 3, 
        mb: 3, 
        borderRadius: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1 }}>
          <SecurityIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h6" sx={{ fontWeight: '700', letterSpacing: '0.5px' }}>Account Security & Authentication</Typography>
        </Box>
        <Typography variant="body2" sx={{ mb: 3, opacity: 0.8, textAlign: 'center' }} color="textSecondary">
          Secure your account using enterprise-grade passwordless passkeys (WebAuthn) or link external identity providers for one-click single sign-on access.
        </Typography>
        
        <Divider sx={{ mb: 2, opacity: 0.2 }} />
        
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
                    <Paper elevation={1} sx={{ 
                      p: 2, 
                      borderRadius: 2,
                      transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
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
          
          <Grid container spacing={2} justifyContent="center">
            {['google', 'github', 'discord'].map(provider => {
              const link = ssoLinks.find(l => l.provider === provider)
              const isLinked = !!link
              
              return (
                <Grid item xs={12} md={4} key={provider}>
                  <Paper elevation={1} sx={{ 
                    p: 2, 
                    borderRadius: 2,
                    bgcolor: isLinked ? 'rgba(0, 230, 118, 0.05)' : 'background.paper',
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

        <Divider sx={{ my: 3, opacity: 0.2 }} />

        {/* Global Feature Controls */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TuneIcon color="secondary" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Global Feature Controls</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7 }} color="textSecondary">
            Enable or disable primary features system-wide. Disabling a feature will reject API requests and block access for all users.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <FormControlLabel
                  control={<Switch checked={settings.streaming_enabled === 'true'} onChange={e => handleToggleSetting('streaming_enabled', e.target.checked)} color="primary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Streaming Features</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Video streaming, HLS and playback capabilities (Default: ON)
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <FormControlLabel
                  control={<Switch checked={settings.scraping_enabled === 'true'} onChange={e => handleToggleSetting('scraping_enabled', e.target.checked)} color="secondary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Scraping Features</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Dynamic browser metadata scraping & Map Mode (Default: OFF)
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <FormControlLabel
                  control={<Switch checked={settings.ripping_enabled === 'true'} onChange={e => handleToggleSetting('ripping_enabled', e.target.checked)} color="error" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Ripping Features</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Mass ripping and queue download engines (Default: OFF)
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3, opacity: 0.2 }} />

        {/* Authentication Policies */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TuneIcon color="info" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Global Authentication Policies</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7 }} color="textSecondary">
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

          {/* Passkeys Notice */}
          {settings.passkeys_enabled === 'true' && (
            <Box sx={{
              p: 2, mb: 2, borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.06) 0%, rgba(0, 176, 255, 0.04) 100%)',
              border: '1px solid rgba(0, 230, 118, 0.15)'
            }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#00e676', display: 'block', mb: 0.5 }}>ℹ️ Passkey Requirements</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, lineHeight: 1.6 }} color="textSecondary">
                WebAuthn requires <strong>HTTPS</strong> or <strong>localhost</strong>. The Relying Party (RP) ID is automatically derived from the browser's hostname. Password managers like 1Password, Bitwarden, iCloud Keychain, and Google Password Manager will automatically be triggered during passkey creation and authentication.
              </Typography>
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
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LanIcon color="warning" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Automatic Authentication Bypass</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7 }} color="textSecondary">
            Allow users to skip the login screen entirely when connecting from a trusted network or through a trusted reverse proxy.
          </Typography>

          {(settings.auth_bypass_enabled === 'true' || settings.auth_bypass_proxy_header_enabled === 'true') && (
            <Box sx={{
              p: 2, mb: 3, borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.12) 0%, rgba(244, 67, 54, 0.08) 100%)',
              border: '1px solid rgba(255, 152, 0, 0.3)',
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

          <Grid container spacing={2} sx={{ justifyContent: 'center', alignItems: 'stretch' }}>
            {/* Trusted Subnet Bypass */}
            <Grid item xs={12} md={6}>
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
            </Grid>

            {/* Reverse Proxy Header Trust */}
            <Grid item xs={12} md={6}>
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
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <Box sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>User Management</Typography>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Create user accounts to grant access to the UI without sharing your Master Key.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <TextField fullWidth size="small" label="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
              <TextField fullWidth size="small" type="password" label="Password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
              <FormControl fullWidth size="small">
                <InputLabel>Role</InputLabel>
                <Select value={newUser.role} label="Role" onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="user">User</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <PasswordChecklist password={newUser.password} />
          </Grid>
          <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button fullWidth variant="contained" onClick={handleCreateUser} disabled={!newUser.username || !newUser.password}>Create User</Button>
          </Grid>
        </Grid>
      </Box>

      {/* Users List & Advanced Management Dashboard */}
      {usersList.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>User Directory & Management Dashboard</Typography>
          <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
            Manage system roles, suspend accounts, reset credentials, revoke passkeys, check IPs, or consolidate history using merges.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ overflowX: 'auto', width: '100%' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Username</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>System Role</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Account Status</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Created On</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Last Signed In</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usersList.map((u) => {
                  const perms = u.permissions || { can_stream: true, can_scrape: false, can_rip: false, url_parsing: 'edit' };
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell align="center" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{u.username}</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Chip
                          size="small"
                          label={u.role}
                          color={u.role === 'admin' ? 'secondary' : u.role === 'user' ? 'primary' : 'default'}
                          sx={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 'bold' }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Switch
                          checked={u.is_active}
                          disabled={u.role === 'admin'}
                          onChange={(e) => handleAdminSavePermissions(u.username, u.role, e.target.checked, perms)}
                          color="secondary"
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ fontSize: '0.85rem', opacity: 0.8, whiteSpace: 'nowrap' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell align="center" sx={{ fontSize: '0.85rem', opacity: 0.8, whiteSpace: 'nowrap' }}>
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleOpenManageUser(u.id)}
                          sx={{ borderRadius: '6px', fontSize: '0.75rem', py: 0.5 }}
                        >
                          Manage Profile
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* Admin Action Audit Logs */}
      {adminLogs.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Admin Action Audit Logs</Typography>
          <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
            A chronological security audit log of all administrative actions, policy adjustments, and user permission updates.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 'bold', background: '#11121a', whiteSpace: 'nowrap' }}>Timestamp</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', background: '#11121a', whiteSpace: 'nowrap' }}>Administrator</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', background: '#11121a', whiteSpace: 'nowrap' }}>Action</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', background: '#11121a', whiteSpace: 'nowrap' }}>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {adminLogs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell align="center" sx={{ opacity: 0.8, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{log.admin_username}</TableCell>
                    <TableCell align="center" sx={{ textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 'bold', color: 'info.main', whiteSpace: 'nowrap' }}>
                      {log.action}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.85rem', maxWidth: '300px', wordBreak: 'break-all' }}>
                      {JSON.stringify(log.details)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

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

      {/* Advanced User Management Details Dialog */}
      <Dialog 
        open={manageUserOpen} 
        onClose={() => setManageUserOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          elevation: 6,
          sx: {
            borderRadius: 3,
            minHeight: '580px'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontFamily: 'Outfit, sans-serif' }}>
              User Security & Profile Management
            </Typography>
            <IconButton onClick={() => setManageUserOpen(false)} sx={{ color: 'text.secondary' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {manageUserLoading || !selectedUserForManage ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
              <SyncIcon sx={{ fontSize: '3rem', animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
              <Typography variant="body1">Retrieving user profile from database...</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', height: '100%', flexGrow: 1 }}>
              {/* Tab Navigation Menu */}
              <Box sx={{ borderRight: '1px solid rgba(255,255,255,0.08)', width: '220px', minWidth: '220px' }}>
                <Tabs
                  orientation="vertical"
                  value={manageUserTab}
                  onChange={(e, nv) => setManageUserTab(nv)}
                  sx={{
                    '& .MuiTab-root': {
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      textTransform: 'none',
                      fontSize: '0.85rem',
                      fontFamily: 'Outfit, sans-serif',
                      py: 1.5,
                      px: 2,
                      color: 'text.secondary',
                      minHeight: 'auto',
                      '&.Mui-selected': {
                        color: 'primary.main',
                        backgroundColor: 'rgba(255,255,255,0.03)'
                      }
                    },
                    '& .MuiTabs-indicator': {
                      left: 0,
                      right: 'auto',
                      width: '4px',
                      borderRadius: '0 4px 4px 0'
                    }
                  }}
                >
                  <Tab icon={<SecurityIcon sx={{ fontSize: '1.2rem', mr: 1 }} />} iconPosition="start" label="Profile & Security" />
                  <Tab icon={<TuneIcon sx={{ fontSize: '1.2rem', mr: 1 }} />} iconPosition="start" label="Permissions & Roles" />
                  <Tab icon={<LanIcon sx={{ fontSize: '1.2rem', mr: 1 }} />} iconPosition="start" label="Activity Logs" />
                  <Tab icon={<WarningAmberIcon sx={{ fontSize: '1.2rem', mr: 1 }} />} iconPosition="start" label="Admin Actions" />
                </Tabs>
              </Box>

              {/* Tab Content Panel */}
              <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto', maxHeight: '550px' }}>
                {/* TAB 0: Profile & Security */}
                <TabPanel value={manageUserTab} index={0}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontFamily: 'Outfit, sans-serif' }}>User Profile Overview</Typography>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Username</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedUserForManage.username}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Assigned System Role</Typography>
                      <Chip
                        size="small"
                        label={selectedUserForManage.role}
                        color={selectedUserForManage.role === 'admin' ? 'secondary' : 'primary'}
                        sx={{ fontWeight: 'bold', textTransform: 'uppercase', mt: 0.5 }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Account Created</Typography>
                      <Typography variant="body2">{selectedUserForManage.created_at ? new Date(selectedUserForManage.created_at).toLocaleString() : 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Last Activity / Sign In</Typography>
                      <Typography variant="body2">{selectedUserForManage.last_login_at ? new Date(selectedUserForManage.last_login_at).toLocaleString() : 'Never'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Daily Rip Quota Usage</Typography>
                      {(() => {
                        const quota = selectedUserForManage.permissions?.quotas?.dailyRips || 0;
                        const usage = selectedUserForManage.daily_rip_usage || 0;
                        const percent = quota > 0 ? Math.min((usage / quota) * 100, 100) : 0;
                        const isUnlimited = quota === 0;
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ flexGrow: 1 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={isUnlimited ? 100 : percent} 
                                color={isUnlimited ? "primary" : percent >= 90 ? "error" : percent >= 75 ? "warning" : "primary"}
                                sx={{ height: 6, borderRadius: 3, ...(isUnlimited && { opacity: 0.3 }) }}
                              />
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: '500', minWidth: 80, textAlign: 'right' }}>
                              {isUnlimited ? `${usage} / ∞` : `${usage} / ${quota}`}
                            </Typography>
                          </Box>
                        );
                      })()}
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 2.5, borderColor: 'rgba(255,255,255,0.08)' }} />

                  {/* Password Reset Actions */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Account Password Status</Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1.5 }}>
                      Manage user authentication status. Admins can directly set or override a user's password string.
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      startIcon={<VpnKeyIcon />} 
                      onClick={() => setAdminResetPasswordOpen(true)}
                    >
                      Reset Password String
                    </Button>
                  </Box>

                  <Divider sx={{ my: 2.5, borderColor: 'rgba(255,255,255,0.08)' }} />

                  {/* WebAuthn Passkeys Section */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Enrolled WebAuthn Passkeys ({selectedUserForManage.passkeys?.length || 0})</Typography>
                      {selectedUserForManage.passkeys?.length > 0 && (
                        <Button 
                          variant="text" 
                          color="error" 
                          size="small" 
                          onClick={handleAdminResetMfa}
                          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                        >
                          Revoke All MFA Keys
                        </Button>
                      )}
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                      Enrolled biometric devices, passkeys, and security hardware keys.
                    </Typography>
                    
                    {selectedUserForManage.passkeys?.length === 0 ? (
                      <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover' }}>
                        <Typography variant="body2" color="textSecondary">No biometric passkeys enrolled for this account.</Typography>
                      </Paper>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {selectedUserForManage.passkeys.map(pk => (
                          <Paper elevation={1}
                            key={pk.id} 
                            sx={{ 
                              p: 1.5, 
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <FingerprintIcon sx={{ color: '#33aa33' }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{pk.name || 'Unnamed Key'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                                  {pk.browser || 'Browser'} on {pk.os_name || 'OS'} • {pk.location || 'Location unknown'} ({pk.ip_address || 'No IP'})
                                </Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                                  Last used: {pk.last_used_at ? new Date(pk.last_used_at).toLocaleString() : 'Never'}
                                </Typography>
                              </Box>
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                    )}
                  </Box>

                  <Divider sx={{ my: 2.5, borderColor: 'rgba(255,255,255,0.08)' }} />

                  {/* SSO Connected Links Section */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Connected SSO Links ({selectedUserForManage.sso_links?.length || 0})</Typography>
                      {selectedUserForManage.sso_links?.length > 0 && (
                        <Button 
                          variant="text" 
                          color="error" 
                          size="small" 
                          onClick={handleAdminResetSso}
                          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                        >
                          Disconnect All SSO
                        </Button>
                      )}
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                      Linked OAuth 2.0 social identity provider links (Google, GitHub, Discord).
                    </Typography>

                    {selectedUserForManage.sso_links?.length === 0 ? (
                      <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover' }}>
                        <Typography variant="body2" color="textSecondary">No third-party SSO accounts connected.</Typography>
                      </Paper>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                        {selectedUserForManage.sso_links.map(sso => (
                          <Paper elevation={1}
                            key={sso.id} 
                            sx={{ 
                              p: 1.5, 
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <LinkIcon sx={{ color: 'primary.main' }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                  {sso.provider} Identity Link
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  Linked Email: {sso.email} • Linked on {new Date(sso.linked_at).toLocaleDateString()}
                                </Typography>
                              </Box>
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                    )}
                  </Box>
                </TabPanel>

                {/* TAB 1: Permissions & Roles */}
                <TabPanel value={manageUserTab} index={1}>
                  <PermissionsManager
                    user={selectedUserForManage}
                    onSave={(payload) => {
                      const assignedRole = payload.targetType.startsWith('role_') ? payload.targetType.replace('role_', '') : editRole;
                      const combinedPermissions = {
                        ...payload.permissions,
                        quotas: payload.quotas,
                        restrictions: payload.restrictions
                      };
                      handleAdminSavePermissions(editUsername, assignedRole, editIsActive, combinedPermissions);
                    }}
                  />
                </TabPanel>

                {/* TAB 2: Activity Logs */}
                <TabPanel value={manageUserTab} index={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>User Security Log Audit</Typography>
                    <FormControl size="small" sx={{ width: '150px' }}>
                      <InputLabel>Action Filter</InputLabel>
                      <Select 
                        value={userActivityActionFilter} 
                        label="Action Filter" 
                        onChange={e => setUserActivityActionFilter(e.target.value)}
                        sx={{ borderRadius: '8px' }}
                      >
                        <MenuItem value="all">All Actions</MenuItem>
                        <MenuItem value="change_password">Password Reset</MenuItem>
                        <MenuItem value="admin_update_user">Updated Profile</MenuItem>
                        <MenuItem value="admin_reset_mfa">MFA Reset</MenuItem>
                        <MenuItem value="admin_reset_sso">SSO Disconnect</MenuItem>
                        <MenuItem value="user_merged">Account Merge</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search logs by keyword..."
                    value={userActivitySearch}
                    onChange={e => setUserActivitySearch(e.target.value)}
                    sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                  />

                  {(() => {
                    const filteredUserLogs = (selectedUserForManage.activity_logs || []).filter(log => {
                      const matchSearch = userActivitySearch.trim() === '' || 
                        log.action.toLowerCase().includes(userActivitySearch.toLowerCase()) ||
                        JSON.stringify(log.details).toLowerCase().includes(userActivitySearch.toLowerCase());
                      const matchAction = userActivityActionFilter === 'all' || log.action === userActivityActionFilter;
                      return matchSearch && matchAction;
                    });

                    if (filteredUserLogs.length === 0) {
                      return (
                        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover' }}>
                          <Typography variant="body2" color="textSecondary">No matching activity logs found.</Typography>
                        </Paper>
                      );
                    }

                    return (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: '350px', overflowY: 'auto', pr: 0.5 }}>
                        {filteredUserLogs.map(log => (
                          <Paper elevation={1}
                            key={log.id} 
                            sx={{ 
                              p: 1.5
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                              <Chip 
                                size="small" 
                                label={log.action} 
                                color="info" 
                                sx={{ fontWeight: 'bold', fontSize: '0.65rem', textTransform: 'uppercase' }} 
                              />
                              <Typography variant="caption" color="textSecondary">
                                {new Date(log.timestamp).toLocaleString()}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ opacity: 0.95, wordBreak: 'break-word', mb: 0.5 }}>
                              Action performed by: <strong>{log.admin_username || 'System'}</strong>
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ fontFamily: 'monospace', display: 'block', wordBreak: 'break-all', backgroundColor: 'rgba(0,0,0,0.2)', p: 1, borderRadius: '4px' }}>
                              {typeof log.details === 'object' && log.details !== null
                                ? Object.entries(log.details).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' • ')
                                : String(log.details || '')}
                            </Typography>
                          </Paper>
                        ))}
                      </Box>
                    );
                  })()}
                </TabPanel>

                {/* TAB 3: Admin Actions */}
                <TabPanel value={manageUserTab} index={3}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, fontFamily: 'Outfit, sans-serif' }}>Administrative Override Actions</Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                    Execute permanent database alterations, suspension holds, and history consolidations.
                  </Typography>

                  {/* Suspension toggle */}
                  <Paper elevation={1}
                    sx={{ 
                      p: 2, 
                      mb: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box sx={{ pr: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Temporarily Deactivate / Suspend Account</Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                        Suspended accounts are locked out instantly. Session JWTs are rejected immediately.
                      </Typography>
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch 
                          checked={editIsActive} 
                          disabled={selectedUserForManage.role === 'admin'}
                          onChange={e => {
                            setEditIsActive(e.target.checked)
                            handleAdminSavePermissions(editUsername, editRole, e.target.checked, editPermissions)
                          }} 
                          color="secondary"
                        />
                      }
                      label={editIsActive ? "Active" : "Suspended"}
                    />
                  </Paper>

                  {/* Account Merge Portal */}
                  <Paper elevation={1}
                    sx={{ 
                      p: 2.5, 
                      mb: 3
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Account History Merge Portal</Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontSize: '0.85rem' }}>
                      Consolidate viewing history, favorites, video stats, WebAuthn passkeys, and linked social SSO accounts from <strong>{selectedUserForManage.username}</strong> into a target user account. The source account will be safely deleted after the migration completes.
                    </Typography>

                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={8}>
                        <FormControl fullWidth size="small" sx={{ minWidth: 200 }}>
                          <InputLabel>Select Target Account</InputLabel>
                          <Select 
                            value={mergeTargetUserId} 
                            label="Select Target Account" 
                            onChange={e => setMergeTargetUserId(e.target.value)}
                          >
                            <MenuItem value=""><em>None selected</em></MenuItem>
                            {usersList
                              .filter(u => u.id !== selectedUserForManage.id)
                              .map(u => (
                                <MenuItem key={u.id} value={u.id}>{u.username} ({u.role})</MenuItem>
                              ))
                            }
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Button 
                          fullWidth 
                          variant="contained" 
                          color="warning" 
                          size="small" 
                          startIcon={<SyncIcon />}
                          disabled={!mergeTargetUserId}
                          onClick={() => {
                            if (window.confirm(`Are you absolutely sure you want to merge all data from ${selectedUserForManage.username} into the selected target account? This will delete ${selectedUserForManage.username} forever and is irreversible.`)) {
                              handleAdminMergeUsers(mergeTargetUserId);
                            }
                          }}
                          sx={{ borderRadius: '8px', py: 1 }}
                        >
                          Consolidate History
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Danger Zone: Delete Account */}
                  <Paper elevation={1}
                    sx={{ 
                      p: 2.5, 
                      border: '1px solid',
                      borderColor: 'error.main',
                      backgroundColor: 'rgba(211, 47, 47, 0.02)'
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ color: 'error.main', fontWeight: 600, mb: 1 }}>Danger Zone: Permanent Deletion</Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontSize: '0.85rem' }}>
                      Completely remove this user account and all of its associated records from the system. This cannot be undone. Lockout protection guarantees you cannot delete the sole remaining administrator account.
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Button 
                        variant="contained" 
                        color="error" 
                        startIcon={<DeleteIcon />}
                        disabled={selectedUserForManage.role === 'admin' && usersList.filter(u => u.role === 'admin').length <= 1}
                        onClick={() => {
                          if (window.confirm(`Type 'DELETE' to confirm you want to permanently delete the user account for ${selectedUserForManage.username}. This will purge all associated settings, credentials, and playback data immediately.`)) {
                            handleAdminDeleteUser();
                          }
                        }}
                        sx={{ borderRadius: '8px' }}
                      >
                        Delete Account Forever
                      </Button>
                    </Box>
                  </Paper>
                </TabPanel>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 2 }}>
          <Button onClick={() => setManageUserOpen(false)} sx={{ textTransform: 'none' }}>
            Close Settings Panel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Sub-Dialog */}
      <Dialog 
        open={adminResetPasswordOpen} 
        onClose={() => setAdminResetPasswordOpen(false)}
        PaperProps={{
          elevation: 6,
          sx: {
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>Reset User Password</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: '0.9rem', opacity: 0.8 }}>
            Set a new temporary or custom password for user <strong>{selectedUserForManage?.username}</strong>. The user will be required to input this password to authenticate next time.
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="New Password string"
            value={adminResetPasswordNew}
            onChange={e => setAdminResetPasswordNew(e.target.value)}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
          <PasswordChecklist password={adminResetPasswordNew} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setAdminResetPasswordOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button 
            variant="contained" 
            color="secondary" 
            onClick={() => handleAdminResetPassword(adminResetPasswordNew)} 
            disabled={adminResetPasswordNew.length < 8}
            sx={{ borderRadius: '8px', textTransform: 'none', px: 3 }}
          >
            Reset password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}