import { useState, useEffect, useCallback } from 'react'
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  Alert, CircularProgress, Chip, Divider
} from '@mui/material'

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`
const getApiKey = () => localStorage.getItem('voyarr_api_key') || import.meta.env.VITE_MASTER_KEY || ''

export default function Duplicates() {
  const [duplicates, setDuplicates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDuplicates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/duplicates`, {
        headers: { 'X-Voyarr-Api-Key': getApiKey() }
      })
      if (!res.ok) throw new Error('Failed to fetch duplicates')
      setDuplicates(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDuplicates()
  }, [fetchDuplicates])

  const handleResolve = async (dupeId, action) => {
    try {
      const res = await fetch(`${API_BASE}/duplicates/${dupeId}/resolve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Voyarr-Api-Key': getApiKey() 
        },
        body: JSON.stringify({ action })
      })
      if (!res.ok) throw new Error('Failed to resolve duplicate')
      
      // Remove from list
      setDuplicates(duplicates.filter(d => d.id !== dupeId))
    } catch (err) {
      alert(`Error resolving: ${err.message}`)
    }
  }

  if (loading) return <CircularProgress />

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Duplicate Resolution</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {duplicates.length === 0 && !loading && (
        <Alert severity="success">No unresolved duplicates found in the library!</Alert>
      )}

      {duplicates.map(dupe => (
        <Card key={dupe.id} sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
              <Typography variant="h6">Potential Match ({dupe.similarity_score}% Similar)</Typography>
              <Button variant="outlined" color="info" onClick={() => handleResolve(dupe.id, 'keep_both')}>
                False Positive (Keep Both)
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={3}>
              {[dupe.entry1, dupe.entry2].map((entry, idx) => (
                <Grid item xs={12} md={6} key={entry.id}>
                  <Box sx={{ p: 2, border: '1px solid #333', borderRadius: 1 }}>
                    <Typography variant="subtitle1" noWrap title={entry.title}>
                      <strong>{entry.title}</strong>
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1, wordBreak: 'break-all' }}>
                      {entry.file_path}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Chip label={entry.resolution || 'Unknown Res'} size="small" />
                      <Chip label={`${(entry.file_size / (1024*1024)).toFixed(1)} MB`} size="small" />
                    </Box>
                    <Button variant="contained" color="primary" fullWidth onClick={() => handleResolve(dupe.id, `keep_${idx + 1}`)}>
                      Keep This & Delete Other
                    </Button>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      ))}
    </Box>
  )
}