import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`;
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
};

export default function ScheduleManager() {
  const [schedules, setSchedules] = useState([]);
  const [providers, setProviders] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    provider_id: '',
    target_url: '',
    cron_expression: '0 0 * * *',
    action: 'metadata_and_download',
    is_active: true
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = useCallback(async () => {
    try {
      const [schedRes, provRes] = await Promise.all([
        fetch(`${API_BASE}/schedules`, { headers: HEADERS }),
        fetch(`${API_BASE}/providers`, { headers: HEADERS })
      ]);
      if (schedRes.ok) setSchedules(await schedRes.json());
      if (provRes.ok) setProviders(await provRes.json());
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchData();
    };
    init();
  }, [fetchData]);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/schedules`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setFormData({
          name: '', provider_id: '', target_url: '', cron_expression: '0 0 * * *', action: 'metadata_and_download', is_active: true
        });
        fetchData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.detail || 'Failed to create schedule'}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await window.appConfirm('Delete this schedule?');
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_BASE}/schedules/${id}`, {
        method: 'DELETE',
        headers: HEADERS
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error('Failed to delete schedule:', e);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Schedule Engine (Site Ripping)</Typography>
      
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>Create New Schedule</Typography>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField 
                fullWidth size="small" name="name" label="Schedule Name" 
                value={formData.name} onChange={handleChange} required 
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Provider</InputLabel>
                <Select name="provider_id" value={formData.provider_id} onChange={handleChange} label="Provider">
                  {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField 
                fullWidth size="small" name="cron_expression" label="Cron Expression" 
                value={formData.cron_expression} onChange={handleChange} required 
                helperText="e.g. 0 0 * * * (Daily at midnight)"
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField 
                fullWidth size="small" name="target_url" label="Target URL (Channel/Playlist/Index)" 
                value={formData.target_url} onChange={handleChange} required 
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Action</InputLabel>
                <Select name="action" value={formData.action} onChange={handleChange} label="Action">
                  <MenuItem value="metadata_and_download">Rip Metadata & Download</MenuItem>
                  <MenuItem value="download_only">Download Videos Only</MenuItem>
                  <MenuItem value="metadata_only">Rip Metadata Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={formData.is_active} onChange={handleChange} name="is_active" />}
                label="Active"
              />
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" type="submit">Create Schedule</Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Typography variant="h6" gutterBottom>Active Schedules</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Target URL</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Cron</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Last Run</TableCell>
              <TableCell>Next Run</TableCell>
              <TableCell>Last Result</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedules.map((row) => {
              const providerName = providers.find(p => p.id === row.provider_id)?.name || 'Unknown';
              return (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    <Tooltip title={row.target_url || ''}>
                      <Typography noWrap sx={{ maxWidth: 150 }}>{row.target_url}</Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{providerName}</TableCell>
                  <TableCell>
                    <Chip size="small" label={row.action.replace(/_/g, ' ')} />
                  </TableCell>
                  <TableCell>{row.cron_expression}</TableCell>
                  <TableCell>
                    <Chip size="small" color={row.is_active ? 'success' : 'default'} label={row.is_active ? 'Active' : 'Inactive'} />
                  </TableCell>
                  <TableCell>
                    {row.last_run ? new Date(row.last_run).toLocaleString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {row.next_run ? new Date(row.next_run).toLocaleString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {row.last_run_status ? (
                      <Tooltip title={row.last_run_details || 'No details'}>
                        <Chip size="small" color={row.last_run_status === 'success' ? 'success' : 'error'} label={row.last_run_status} />
                      </Tooltip>
                    ) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {schedules.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center">No schedules defined</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}