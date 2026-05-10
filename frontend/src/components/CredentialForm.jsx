import { TextField, Button, Typography, Box } from '@mui/material'

export default function CredentialForm({ 
  credentials, 
  setCredentials, 
  onSubmit 
}) {
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
      <TextField
        fullWidth
        label="Custom Daily Limit (Optional)"
        type="number"
        value={credentials.dailyLimit}
        onChange={(e) => setCredentials({...credentials, dailyLimit: e.target.value})}
        margin="normal"
        placeholder="Override default limit"
      />
      <Button type="submit" variant="contained" sx={{ mt: 2 }}>
        Save Credentials
      </Button>
    </Box>
  )
}
