import { useState, useEffect } from 'react'
import {
  Box, Typography, TextField, Button, Paper, Grid, Divider, Tooltip, Chip,
  Avatar, Autocomplete, InputAdornment, CircularProgress, IconButton, Stack
} from '@mui/material'
import HelpIcon from '@mui/icons-material/Help'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
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
        fontWeight: 'bold',
        bgcolor: `rgba(${color}, 0.15)`,
        color: '#a5b4fc',
        border: `1px solid rgba(${color}, 0.35)`,
        '&:hover': { bgcolor: `rgba(${color}, 0.3)` }
      }}
    />
  </Tooltip>
)

const FieldLabel = ({ label, help, color, accent }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
    <Typography variant="caption" sx={{ fontWeight: '700', color: '#cbd5e1', ml: 0.5 }}>
      {label}
    </Typography>
    <HelpChip help={help} color={color} accent={accent} />
  </Box>
)

const HelpField = ({ field, value, onChange }) => (
  <Box>
    <FieldLabel label={field.label} help={field.help} color={field.color} accent={field.accent} />
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
      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
    />
  </Box>
)

const SelectField = ({ field, items, loading, error, value, onChange }) => (
  <Box>
    <FieldLabel label={field.label} help={field.help} color={field.color} accent={field.accent} />
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
          <Box component="li" key={key || option.id} {...optionProps} sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{option.name}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontFamily: 'monospace' }}>({option.id})</Typography>
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
            helperText={loading ? field.loadingText : (error || (items.length > 0 ? field.foundText(items.length) : field.emptyText))}
            slotProps={{
              input: {
                ...inputProps,
                endAdornment: (
                  <InputAdornment position="end">
                    {loading ? <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} /> : null}
                    {inputProps?.endAdornment}
                  </InputAdornment>
                )
              }
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        )
      }}
    />
  </Box>
)

/**
 * Registry of supported credential managers. Each entry is fully data-driven so
 * adding a new manager requires only one new entry here (fields, colors, loaders,
 * sync provider, save keys).
 */
const MANAGERS = [
  {
    key: '1password',
    label: '1Password Connect',
    favicon: '1password.com',
    syncProvider: '1password',
    accent: '#818cf8',
    background: 'rgba(99, 102, 241, 0.04)',
    border: 'rgba(99, 102, 241, 0.18)',
    color: '99, 102, 241',
    channelText: '#6ee7b7',
    loadItems: async () => {
      const res = await apiFetch('/settings/op/vaults')
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
    background: 'rgba(16, 185, 129, 0.04)',
    border: 'rgba(16, 185, 129, 0.18)',
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
  const [selectValue, setSelectValue] = useState(null)

  // A manager card is shown if explicitly added OR already configured via settings.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (results.every(r => r.ok)) notify(`${manager.label} settings saved!`, 'success')
      else notify(`Some ${manager.label} settings failed to save.`, 'warning')
    }).catch(() => notify(`Failed to save ${manager.label} settings.`, 'error'))
  }

  return (
    <Paper sx={{
      p: 3, mb: 3, borderRadius: '16px',
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
    }}>
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: '700' }}>Password Vault Integrations</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Securely sync Voyarr credentials with external password managers (1Password Connect or Bitwarden / Vaultwarden CLI server).
        </Typography>
      </Box>
      <Divider sx={{ mb: 3, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      {available.length > 0 && (
        <Box sx={{ mb: visible.length > 0 ? 3 : 0 }}>
          <Autocomplete
            size="small"
            options={available}
            getOptionLabel={(o) => o.label}
            value={selectValue}
            onChange={(e, val) => { if (val) { addManager(val.key); setSelectValue(null) } }}
            renderOption={(props, option) => {
              const { key, ...optionProps } = props
              return (
                <Box component="li" key={key || option.key} {...optionProps} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  <Avatar src={`https://www.google.com/s2/favicons?domain=${option.favicon}&sz=128`} alt={option.label} sx={{ width: 24, height: 24, borderRadius: '6px', bgcolor: 'transparent' }} />
                  <Typography variant="body2">{option.label}</Typography>
                </Box>
              )
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Add a credential manager"
                placeholder="Search for 1Password, Bitwarden..."
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
            )}
          />
        </Box>
      )}

      {visible.length > 0 && (
        <Grid container spacing={3} justifyContent="center" sx={{ maxWidth: 1000, mx: 'auto' }}>
          {visible.map((key) => {
            const manager = MANAGERS.find(m => m.key === key)
            if (!manager) return null
            const hostField = hostOf(manager)
            const tokenField = tokenOf(manager)
            const selectField = selectOf(manager)
            const hostConfigured = !!(settings[hostField.name] && settings[tokenField.name])
            return (
              <Grid item xs={12} md={visible.length === 1 ? 12 : 6} key={key}>
                <Box sx={{
                  p: 2.5, borderRadius: '14px',
                  position: 'relative',
                  background: manager.background,
                  border: `1px solid ${manager.border}`,
                  display: 'flex', flexDirection: 'column', gap: 2, height: '100%'
                }}>
                  <IconButton
                    size="small"
                    onClick={() => removeManager(manager)}
                    sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ef4444' } }}
                    title={`Remove ${manager.label}`}
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>

                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: manager.accent, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={`https://www.google.com/s2/favicons?domain=${manager.favicon}&sz=128`} alt={manager.label} sx={{ width: 26, height: 26, borderRadius: '6px', bgcolor: 'transparent' }} /> {manager.label}
                    </Typography>
                    <Chip
                      label={hostConfigured ? 'Connected' : 'Setup required'}
                      size="small"
                      color={hostConfigured ? 'success' : 'default'}
                      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }}
                    />
                  </Stack>

                  <HelpField field={hostField} value={settings[hostField.name]} onChange={handleChange} />
                  <HelpField field={tokenField} value={settings[tokenField.name]} onChange={handleChange} />
                  <SelectField
                    field={selectField}
                    items={itemsMap[key] || []}
                    loading={loadingMap[key]}
                    error={errorMap[key]}
                    value={settings[selectField.name]}
                    onChange={handleChange}
                  />

                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 'auto', pt: 1, justifyContent: 'center' }}>
                    <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />}
                      onClick={() => saveManager(manager)}
                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold', px: 2 }}>
                      Save {manager.label}
                    </Button>
                    <Button variant="outlined" color="primary" size="small"
                      onClick={() => handleSyncManager(manager.syncProvider, 'push')}
                      sx={{ borderRadius: '8px', textTransform: 'none' }}>Push</Button>
                    <Button variant="outlined" color="secondary" size="small"
                      onClick={() => handleSyncManager(manager.syncProvider, 'pull')}
                      sx={{ borderRadius: '8px', textTransform: 'none' }}>Pull</Button>
                  </Box>
                </Box>
              </Grid>
            )
          })}
        </Grid>
      )}

      {visible.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Select a credential manager above to get started.
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