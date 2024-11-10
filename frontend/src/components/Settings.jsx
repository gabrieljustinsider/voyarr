import { useState, useEffect } from 'react'
import { Box, Typography, TextField, Button, Paper, Grid, Snackbar, Alert, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel, Tabs, Tab } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import SyncIcon from '@mui/icons-material/Sync'

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
    pm_sync_direction: 'pull'
  })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [apiKeys, setApiKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState(null)
  const [masterKeyInput, setMasterKeyInput] = useState(localStorage.getItem('voyarr_api_key') || '')
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, keyId: null })
  
  const [tabValue, setTabValue] = useState(0)
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })

  const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`
  const SETTINGS_API = `${API_BASE}/settings`
  
  const getAuthHeaders = () => {
    const token = localStorage.getItem('voyarr_jwt')
    if (token) return { 'Authorization': `Bearer ${token}` }
    const apiKey = localStorage.getItem('voyarr_api_key')
    if (apiKey) return { 'X-Voyarr-Api-Key': apiKey }
    return {}
  }

  useEffect(() => {
    fetch(SETTINGS_API, {
      headers: getAuthHeaders()
    })
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
  }, [])

  const fetchApiKeys = async () => {
    try {
      const res = await fetch(`${API_BASE}/apikeys`, { headers: getAuthHeaders() })
      if (res.ok) setApiKeys(await res.json())
    } catch (err) { console.error('Failed to fetch API keys:', err) }
  }

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value })
  }

  const handleSave = async (key, value) => {
    try {
      const res = await fetch(SETTINGS_API, {
        method: 'POST',
        headers: { 
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value: String(value) })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `Setting "${key}" updated successfully!`, severity: 'success' })
      } else {
        setSnackbar({ open: true, message: `Failed to update "${key}". Server returned ${res.status}`, severity: 'error' })
      }
    } catch (err) {
      setSnackbar({ open: true, message: `Failed to update "${key}".`, severity: 'error' })
    }
  }

  const generateExtensionSecret = () => {
    const array = new Uint8Array(32)
    window.crypto.getRandomValues(array)
    const newKey = Array.from(array, byte => ('0' + byte.toString(16)).slice(-2)).join('')
    setSettings(prev => ({ ...prev, extension_secret: newKey }))
  }

  const handleCreateApiKey = async () => {
    try {
      const res = await fetch(`${API_BASE}/apikeys`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
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
      await fetch(`${API_BASE}/apikeys/${deleteConfirm.keyId}`, { 
        method: 'DELETE', 
        headers: getAuthHeaders() 
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
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
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
            <TextField fullWidth label="Docker Media Root Mapping" name="media_root_path" value={settings.media_root_path || ''} onChange={handleChange} helperText="The physical directory path where downloads will be organized inside the container." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('media_root_path', settings.media_root_path)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={10}>
            <TextField fullWidth label="Default Download Destination" name="download_destination" value={settings.download_destination || ''} onChange={handleChange} helperText="Sub-directory where new, unprocessed files are initially downloaded." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('download_destination', settings.download_destination)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={10}>
            <TextField fullWidth label="Permanent Library Folder" name="library_folder" value={settings.library_folder || ''} onChange={handleChange} helperText="Directory where organized and tagged media is permanently stored." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('library_folder', settings.library_folder)}>Save</Button>
          </Grid>

          <Grid item xs={12} md={10}>
            <TextField fullWidth label="Existing Media Scan Target" name="scan_folder" value={settings.scan_folder || ''} onChange={handleChange} helperText="Directory targeted by the Reverse Regex Engine when searching for existing local files." />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" onClick={() => handleSave('scan_folder', settings.scan_folder)}>Save</Button>
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