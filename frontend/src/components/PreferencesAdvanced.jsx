import { useState, useEffect } from 'react'
import {
  Box, Button, Card, CardContent, TextField, Typography, Select, MenuItem,
  FormControl, InputLabel, Switch, FormControlLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Alert
} from '@mui/material'

export default function PreferencesAdvanced() {
  const [selectedProvider, setSelectedProvider] = useState(1)
  const [preferences, setPreferences] = useState(null)
  const [patternExample, setPatternExample] = useState('')
  const [availableVariables, setAvailableVariables] = useState([])

  const API_BASE = 'http://localhost:8000'

  useEffect(() => {
    fetchPreferences()
    fetchNamingPatterns()
  }, [selectedProvider])

  const fetchPreferences = async () => {
    try {
      const response = await fetch(`${API_BASE}/preferences/provider/${selectedProvider}`)
      if (response.ok) {
        const data = await response.json()
        setPreferences(data)
        setAvailableVariables(data.available_variables || [])
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error)
    }
  }

  const fetchNamingPatterns = async () => {
    try {
      const response = await fetch(`${API_BASE}/preferences/naming-patterns`)
      if (response.ok) {
        const data = await response.json()
        setAvailableVariables(data.template_variables)
      }
    } catch (error) {
      console.error('Failed to fetch patterns:', error)
    }
  }

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_BASE}/preferences/provider/${selectedProvider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_resolution: preferences.preferred_resolution,
          naming_pattern: preferences.naming_pattern,
          append_metadata: preferences.append_metadata,
          auto_tag_files: preferences.auto_tag_files,
          duplicate_handling: preferences.duplicate_handling
        })
      })
      if (response.ok) {
        alert('Preferences saved!')
      }
    } catch (error) {
      console.error('Failed to save preferences:', error)
    }
  }

  const handleValidatePattern = async () => {
    try {
      const response = await fetch(`${API_BASE}/preferences/validate-pattern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: preferences.naming_pattern })
      })
      if (response.ok) {
        const data = await response.json()
        if (data.valid) {
          setPatternExample(data.example)
        } else {
          alert(`Invalid pattern: ${data.error}`)
        }
      }
    } catch (error) {
      console.error('Failed to validate pattern:', error)
    }
  }

  if (!preferences) {
    return <Typography>Loading...</Typography>
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Advanced Preferences
      </Typography>

      <Box sx={{ mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Provider</InputLabel>
          <Select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            label="Provider"
          >
            <MenuItem value={1}>Provider 1</MenuItem>
            <MenuItem value={2}>Provider 2</MenuItem>
            <MenuItem value={3}>Provider 3</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Resolution Preferences */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Video Resolution Preferences</Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Preferred Resolution</InputLabel>
            <Select
              value={preferences.preferred_resolution}
              onChange={(e) => setPreferences({...preferences, preferred_resolution: e.target.value})}
              label="Preferred Resolution"
            >
              <MenuItem value="auto">Auto (Best Available)</MenuItem>
              <MenuItem value="4K">4K</MenuItem>
              <MenuItem value="1080p">1080p</MenuItem>
              <MenuItem value="720p">720p</MenuItem>
              <MenuItem value="480p">480p</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="textSecondary">
            Downloads will prefer the selected resolution when available
          </Typography>
        </CardContent>
      </Card>

      {/* Naming Pattern */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Filename Naming Pattern</Typography>
          <TextField
            fullWidth
            label="Naming Pattern"
            value={preferences.naming_pattern}
            onChange={(e) => setPreferences({...preferences, naming_pattern: e.target.value})}
            margin="normal"
            multiline
            rows={2}
            placeholder="{title}_{performers}_{resolution}"
          />
          <Button variant="outlined" onClick={handleValidatePattern} sx={{ mt: 1 }}>
            Preview Pattern
          </Button>
          {patternExample && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Example: <strong>{patternExample}</strong>
            </Alert>
          )}

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
            Available Variables:
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell>Variable</TableCell>
                  <TableCell>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.isArray(availableVariables) ? (
                  Object.entries(availableVariables).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell><code>{`{${key}}`}</code></TableCell>
                      <TableCell>{typeof value === 'string' ? value : key}</TableCell>
                    </TableRow>
                  ))
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Metadata & Tagging */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Metadata & File Tagging</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.append_metadata}
                onChange={(e) => setPreferences({...preferences, append_metadata: e.target.checked})}
              />
            }
            label="Write metadata to JSON sidecar files"
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.auto_tag_files}
                onChange={(e) => setPreferences({...preferences, auto_tag_files: e.target.checked})}
              />
            }
            label="Auto-embed metadata tags in video files"
          />
        </CardContent>
      </Card>

      {/* Duplicate Handling */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Duplicate Handling</Typography>
          <FormControl fullWidth>
            <InputLabel>When duplicate detected</InputLabel>
            <Select
              value={preferences.duplicate_handling}
              onChange={(e) => setPreferences({...preferences, duplicate_handling: e.target.value})}
              label="When duplicate detected"
            >
              <MenuItem value="skip">Skip download</MenuItem>
              <MenuItem value="ask">Ask user</MenuItem>
              <MenuItem value="overwrite">Overwrite existing</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <Button variant="contained" size="large" onClick={handleSave}>
        Save All Preferences
      </Button>
    </Box>
  )
}
