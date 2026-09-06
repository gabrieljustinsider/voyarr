import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Tooltip, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { apiFetch } from '../api';
import { describeCron, formatScheduleDisplay } from '../utils/cron';

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
  const [displayMode, setDisplayMode] = useState(() => localStorage.getItem('fleet_schedule_display_mode') || 'hybrid');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, scheduleId: null });
  const [scrapingEnabled, setScrapingEnabled] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [schedRes, provRes] = await Promise.all([
        apiFetch('/schedules'),
        apiFetch('/providers')
      ]);
      if (schedRes.ok) setSchedules(await schedRes.json());
      if (provRes.ok) setProviders(await provRes.json());

      // Check global scraping setting and schedule display mode
      const settingsRes = await apiFetch('/settings');
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings && settings.scraping_enabled === 'false') {
          setScrapingEnabled(false);
        }
        if (settings?.schedule_display_mode) {
          setDisplayMode(settings.schedule_display_mode);
        }
      }
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
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
      const res = await apiFetch('/schedules', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          provider_id: formData.provider_id ? parseInt(formData.provider_id, 10) : null
        })
      });
      if (res.ok) {
        setFormData({
          name: '', provider_id: '', target_url: '', cron_expression: '0 0 * * *', action: 'metadata_and_download', is_active: true
        });
        fetchData();
        setSnackbar({ open: true, message: 'Schedule created successfully!', severity: 'success' });
      } else {
        const error = await res.json().catch(() => ({}));
        setSnackbar({ open: true, message: `Error: ${error.detail || 'Failed to create schedule'}`, severity: 'error' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: `Error: ${e.message}`, severity: 'error' });
    }
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.scheduleId;
    if (!id) return;
    try {
      const res = await apiFetch(`/schedules/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDeleteConfirm({ open: false, scheduleId: null });
        fetchData();
        setSnackbar({ open: true, message: 'Schedule deleted successfully', severity: 'success' });
      } else {
        const err = await res.json().catch(() => ({}));
        setSnackbar({ open: true, message: `Error: ${err.detail || 'Failed to delete'}`, severity: 'error' });
      }
    } catch (e) {
      console.error('Failed to delete schedule:', e);
    }
  };

  const handleToggle = async (id, currentStatus) => {
    try {
      const res = await apiFetch(`/schedules/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (res.ok) {
        fetchData();
      } else {
        setSnackbar({ open: true, message: 'Failed to update schedule.', severity: 'error' });
      }
    } catch (e) {
      console.error('Failed to toggle schedule:', e);
    }
  };

  const handleTrigger = async (id) => {
    try {
      const res = await apiFetch(`/schedules/${id}/trigger`, {
        method: 'POST'
      });
      if (res.ok) {
        setSnackbar({ open: true, message: 'Schedule triggered! Check the download queue shortly.', severity: 'success' });
        fetchData();
      } else {
        setSnackbar({ open: true, message: 'Failed to trigger schedule.', severity: 'error' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: `Error: ${e.message}`, severity: 'error' });
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    const hasTimezone = timeStr.endsWith('Z') || timeStr.includes('+') || timeStr.match(/-\d{2}:\d{2}$/);
    return new Date(hasTimezone ? timeStr : timeStr + 'Z').toLocaleString();
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h5" gutterBottom>Schedule Engine (Site Ripping)</Typography>
      
      {/* Purpose Banner */}
      <Alert 
        severity="info" 
        sx={{ 
          mb: 3, 
          borderRadius: '12px', 
          bgcolor: 'rgba(14, 165, 233, 0.08)', 
          color: '#38bdf8',
          border: '1px solid rgba(14, 165, 233, 0.2)',
          '& .MuiAlert-icon': { color: '#0284c7' } 
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
          ⏱️ Automated Task Scheduler &amp; Recurring Cron Jobs
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
          The Schedule Engine runs recurring background jobs for automated channel scraping, metadata synchronization, database maintenance, and routine media backups at custom Cron intervals.
        </Typography>
      </Alert>
      
      <Paper sx={{ p: 2, mb: 4, mx: 'auto', width: '100%' }}>
        <Typography variant="h6" gutterBottom>Create New Schedule</Typography>
        {!scrapingEnabled && (
          <Alert severity="warning" sx={{ mb: 2 }} style={{ color: '#ff9800', background: 'rgba(255, 152, 0, 0.08)', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
            ⚠️ Access Denied: The Scraping feature is disabled globally by the administrator. Please enable it in Settings to configure or manage schedules.
          </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid xs={12}>
              <TextField 
                fullWidth size="small" name="name" label="Schedule Name" 
                slotProps={{ inputLabel: { shrink: true } }}
                value={formData.name} onChange={handleChange} required 
                disabled={!scrapingEnabled}
              />
            </Grid>
            <Grid xs={12}>
              <Autocomplete
                options={providers}
                getOptionLabel={(option) => option.name}
                value={providers.find(p => p.id === formData.provider_id) || null}
                onChange={(e, newValue) => setFormData({ ...formData, provider_id: newValue ? newValue.id : '' })}
                disabled={!scrapingEnabled}
                renderInput={(params) => <TextField {...params} label="Provider" size="small" required />}
                fullWidth
              />
            </Grid>
            <Grid xs={12}>
              <Autocomplete
                options={[
                  {value: 'metadata_and_download', label: 'Rip Metadata & Download'},
                  {value: 'download_only', label: 'Download Videos Only'},
                  {value: 'metadata_only', label: 'Rip Metadata Only'}
                ]}
                getOptionLabel={(option) => option.label}
                value={[
                  {value: 'metadata_and_download', label: 'Rip Metadata & Download'},
                  {value: 'download_only', label: 'Download Videos Only'},
                  {value: 'metadata_only', label: 'Rip Metadata Only'}
                ].find(o => o.value === formData.action) || null}
                onChange={(e, newValue) => setFormData({ ...formData, action: newValue ? newValue.value : 'metadata_and_download' })}
                disabled={!scrapingEnabled}
                renderInput={(params) => <TextField {...params} label="Action" size="small" required />}
                fullWidth
              />
            </Grid>
            <Grid xs={12}>
              <TextField 
                fullWidth size="small" name="cron_expression" 
                label={displayMode === 'human_only' ? 'Schedule Cadence' : 'Cron Expression'} 
                slotProps={{ inputLabel: { shrink: true } }}
                value={formData.cron_expression} onChange={handleChange} required 
                helperText={
                  displayMode === 'human_only'
                    ? `Current Cadence: ${describeCron(formData.cron_expression)}`
                    : `e.g. 0 0 * * * — Translates to: ${describeCron(formData.cron_expression)}`
                }
                disabled={!scrapingEnabled}
              />
            </Grid>
            <Grid xs={12}>
              <TextField 
                fullWidth size="small" name="target_url" label="Target URL (Channel/Playlist/Index)" 
                slotProps={{ inputLabel: { shrink: true } }}
                value={formData.target_url} onChange={handleChange} required 
                disabled={!scrapingEnabled}
              />
            </Grid>
            <Grid xs={12}>
              <FormControlLabel
                control={<Switch checked={formData.is_active} onChange={handleChange} name="is_active" disabled={!scrapingEnabled} />}
                label="Active"
              />
            </Grid>
            <Grid xs={12} sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="contained" type="submit" disabled={!scrapingEnabled} sx={{ minWidth: 200, height: 40, fontWeight: 600 }}>
                Create Schedule
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Typography variant="h6" gutterBottom>Active Schedules</Typography>
      <TableContainer component={Paper} sx={{ overflowX: 'auto', mx: 'auto', width: '100%' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Name</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Target URL</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Provider</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Action</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Schedule Cadence</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Active</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Last Run</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Next Run</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Last Result</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedules.map((row) => {
              const providerName = providers.find(p => p.id === row.provider_id)?.name || 'Unknown';
              return (
                <TableRow key={row.id}>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{row.name}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title={row.target_url || ''}>
                      <Typography noWrap sx={{ maxWidth: 150 }}>{row.target_url}</Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{providerName}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Chip size="small" label={row.action.replace(/_/g, ' ')} />
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {describeCron(row.cron_expression)}
                      </Typography>
                      {displayMode === 'hybrid' && (
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', bgcolor: 'rgba(255,255,255,0.05)', px: 1, py: 0.25, borderRadius: 1, fontSize: '0.7rem' }}>
                          {row.cron_expression}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Switch size="small" checked={row.is_active} onChange={() => handleToggle(row.id, row.is_active)} disabled={!scrapingEnabled} />
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {formatTime(row.last_run)}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {formatTime(row.next_run)}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {row.last_run_status ? (
                      <Tooltip title={row.last_run_details || 'No details'}>
                        <Chip size="small" color={row.last_run_status === 'success' ? 'success' : 'error'} label={row.last_run_status} />
                      </Tooltip>
                    ) : 'N/A'}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Trigger Now">
                      <IconButton size="small" color="primary" onClick={() => handleTrigger(row.id)} disabled={!scrapingEnabled}>
                        <PlayArrowIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteConfirm({ open: true, scheduleId: row.id })} disabled={!scrapingEnabled}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
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

      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, scheduleId: null })}>
        <DialogTitle>Delete Schedule</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this schedule? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, scheduleId: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}