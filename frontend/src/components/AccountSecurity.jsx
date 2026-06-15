import React, { useState, useEffect } from 'react'
import { 
  Box, Typography, TextField, Button, Paper, Grid, Divider, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, 
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem,
  FormControl, InputLabel, Avatar, Chip
} from '@mui/material'
import { Trash2, Link, Link2Off, Fingerprint, KeyRound, Plus, ShieldCheck, User, Globe } from 'lucide-react'
import { apiFetch } from '../api'
import PasswordChecklist from './PasswordChecklist'
import InlineTextField from './InlineTextField'

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

  useEffect(() => {
    fetchProfile()
    fetchPasskeys()
    fetchSsoLinks()
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setProfileLoading(true)
    try {
      const res = await apiFetch('/auth/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify({
          display_name: displayName,
          email: email,
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

  const getClientInfo = () => {
    const ua = navigator.userAgent
    let browser = "Unknown Browser"
    let os_name = "Unknown OS"
    if (ua.includes("Firefox")) browser = "Firefox"
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
      const res = await apiFetch('/auth/passkeys/register/options', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to retrieve registration options')
      const options = await res.json()
      
      options.challenge = base64ToBuffer(options.challenge)
      options.user.id = new TextEncoder().encode(options.user.id)
      
      const credential = await navigator.credentials.create({ publicKey: options })
      if (!credential) throw new Error('Passkey creation cancelled or failed.')
      
      const clientInfo = getClientInfo()
      let publicKeyB64 = ''
      if (typeof credential.response.getPublicKey === 'function') {
        publicKeyB64 = bufferToBase64(credential.response.getPublicKey())
      }
      
      const verifyRes = await apiFetch('/auth/passkeys/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          credential_id: credential.id,
          public_key: publicKeyB64,
          client_data_json: bufferToBase64(credential.response.clientDataJSON),
          aaguid: null,
          browser: clientInfo.browser,
          os_name: clientInfo.os_name,
          backup_eligible: true,
          backup_state: true,
          name: newPasskeyName || 'My Passkey',
        })
      })
      if (verifyRes.ok) {
        setSnackbar({ open: true, message: 'Passkey registered successfully!', severity: 'success' })
        setNewPasskeyName('')
        fetchPasskeys()
      } else {
        const err = await verifyRes.json()
        throw new Error(err.detail)
      }
    } catch (err) {
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
    }
  }

  // SSO Operations
  const handleLinkSso = (provider) => {
    const token = localStorage.getItem('voyarr_jwt')
    const apiBase = import.meta.env.VITE_API_BASE || '/api'
    window.location.href = `${apiBase}/auth/oidc/login?provider=${provider}&token=${encodeURIComponent(token)}`
  }

  const handleUnlinkSso = async (provider) => {
    try {
      const res = await apiFetch(`/auth/sso/unlink/${provider}`, {
        method: 'POST'
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `Successfully unlinked ${provider} identity.`, severity: 'success' })
        fetchSsoLinks()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Overhauled User Profile & Regional Preferences Card */}
      <Paper sx={{ p: 4, border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, color: 'primary.main' }}>
          <User size={24} />
          <Typography variant="h6" fontWeight="bold" color="text.primary">Profile &amp; Display Preferences</Typography>
        </Box>
        <form onSubmit={handleUpdateProfile}>
          <Grid container spacing={4}>
            {/* Left side: Avatar & Info */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }} color="textSecondary">User Profile Info</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
                <Avatar 
                  src={avatarUrl} 
                  sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: '2rem' }}
                >
                  {displayName ? displayName.charAt(0).toUpperCase() : '?'}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Avatar Image URL"
                    value={avatarUrl}
                    onChange={e => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="caption" color="textSecondary">Provide a URL to your custom profile picture</Typography>
                </Box>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Display Name"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    label="Email Address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. john@example.com"
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Right side: Display & Regional settings */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }} color="textSecondary">Display &amp; Regional Preferences</Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
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

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
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

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
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

                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
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
              </Grid>
            </Grid>

            {/* Save Button */}
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button 
                type="submit" 
                variant="contained" 
                color="primary"
                disabled={profileLoading}
              >
                {profileLoading ? <CircularProgress size={24} /> : 'Save Profile & Preferences'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* Change Password Card */}
      <Paper sx={{ p: 3, border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: 'primary.main' }}>
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
            <Grid item xs={12} sx={{ mt: 1 }}>
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

      {/* Account Security Card */}
      <Paper sx={{ p: 3, border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: 'primary.main' }}>
          <ShieldCheck size={24} />
          <Typography variant="subtitle1" fontWeight="bold" color="text.primary">Passkeys & Passwordless</Typography>
        </Box>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Add secure, platform-based authenticators for quick logins without password entry.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
          <TextField 
            size="small" 
            placeholder="Passkey Name (e.g. YubiKey)" 
            value={newPasskeyName} 
            onChange={e => setNewPasskeyName(e.target.value)} 
            disabled={passkeyLoading}
            sx={{ flex: 1 }}
          />
          <Button 
            variant="contained" 
            color="secondary"
            startIcon={<Plus size={20} />} 
            onClick={handleAddPasskey}
            disabled={passkeyLoading || !newPasskeyName.trim()}
          >
            {passkeyLoading ? 'Adding...' : 'Add'}
          </Button>
        </Box>

        {passkeys.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', opacity: 0.3, mb: 1 }}>
              <Fingerprint size={36} />
            </Box>
            <Typography variant="caption" display="block" color="textSecondary">No passkeys registered yet.</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Name</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Created</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Binding Target</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {passkeys.map(pk => (
                  <TableRow key={pk.id}>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <InlineTextField 
                        value={pk.name} 
                        onSave={(val) => handleRenamePasskey(pk.id, val)}
                        label="Rename Passkey"
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{new Date(pk.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      {pk.rp_id ? (
                        <Chip
                          label={pk.rp_id === 'localhost' ? 'Local Link (localhost / IP)' : `Domain (${pk.rp_id})`}
                          size="small"
                          color={pk.rp_id === 'localhost' ? 'default' : 'primary'}
                          variant="outlined"
                          sx={{ 
                            fontSize: '11px',
                            borderColor: pk.rp_id === 'localhost' ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.3)',
                            color: pk.rp_id === 'localhost' ? 'text.secondary' : 'primary.light'
                          }}
                        />
                      ) : (
                        <Chip
                          label="Legacy (Any Domain)"
                          size="small"
                          variant="outlined"
                          color="warning"
                          sx={{ fontSize: '11px', opacity: 0.7 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton color="error" size="small" onClick={() => handleDeletePasskey(pk.id)}>
                        <Trash2 size={18} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Linked Identities SSO */}
      <Paper sx={{ p: 3, border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: 'primary.main' }}>
          <Link size={24} />
          <Typography variant="subtitle1" fontWeight="bold" color="text.primary">Linked Accounts (SSO)</Typography>
        </Box>
        <Grid container spacing={2}>
          {['google', 'github', 'discord'].map(provider => {
            const link = ssoLinks.find(l => l.provider === provider)
            const isLinked = !!link
            return (
              <Grid item xs={12} sm={4} key={provider}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: '8px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
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
                  <Typography variant="body2" sx={{ fontWeight: 'bold', textTransform: 'capitalize', mb: 1 }}>{provider}</Typography>
                  {isLinked ? (
                    <Box>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1.5, wordBreak: 'break-all', height: 20 }}>
                        {link.email || 'Linked'}
                      </Typography>
                      <Button fullWidth variant="outlined" color="error" size="small" startIcon={<Link2Off size={18} />} onClick={() => handleUnlinkSso(provider)}>
                        Unlink
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      <Button fullWidth variant="outlined" color="primary" size="small" startIcon={<Link size={18} />} onClick={() => handleLinkSso(provider)}>
                        Link
                      </Button>
                    </Box>
                  )}
                </Paper>
              </Grid>
            )
          })}
        </Grid>
      </Paper>
    </Box>
  )
}
