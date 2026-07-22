import React, { useState, useEffect, useRef } from 'react'
import { 
  Box, Typography, TextField, Button, Paper, Grid, Divider, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, 
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem,
  FormControl, InputLabel, Avatar, Chip, Menu
} from '@mui/material'
import { Trash2, Link, Link2Off, Fingerprint, KeyRound, Plus, ShieldCheck, User, Globe } from 'lucide-react'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SecurityIcon from '@mui/icons-material/Security'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import { apiFetch, API_BASE } from '../api'
import PasswordChecklist from './PasswordChecklist'
import InlineTextField from './InlineTextField'
import { QRCodeSVG } from 'qrcode.react'

const AppleSvg = () => (
  <svg viewBox="0 0 170 170" width="20" height="20" style={{ fill: 'currentColor' }}>
    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.37.13-9.13-1.9-14.28-6.1-3.48-2.84-7.46-7.85-11.93-15.03-8.84-14.25-13.25-28.7-13.25-43.34 0-16.14 4.21-29.35 12.62-39.63 8.41-10.27 18.69-15.48 30.83-15.6 6.13 0 12.39 2.03 18.75 6.1 6.35 4.08 10.96 6.1 13.8 6.1 2.45 0 6.55-1.78 12.28-5.35 7.15-4.42 13.8-6.52 19.95-6.3 15.04.53 26.42 6.17 34.18 16.93-12.75 7.74-19.06 18.42-18.94 32.06.13 10.3 3.96 18.91 11.51 25.83 7.55 6.92 16.32 10.63 26.31 11.13-2.12 6.53-4.58 12.63-7.38 18.32zM120.3 33.16c0-8.13 2.87-15.44 8.62-21.93 5.75-6.5 12.87-10.23 21.36-11.23.12 8.62-2.73 16.13-8.55 22.51-5.83 6.38-13.1 9.94-21.43 10.65z"/>
  </svg>
)

const GoogleSvg = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" style={{ fill: 'currentColor' }}>
    <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.113-5.136 4.113-3.48 0-6.305-2.825-6.305-6.305s2.825-6.305 6.305-6.305c1.558 0 2.978.577 4.075 1.528l3.053-3.053C18.98 2.215 15.82 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.985 0-.746-.08-1.484-.224-2.21H12.24z"/>
  </svg>
)

const YubicoSvg = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" style={{ fill: '#8FB53E' }}>
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1.657 14.857h-3.314v-4.143L7.514 6.857h3.314l1.657 3.314 1.657-3.314h3.314l-2.829 5.857v4.143z"/>
  </svg>
)

const WindowsHelloSvg = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" style={{ fill: 'currentColor' }}>
    <path d="M0 0h24v24H0V0zm1.56 1.56v9.36h9.36V1.56H1.56zm11.52 0v9.36h9.36V1.56h-9.36zM1.56 13.08v9.36h9.36v-9.36H1.56zm11.52 0v9.36h9.36v-9.36h-9.36z"/>
  </svg>
)

export default function AccountSecurity({ setSnackbar }) {
  // Profile & Preferences State
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const uniformInputStyle = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      transition: 'border-color 0.2s, background-color 0.2s',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
      },
      '&.Mui-focused': {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
      }
    }
  }
  const [locale, setLocale] = useState('en')
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD')
  const [timeFormat, setTimeFormat] = useState('HH:mm:ss')
  const [timezone, setTimezone] = useState('UTC')
  const [profileLoading, setProfileLoading] = useState(false)

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Passkeys State
  const [passkeys, setPasskeys] = useState([])
  const [newPasskeyName, setNewPasskeyName] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState(false)

  // SSO Linking State
  const [ssoLinks, setSsoLinks] = useState([])
  const [mockSsoOpen, setMockSsoOpen] = useState(false)
  const [mockSsoProvider, setMockSsoProvider] = useState('')
  const [mockSsoEmail, setMockSsoEmail] = useState('')
  const [newlyAddedPasskeyId, setNewlyAddedPasskeyId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Voyarr Lens Pairing States
  const [pairingCode, setPairingCode] = useState('')
  const [expiresIn, setExpiresIn] = useState(300)
  const [pairings, setPairings] = useState([])
  const [pairingsLoading, setPairingsLoading] = useState(false)
  const [deleteConfirmPairingId, setDeleteConfirmPairingId] = useState(null)
  const [initialPairingIds, setInitialPairingIds] = useState([])

  // Avatar handling ref and state
  const fileInputRef = useRef(null)
  const [avatarAnchorEl, setAvatarAnchorEl] = useState(null)
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [tempUrl, setTempUrl] = useState('')

  const [vrApproveCode, setVrApproveCode] = useState('')
  const [vrApproveMsg, setVrApproveMsg] = useState('')
  const [vrApproveSeverity, setVrApproveSeverity] = useState('info')
  const [deovrCopied, setDeovrCopied] = useState(false)

  const handleApproveVrDevice = async () => {
    if (!vrApproveCode.trim()) return
    setVrApproveMsg('')
    try {
      const res = await apiFetch('/auth/pair/device/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: vrApproveCode.trim(), device_name: 'VR Headset' })
      })
      if (res.ok) {
        setVrApproveSeverity('success')
        setVrApproveMsg('✅ VR Headset paired successfully! Your headset is now signed in.')
        setVrApproveCode('')
        fetchPairings()
      } else {
        const data = await res.json().catch(() => ({}))
        setVrApproveSeverity('error')
        setVrApproveMsg(data.detail || 'Failed to pair device. Please check the 6-digit code.')
      }
    } catch (err) {
      setVrApproveSeverity('error')
      setVrApproveMsg(err.message || 'Error connecting to pairing server.')
    }
  }

  useEffect(() => {
    let timer
    let pollTimer
    if (pairingCode && expiresIn > 0) {
      timer = setInterval(() => {
        setExpiresIn(prev => {
          if (prev <= 1) {
            setPairingCode('')
            return 300
          }
          return prev - 1
        })
      }, 1000)

      pollTimer = setInterval(() => {
        fetchPairings()
      }, 3000)
    }
    return () => {
      clearInterval(timer)
      clearInterval(pollTimer)
    }
  }, [pairingCode, expiresIn])

  useEffect(() => {
    if (pairingCode && pairings.length > 0) {
      const hasNewPairing = pairings.some(p => !initialPairingIds.includes(p.id))
      if (hasNewPairing) {
        setPairingCode('')
        setSnackbar({ open: true, message: 'Pairing successful! Device linked.', severity: 'success' })
      }
    }
  }, [pairings, pairingCode, initialPairingIds])

  useEffect(() => {
    fetchProfile()
    fetchPasskeys()
    fetchSsoLinks()
    fetchPairings()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/auth/me')
      if (res.ok) {
        const data = await res.json()
        setDisplayName(data.display_name || '')
        setEmail(data.email || '')
        setAvatarUrl(data.avatar_url || '')
        setLocale(data.locale || 'en')
        setDateFormat(data.date_format || 'YYYY-MM-DD')
        setTimeFormat(data.time_format || 'HH:mm:ss')
        setTimezone(data.timezone || 'UTC')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleAvatarClick = (event) => {
    setAvatarAnchorEl(event.currentTarget)
  }

  const handleAvatarClose = () => {
    setAvatarAnchorEl(null)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setAvatarUrl(event.target.result)
        setSnackbar({ open: true, message: 'Avatar updated! Click Save Profile & Preferences to apply.', severity: 'info' })
      }
      reader.readAsDataURL(file)
    }
    handleAvatarClose()
  }

  const handleUrlSubmit = (e) => {
    e.preventDefault()
    if (tempUrl.trim()) {
      setAvatarUrl(tempUrl.trim())
      setTempUrl('')
      setUrlDialogOpen(false)
      setSnackbar({ open: true, message: 'Avatar URL updated! Click Save Profile & Preferences to apply.', severity: 'info' })
    }
  }

  const handleLinkSso = (provider) => {
    const token = localStorage.getItem('voyarr_jwt')
    window.location.href = `${API_BASE}/auth/oidc/login?provider=${provider}&token=${token || ''}`
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setProfileLoading(true)
    try {
      const res = await apiFetch('/auth/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify({
          display_name: displayName,
          avatar_url: avatarUrl,
          locale: locale,
          date_format: dateFormat,
          time_format: timeFormat,
          timezone: timezone
        })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Profile and regional preferences saved successfully!', severity: 'success' })
        fetchProfile()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Network error updating profile.', severity: 'error' })
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchPasskeys = async () => {
    try {
      const res = await apiFetch('/auth/passkeys')
      if (res.ok) {
        setPasskeys(await res.json())
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchSsoLinks = async () => {
    try {
      const res = await apiFetch('/auth/sso/links')
      if (res.ok) {
        setSsoLinks(await res.json())
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleInitiatePairing = async () => {
    try {
      const res = await apiFetch('/auth/pair/initiate', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setPairingCode(data.pairing_code)
        setExpiresIn(data.expires_in || 300)
        setInitialPairingIds(pairings.map(p => p.id))
        
        // Dispatch custom event to notify Lens extension loaded on the tab
        window.dispatchEvent(new CustomEvent('VOYARR_INITIATE_PAIRING', {
          detail: {
            url: window.location.origin,
            pairingCode: data.pairing_code
          }
        }))

        // Save to sessionStorage for dynamic fallback retrieval by the extension popup
        sessionStorage.setItem('voyarr_pending_pairing', JSON.stringify({
          url: window.location.origin,
          pairingCode: data.pairing_code,
          timestamp: Date.now()
        }))
        
        setSnackbar({ open: true, message: 'Pairing code generated! Opening the Voyarr Lens extension will now auto-detect and pair.', severity: 'info' })
      } else {
        setSnackbar({ open: true, message: 'Failed to initiate pairing.', severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Error initiating pairing.', severity: 'error' })
    }
  }

  const fetchPairings = async () => {
    setPairingsLoading(true)
    try {
      const res = await apiFetch('/auth/pairings')
      if (res.ok) {
        setPairings(await res.json())
      }
    } catch (err) {
      console.error('Error fetching pairings:', err)
    } finally {
      setPairingsLoading(false)
    }
  }

  const handleRenamePairing = async (id, newName) => {
    try {
      const res = await apiFetch(`/auth/pairings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Pairing renamed successfully!', severity: 'success' })
        fetchPairings()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed to rename: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error('Error renaming pairing:', err)
      setSnackbar({ open: true, message: 'Network error renaming pairing.', severity: 'error' })
    }
  }

  const handleRevokePairing = async (id) => {
    try {
      const res = await apiFetch(`/auth/pairings/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Pairing revoked successfully!', severity: 'success' })
        fetchPairings()
      } else {
        setSnackbar({ open: true, message: 'Failed to revoke pairing.', severity: 'error' })
      }
    } catch (err) {
      console.error('Error revoking pairing:', err)
      setSnackbar({ open: true, message: 'Network error revoking pairing.', severity: 'error' })
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!currentPassword) {
      setSnackbar({ open: true, message: 'Please enter your current password.', severity: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setSnackbar({ open: true, message: 'New passwords do not match.', severity: 'error' })
      return
    }
    // Perform checklist criteria evaluation
    const hasLength = newPassword.length >= 8
    const hasUpper = /[A-Z]/.test(newPassword)
    const hasLower = /[a-z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword)
    if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setSnackbar({ open: true, message: 'Password does not meet all security requirements.', severity: 'error' })
      return
    }

    setPasswordLoading(true)
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Password updated successfully!', severity: 'success' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Network error changing password.', severity: 'error' })
    } finally {
      setPasswordLoading(false)
    }
  }

  const base64ToBuffer = (b64) => {
    let base64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) { base64 += new Array(5 - pad).join('='); }
    const bin = window.atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i) }
    return bytes.buffer
  }

  const bufferToBase64 = (buf) => {
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]) }
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
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

  // Passkey operations
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

  const handleRenamePasskey = async (id, newName) => {
    try {
      const res = await apiFetch(`/auth/passkeys/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Passkey renamed successfully!', severity: 'success' })
        fetchPasskeys()
      }
    } catch (err) {
      console.error(err)
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
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error deleting passkey.', severity: 'error' })
    }
  }

  // SSO Operations
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Overhauled User Profile & Regional Preferences Card */}
      <Paper sx={{ p: 4, border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 4, color: 'primary.main' }}>
          <User size={24} />
          <Typography variant="h6" fontWeight="bold" color="text.primary">Profile &amp; Display Preferences</Typography>
        </Box>
        <form onSubmit={handleUpdateProfile}>
          {/* Centered Avatar Placeholder */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, width: '100%' }}>
            <Avatar 
              src={avatarUrl} 
              onClick={handleAvatarClick}
              sx={{ 
                width: 100, 
                height: 100, 
                bgcolor: 'primary.main', 
                fontSize: '2.5rem',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
                }
              }}
            >
              {displayName ? displayName.charAt(0).toUpperCase() : '?'}
            </Avatar>
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1.5, cursor: 'pointer', opacity: 0.8, '&:hover': { opacity: 1 } }} onClick={handleAvatarClick}>
              Click avatar to change profile image
            </Typography>
            
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
            />
          </Box>

          <Menu
            anchorEl={avatarAnchorEl}
            open={Boolean(avatarAnchorEl)}
            onClose={handleAvatarClose}
            PaperProps={{
              elevation: 4,
              sx: {
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                minWidth: 200,
                mt: 1
              }
            }}
          >
            <MenuItem onClick={() => { fileInputRef.current.click(); handleAvatarClose(); }}>
              Upload from Device
            </MenuItem>
            <MenuItem onClick={() => { setUrlDialogOpen(true); handleAvatarClose(); }}>
              Use Image URL
            </MenuItem>
            
            {/* Linked SSO Services Avatars */}
            {ssoLinks.map(link => (
              <MenuItem 
                key={link.id} 
                onClick={() => { 
                  if (link.avatar_url) {
                    setAvatarUrl(link.avatar_url); 
                    setSnackbar({ open: true, message: `Using avatar from ${link.provider.charAt(0).toUpperCase() + link.provider.slice(1)}. Click Save Profile & Preferences to apply.`, severity: 'info' });
                  } else {
                    setSnackbar({ open: true, message: `No avatar was found on your linked ${link.provider.charAt(0).toUpperCase() + link.provider.slice(1)} profile.`, severity: 'warning' });
                  }
                  handleAvatarClose(); 
                }}
              >
                Use avatar from {link.provider.charAt(0).toUpperCase() + link.provider.slice(1)}
              </MenuItem>
            ))}
          </Menu>

          <Grid container spacing={3}>
            {/* Display Name */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Display Name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. John Doe"
                sx={uniformInputStyle}
              />
            </Grid>
            
            {/* Language / Locale */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={uniformInputStyle}>
                <InputLabel id="user-locale-label">Language / Locale</InputLabel>
                <Select
                  labelId="user-locale-label"
                  value={locale}
                  label="Language / Locale"
                  onChange={e => setLocale(e.target.value)}
                >
                  <MenuItem value="en">English (en)</MenuItem>
                  <MenuItem value="es">Español (es)</MenuItem>
                  <MenuItem value="fr">Français (fr)</MenuItem>
                  <MenuItem value="de">Deutsch (de)</MenuItem>
                  <MenuItem value="it">Italiano (it)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Date Format */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={uniformInputStyle}>
                <InputLabel id="user-date-label">Date Format</InputLabel>
                <Select
                  labelId="user-date-label"
                  value={dateFormat}
                  label="Date Format"
                  onChange={e => setDateFormat(e.target.value)}
                >
                  <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-06-14)</MenuItem>
                  <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (e.g. 06/14/2026)</MenuItem>
                  <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (e.g. 14/06/2026)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Time Format */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={uniformInputStyle}>
                <InputLabel id="user-time-label">Time Format</InputLabel>
                <Select
                  labelId="user-time-label"
                  value={timeFormat}
                  label="Time Format"
                  onChange={e => setTimeFormat(e.target.value)}
                >
                  <MenuItem value="HH:mm:ss">24-hour (HH:mm:ss)</MenuItem>
                  <MenuItem value="hh:mm:ss A">12-hour (hh:mm:ss AM/PM)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Timezone */}
            <Grid item xs={12}>
              <FormControl fullWidth size="small" sx={uniformInputStyle}>
                <InputLabel id="user-timezone-label">Timezone</InputLabel>
                <Select
                  labelId="user-timezone-label"
                  value={timezone}
                  label="Timezone"
                  onChange={e => setTimezone(e.target.value)}
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

            {/* Save Button */}
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button 
                type="submit" 
                variant="contained" 
                color="primary"
                disabled={profileLoading}
                sx={{ borderRadius: '10px', px: 4, py: 1, textTransform: 'none' }}
              >
                {profileLoading ? <CircularProgress size={24} /> : 'Save Profile & Preferences'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* Change Password Card */}
      <Paper sx={{ p: 3, border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2, color: 'primary.main' }}>
          <KeyRound size={24} />
          <Typography variant="subtitle1" fontWeight="bold" color="text.primary">Change Password</Typography>
        </Box>
        <form onSubmit={handleChangePassword}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                type="password"
                label="Current Password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="password"
                label="New Password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </Grid>
            {newPassword && (
              <Grid item xs={12}>
                <PasswordChecklist password={newPassword} />
              </Grid>
            )}
            <Grid item xs={12} sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
              <Button 
                type="submit" 
                variant="contained" 
                color="primary"
                disabled={passwordLoading || !newPassword || newPassword !== confirmPassword}
              >
                {passwordLoading ? <CircularProgress size={24} /> : 'Update Password'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* Account Security & Passkeys Panel */}
      <Paper sx={{ p: 3, border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1 }}>
          <SecurityIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h6" sx={{ fontWeight: '700', letterSpacing: '0.5px' }}>Account Security & Authentication</Typography>
        </Box>
        <Typography variant="body2" sx={{ mb: 3, opacity: 0.8, textAlign: 'center' }} color="textSecondary">
          Secure your account using enterprise-grade passwordless passkeys (WebAuthn) or link external identity providers for one-click single sign-on access.
        </Typography>
        
        <Divider sx={{ mb: 2, opacity: 0.2 }} />
        
        {/* Passkeys Panel */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
            <FingerprintIcon color="secondary" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Registered Passkeys</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 3, opacity: 0.8, textAlign: 'center' }} color="textSecondary">
            Manage your hardware security keys, biometrics, or device credentials.
          </Typography>

          {/* Shaded area to register a new passkey */}
          <Box sx={{ 
            p: 3, 
            mb: 4,
            width: '100%',
            textAlign: 'center', 
            borderRadius: '12px', 
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5
          }}>
            <FingerprintIcon sx={{ fontSize: 36, color: 'secondary.main', opacity: 0.8 }} />
            <Typography variant="body2" sx={{ opacity: 0.8 }} color="textSecondary">
              Register a new hardware key, fingerprint reader, or device passkey.
            </Typography>
            <Button 
              variant="contained" 
              color="secondary"
              startIcon={<AddIcon />} 
              onClick={handleAddPasskey}
              disabled={passkeyLoading}
              sx={{ borderRadius: '10px', textTransform: 'none' }}
            >
              {passkeyLoading ? 'Registering...' : 'Register Passkey'}
            </Button>
          </Box>

          <Box sx={{ width: '100%' }}>
            {passkeys.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="body2" sx={{ opacity: 0.5 }} color="textSecondary">
                  No passkeys registered yet.
                </Typography>
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
                        position: 'relative',
                        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                        }
                      }}>
                        {/* Center Card Confirmation Overlay (Toast-like Overlay) */}
                        {deleteConfirmId === pk.id && (
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            bgcolor: 'rgba(18, 18, 18, 0.95)',
                            borderRadius: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1.5,
                            zIndex: 10,
                            p: 2,
                            boxSizing: 'border-box',
                            backdropFilter: 'blur(4px)'
                          }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main', textAlign: 'center' }}>
                              Delete this passkey?
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button 
                                variant="contained" 
                                color="error" 
                                size="small" 
                                onClick={() => {
                                  handleDeletePasskey(pk.id)
                                  setDeleteConfirmId(null)
                                }}
                                sx={{ borderRadius: '6px', textTransform: 'none' }}
                              >
                                Confirm
                              </Button>
                              <Button 
                                variant="outlined" 
                                size="small" 
                                onClick={() => setDeleteConfirmId(null)}
                                sx={{ borderRadius: '6px', textTransform: 'none', color: 'text.secondary', borderColor: 'rgba(255,255,255,0.2)' }}
                              >
                                Cancel
                              </Button>
                            </Box>
                          </Box>
                        )}

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1, overflow: 'hidden' }}>
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
                            <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
                              <InlineTextField 
                                value={pk.name} 
                                onSave={(val) => {
                                  handleRenamePasskey(pk.id, val)
                                  setNewlyAddedPasskeyId(null)
                                }}
                                label="Rename Passkey"
                                autoEdit={newlyAddedPasskeyId === pk.id}
                                fullWidth
                              />
                            </Box>
                          </Box>
                          
                          <IconButton color="error" size="small" onClick={() => setDeleteConfirmId(pk.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        {/* Passkey Provider Profile Info */}
                        <Box sx={{
                          p: 1.5,
                          mb: 2,
                          borderRadius: '10px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.5
                        }}>
                          <Box sx={{ 
                            p: 1, 
                            borderRadius: '8px', 
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'primary.main',
                            mt: 0.5
                          }}>
                            {brand.icon === 'apple' && <AppleSvg />}
                            {brand.icon === 'google' && <GoogleSvg />}
                            {brand.icon === 'yubico' && <YubicoSvg />}
                            {brand.icon === 'windows' && <WindowsHelloSvg />}
                            {brand.icon !== 'apple' && brand.icon !== 'google' && brand.icon !== 'yubico' && brand.icon !== 'windows' && <FingerprintIcon />}
                          </Box>
                          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                              {brand.provider}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.8, fontWeight: '500', fontSize: '0.85rem' }} color="textSecondary">
                              {brand.name}
                            </Typography>
                            {brand.description && (
                              <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mt: 0.5, fontStyle: 'italic', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                {brand.description}
                              </Typography>
                            )}
                          </Box>
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
                            <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }} color="textSecondary">Relying Party / Domain</Typography>
                            <Typography variant="body2" sx={{ fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={pk.rp_id || 'voyarr.local'}>
                              {pk.rp_id || 'voyarr.local'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }} color="textSecondary">Sign Count</Typography>
                            <Typography variant="body2" sx={{ fontWeight: '500' }}>
                              {pk.sign_count || 0}
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
        </Box>
        
        <Divider sx={{ my: 3, opacity: 0.2 }} />
        
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <LinkIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Linked Identities (SSO)</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', alignItems: 'stretch', width: '100%' }}>
            {['google', 'github', 'discord'].map(provider => {
              const link = ssoLinks.find(l => l.provider === provider)
              const isLinked = !!link
              
              return (
                <Box key={provider} sx={{ flex: 1, maxWidth: 350, minWidth: 250 }}>
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
                          {provider}
                        </Typography>
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
                        onClick={() => handleLinkSso(provider)}
                        sx={{ borderRadius: '8px', textTransform: 'none' }}
                      >
                        Link Provider
                      </Button>
                    )}
                  </Paper>
                </Box>
              )
            })}
          </Box>
        </Box>
      </Paper>

      {/* Voyarr Lens Companion Pairing Card */}
      <Paper sx={{ p: 3, border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2, color: 'primary.main' }}>
          <LinkIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="bold" color="text.primary">Voyarr Lens Companion Pairing</Typography>
        </Box>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2, textAlign: 'center' }}>
          Instantly pair the <strong>Voyarr Lens</strong> companion browser extension. Click below to generate a temporary pairing code.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Typography variant="caption" color="textSecondary" sx={{ mb: 1 }}>
            Don't have the extension installed yet?
          </Typography>
          <a 
            href="https://chromewebstore.google.com/detail/onhleknmoagbflmddadhkkkclodpppgn?utm_source=item-share-cb" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ display: 'inline-block', transition: 'transform 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Box 
              component="img"
              src="https://developer.chrome.com/static/docs/webstore/branding/image/iNEddTyWiMfLSwFD6qGq.png" 
              alt="Available in the Chrome Web Store" 
              sx={{ height: 44, display: 'block' }}
            />
          </a>
        </Box>

        {pairingCode ? (
          <Box sx={{ 
            textAlign: 'center', 
            p: 3, 
            mb: 3,
            border: '1px dashed #6366f1', 
            borderRadius: 2, 
            backgroundColor: 'rgba(99, 102, 241, 0.04)',
            maxWidth: 400,
            mx: 'auto'
          }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              Active Pairing Code (expires in {expiresIn}s):
            </Typography>
            <Typography variant="h3" sx={{ letterSpacing: 6, fontWeight: 'bold', mb: 2, color: '#6366f1', fontFamily: 'monospace' }}>
              {pairingCode}
            </Typography>
            <Button size="small" variant="outlined" color="inherit" onClick={() => setPairingCode('')}>Cancel</Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Button variant="contained" color="secondary" onClick={handleInitiatePairing}>
              Initiate Pairing
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 3, opacity: 0.15 }} />

        <Box sx={{ width: '100%' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: '600', mb: 2, textAlign: 'center', color: 'text.secondary' }}>
            Active Companion Pairings
          </Typography>
          {pairingsLoading && pairings.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : pairings.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2, opacity: 0.5 }}>
              No active browser extension pairings registered.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {pairings.map(pairing => (
                <Grid item xs={12} md={6} key={pairing.id}>
                  <Paper elevation={1} sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    position: 'relative',
                    transition: 'transform 0.2s, border-color 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: 'rgba(255, 255, 255, 0.12)'
                    }
                  }}>
                    {deleteConfirmPairingId === pairing.id && (
                      <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        bgcolor: 'rgba(18, 18, 18, 0.95)',
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1.5,
                        zIndex: 10,
                        p: 2,
                        boxSizing: 'border-box',
                        backdropFilter: 'blur(4px)'
                      }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main', textAlign: 'center' }}>
                          Revoke this pairing?
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button 
                            variant="contained" 
                            color="error" 
                            size="small" 
                            onClick={() => {
                              handleRevokePairing(pairing.id)
                              setDeleteConfirmPairingId(null)
                            }}
                            sx={{ borderRadius: '6px', textTransform: 'none' }}
                          >
                            Revoke
                          </Button>
                          <Button 
                            variant="outlined" 
                            size="small" 
                            onClick={() => setDeleteConfirmPairingId(null)}
                            sx={{ borderRadius: '6px', textTransform: 'none', color: 'text.secondary', borderColor: 'rgba(255,255,255,0.2)' }}
                          >
                            Cancel
                          </Button>
                        </Box>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1, overflow: 'hidden' }}>
                        <Box sx={{
                          p: 1,
                          borderRadius: '8px',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          color: '#6366f1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <LinkIcon size={18} />
                        </Box>
                        <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
                          <InlineTextField
                            value={pairing.name}
                            onSave={(val) => handleRenamePairing(pairing.id, val)}
                            label="Rename Pairing"
                            fullWidth
                          />
                        </Box>
                      </Box>
                      <IconButton color="error" size="small" onClick={() => setDeleteConfirmPairingId(pairing.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <Grid container spacing={1.5}>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }} color="textSecondary">Created</Typography>
                        <Typography variant="body2" sx={{ fontWeight: '500' }}>
                          {new Date(pairing.created_at).toLocaleDateString()}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }} color="textSecondary">Last Active</Typography>
                        <Typography variant="body2" sx={{ fontWeight: '500' }}>
                          {pairing.last_used ? new Date(pairing.last_used).toLocaleDateString() : 'Never'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Paper>

      {/* VR Headset 6-Digit Device Pairing & DeoVR Player Quick Feed */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex' }}>
            <KeyRound size={20} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>VR Headset & DeoVR Easy Sign-In</Typography>
            <Typography variant="body2" color="text.secondary">
              Pair VR headsets effortlessly without typing passwords, or scan the QR code to load your DeoVR feed.
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Card 1: 6-Digit VR Device Pairing Approval */}
          <Grid item xs={12} md={6}>
            <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'action.hover', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  🔢 Pair New VR Headset (6-Digit Code)
                </Typography>
                <Typography variant="caption" color="text.secondary" paragraph>
                  Opened Voyarr on your Meta Quest or Vision Pro headset? Enter the 6-digit PIN displayed on your headset screen below:
                </Typography>

                {vrApproveMsg && (
                  <Alert severity={vrApproveSeverity} sx={{ mb: 2 }} onClose={() => setVrApproveMsg('')}>
                    {vrApproveMsg}
                  </Alert>
                )}

                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 1 }}>
                  <TextField
                    size="small"
                    placeholder="e.g. 839201"
                    value={vrApproveCode}
                    onChange={(e) => setVrApproveCode(e.target.value)}
                    inputProps={{ maxLength: 6, style: { letterSpacing: '3px', fontWeight: 'bold', textAlign: 'center', fontSize: '1.1rem' } }}
                    sx={{ maxWidth: 160 }}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={!vrApproveCode || vrApproveCode.trim().length !== 6}
                    onClick={handleApproveVrDevice}
                  >
                    Approve VR Device
                  </Button>
                </Box>
              </Box>
            </Box>
          </Grid>

          {/* Card 2: DeoVR QR Code Feed Link */}
          <Grid item xs={12} md={6}>
            <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 2.5, height: '100%' }}>
              <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QRCodeSVG
                  value={`${window.location.origin}?token=${localStorage.getItem('voyarr_token') || ''}`}
                  size={110}
                  level="M"
                />
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  📷 DeoVR QR Code Quick Scan
                </Typography>
                <Typography variant="caption" color="text.secondary" paragraph>
                  Scan this QR code with your headset camera or DeoVR app to load your library feed instantly.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkIcon fontSize="small" />}
                  onClick={() => {
                    const url = `${window.location.origin}?token=${localStorage.getItem('voyarr_token') || ''}`
                    navigator.clipboard.writeText(url)
                    setDeovrCopied(true)
                    setTimeout(() => setDeovrCopied(false), 3000)
                  }}
                  sx={{ textTransform: 'none', borderRadius: '6px' }}
                >
                  {deovrCopied ? 'Copied DeoVR URL!' : 'Copy DeoVR Feed Link'}
                </Button>
              </Box>
            </Box>
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

      {/* Dialog to input image URL */}
      <Dialog 
        open={urlDialogOpen} 
        onClose={() => setUrlDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }
        }}
      >
        <DialogTitle>Use Image URL</DialogTitle>
        <form onSubmit={handleUrlSubmit}>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Avatar Image URL"
              value={tempUrl}
              onChange={e => setTempUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              sx={{ minWidth: 300, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setUrlDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" sx={{ textTransform: 'none', borderRadius: '8px' }}>Apply</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}
