import React, { useState, useEffect } from 'react'
import { 
  Box, Typography, TextField, Button, Paper, Grid, Divider, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, 
  Alert
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import KeyIcon from '@mui/icons-material/Key'
import AddIcon from '@mui/icons-material/Add'
import SecurityIcon from '@mui/icons-material/Security'
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

  useEffect(() => {
    fetchPasskeys()
    fetchSsoLinks()
  }, [])

  const fetchPasskeys = async () => {
    try {
      const res = await apiFetch('/auth/passkeys/')
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

  // Passkey operations
  const handleAddPasskey = async () => {
    setPasskeyLoading(true)
    try {
      const res = await apiFetch('/auth/passkeys/register/options', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to retrieve registration options')
      const options = await res.json()
      
      // Simulate passkey creation on the client (since browser webauthn relies on hardware context)
      const credential = {
        id: 'pk_' + Math.random().toString(36).substr(2, 9),
        rawId: 'pk_' + Math.random().toString(36).substr(2, 9),
        type: 'public-key'
      }
      
      const verifyRes = await apiFetch('/auth/passkeys/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          name: newPasskeyName || 'My Passkey',
          credential: credential
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
  const handleOpenMockSso = (provider) => {
    setMockSsoProvider(provider)
    setMockSsoEmail('')
    setMockSsoOpen(true)
  }

  const handleExecuteMockSso = async () => {
    try {
      const res = await apiFetch('/auth/sso/link', {
        method: 'POST',
        body: JSON.stringify({
          provider: mockSsoProvider,
          email: mockSsoEmail,
          token: "mock_sso_oauth_flow_token"
        })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `Successfully linked ${mockSsoProvider} identity!`, severity: 'success' })
        setMockSsoOpen(false)
        fetchSsoLinks()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'SSO linking failed.', severity: 'error' })
    }
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Change Password Card */}
      <Paper sx={{ p: 3, border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <KeyIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">Change Password</Typography>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <SecurityIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">Passkeys & Passwordless</Typography>
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
            startIcon={<AddIcon />} 
            onClick={handleAddPasskey}
            disabled={passkeyLoading || !newPasskeyName.trim()}
          >
            {passkeyLoading ? 'Adding...' : 'Add'}
          </Button>
        </Box>

        {passkeys.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
            <FingerprintIcon sx={{ fontSize: 36, opacity: 0.3, mb: 1 }} />
            <Typography variant="caption" display="block" color="textSecondary">No passkeys registered yet.</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {passkeys.map(pk => (
                  <TableRow key={pk.id}>
                    <TableCell>
                      <InlineTextField 
                        value={pk.name} 
                        onSave={(val) => handleRenamePasskey(pk.id, val)}
                        label="Rename Passkey"
                      />
                    </TableCell>
                    <TableCell>{new Date(pk.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <IconButton color="error" size="small" onClick={() => handleDeletePasskey(pk.id)}>
                        <DeleteIcon fontSize="small" />
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <LinkIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">Linked Accounts (SSO)</Typography>
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
                      <Button fullWidth variant="outlined" color="error" size="small" startIcon={<LinkOffIcon />} onClick={() => handleUnlinkSso(provider)}>
                        Unlink
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1.5, height: 20 }}>Not linked</Typography>
                      <Button fullWidth variant="outlined" color="primary" size="small" startIcon={<LinkIcon />} onClick={() => handleOpenMockSso(provider)}>
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

      {/* Mock SSO OAuth Flow Dialog */}
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
          <Typography variant="h6" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
            Simulate {mockSsoProvider} Link
          </Typography>
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
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setMockSsoOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleExecuteMockSso}
            variant="contained" 
            disabled={!mockSsoEmail.trim() || !mockSsoEmail.includes('@')}
          >
            Authorize Link
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
