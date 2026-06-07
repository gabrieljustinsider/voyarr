import { useState } from 'react'
import { TextField, Button, Typography, Box, FormControlLabel, Switch } from '@mui/material'

export default function CredentialForm({ 
  credentials, 
  setCredentials, 
  onSubmit 
}) {
  const [overrideEnabled, setOverrideEnabled] = useState(!!credentials.dailyLimit)

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ maxWidth: 400 }}>
      <Typography variant="h4" gutterBottom>
        Configure Credentials
      </Typography>
      <TextField
        fullWidth
        label="Username"
        value={credentials.username}
        onChange={(e) => setCredentials({...credentials, username: e.target.value})}
        margin="normal"
        required
      />
      <TextField
        fullWidth
        label="Password"
        type="password"
        value={credentials.password}
        onChange={(e) => setCredentials({...credentials, password: e.target.value})}
        margin="normal"
        required
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, mb: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={overrideEnabled}
              onChange={(e) => {
                const checked = e.target.checked
                setOverrideEnabled(checked)
                if (!checked) {
                  setCredentials(prev => ({ ...prev, dailyLimit: '' }))
                }
              }}
            />
          }
          label="Custom Limit"
          sx={{ minWidth: '150px' }}
        />
        <TextField
          fullWidth
          label="Custom Daily Limit"
          type="number"
          disabled={!overrideEnabled}
          required={overrideEnabled}
          value={credentials.dailyLimit || ''}
          onChange={(e) => setCredentials({...credentials, dailyLimit: e.target.value})}
          placeholder="Override default limit"
        />
      </Box>
      <Button type="submit" variant="contained" sx={{ mt: 2 }}>
        Save Credentials
      </Button>
    </Box>
  )
}
