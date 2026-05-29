import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  TextField,
  Divider,
  Alert,
  Grid
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import FolderIcon from '@mui/icons-material/Folder';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SettingsIcon from '@mui/icons-material/Settings';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import DnsIcon from '@mui/icons-material/Dns';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BuildIcon from '@mui/icons-material/Build';
import BlockIcon from '@mui/icons-material/Block';
import EditIcon from '@mui/icons-material/Edit';

// Logically managed features in Voyarr
const FEATURES = [
  { id: 'library', label: 'Library & Media Catalog', supportsEdit: true, icon: <FolderIcon fontSize="small" sx={{ color: '#4caf50' }} /> },
  { id: 'streaming', label: 'Video Streaming', supportsEdit: false, icon: <PlayCircleIcon fontSize="small" sx={{ color: '#2196f3' }} /> }, 
  { id: 'scraping', label: 'Metadata Scraping', supportsEdit: true, icon: <SearchIcon fontSize="small" sx={{ color: '#9c27b0' }} /> },
  { id: 'ripping', label: 'Ripping & Downloads', supportsEdit: true, icon: <DownloadIcon fontSize="small" sx={{ color: '#f44336' }} /> },
  { id: 'requests', label: 'Media Requests Portal', supportsEdit: true, icon: <AssignmentIcon fontSize="small" sx={{ color: '#ff9800' }} /> },
  { id: 'settings', label: 'System & Proxy Settings', supportsEdit: true, icon: <SettingsIcon fontSize="small" sx={{ color: '#9e9e9e' }} /> },
  { id: 'billing', label: 'Billing & Subscriptions', supportsEdit: true, icon: <CreditCardIcon fontSize="small" sx={{ color: '#00bcd4' }} /> },
  { id: 'providers', label: 'Provider Management', supportsEdit: true, icon: <DnsIcon fontSize="small" sx={{ color: '#8bc34a' }} /> },
  { id: 'lens_access', label: 'Voyarr Lens Access', supportsEdit: false, icon: <VisibilityIcon fontSize="small" sx={{ color: '#3f51b5' }} /> },
  { id: 'lens_features', label: 'Voyarr Lens Feature Control', supportsEdit: true, icon: <BuildIcon fontSize="small" sx={{ color: '#ff5722' }} /> },
];

const ACCESS_LEVELS = {
  NONE: 'none',
  VIEW: 'view',
  EDIT: 'edit',
};

export default function PermissionsManager({ user, onSave }) {
  // Local state for the selected entity (Role vs User override)
  const [targetType, setTargetType] = useState('user');
  
  // Mock initial state based on Voyarr's flexible JSON permissions column
  const [permissions, setPermissions] = useState(user?.permissions || {
    library: ACCESS_LEVELS.VIEW,
    streaming: ACCESS_LEVELS.VIEW,
    scraping: ACCESS_LEVELS.NONE,
    ripping: ACCESS_LEVELS.NONE,
    requests: ACCESS_LEVELS.VIEW,
    settings: ACCESS_LEVELS.NONE,
    billing: ACCESS_LEVELS.NONE,
    providers: ACCESS_LEVELS.NONE,
    lens_access: ACCESS_LEVELS.NONE,
    lens_features: ACCESS_LEVELS.NONE,
  });

  // Suggested Advanced Controls
  const [dailyRipQuota, setDailyRipQuota] = useState(user?.quotas?.dailyRips || 0);
  const [restrictedTags, setRestrictedTags] = useState(user?.restrictions?.tags?.join(', ') || '');

  const handlePermissionChange = (featureId, newLevel) => {
    setPermissions((prev) => ({
      ...prev,
      [featureId]: newLevel,
    }));
  };

  const handleSave = () => {
    const payload = {
      targetType,
      permissions,
      quotas: {
        dailyRips: parseInt(dailyRipQuota, 10),
      },
      restrictions: {
        tags: restrictedTags.split(',').map((tag) => tag.trim()).filter(Boolean),
      }
    };
    if (onSave) onSave(payload);
  };

  return (
    <Box sx={{ maxWidth: 1000, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <SecurityIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'Outfit, sans-serif' }}>
          Access Control & Permissions
        </Typography>
      </Box>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Manage granular module access, daily quotas, and specialized content restrictions.
      </Typography>

      <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Target Profile</InputLabel>
              <Select
                value={targetType}
                label="Target Profile"
                onChange={(e) => setTargetType(e.target.value)}
                sx={{ borderRadius: 1 }}
              >
                <MenuItem value="role_user">Global Role: Standard User</MenuItem>
                <MenuItem value="role_moderator">Global Role: Moderator</MenuItem>
                <MenuItem value="user">Specific User Override ({user?.username || 'Selected User'})</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2, mb: 4 }}>
        <Table>
          <TableHead sx={{ backgroundColor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Feature Module</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Access Level</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {FEATURES.map((feature) => (
              <TableRow key={feature.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {feature.icon}
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{feature.label}</Typography>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <Select
                      value={permissions[feature.id] || ACCESS_LEVELS.NONE}
                      onChange={(e) => handlePermissionChange(feature.id, e.target.value)}
                      sx={{ 
                        borderRadius: '8px', 
                        fontSize: '0.85rem'
                      }}
                    >
                      <MenuItem value={ACCESS_LEVELS.NONE} sx={{ fontSize: '0.85rem' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><BlockIcon fontSize="small" color="error" /> None</Box>
                      </MenuItem>
                      <MenuItem value={ACCESS_LEVELS.VIEW} sx={{ fontSize: '0.85rem' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><VisibilityIcon fontSize="small" color="info" /> View</Box>
                      </MenuItem>
                      {feature.supportsEdit && (
                        <MenuItem value={ACCESS_LEVELS.EDIT} sx={{ fontSize: '0.85rem' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><EditIcon fontSize="small" color="success" /> Edit / Manage</Box>
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Advanced Controls Section */}
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: '600', mt: 4, fontFamily: 'Outfit, sans-serif' }}>
        Advanced Controls & Restrictions
      </Typography>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Daily Download Quota (Items)"
              type="number"
              helperText={`Set to 0 for unlimited. Current usage today: ${user?.daily_rip_usage || 0} rips.`}
              value={dailyRipQuota}
              onChange={(e) => setDailyRipQuota(e.target.value)}
              disabled={permissions.ripping === ACCESS_LEVELS.NONE}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Restricted Tags (Comma Separated)"
              helperText="Videos containing these tags will be entirely hidden from this user."
              value={restrictedTags}
              onChange={(e) => setRestrictedTags(e.target.value)}
              placeholder="e.g. Extreme, VR, Private"
            />
          </Grid>
        </Grid>
      </Paper>

      <Alert severity="info" elevation={1} sx={{ mb: 3, borderRadius: 2 }}>
        <strong>Note:</strong> Saving a specific user override instantly bypasses their global role defaults. Admins are exempt from system restrictions.
      </Alert>

      <Box display="flex" justifyContent="flex-end" gap={2}>
        <Button variant="outlined" color="inherit">
          Discard Changes
        </Button>
        <Button 
          variant="contained" 
          color="secondary" 
          onClick={handleSave}
          sx={{ px: 4 }}
        >
          Save Permissions
        </Button>
      </Box>
    </Box>
  );
}
