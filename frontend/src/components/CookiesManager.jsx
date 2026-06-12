import { useState, useEffect, useCallback } from 'react';
import { 
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, 
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, 
  InputLabel, Select, MenuItem, TextField, FormControlLabel, Switch, Autocomplete 
} from '@mui/material';
import { Trash2, Plus } from 'lucide-react';
import { apiFetch } from '../api';

export default function CookiesManager() {
  const [cookies, setCookies] = useState([]);
  const [providers, setProviders] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [formData, setFormData] = useState({ provider_id: '', cookie_text: '', download_limit: '' });

  const fetchData = useCallback(async () => {
    try {
      const [cookieRes, provRes] = await Promise.all([
        apiFetch('/cookies').catch(() => ({ ok: false })),
        apiFetch('/providers')
      ]);
      
      if (cookieRes.ok) setCookies(await cookieRes.json());
      if (provRes.ok) setProviders(await provRes.json());
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCookie = async () => {
    try {
      const payload = {
        provider_id: formData.provider_id,
        cookie_text: formData.cookie_text,
        download_limit: limitEnabled && formData.download_limit ? parseInt(formData.download_limit, 10) : null
      };
      
      const res = await apiFetch('/cookies', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Session cookie added successfully', severity: 'success' } }));
        setOpenDialog(false);
        setLimitEnabled(false);
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
    const confirmed = await window.appConfirm('Are you sure you want to delete this session cookie?');
    if (!confirmed) return;
    
    try {
      await apiFetch(`/cookies/${id}`, { method: 'DELETE' });
      fetchData();
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Cookie deleted', severity: 'success' } }));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ textAlign: { xs: 'center', sm: 'left' } }}>Session Cookies Manager</Typography>
        <Button variant="contained" startIcon={<Plus size={20} />} onClick={() => setOpenDialog(true)} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          Add Session Cookie
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Provider</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Usage / Limit</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Expiration</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell>
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
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{providers.find(p => p.id === cookie.provider_id)?.name || `Provider ID: ${cookie.provider_id}`}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Chip 
                      label={cookie.status} 
                      color={cookie.status === 'active' ? 'success' : cookie.status === 'expired' ? 'error' : 'warning'} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{cookie.downloads_used} / {cookie.download_limit || '∞'}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{cookie.expires_at ? new Date(cookie.expires_at).toLocaleString() : 'Never'}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton color="error" onClick={() => handleDelete(cookie.id)}>
                      <Trash2 size={20} />
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
          <Autocomplete
            options={providers}
            getOptionLabel={(option) => option.name}
            value={providers.find(p => p.id === formData.provider_id) || null}
            onChange={(e, newValue) => setFormData({ ...formData, provider_id: newValue ? newValue.id : '' })}
            renderInput={(params) => <TextField {...params} label="Provider" margin="normal" />}
            fullWidth
          />
          <TextField fullWidth margin="normal" label="Netscape Cookie Text / Token" multiline rows={4} value={formData.cookie_text} onChange={e => setFormData({...formData, cookie_text: e.target.value})} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={limitEnabled}
                  onChange={(e) => setLimitEnabled(e.target.checked)}
                />
              }
              label="Enable Max Limit"
              sx={{ minWidth: '180px' }}
            />
            <TextField 
              fullWidth 
              margin="normal" 
              label="Download Limit"
              type="number"
              disabled={!limitEnabled}
              value={formData.download_limit}
              onChange={e => setFormData({...formData, download_limit: e.target.value})}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddCookie}>Save Cookie</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}