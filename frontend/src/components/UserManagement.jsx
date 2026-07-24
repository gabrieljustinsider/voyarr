import React, { useState, useEffect, useMemo } from 'react'
import { 
  Box, Typography, TextField, Button, Paper, Grid, Snackbar, Alert, Divider, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, 
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, 
  InputLabel, Tabs, Tab, Switch, FormControlLabel, InputAdornment, Chip, LinearProgress, Stack, CircularProgress 
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import SyncIcon from '@mui/icons-material/Sync'
import CloseIcon from '@mui/icons-material/Close'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import SecurityIcon from '@mui/icons-material/Security'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TuneIcon from '@mui/icons-material/Tune'
import LanIcon from '@mui/icons-material/Lan'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import GlassCard from './common/GlassCard'
import { apiFetch } from '../api'
import PasswordChecklist from './PasswordChecklist'
import PermissionsManager from './PermissionsManager'

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
        <Box sx={{ p: 0 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function UserManagement() {
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })
  const [usersList, setUsersList] = useState([])
  const [adminLogs, setAdminLogs] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [creationSuccess, setCreationSuccess] = useState(false)
  
  // Dialog & Notification States
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

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

  const isUsernameTaken = useMemo(() => {
    if (!newUser.username) return false;
    return usersList.some(u => u.username.toLowerCase() === newUser.username.toLowerCase());
  }, [newUser.username, usersList]);

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
  
  useEffect(() => {
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
    
    setIsCreating(true)
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser)
      })
      if (res.ok) {
        setCreationSuccess(true)
        setSnackbar({ open: true, message: `User ${newUser.username} created successfully!`, severity: 'success' })
        fetchUsersList()
        fetchAdminLogs()
        setTimeout(() => {
          setCreationSuccess(false)
          setNewUser({ username: '', password: '', role: 'user' })
        }, 2000)
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error creating user.', severity: 'error' })
    } finally {
      setIsCreating(false)
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
    const confirmed = await window.appConfirm("Are you sure you want to revoke all WebAuthn passkeys for this user? They will be forced to log in using their password next time.")
    if (!confirmed) return
    try {
      const res = await apiFetch(`/auth/users/${selectedUserForManage.id}/reset-mfa`, { method: 'POST' })
      if (res.ok) {
        setSnackbar({ open: true, message: 'Successfully revoked all user passkeys.', severity: 'success' })
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
    const confirmed = await window.appConfirm("Are you sure you want to disconnect all social SSO links? Direct logins using linked profiles will be rejected.")
    if (!confirmed) return
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

  const handleAdminRevokeSessions = async () => {
    const confirmed = await window.appConfirm("Are you sure you want to force sign-out this user and revoke all paired devices & API keys?")
    if (!confirmed) return
    try {
      const res = await apiFetch(`/auth/users/${selectedUserForManage.id}/revoke-sessions`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setSnackbar({ open: true, message: data.message || 'Successfully revoked all active user sessions.', severity: 'success' })
        handleOpenManageUser(selectedUserForManage.id)
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Error revoking sessions.', severity: 'error' })
    }
  }

  const handleAdminSavePermissions = async (updatedUsername, updatedRole, updatedActive, updatedPermissions) => {
    try {
      const res = await apiFetch(`/auth/users/${selectedUserForManage ? selectedUserForManage.id : usersList.find(u => u.username === updatedUsername)?.id}`, {
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
        if (selectedUserForManage) {
          handleOpenManageUser(selectedUserForManage.id)
        }
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
          destination_user_id: parseInt(targetUserId, 10)
        })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: 'User history, keys, and credentials migrated successfully!', severity: 'success' })
        setManageUserOpen(false)
        setMergeTargetUserId('')
        fetchUsersList()
        fetchAdminLogs()
      } else {
        const err = await res.json()
        setSnackbar({ open: true, message: `Merge failed: ${err.detail}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error executing user merge.', severity: 'error' })
    }
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <GlassCard sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>User Management</Typography>
      <Alert severity="info" sx={{ mb: 3, borderRadius: '12px', bgcolor: 'rgba(99,102,241,0.08)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)', '& .MuiAlert-icon': { color: '#818cf8' } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>👥 User Management Console</Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          Create and manage user accounts, configure role-based permissions, manage WebAuthn passkeys and SSO identity links for all users.
        </Typography>
      </Alert>
        <Typography variant="body2" sx={{ mb: 2 }} color="textSecondary">
          Create user accounts to grant access to the UI.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <form onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }}>
          <Grid container spacing={3} sx={{ alignItems: 'stretch', width: '100%', m: 0 }}>
            <Grid xs={12} md={7} sx={{ pl: '0 !important', pt: '0 !important' }}>
              <Stack spacing={2.5} sx={{ width: '100%', boxSizing: 'border-box' }}>
                <TextField 
                  fullWidth 
                  label="Username" 
                  value={newUser.username} 
                  onChange={e => setNewUser({...newUser, username: e.target.value})} 
                  error={isUsernameTaken}
                  helperText={isUsernameTaken ? "Username already exists" : ""}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
                <TextField 
                  fullWidth 
                  type="password" 
                  autoComplete="new-password" 
                  label="Password" 
                  value={newUser.password} 
                  onChange={e => setNewUser({...newUser, password: e.target.value})} 
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select value={newUser.role} label="Role" onChange={e => setNewUser({...newUser, role: e.target.value})} sx={{ borderRadius: '10px' }}>
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="user">User</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Grid>
            <Grid xs={12} md={5} sx={{ pt: { xs: 2, md: '0 !important' }, pr: '0 !important' }}>
              <PasswordChecklist password={newUser.password} />
            </Grid>
          </Grid>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              type="submit"
              variant="contained" 
              color={creationSuccess ? "success" : "primary"}
              disabled={!newUser.username || !newUser.password || newUser.password.length < 8 || isUsernameTaken || isCreating} 
              sx={{ minWidth: 180, transition: 'all 0.3s ease' }}
            >
              {creationSuccess ? (
                <><CheckIcon sx={{ mr: 1 }} /> Success!</>
              ) : isCreating ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Create User'
              )}
            </Button>
          </Box>
        </form>
      </GlassCard>

      {/* Users List & Advanced Management Dashboard */}
      {usersList.length > 0 && (
        <GlassCard sx={{ p: 3, mb: 3 }}>
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
                    <TableRow key={u.id} hover sx={{ '&:hover': { bgcolor: 'rgba(99,102,241,0.06)' } }}>
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
        </GlassCard>
      )}

      {/* Admin Action Audit Logs */}
      {adminLogs.length > 0 && (
        <GlassCard sx={{ p: 3, mb: 3 }}>
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
                  <TableRow key={log.id} hover sx={{ '&:hover': { bgcolor: 'rgba(99,102,241,0.06)' } }}>
                    <TableCell align="center" sx={{ opacity: 0.8, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{log.admin_username}</TableCell>
                    <TableCell align="center" sx={{ textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 'bold', color: 'info.main', whiteSpace: 'nowrap' }}>
                      {log.action}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.85rem', maxWidth: '300px', wordBreak: 'break-all' }}>
                      {(() => {
                        if (!log.details) return ''
                        try {
                          const det = typeof log.details === 'string' ? JSON.parse(log.details) : log.details
                          return Object.entries(det)
                            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                            .join(' | ')
                        } catch { return String(log.details) }
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </GlassCard>
      )}

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
                    <Grid xs={6}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Username</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedUserForManage.username}</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Assigned System Role</Typography>
                      <Chip
                        size="small"
                        label={selectedUserForManage.role}
                        color={selectedUserForManage.role === 'admin' ? 'secondary' : 'primary'}
                        sx={{ fontWeight: 'bold', textTransform: 'uppercase', mt: 0.5 }}
                      />
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Account Created</Typography>
                      <Typography variant="body2">{selectedUserForManage.created_at ? new Date(selectedUserForManage.created_at).toLocaleString() : 'N/A'}</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>Last Activity / Sign In</Typography>
                      <Typography variant="body2">{selectedUserForManage.last_login_at ? new Date(selectedUserForManage.last_login_at).toLocaleString() : 'Never'}</Typography>
                    </Grid>
                    <Grid xs={12}>
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
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                      <Button 
                        variant="outlined" 
                        size="small" 
                        startIcon={<VpnKeyIcon />} 
                        onClick={() => setAdminResetPasswordOpen(true)}
                      >
                        Reset Password String
                      </Button>
                    </Box>
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
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                              {(() => {
                                if (!log.details) return 'No details available.'
                                try {
                                  const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details
                                  
                                  if (log.action === 'change_password' || log.action === 'reset_password') {
                                    return 'Password was updated.'
                                  } else if (log.action === 'admin_reset_mfa') {
                                    return 'Multi-Factor Authentication (MFA) passkeys were revoked.'
                                  } else if (log.action === 'admin_reset_sso') {
                                    return 'SSO identity provider links were disconnected.'
                                  } else if (log.action === 'user_merged') {
                                    return `Merged from/to another user. Target ID: ${details.target_user_id || 'N/A'}`
                                  } else if (log.action === 'update_user_permissions' || log.action === 'admin_update_user') {
                                    const parts = []
                                    if (details.old_role && details.new_role && details.old_role !== details.new_role) {
                                      parts.push(`Role changed from "${details.old_role}" to "${details.new_role}".`)
                                    }
                                    if (details.old_permissions && details.new_permissions) {
                                      const diffs = []
                                      const allKeys = new Set([...Object.keys(details.old_permissions), ...Object.keys(details.new_permissions)])
                                      allKeys.forEach(k => {
                                        if (k === 'quotas' || k === 'restrictions') return
                                        const oldVal = details.old_permissions[k]
                                        const newVal = details.new_permissions[k]
                                        if (oldVal !== newVal) {
                                          diffs.push(`${k}: ${oldVal || 'none'} ➔ ${newVal || 'none'}`)
                                        }
                                      })
                                      if (diffs.length > 0) {
                                        parts.push(`Permissions changed: ${diffs.join(', ')}.`);
                                      }
                                    }
                                    return parts.length > 0 ? parts.join(' ') : 'Profile or permission settings updated.'
                                  }
                                  
                                  return Object.entries(details)
                                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                                    .join(' | ')
                                } catch {
                                  return String(log.details)
                                }
                              })()}
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

                    <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                      <Grid xs={12}>
                        <FormControl fullWidth size="small">
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
                      <Grid xs={12} sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                        <Button 
                          variant="contained" 
                          color="warning" 
                          size="small" 
                          startIcon={<SyncIcon />}
                          disabled={!mergeTargetUserId}
                          onClick={async () => {
                            if (await window.appConfirm(`Are you absolutely sure you want to merge all data from ${selectedUserForManage.username} into the selected target account? This will delete ${selectedUserForManage.username} forever and is irreversible.`)) {
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

                  {/* Revoke All Active Sessions & Paired Keys */}
                  <Paper elevation={1} sx={{ p: 2.5, mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Force Sign-Out & Revoke Sessions</Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontSize: '0.85rem' }}>
                      Immediately invalidate all active session tokens, browser extension pairings, and API keys for <strong>{selectedUserForManage.username}</strong> across all devices.
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Button
                        variant="outlined"
                        color="warning"
                        startIcon={<VpnKeyIcon />}
                        onClick={handleAdminRevokeSessions}
                        sx={{ borderRadius: '8px', textTransform: 'none' }}
                      >
                        Revoke All Active Sessions & API Keys
                      </Button>
                    </Box>
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

                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                      <Button 
                        variant="contained" 
                        color="error" 
                        startIcon={<DeleteIcon />}
                        disabled={selectedUserForManage.role === 'admin' && usersList.filter(u => u.role === 'admin').length <= 1}
                        onClick={async () => {
                          if (await window.appConfirm(`Are you sure you want to permanently delete the user account for ${selectedUserForManage.username}? This will purge all associated settings, credentials, and playback data immediately.`)) {
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
        disableRestoreFocus
        PaperProps={{
          elevation: 6,
          sx: {
            borderRadius: 3
          }
        }}
      >
        <form onSubmit={(e) => { e.preventDefault(); if (adminResetPasswordNew.length >= 8) handleAdminResetPassword(adminResetPasswordNew); }}>
          <DialogTitle sx={{ pb: 1 }}>Reset User Password</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2, fontSize: '0.9rem', opacity: 0.8 }}>
              Set a new temporary or custom password for user <strong>{selectedUserForManage?.username}</strong>. The user will be required to input this password to authenticate next time.
            </Typography>
            <Grid container spacing={3} sx={{ alignItems: 'stretch', mt: 0.5 }}>
              <Grid xs={12} sm={7}>
                <TextField
                  fullWidth
                  type="password"
                  autoComplete="new-password"
                  label="New Password string"
                  value={adminResetPasswordNew}
                  onChange={e => setAdminResetPasswordNew(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>
              <Grid xs={12} sm={5}>
                <PasswordChecklist password={adminResetPasswordNew} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setAdminResetPasswordOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button 
              type="submit"
              variant="contained" 
              color="secondary" 
              disabled={adminResetPasswordNew.length < 8}
              sx={{ borderRadius: '8px', textTransform: 'none', px: 3 }}
            >
              Reset password
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}
