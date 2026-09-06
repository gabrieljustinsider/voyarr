import { useState, useEffect, useMemo } from 'react'
import { Box, Typography, TextField, Button, Paper, Grid, Snackbar, Alert, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel, Tabs, Tab, Switch, FormControlLabel, Chip, LinearProgress, FormHelperText, Avatar } from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TuneIcon from '@mui/icons-material/Tune'
import LanIcon from '@mui/icons-material/Lan'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import { apiFetch } from '../api'
import GlassCard from './common/GlassCard'
import PathPicker from './PathPicker'
import InlineTextField from './InlineTextField'
import PasswordChecklist from './PasswordChecklist'
import PermissionsManager from './PermissionsManager'
import AccountSecurity from './AccountSecurity'
import ExternalAPIs from './ExternalAPIs'
import DownloadRules from './DownloadRules'
import CredentialManagerIntegration from './CredentialManagerIntegration'

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

function PillListInput({ label, value, onChange, placeholder = "Type and press enter..." }) {
  const [inputValue, setInputValue] = useState('')
  const pills = useMemo(() => {
    if (!value) return []
    return value.split(',').map(v => v.trim()).filter(Boolean)
  }, [value])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      const newPill = inputValue.trim()
      if (!pills.includes(newPill)) {
        const updated = [...pills, newPill].join(',')
        onChange(updated)
      }
      setInputValue('')
    }
  }

  const handleDelete = (pillToDelete) => {
    const updated = pills.filter(p => p !== pillToDelete).join(',')
    onChange(updated)
  }

  return (
    <Box sx={{ mt: 1.5, mb: 1.5 }}>
      <TextField
        fullWidth
        label={label}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        helperText="Press Enter to add items to the list"
        slotProps={{ input: {
          startAdornment: pills.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 0.5 }}>
              {pills.map((pill) => (
                <Chip
                  key={pill}
                  label={pill}
                  onDelete={() => handleDelete(pill)}
                  size="small"
                />
              ))}
            </Box>
          ) : null
        }}}
      />
    </Box>
  )
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
    pm_sync_direction: 'pull',
    yt_write_subs: 'false',
    yt_write_thumbs: 'false',
    yt_sponsorblock: 'false',
    yt_live_streams: 'false',
    yt_native_playlists: 'false',
    yt_custom_format: '',
    yt_browser_cookies: '',
    discord_allowed_users: '',
    global_proxy_enabled: 'false',
    global_proxy_url: '',
    global_user_agent: '',
    passkeys_enabled: 'true',
    passkeys_rp_name: 'Voyarr Media Server',
    passkeys_rp_id: '',
    passkeys_authenticator_attachment: 'any',
    passkeys_resident_key: 'required',
    passkeys_user_verification: 'preferred',
    passkeys_timeout: '60',
    passkeys_attestation: 'none',
    sso_enabled: 'false',
    oidc_enabled: 'false',
    auth_bypass_enabled: 'false',
    auth_bypass_subnets: '127.0.0.1',
    auth_bypass_default_user: '',
    auth_bypass_proxy_header_enabled: 'false',
    auth_bypass_proxy_header_name: 'Remote-User',
    streaming_enabled: 'true',
    scraping_enabled: 'false',
    ripping_enabled: 'false'
  })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [bookmarkletCode, setBookmarkletCode] = useState('')

  const [settingsTab] = useState(0)

  // Local preferences state for UI Customizations
  const [themeName, setThemeName] = useState('dark')
  const [uiConfig, setUiConfig] = useState({
    showFavorites: true,
    showStudios: true,
    showAnalytics: true,
    showLive: true,
    rememberLastTab: true
  })

  // Load preferences from DB on mount
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const res = await apiFetch('/user/stats/preferences')
        if (res.ok) {
          const data = await res.json()
          setThemeName(data.theme || 'dark')
          if (data.ui_config) {
            setUiConfig({
              showFavorites: data.ui_config.showFavorites !== false,
              showStudios: data.ui_config.showStudios !== false,
              showAnalytics: data.ui_config.showAnalytics !== false,
              showLive: data.ui_config.showLive !== false,
              rememberLastTab: data.ui_config.rememberLastTab !== false
            })
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    loadUserPreferences()
  }, [])

  useEffect(() => {
    apiFetch('/settings')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch settings')
        return res.json()
      })
      .then(data => {
        if (data.detail) return; // Prevent overwriting settings with error response payloads
        setSettings(prev => ({ ...prev, ...data }))
      })
      .catch(console.error)
    apiFetch('/scraper/bookmarklet')
      .then(res => {
        if (res.ok) return res.json()
      })
      .then(data => {
        if (data && data.bookmarklet) setBookmarkletCode(data.bookmarklet)
      })
      .catch(console.error)
  }, [])

  const handleSyncManager = async (provider, direction) => {
    try {
      const res = await apiFetch(`/credentials/sync/${provider}/${direction}`, {
        method: 'POST'
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `Sync initiated for ${provider}`, severity: 'success' })
      } else {
        setSnackbar({ open: true, message: `Failed to sync ${provider}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: 'Network error during sync.', severity: 'error' })
    }
  }

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value })
  }

  const handleSave = async (key, value) => {
    try {
      const res = await apiFetch('/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value: String(value) })
      })
      if (res.ok) {
        setSnackbar({ open: true, message: `Setting "${key}" updated successfully!`, severity: 'success' })
      } else {
        setSnackbar({ open: true, message: `Failed to update "${key}". Server returned ${res.status}`, severity: 'error' })
      }
    } catch (err) {
      console.error(err)
      setSnackbar({ open: true, message: `Failed to update "${key}".`, severity: 'error' })
    }
  }

  const handleToggleSetting = (name, checked) => {
    const value = checked ? 'true' : 'false';
    setSettings(prev => ({ ...prev, [name]: value }));
    handleSave(name, value);
  };

  const mediaPaths = useMemo(() => {
    if (!settings.media_root_path) return []
    return settings.media_root_path.split(',').map(p => p.trim()).filter(Boolean)
  }, [settings.media_root_path])

  const handleRemoveMediaPath = (pathToRemove) => {
    const updated = mediaPaths.filter(p => p !== pathToRemove).join(',')
    setSettings(prev => ({ ...prev, media_root_path: updated }))
    handleSave('media_root_path', updated)
  }

  const handleAddMediaPath = (newPath) => {
    if (!newPath) return
    const cleaned = newPath.trim()
    if (!mediaPaths.includes(cleaned)) {
      const updated = [...mediaPaths, cleaned].join(',')
      setSettings(prev => ({ ...prev, media_root_path: updated }))
      handleSave('media_root_path', updated)
    }
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3 }}>
        System Settings &amp; Preferences
      </Typography>

      <Paper sx={{ mb: 3, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(12px)' }}>
        <Tabs value={0}
          sx={{ px: 2, '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', minHeight: 48 } }}>
          <Tab label="System & App Settings" />
        </Tabs>
      </Paper>

      {settingsTab === 0 && (
        <>
          {/* Purpose Banner */}
          <Alert 
            severity="info" 
            icon={<TuneIcon fontSize="small" color="primary" />} 
            sx={{ 
              mb: 3, 
              borderRadius: '12px', 
              bgcolor: 'rgba(99, 102, 241, 0.08)', 
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              '& .MuiAlert-icon': { color: '#818cf8' } 
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.25 }}>
              ⚙️ System Settings &amp; Global Preference Controls
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, lineHeight: 1.4 }}>
              The Settings console manages media root paths, 1Password / Bitwarden vault integrations, global authentication policies (Passkeys, SSO, OAuth), role-based feature toggles, error log retention, and external API keys.
            </Typography>
          </Alert>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" align="center" gutterBottom>Storage &amp; Directory Paths</Typography>
        <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }} color="textSecondary">
          Configure default filesystem paths for media scanning, downloads, and library structures.
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', gap: 3, width: '100%' }}>
          {/* Left Column (45%): All Input Fields Vertically Stacked */}
          <Box sx={{ width: '45%', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Media Root Scan Paths</Typography>
                <PathPicker
                  value=""
                  onChange={(val) => {
                    if (val) {
                      handleAddMediaPath(val);
                    }
                  }}
                  label="Add Media Root Path"
                  mode="folder"
                />
              </Box>

              <PathPicker
                value={settings.download_destination || ''}
                onChange={(val) => {
                  setSettings(prev => ({ ...prev, download_destination: val }));
                  handleSave('download_destination', val);
                }}
                label="Download Destination Path"
                helperText="Target directory for new downloads"
                mode="folder"
              />

              <PathPicker
                value={settings.scan_folder || ''}
                onChange={(val) => {
                  setSettings(prev => ({ ...prev, scan_folder: val }));
                  handleSave('scan_folder', val);
                }}
                label="Scan Folder Path"
                helperText="Directory to monitor for incoming files"
                mode="folder"
              />
            </Box>
          </Box>

          {/* Right Column (55%): Added Paths Chips */}
          <Box sx={{ width: '55%', flexGrow: 1 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Added Paths</Typography>
              {mediaPaths.length === 0 ? (
                <Typography variant="caption" color="textSecondary" display="block">No media root paths configured.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {mediaPaths.map((path) => (
                    <Chip
                      key={path}
                      label={path}
                      onDelete={() => handleRemoveMediaPath(path)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" align="center" gutterBottom>System-Wide Regional &amp; Localization Settings</Typography>
        <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }} color="textSecondary">
          Configure default language, time formats, and system timezone behaviors for users and schedules.
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 3, justifyContent: 'center', width: '100%', mt: 2 }}>
          <Box sx={{ flex: 1, maxWidth: 300, minWidth: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="global-locale-label">System Language</InputLabel>
              <Select
                labelId="global-locale-label"
                value={settings.global_locale || 'en'}
                label="System Language"
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, global_locale: e.target.value }));
                  handleSave('global_locale', e.target.value);
                }}
              >
                <MenuItem value="en">English (en)</MenuItem>
                <MenuItem value="es">Español (es)</MenuItem>
                <MenuItem value="fr">Français (fr)</MenuItem>
                <MenuItem value="de">Deutsch (de)</MenuItem>
                <MenuItem value="it">Italiano (it)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flex: 1, maxWidth: 300, minWidth: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="global-date-format-label">Date Format</InputLabel>
              <Select
                labelId="global-date-format-label"
                value={settings.global_date_format || 'YYYY-MM-DD'}
                label="Date Format"
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, global_date_format: e.target.value }));
                  handleSave('global_date_format', e.target.value);
                }}
              >
                <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-06-14)</MenuItem>
                <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (e.g. 06/14/2026)</MenuItem>
                <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (e.g. 14/06/2026)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flex: 1, maxWidth: 300, minWidth: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="global-time-format-label">Time Format</InputLabel>
              <Select
                labelId="global-time-format-label"
                value={settings.global_time_format || 'HH:mm:ss'}
                label="Time Format"
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, global_time_format: e.target.value }));
                  handleSave('global_time_format', e.target.value);
                }}
              >
                <MenuItem value="HH:mm:ss">24-hour (HH:mm:ss)</MenuItem>
                <MenuItem value="hh:mm:ss A">12-hour (hh:mm:ss AM/PM)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flex: 1, maxWidth: 300, minWidth: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="global-timezone-label">System Timezone</InputLabel>
              <Select
                labelId="global-timezone-label"
                value={settings.global_timezone || 'UTC'}
                label="System Timezone"
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, global_timezone: e.target.value }));
                  handleSave('global_timezone', e.target.value);
                }}
              >
                <MenuItem value="UTC">Coordinated Universal Time (UTC)</MenuItem>
                <MenuItem value="America/New_York">Eastern Time (America/New_York)</MenuItem>
                <MenuItem value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</MenuItem>
                <MenuItem value="Europe/London">Greenwich Mean Time (Europe/London)</MenuItem>
                <MenuItem value="Europe/Paris">Central European Time (Europe/Paris)</MenuItem>
                <MenuItem value="Asia/Tokyo">Japan Standard Time (Asia/Tokyo)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flex: 1, maxWidth: 300, minWidth: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="schedule-display-mode-label">Schedule Display Mode</InputLabel>
              <Select
                labelId="schedule-display-mode-label"
                value={settings.schedule_display_mode || localStorage.getItem('fleet_schedule_display_mode') || 'hybrid'}
                label="Schedule Display Mode"
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(prev => ({ ...prev, schedule_display_mode: val }));
                  localStorage.setItem('fleet_schedule_display_mode', val);
                  handleSave('schedule_display_mode', val);
                }}
              >
                <MenuItem value="hybrid">Plain Text + Cron Badge (Hybrid)</MenuItem>
                <MenuItem value="human_only">Plain Language Only (Hide Cron)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" align="center" gutterBottom>Browser Extension Integration</Typography>
        <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }} color="textSecondary">
          Integrate Voyarr directly with your web browser to dynamically trigger remote downloads while browsing media sites.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          <Box 
            sx={{ 
              p: 3, 
              flex: 1, 
              backgroundColor: 'rgba(99, 102, 241, 0.05)', 
              borderRadius: '16px', 
              border: '1px solid rgba(99, 102, 241, 0.25)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 2 
            }}
          >
            {/* Official Chrome Web Store Listing Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar 
                src="/voyarr-lens.png" 
                alt="Voyarr Lens" 
                variant="rounded"
                sx={{ 
                  width: 54, 
                  height: 54, 
                  borderRadius: '12px', 
                  bgcolor: 'transparent', 
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              />
              <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="h6" sx={{ fontWeight: '800', fontSize: '1.05rem', color: '#ffffff', letterSpacing: '-0.3px' }}>
                    Voyarr Lens
                  </Typography>
                  <Chip label="Chrome Web Store Listing" size="small" color="primary" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  Listing ID: <code>onhleknmoagbflmddadhkkkclodpppgn</code>
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              Official Chrome Web Store extension for Voyarr browser integration and remote media workflows.
            </Typography>

            {/* Official Listing Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1.5, mt: 'auto', pt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<DownloadIcon />}
                href="https://chromewebstore.google.com/detail/onhleknmoagbflmddadhkkkclodpppgn" 
                target="_blank" 
                rel="noopener noreferrer"
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', px: 2.5, height: 40 }}
              >
                Add to Chrome
              </Button>
              <Button 
                variant="outlined" 
                color="inherit" 
                onClick={() => {
                  navigator.clipboard.writeText('https://chromewebstore.google.com/detail/onhleknmoagbflmddadhkkkclodpppgn');
                  setSnackbar({ open: true, message: 'Chrome Web Store URL copied to clipboard!', severity: 'success' });
                }}
                startIcon={<ContentCopyIcon />}
                sx={{ borderRadius: '10px', textTransform: 'none', height: 40, color: 'text.secondary' }}
              >
                Copy Listing URL
              </Button>
            </Box>
          </Box>
          
          <Box 
            sx={{ 
              p: 2.5, 
              flex: 1, 
              backgroundColor: 'rgba(99, 102, 241, 0.05)', 
              borderRadius: '16px', 
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: '800', fontSize: '1.05rem', color: '#ffffff', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25 }}>
              <Avatar src="https://www.google.com/s2/favicons?domain=meta.com&sz=128" alt="Meta Quest" sx={{ width: 28, height: 28, borderRadius: '6px', bgcolor: 'transparent' }} /> Meta Quest &amp; Mobile (Universal Bookmarklet)
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              For VR Headsets (Meta Quest Browser) or mobile devices: Copy the bookmarklet code below, save it as a browser bookmark, and click it on any website to map selectors in 3D Space!
            </Typography>
            {bookmarkletCode ? (
              <Box sx={{ display: 'flex', gap: 1.5, mt: 'auto', pt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  href={bookmarkletCode} 
                  sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', px: 2.5, height: 40 }}
                  onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(bookmarkletCode);
                    setSnackbar({ open: true, message: 'Bookmarklet code copied! Dragging is not supported in all browsers, so paste it as a bookmark URL.', severity: 'success' });
                  }}
                >
                  🎯 Voyarr Lens VR
                </Button>
                <Button 
                  variant="outlined" 
                  color="inherit"
                  onClick={() => {
                    navigator.clipboard.writeText(bookmarkletCode);
                    setSnackbar({ open: true, message: 'Bookmarklet code copied to clipboard!', severity: 'success' });
                  }}
                  sx={{ borderRadius: '10px', textTransform: 'none', height: 40, color: 'text.secondary' }}
                >
                  Copy Bookmarklet
                </Button>
              </Box>
            ) : (
              <Typography variant="body2" color="error">
                Failed to load bookmarklet code. Make sure your Voyarr server is fully updated and running.
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Combined Password Vault Integrations Card */}
      <CredentialManagerIntegration
        settings={settings}
        handleChange={handleChange}
        handleSyncManager={handleSyncManager}
        notify={(message, severity) => setSnackbar({ open: true, message, severity })}
      />

    <Paper elevation={2} sx={{ 
      p: 3, 
      mb: 3, 
      borderRadius: 2
    }}>
        {/* Global Feature Controls */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <TuneIcon color="secondary" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Global Feature Controls</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7, textAlign: 'center' }} color="textSecondary">
            Enable or disable primary features system-wide. Disabling a feature will reject API requests and block access for all users.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 2, justifyContent: 'center', alignItems: 'stretch', width: '100%', mb: 2 }}>
            <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <FormControlLabel
                  control={<Switch checked={settings.streaming_enabled === 'true'} onChange={e => handleToggleSetting('streaming_enabled', e.target.checked)} color="primary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Streaming Features</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Video streaming, HLS and playback capabilities (Default: ON)
                </Typography>
              </Paper>
            </Box>
            <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <FormControlLabel
                  control={<Switch checked={settings.scraping_enabled === 'true'} onChange={e => handleToggleSetting('scraping_enabled', e.target.checked)} color="secondary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Scraping Features</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Dynamic browser metadata scraping & Map Mode (Default: OFF)
                </Typography>
              </Paper>
            </Box>
            <Box sx={{ flex: 1, maxWidth: 350, minWidth: 0 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <FormControlLabel
                  control={<Switch checked={settings.ripping_enabled === 'true'} onChange={e => handleToggleSetting('ripping_enabled', e.target.checked)} color="error" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Ripping Features</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Mass ripping and queue download engines (Default: OFF)
                </Typography>
              </Paper>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3, opacity: 0.2 }} />

        {/* Authentication Policies */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <TuneIcon color="info" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Global Authentication Policies</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7, textAlign: 'center' }} color="textSecondary">
            Control which sign-in methods are available on the login screen. Disabling an option will hide it from users and block API requests.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2, justifyContent: 'center' }}>
            <Grid xs={12} md={4}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <FormControlLabel
                  control={<Switch checked={settings.passkeys_enabled === 'true'} onChange={e => handleToggleSetting('passkeys_enabled', e.target.checked)} color="secondary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Passkey Authentication</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  WebAuthn / FIDO2 passwordless logins
                </Typography>
              </Paper>
            </Grid>
            <Grid xs={12} md={4}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <FormControlLabel
                  control={<Switch checked={settings.sso_enabled === 'true'} onChange={e => handleToggleSetting('sso_enabled', e.target.checked)} color="primary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Single Sign-On (SSO)</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Google, GitHub, Discord providers
                </Typography>
              </Paper>
            </Grid>
            <Grid xs={12} md={4}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <FormControlLabel
                  control={<Switch checked={settings.oidc_enabled === 'true'} onChange={e => handleToggleSetting('oidc_enabled', e.target.checked)} color="primary" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>OpenID Connect (OIDC)</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.5 }} color="textSecondary">
                  Keycloak, Authentik, Azure AD, etc.
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* System Error Log Retention Settings */}
          <Box sx={{
            p: 3, mb: 3, borderRadius: '12px', width: '100%', maxWidth: '600px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#ec4899', mb: 2 }}>
              🛡️ System Error Log Retention & Cleanup
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Grid container spacing={2}>
                <Grid xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="error-log-entries-label">Auto-Clear After X Entries</InputLabel>
                    <Select
                      labelId="error-log-entries-label"
                      label="Auto-Clear After X Entries"
                      value={settings.error_log_max_entries || '1000'}
                      onChange={e => {
                        setSettings(prev => ({ ...prev, error_log_max_entries: e.target.value }));
                        handleSave('error_log_max_entries', e.target.value);
                      }}
                    >
                      <MenuItem value="100">Keep Last 100 Entries</MenuItem>
                      <MenuItem value="500">Keep Last 500 Entries</MenuItem>
                      <MenuItem value="1000">Keep Last 1,000 Entries</MenuItem>
                      <MenuItem value="5000">Keep Last 5,000 Entries</MenuItem>
                      <MenuItem value="0">Never (Keep All Log Entries)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="error-log-days-label">Auto-Clear After X Days</InputLabel>
                    <Select
                      labelId="error-log-days-label"
                      label="Auto-Clear After X Days"
                      value={settings.error_log_max_days || '30'}
                      onChange={e => {
                        setSettings(prev => ({ ...prev, error_log_max_days: e.target.value }));
                        handleSave('error_log_max_days', e.target.value);
                      }}
                    >
                      <MenuItem value="1">Clear Errors Older Than 1 Day</MenuItem>
                      <MenuItem value="7">Clear Errors Older Than 7 Days</MenuItem>
                      <MenuItem value="30">Clear Errors Older Than 30 Days</MenuItem>
                      <MenuItem value="90">Clear Errors Older Than 90 Days</MenuItem>
                      <MenuItem value="0">Never (Keep Errors Indefinitely)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <Typography variant="caption" color="textSecondary">
                  Manually purge all logged system errors from database:
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={async () => {
                    try {
                      const res = await apiFetch('/logs/errors', { method: 'DELETE' });
                      if (res.ok) {
                        setSnackbar({ open: true, message: 'All system error logs cleared immediately!', severity: 'success' });
                      }
                    } catch {
                      setSnackbar({ open: true, message: 'Failed to clear system error logs.', severity: 'error' });
                    }
                  }}
                >
                  Clear Errors Immediately
                </Button>
              </Box>
            </Box>
          </Box>

          {/* Passkeys Configuration Section */}
          {settings.passkeys_enabled === 'true' && (
            <Box sx={{
              p: 3, mb: 3, borderRadius: '12px', width: '100%', maxWidth: '600px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#00e676', mb: 2 }}>
                🔑 Passkey & WebAuthn Customization
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  fullWidth
                  label="Display Name"
                  name="passkeys_rp_name"
                  value={settings.passkeys_rp_name || ''}
                  onChange={handleChange}
                  onBlur={e => handleSave(e.target.name, e.target.value)}
                  helperText="The name shown on your device prompt when logging in."
                />

                <TextField
                  fullWidth
                  label="Website Address Override"
                  name="passkeys_rp_id"
                  value={settings.passkeys_rp_id || ''}
                  onChange={handleChange}
                  onBlur={e => handleSave(e.target.name, e.target.value)}
                  placeholder="e.g. example.com"
                  helperText="Leave blank to automatically detect your domain. Override only if using advanced routing."
                />

                <FormControl fullWidth>
                  <InputLabel id="settings-attachment-label">Allowed Sign-In Devices</InputLabel>
                  <Select
                    labelId="settings-attachment-label"
                    label="Allowed Sign-In Devices"
                    name="passkeys_authenticator_attachment"
                    value={settings.passkeys_authenticator_attachment || 'any'}
                    onChange={e => {
                      setSettings(prev => ({ ...prev, passkeys_authenticator_attachment: e.target.value }));
                      handleSave('passkeys_authenticator_attachment', e.target.value);
                    }}
                  >
                    <MenuItem value="any">Any Device (Recommended)</MenuItem>
                    <MenuItem value="platform">This Device Only (built-in fingerprint/face unlock)</MenuItem>
                    <MenuItem value="cross-platform">Portable Keys Only (USB security keys)</MenuItem>
                  </Select>
                  <FormHelperText>Restrict passkey storage to specific device types.</FormHelperText>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="settings-resident-key-label">Username-Free Sign-In</InputLabel>
                  <Select
                    labelId="settings-resident-key-label"
                    label="Username-Free Sign-In"
                    name="passkeys_resident_key"
                    value={settings.passkeys_resident_key || 'required'}
                    onChange={e => {
                      setSettings(prev => ({ ...prev, passkeys_resident_key: e.target.value }));
                      handleSave('passkeys_resident_key', e.target.value);
                    }}
                  >
                    <MenuItem value="required">Enabled (Recommended)</MenuItem>
                    <MenuItem value="preferred">Preferred</MenuItem>
                    <MenuItem value="discouraged">Disabled (Must type username first)</MenuItem>
                  </Select>
                  <FormHelperText>Permits logging in by scanning fingerprint/face without typing your username first.</FormHelperText>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="settings-verification-label">Require Fingerprint/Face Verification</InputLabel>
                  <Select
                    labelId="settings-verification-label"
                    label="Require Fingerprint/Face Verification"
                    name="passkeys_user_verification"
                    value={settings.passkeys_user_verification || 'preferred'}
                    onChange={e => {
                      setSettings(prev => ({ ...prev, passkeys_user_verification: e.target.value }));
                      handleSave('passkeys_user_verification', e.target.value);
                    }}
                  >
                    <MenuItem value="preferred">Preferred (Recommended)</MenuItem>
                    <MenuItem value="required">Strictly Required</MenuItem>
                    <MenuItem value="discouraged">Not Required</MenuItem>
                  </Select>
                  <FormHelperText>Forces validation of biometrics (fingerprint/face) or PIN code before completing login.</FormHelperText>
                </FormControl>

                <TextField
                  fullWidth
                  type="number"
                  label="Setup Time Limit (seconds)"
                  name="passkeys_timeout"
                  value={settings.passkeys_timeout || '60'}
                  onChange={handleChange}
                  onBlur={e => handleSave(e.target.name, e.target.value)}
                  helperText="Maximum allowed time to complete the scanner verification before it cancels."
                />

                <FormControl fullWidth>
                  <InputLabel id="settings-attestation-label">Security Device Verification</InputLabel>
                  <Select
                    labelId="settings-attestation-label"
                    label="Security Device Verification"
                    name="passkeys_attestation"
                    value={settings.passkeys_attestation || 'none'}
                    onChange={e => {
                      setSettings(prev => ({ ...prev, passkeys_attestation: e.target.value }));
                      handleSave('passkeys_attestation', e.target.value);
                    }}
                  >
                    <MenuItem value="none">Do Not Collect (Recommended)</MenuItem>
                    <MenuItem value="indirect">Collect Indirectly</MenuItem>
                    <MenuItem value="direct">Collect Directly</MenuItem>
                  </Select>
                  <FormHelperText>Verifies the authenticity of the physical hardware key against manufacturer databases.</FormHelperText>
                </FormControl>
              </Box>
            </Box>
          )}

          {/* SSO Notice */}
          {settings.sso_enabled === 'true' && (
            <Box sx={{
              p: 2, mb: 2, borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(63, 81, 181, 0.08) 0%, rgba(156, 39, 176, 0.05) 100%)',
              border: '1px solid rgba(63, 81, 181, 0.2)'
            }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#7c8dff', display: 'block', mb: 0.5 }}>ℹ️ SSO Configuration Required</Typography>
              <Typography variant="caption" component="div" sx={{ opacity: 0.8, lineHeight: 1.8 }} color="textSecondary">
                To enable SSO providers, configure the following environment variables in your host <code>.env</code> file and restart the backend:
                <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                  <li><code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> — from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" style={{ color: '#7c8dff' }}>Google Cloud Console <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} /></a></li>
                  <li><code>GITHUB_CLIENT_ID</code> / <code>GITHUB_CLIENT_SECRET</code> — from <a href="https://github.com/settings/developers" target="_blank" rel="noopener" style={{ color: '#7c8dff' }}>GitHub Developer Settings <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} /></a></li>
                  <li><code>DISCORD_CLIENT_ID</code> / <code>DISCORD_CLIENT_SECRET</code> — from <a href="https://discord.com/developers/applications" target="_blank" rel="noopener" style={{ color: '#7c8dff' }}>Discord Developer Portal <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} /></a></li>
                </Box>
              </Typography>
            </Box>
          )}

          {/* OIDC Notice */}
          {settings.oidc_enabled === 'true' && (
            <Box sx={{
              p: 2, mb: 2, borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.08) 0%, rgba(255, 87, 34, 0.05) 100%)',
              border: '1px solid rgba(255, 152, 0, 0.2)'
            }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#ffb74d', display: 'block', mb: 0.5 }}>ℹ️ OIDC Configuration Required</Typography>
              <Typography variant="caption" component="div" sx={{ opacity: 0.8, lineHeight: 1.8 }} color="textSecondary">
                Configure these environment variables in your host <code>.env</code> file:
                <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                  <li><code>OIDC_CLIENT_ID</code> — The client ID from your identity provider</li>
                  <li><code>OIDC_CLIENT_SECRET</code> — The client secret from your identity provider</li>
                  <li><code>OIDC_DISCOVERY_URL</code> — The OpenID Connect discovery endpoint (e.g., <code>https://auth.example.com/.well-known/openid-configuration</code>)</li>
                </Box>
                <Box sx={{ mt: 1 }}>
                  Set the <strong>Callback/Redirect URI</strong> in your identity provider to: <code>{`${window.location.protocol}//${window.location.hostname}:8000/auth/oidc/callback`}</code>
                </Box>
                <Box sx={{ mt: 1 }}>
                  Compatible with: Keycloak, Authentik, Authelia, Azure AD / Entra ID, Okta, Google Workspace, and any OpenID Connect compliant provider.
                </Box>
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 3, opacity: 0.2 }} />

        {/* Automatic Authentication Bypass (Autologin) */}
        <Box sx={{ p: 3, borderRadius: '12px', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <LanIcon color="warning" />
            <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>Automatic Authentication Bypass</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7, textAlign: 'center' }} color="textSecondary">
            Allow users to skip the login screen entirely when connecting from a trusted network or through a trusted reverse proxy.
          </Typography>

          {(settings.auth_bypass_enabled === 'true' || settings.auth_bypass_proxy_header_enabled === 'true') && (
            <Box sx={{
              p: 2, mb: 3, borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.12) 0%, rgba(244, 67, 54, 0.08) 100%)',
              border: '1px solid rgba(255, 152, 0, 0.2)',
              display: 'flex', alignItems: 'flex-start', gap: 1.5
            }}>
              <WarningAmberIcon sx={{ color: '#ff9800', mt: 0.2 }} />
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#ff9800', display: 'block', mb: 0.5 }}>⚠️ Security Warning</Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, lineHeight: 1.6 }} color="textSecondary">
                  Authentication bypass should only be enabled on isolated, private networks. If you are exposing Voyarr to the internet, ensure your reverse proxy strips any spoofed authentication headers from external requests. Misconfigured bypass settings can allow unauthorized access.
                </Typography>
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'stretch', width: '100%' }}>
            {/* Trusted Subnet Bypass */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <FormControlLabel
                  control={<Switch checked={settings.auth_bypass_enabled === 'true'} onChange={e => handleToggleSetting('auth_bypass_enabled', e.target.checked)} color="warning" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Trusted Subnet Bypass</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mb: 2, opacity: 0.5 }} color="textSecondary">
                  Auto-login when connecting from a trusted IP range (e.g., your home LAN).
                </Typography>

                {settings.auth_bypass_enabled === 'true' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                      size="small"
                      label="Trusted Subnets (comma-separated)"
                      placeholder="127.0.0.1, 192.168.1.0/24, 10.0.0.0/8"
                      value={settings.auth_bypass_subnets}
                      onChange={e => setSettings(prev => ({ ...prev, auth_bypass_subnets: e.target.value }))}
                      onBlur={() => handleSave('auth_bypass_subnets', settings.auth_bypass_subnets)}
                      helperText="IPv4/IPv6 addresses or CIDR notation"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                    />
                    <TextField
                      size="small"
                      label="Default Auto-Login Username"
                      placeholder="e.g. local_viewer"
                      value={settings.auth_bypass_default_user}
                      onChange={e => setSettings(prev => ({ ...prev, auth_bypass_default_user: e.target.value }))}
                      onBlur={() => handleSave('auth_bypass_default_user', settings.auth_bypass_default_user)}
                      helperText="The user account to sign in as automatically"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                    />
                  </Box>
                )}
              </Paper>
            </Box>

            {/* Reverse Proxy Header Trust */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <FormControlLabel
                  control={<Switch checked={settings.auth_bypass_proxy_header_enabled === 'true'} onChange={e => handleToggleSetting('auth_bypass_proxy_header_enabled', e.target.checked)} color="warning" />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Reverse Proxy Header Trust</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', mb: 2, opacity: 0.5 }} color="textSecondary">
                  Trust an HTTP header set by your reverse proxy (Authelia, Authentik, Cloudflare Access) to auto-login.
                </Typography>

                {settings.auth_bypass_proxy_header_enabled === 'true' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                      size="small"
                      label="Trusted Header Name"
                      placeholder="Remote-User"
                      value={settings.auth_bypass_proxy_header_name}
                      onChange={e => setSettings(prev => ({ ...prev, auth_bypass_proxy_header_name: e.target.value }))}
                      onBlur={() => handleSave('auth_bypass_proxy_header_name', settings.auth_bypass_proxy_header_name)}
                      helperText="Common headers: Remote-User, X-Webauth-User, X-Forwarded-User"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                    />
                    <Typography variant="caption" sx={{ opacity: 0.6, lineHeight: 1.5 }} color="textSecondary">
                      If the specified user does not exist, a new account will be auto-provisioned with the "user" role.
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Box>
          </Box>
        </Box>
      </Paper>
      </>
      )}

      {/* Sidebar Visibility Section */}
      <GlassCard sx={{ mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ p: 1, borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: '#fff', display: 'flex' }}>
            <TuneIcon fontSize="small" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: '700' }}>Sidebar Navigation Visibility</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Choose which pages appear in the sidebar. Hidden pages remain accessible via URL or through their parent page.
        </Typography>

        {[
          { group: 'Media Hub', items: [
            ['showDashboard','Dashboard'],['showLibrary','Library'],['showSearch','Universal Search'],
            ['showFavorites','Favorites'],['showLive','Live Streams'],
          ]},
          { group: 'Operations & Queues', items: [
            ['showDownloads','Download Queue'],['showTranscode','Transcode Queue'],['showMassRip','Mass Ripper'],
            ['showSubscriptions','Subscriptions'],['showSchedules','Schedules'],
          ]},
          { group: 'Metadata & Intelligence', items: [
            ['showProviders','Providers'],['showScraperTester','Scraper Tester'],['showBillers','Billers'],
            ['showPerformers','Performers'],['showTags','Tags'],['showStudios','Studios'],['showMetadata','Metadata Manager'],
          ]},
          { group: 'System Administration', items: [
            ['showUserManagement','User Management'],['showAccountSecurity','Account Security'],
            ['showP2P','P2P Sync'],['showBackup','Backup Manager'],['showLogs','System Logs'],
            ['showStatus','System Status'],['showSettings','Settings'],['showHelp','Help & Docs'],
          ]},
        ].map(section => (
          <Box key={section.group} sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1, fontSize: '0.65rem' }}>
              {section.group}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {section.items.map(([key, label]) => (
                <Chip
                  key={key}
                  label={label}
                  variant={uiConfig[key] !== false ? 'filled' : 'outlined'}
                  color={uiConfig[key] !== false ? 'primary' : 'default'}
                  onClick={() => {
                    const newVal = uiConfig[key] === false
                    apiFetch('/user/stats/preferences', {
                      method: 'POST',
                      body: JSON.stringify({ theme: themeName, ui_config: { ...uiConfig, [key]: newVal } })
                    }).catch(() => {})
                    setUiConfig(prev => ({ ...prev, [key]: newVal }))
                  }}
                  onDelete={uiConfig[key] !== false ? () => {
                    apiFetch('/user/stats/preferences', {
                      method: 'POST',
                      body: JSON.stringify({ theme: themeName, ui_config: { ...uiConfig, [key]: false } })
                    }).catch(() => {})
                    setUiConfig(prev => ({ ...prev, [key]: false }))
                  } : undefined}
                  size="small"
                  sx={{ borderRadius: '8px', fontWeight: 600, fontSize: '0.72rem' }}
                />
              ))}
            </Box>
          </Box>
        ))}
      </GlassCard>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>

    </Box>
  )
}