import { useState, useEffect, useCallback } from 'react';
import { 
  Box, Typography, Paper, Button, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, IconButton, Dialog, 
  DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, 
  Select, MenuItem, TextField 
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

export default function CookiesManager() {
  const [cookies, setCookies] = useState([]);
  const [providers, setProviders] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({ provider_id: '', cookie_text: '', download_limit: '' });

  const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`;
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('voyarr_jwt');
    if (token) return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const apiKey = localStorage.getItem('voyarr_api_key');
    if (apiKey) return { 'X-Voyarr-Api-Key': apiKey, 'Content-Type': 'application/json' };
    return { 'Content-Type': 'application/json' };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Note: Assuming you will create a GET /cookies endpoint in your FastAPI backend
      const [cookieRes, provRes] = await Promise.all([
        fetch(`${API_BASE}/cookies`, { headers: getAuthHeaders() }).catch(() => ({ ok: false })),
        fetch(`${API_BASE}/providers`, { headers: getAuthHeaders() })
      ]);
      
      if (cookieRes.ok) setCookies(await cookieRes.json());
      if (provRes.ok) setProviders(await provRes.json());
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  }, [API_BASE, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCookie = async () => {
    try {
      const payload = {
        provider_id: formData.provider_id,
        cookie_text: formData.cookie_text,
        download_limit: formData.download_limit ? parseInt(formData.download_limit) : null
      };
      
      // Note: Assuming you will create a POST /cookies endpoint
      const res = await fetch(`${API_BASE}/cookies`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Session cookie added successfully', severity: 'success' } }));
        setOpenDialog(false);
        setFormData({ provider_id: '', cookie_text: '', download_limit: '' });
        fetchData();
      } else {
        const err = await res.json();
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.detail || 'Failed to add cookie', severity: 'error' } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: e.message, severity: 'error' } }));
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.appConfirm ? await window.appConfirm('Are you sure you want to delete this session cookie?') : window.confirm('Are you sure you want to delete this session cookie?');
    if (!confirmed) return;
    
    try {
      await fetch(`${API_BASE}/cookies/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      fetchData();
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Cookie deleted', severity: 'success' } }));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Session Cookies Manager</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
          Add Session Cookie
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Provider</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Usage / Limit</TableCell>
              <TableCell>Expiration</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cookies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">No session cookies configured.</TableCell>
              </TableRow>
            ) : (
              cookies.map((cookie) => (
                <TableRow key={cookie.id}>
                  <TableCell>{providers.find(p => p.id === cookie.provider_id)?.name || `Provider ID: ${cookie.provider_id}`}</TableCell>
                  <TableCell>
                    <Chip 
                      label={cookie.status} 
                      color={cookie.status === 'active' ? 'success' : cookie.status === 'expired' ? 'error' : 'warning'} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>{cookie.downloads_used} / {cookie.download_limit || '∞'}</TableCell>
                  <TableCell>{cookie.expires_at ? new Date(cookie.expires_at).toLocaleString() : 'Never'}</TableCell>
                  <TableCell align="right">
                    <IconButton color="error" onClick={() => handleDelete(cookie.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Session Cookie</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth margin="normal">
            <InputLabel>Provider</InputLabel>
            <Select value={formData.provider_id} onChange={e => setFormData({...formData, provider_id: e.target.value})} label="Provider">
              {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth margin="normal" label="Netscape Cookie Text / Token" multiline rows={4} value={formData.cookie_text} onChange={e => setFormData({...formData, cookie_text: e.target.value})} />
          <TextField fullWidth margin="normal" type="number" label="Max Downloads Limit (Optional)" value={formData.download_limit} onChange={e => setFormData({...formData, download_limit: e.target.value})} helperText="Cookie will be marked 'limit_reached' after this many downloads." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleAddCookie} variant="contained" disabled={!formData.provider_id || !formData.cookie_text}>Save Cookie</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
