import { useState } from 'react'
import { Box, Typography, TextField, Button, Paper, Alert } from '@mui/material'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const formData = new URLSearchParams()
      formData.append('username', username)
      formData.append('password', password)

      const res = await fetch(`${API_BASE}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      })

      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('voyarr_jwt', data.access_token)
        window.location.reload()
      } else {
        setError('Invalid credentials')
      }
    } catch (err) {
      setError('Network error preventing login.')
    }
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <Typography variant="h5" gutterBottom align="center">Voyarr Login</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={handleLogin}>
          <TextField fullWidth label="Username" margin="normal" value={username} onChange={e => setUsername(e.target.value)} required />
          <TextField fullWidth type="password" label="Password" margin="normal" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button fullWidth type="submit" variant="contained" sx={{ mt: 3 }}>Login</Button>
        </form>
      </Paper>
    </Box>
  )
}