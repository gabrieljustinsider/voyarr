import { useState, useEffect } from 'react'
import {
  Box, Typography, TextField, Button, Paper, Grid, Divider, Tooltip, Chip,
  Avatar, Autocomplete, InputAdornment, CircularProgress, IconButton, Stack
} from '@mui/material'
import HelpIcon from '@mui/icons-material/Help'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import SaveIcon from '@mui/icons-material/Save'
import LockIcon from '@mui/icons-material/Lock'
import ShieldIcon from '@mui/icons-material/Shield'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { apiFetch } from '../api'

const STORAGE_KEY = 'voyarr_credential_managers'

const HelpChip = ({ help, color, accent }) => (
  <Tooltip title={help} arrow placement="top">
    <Chip
      icon={<HelpIcon sx={{ fontSize: '14px !important', color: `${accent} !important` }} />}
      label="Help"
      size="small"
      clickable
      sx={{
        height: 20,
        fontSize: '0.68rem',
        fontWeight: '700',
        bgcolor: `rgba(${color}, 0.12)`,
        color: accent,
        border: `1px solid rgba(${color}, 0.25)`,
        backdropFilter: 'blur(8px)',
        '&:hover': { bgcolor: `rgba(${color}, 0.25)` }
      }}
    />
  </Tooltip>
)

const FieldLabel = ({ label, help, color, accent }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
    <Typography variant="caption" sx={{ fontWeight: '700', color: '#cbd5e1', ml: 0.5, letterSpacing: '0.02em' }}>
      {label}
    </Typography>
    <HelpChip help={help} color={color} accent={accent} />
  </Box>
)

const HelpField = ({ field, value, onChange, accent, color }) => (
  <Box sx={{ mb: 1.5 }}>
    <FieldLabel label={field.label} help={field.help} color={color} accent={accent} />
    <TextField
      fullWidth
      size="small"
      name={field.name}
      type={field.type || 'text'}
      autoComplete={field.type === 'password' ? 'new-password' : undefined}
      placeholder={field.placeholder}
      value={value || ''}
      onChange={onChange}
      helperText={field.helperText}
      FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', ml: 0.5 } }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          transition: 'all 0.2s ease-in-out',
          color: '#f8fafc',
          fontSize: '0.85rem',
          '&:hover': {
            borderColor: `rgba(${color}, 0.4)`,
            backgroundColor: 'rgba(0, 0, 0, 0.35)'
          },
          '&.Mui-focused': {
            borderColor: accent,
            boxShadow: `0 0 0 3px rgba(${color}, 0.15)`,
            backgroundColor: 'rgba(0, 0, 0, 0.4)'
          }
        }
      }}
    />
  </Box>
)

const selectFieldSx = (color, accent) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    transition: 'all 0.2s ease-in-out',
    color: '#f8fafc',
    fontSize: '0.85rem',
    '&:hover': {
      borderColor: `rgba(${color}, 0.4)`,
      backgroundColor: 'rgba(0, 0, 0, 0.35)'
    },
    '&.Mui-focused': {
      borderColor: accent,
      boxShadow: `0 0 0 3px rgba(${color}, 0.15)`,
      backgroundColor: 'rgba(0, 0, 0, 0.4)'
    }
  }
})

const SelectField = ({ field, items, loading, error, value, onChange, accent, color }) => {
  if (loading || items.length === 0) {
    return (
      <Box sx={{ mb: 1.5 }}>
        <FieldLabel label={field.label} help={field.help} color={color} accent={accent} />
        <TextField
          size="small"
          name={field.name}
          placeholder={field.placeholder}
          value={value || ''}
          onChange={onChange}
          error={!!error}
          helperText={loading ? field.loadingText : (error || field.emptyText)}
          FormHelperTextProps={{ sx: { color: error ? '#f87171' : 'rgba(255,255,255,0.4)', fontSize: '0.72rem', ml: 0.5 } }}
          slotProps={{
            input: {
              endAdornment: loading ? (
                <InputAdornment position="end">
                  <CircularProgress color="inherit" size={16} sx={{ mr: 1, color: accent }} />
                </InputAdornment>
              ) : null
            }
          }}
          sx={selectFieldSx(color, accent)}
        />
      </Box>
    )
  }

  return (
    <Box sx={{ mb: 1.5 }}>
      <FieldLabel label={field.label} help={field.help} color={color} accent={accent} />
      <Autocomplete
        freeSolo
        size="small"
        options={items}
        getOptionLabel={(option) => typeof option === 'string' ? option : option.id || ''}
        value={value || ''}
        onChange={(e, newValue) => {
          const val = typeof newValue === 'object' && newValue !== null ? newValue.id : newValue
          onChange({ target: { name: field.name, value: val || '' } })
        }}
        onInputChange={(e, newInputValue) => {
          onChange({ target: { name: field.name, value: newInputValue || '' } })
        }}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props
          return (
            <Box component="li" key={key || option.id} {...optionProps} sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>{option.name}</Typography>
              <Typography variant="caption" sx={{ ml: 1, fontFamily: 'monospace', color: accent, bgcolor: `rgba(${color}, 0.12)`, px: 1, py: 0.2, borderRadius: '6px' }}>
                {option.id}
              </Typography>
            </Box>
          )
        }}
        renderInput={(params) => {
          const { slotProps: { input: inputProps } = {}, ...restParams } = params
          return (
            <TextField
              {...restParams}
              name={field.name}
              placeholder={field.placeholder}
              error={!!error}
              helperText={error || field.foundText(items.length)}
              FormHelperTextProps={{ sx: { color: error ? '#f87171' : 'rgba(255,255,255,0.4)', fontSize: '0.72rem', ml: 0.5 } }}
              slotProps={{
                input: {
                  ...inputProps,
                  endAdornment: (
                    <InputAdornment position="end">
                      {inputProps?.endAdornment}
                    </InputAdornment>
                  )
                }
              }}
              sx={selectFieldSx(color, accent)}
            />
          )
        }}
      />
    </Box>
  )
}

/**
 * Registry of supported credential managers.
 */
const MANAGERS = [
  {
    key: '1password',
    label: '1Password Connect',
    favicon: '1password.com',
    syncProvider: '1password',
    accent: '#818cf8',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
    border: 'rgba(99, 102, 241, 0.25)',
    color: '99, 102, 241',
    channelText: '#6ee7b7',
    loadItems: async () => {
      const res = await apiFetch('/settings/op/vaults')
      if (!res.ok) {
        let detail = ''
        try { detail = (await res.json())?.detail || '' } catch { /* ignore */ }
        throw new Error(detail || `Server returned ${res.status}`)
      }
      const data = await res.json()
      const list = Array.isArray(data?.vaults) ? data.vaults : []
      return list.map(v => ({ id: v.id, name: v.name || v.id, label: `${v.name || v.id} (${v.id})` }))
    },
    fields: [
      {
        kind: 'help', name: 'op_connect_host', label: '1Password Connect Host',
        placeholder: 'e.g. http://localhost:8080 or https://connect.mycompany.com',
        helperText: 'Deploy via 1Password Connect Docker or Kubernetes.',
        help: 'The URL of your running 1Password Connect API server (e.g. http://localhost:8080). Deploy via 1Password Connect Docker or Kubernetes.'
      },
      {
        kind: 'help', name: 'op_connect_token', label: '1Password Connect Token', type: 'password',
        placeholder: 'Generated API Access Token',
        helperText: 'Generate in 1Password.com -> Developer Settings',
        help: 'Your 1Password Connect API Access Token. Generate this in 1Password.com -> Developer Settings -> Connect Services -> Create Access Token.'
      },
      {
        kind: 'select', name: 'op_vault_id', label: '1Password Vault ID',
        placeholder: 'Select or paste 26-character Vault ID',
        loadingText: 'Loading account vaults...',
        emptyText: 'The 26-character ID of vault to sync with.',
        foundText: (n) => `Select or type vault ID (${n} vaults found)`,
        help: 'The 26-character unique ID of your 1Password vault. Search and select from the dropdown when host & token are valid, or paste manually.'
      }
    ],
    saveKeys: ['op_connect_host', 'op_connect_token', 'op_vault_id']
  },
  {
    key: 'bitwarden',
    label: 'Bitwarden / Vaultwarden',
    favicon: 'bitwarden.com',
    syncProvider: 'bitwarden',
    accent: '#34d399',
    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
    border: 'rgba(16, 185, 129, 0.25)',
    color: '16, 185, 129',
    channelText: '#6ee7b7',
    loadItems: async (host, token) => {
      const cleanHost = host.replace(/\/$/, '')
      const res = await fetch(`${cleanHost}/object/folder?session=${encodeURIComponent(token)}`)
      const data = await res.json()
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      return list.map(f => ({ id: f.id, name: f.name || f.id, label: `${f.name || f.id} (${f.id})` }))
    },
    fields: [
      {
        kind: 'help', name: 'bw_connect_host', label: 'Bitwarden Serve Host',
        placeholder: "e.g. http://localhost:8087 ('bw serve')",
        helperText: "Bitwarden CLI REST server running 'bw serve'.",
        help: "The URL of your Bitwarden CLI REST server running 'bw serve' (e.g. http://localhost:8087)."
      },
      {
        kind: 'help', name: 'bw_session_token', label: 'Bitwarden Session Token', type: 'password',
        placeholder: "BW_SESSION token from 'bw unlock'",
        helperText: "Session token from 'bw unlock'",
        help: "The BW_SESSION environment token generated upon unlocking your vault via Bitwarden CLI ('bw unlock') or Vaultwarden API."
      },
      {
        kind: 'select', name: 'bw_folder_id', label: 'Bitwarden Folder ID',
        placeholder: 'Select or paste Folder UUID',
        loadingText: 'Loading folders...',
        emptyText: 'Optional: The UUID of folder to sync with.',
        foundText: (n) => `Select or type folder ID (${n} folders found)`,
        help: 'Optional: The UUID of a specific folder in your Bitwarden vault. Search and select from dropdown when active, or paste UUID manually.'
      }
    ],
    saveKeys: ['bw_connect_host', 'bw_session_token', 'bw_folder_id']
  }
]

const readStored = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
}
const writeStored = (list) => localStorage.setItem(STORAGE_KEY, JSON.stringify(list))

const hostOf = (m) => m.fields.find(f => f.kind === 'help')
const tokenOf = (m) => m.fields.filter(f => f.kind === 'help')[1]
const selectOf = (m) => m.fields.find(f => f.kind === 'select')

export default function CredentialManagerIntegration({ settings, handleChange, notify, handleSyncManager }) {
  const [added, setAdded] = useState(readStored)
  const [itemsMap, setItemsMap] = useState({})
  const [loadingMap, setLoadingMap] = useState({})
  const [errorMap, setErrorMap] = useState({})
  const [syncingMap, setSyncingMap] = useState({})

  const visible = useManagerList(added, settings)
  const available = MANAGERS.filter(m => !visible.includes(m.key))

  useEffect(() => {
    visible.forEach((key) => {
      const manager = MANAGERS.find(m => m.key === key)
      if (!manager) return
      const host = settings[hostOf(manager).name]
      const token = settings[tokenOf(manager).name]
      if (!host || !token) { setItemsMap(p => ({ ...p, [key]: [] })); return }
      setLoadingMap(p => ({ ...p, [key]: true }))
      setErrorMap(p => ({ ...p, [key]: null }))
      manager.loadItems(host, token)
        .then((items) => setItemsMap(p => ({ ...p, [key]: items })))
        .catch(() => { setItemsMap(p => ({ ...p, [key]: [] })); setErrorMap(p => ({ ...p, [key]: `Couldn't reach ${manager.label}. Check the host and token.` })) })
        .finally(() => setLoadingMap(p => ({ ...p, [key]: false })))
    })
  }, [visible.join('|'), JSON.stringify([settings.op_connect_host, settings.op_connect_token, settings.bw_connect_host, settings.bw_session_token])])

  const addManager = (key) => {
    const next = [...new Set([...added, key])]
    setAdded(next)
    writeStored(next)
  }

  const removeManager = (manager) => {
    const next = added.filter(k => k !== manager.key)
    setAdded(next)
    writeStored(next)
    Promise.all(manager.saveKeys.map(k =>
      apiFetch('/settings', { method: 'POST', body: JSON.stringify({ key: k, value: '' }) })
    )).then(results => {
      if (results.every(r => r.ok)) notify(`${manager.label} removed.`, 'success')
      else notify(`Failed to fully clear ${manager.label} settings.`, 'warning')
    }).catch(() => notify(`Failed to clear ${manager.label} settings.`, 'error'))
  }

  const saveManager = (manager) => {
    Promise.all(manager.saveKeys.map(k =>
      apiFetch('/settings', { method: 'POST', body: JSON.stringify({ key: k, value: String(settings[k] ?? '') }) })
    )).then(results => {
      if (results.every(r => r.ok)) notify(`${manager.label} settings saved successfully!`, 'success')
      else notify(`Some ${manager.label} settings failed to save.`, 'warning')
    }).catch(() => notify(`Failed to save ${manager.label} settings.`, 'error'))
  }

  const triggerSync = (manager, direction) => {
    setSyncingMap(p => ({ ...p, [`${manager.key}_${direction}`]: true }))
    Promise.resolve(handleSyncManager(manager.syncProvider, direction))
      .finally(() => setSyncingMap(p => ({ ...p, [`${manager.key}_${direction}`]: false })))
  }

  return (
    <Paper sx={{
      p: { xs: 2.5, md: 4 },
      mb: 4,
      borderRadius: '24px',
      background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.75) 0%, rgba(2, 6, 23, 0.85) 100%)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative Glow Ambient Element */}
      <Box sx={{
        position: 'absolute',
        top: -100,
        right: -100,
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(0,0,0,0) 70%)',
        pointerEvents: 'none'
      }} />

      <Box sx={{ textAlign: 'center', mb: 3, position: 'relative', zIndex: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ mb: 1 }}>
          <Box sx={{ p: 1, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <ShieldIcon sx={{ color: '#818cf8', fontSize: 24 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: '900', color: '#f8fafc', letterSpacing: '-0.02em' }}>
            Password Vault Integrations
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 650, mx: 'auto', lineHeight: 1.6 }}>
          Securely synchronize Voyarr application credentials, tokens, and storage secrets directly with enterprise password managers (1Password Connect or Bitwarden / Vaultwarden CLI server).
        </Typography>
      </Box>

      <Divider sx={{ mb: 4, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      {available.length > 0 && (
        <Box sx={{ mb: visible.length > 0 ? 4 : 0 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: '600', textAlign: 'center', mb: 2 }}>
            {visible.length === 0 ? 'Select a credential manager to begin' : 'Add another credential manager'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
            {available.map((option) => (
              <Box
                key={option.key}
                component="button"
                type="button"
                onClick={() => addManager(option.key)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 2.25,
                  py: 1.25,
                  borderRadius: '14px',
                  cursor: 'pointer',
                  appearance: 'none',
                  userSelect: 'none',
                  lineHeight: 1,
                  background: `linear-gradient(135deg, rgba(${option.color}, 0.12) 0%, rgba(0, 0, 0, 0.3) 100%)`,
                  border: `1px solid ${option.border}`,
                  color: '#f8fafc',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: option.accent,
                    boxShadow: `0 4px 18px rgba(${option.color}, 0.25)`,
                    transform: 'translateY(-1px)'
                  },
                  '&:focus-visible': {
                    outline: '2px solid ' + option.accent,
                    outlineOffset: '2px'
                  }
                }}
              >
                <Avatar src={`https://www.google.com/s2/favicons?domain=${option.favicon}&sz=128`} alt={option.label} sx={{ width: 22, height: 22, borderRadius: '6px', bgcolor: 'transparent' }} />
                {option.label}
                <AddIcon sx={{ fontSize: 16, color: option.accent }} />
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {visible.length > 0 && (
        <Grid container spacing={3} justifyContent="center" sx={{ maxWidth: 1100, mx: 'auto' }}>
          {visible.map((key) => {
            const manager = MANAGERS.find(m => m.key === key)
            if (!manager) return null
            const hostField = hostOf(manager)
            const tokenField = tokenOf(manager)
            const selectField = selectOf(manager)
            const hostConfigured = !!(settings[hostField.name] && settings[tokenField.name])
            const isError = !!errorMap[key]

            return (
              <Grid item xs={12} md={visible.length === 1 ? 12 : 6} key={key}>
                <Box sx={{
                  p: { xs: 2.5, sm: 3 },
                  borderRadius: '20px',
                  position: 'relative',
                  background: manager.background,
                  border: `1px solid ${manager.border}`,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  height: '100%',
                  transition: 'transform 0.3s ease, border-color 0.3s ease',
                  '&:hover': {
                    borderColor: manager.accent
                  }
                }}>
                  {/* Remove Manager Button */}
                  <IconButton
                    size="small"
                    onClick={() => removeManager(manager)}
                    sx={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      color: 'rgba(255,255,255,0.4)',
                      bgcolor: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.15)' }
                    }}
                    title={`Remove ${manager.label}`}
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>

                  {/* Header Row */}
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pr: 4 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: '800', color: manager.accent, display: 'flex', alignItems: 'center', gap: 1.25, fontSize: '1.05rem' }}>
                      <Avatar src={`https://www.google.com/s2/favicons?domain=${manager.favicon}&sz=128`} alt={manager.label} sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: 'transparent' }} />
                      {manager.label}
                    </Typography>
                    <Chip
                      icon={hostConfigured ? <CheckCircleIcon sx={{ fontSize: '14px !important', color: '#34d399 !important' }} /> : <ErrorIcon sx={{ fontSize: '14px !important', color: '#cbd5e1 !important' }} />}
                      label={hostConfigured ? (isError ? 'Error' : 'Connected') : 'Setup required'}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.68rem',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        bgcolor: hostConfigured ? (isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)') : 'rgba(255,255,255,0.05)',
                        color: hostConfigured ? (isError ? '#f87171' : '#34d399') : '#94a3b8',
                        border: `1px solid ${hostConfigured ? (isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)') : 'rgba(255,255,255,0.1)'}`
                      }}
                    />
                  </Stack>

                  <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)', my: 0.5 }} />

                  {/* Input Fields */}
                  <HelpField field={hostField} value={settings[hostField.name]} onChange={handleChange} accent={manager.accent} color={manager.color} />
                  <HelpField field={tokenField} value={settings[tokenField.name]} onChange={handleChange} accent={manager.accent} color={manager.color} />
                  <SelectField
                    field={selectField}
                    items={itemsMap[key] || []}
                    loading={loadingMap[key]}
                    error={errorMap[key]}
                    value={settings[selectField.name]}
                    onChange={handleChange}
                    accent={manager.accent}
                    color={manager.color}
                  />

                  {/* Action Bar */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    mt: 'auto',
                    pt: 2,
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SaveIcon />}
                      onClick={() => saveManager(manager)}
                      sx={{
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontWeight: '800',
                        py: 1,
                        bgcolor: manager.accent,
                        color: '#0f172a',
                        boxShadow: `0 4px 14px rgba(${manager.color}, 0.3)`,
                        '&:hover': {
                          bgcolor: manager.accent,
                          filter: 'brightness(1.1)'
                        }
                      }}
                    >
                      Save {manager.label} Settings
                    </Button>

                    <Stack direction="row" spacing={1.5} justifyContent="center">
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={!hostConfigured || syncingMap[`${manager.key}_push`]}
                        startIcon={syncingMap[`${manager.key}_push`] ? <CircularProgress size={14} color="inherit" /> : <CloudUploadIcon sx={{ fontSize: 16 }} />}
                        onClick={() => triggerSync(manager, 'push')}
                        sx={{
                          flex: 1,
                          borderRadius: '10px',
                          textTransform: 'none',
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          color: '#f8fafc',
                          borderColor: 'rgba(255,255,255,0.15)',
                          bgcolor: 'rgba(255,255,255,0.03)',
                          '&:hover': {
                            borderColor: manager.accent,
                            bgcolor: `rgba(${manager.color}, 0.1)`
                          }
                        }}
                      >
                        Push to Vault
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={!hostConfigured || syncingMap[`${manager.key}_pull`]}
                        startIcon={syncingMap[`${manager.key}_pull`] ? <CircularProgress size={14} color="inherit" /> : <CloudDownloadIcon sx={{ fontSize: 16 }} />}
                        onClick={() => triggerSync(manager, 'pull')}
                        sx={{
                          flex: 1,
                          borderRadius: '10px',
                          textTransform: 'none',
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          color: '#f8fafc',
                          borderColor: 'rgba(255,255,255,0.15)',
                          bgcolor: 'rgba(255,255,255,0.03)',
                          '&:hover': {
                            borderColor: manager.accent,
                            bgcolor: `rgba(${manager.color}, 0.1)`
                          }
                        }}
                      >
                        Pull from Vault
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              </Grid>
            )
          })}
        </Grid>
      )}

      {visible.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <LockIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
          <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: '500' }}>
            No password managers configured yet. Select a credential manager above to begin.
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

function useManagerList(added, settings) {
  const configured = MANAGERS.filter(m =>
    settings[hostOf(m).name] || settings[tokenOf(m).name]
  ).map(m => m.key)
  return [...new Set([...added, ...configured])]
}