import { useState, useEffect } from 'react'
import { 
  Box, Typography, Card, CardContent, Button, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, 
  FormControl, InputLabel, Select, MenuItem, Alert
} from '@mui/material'

export default function Duplicates() {
  const [duplicates, setDuplicates] = useState([])
  
  // Hash Comparison Tool State
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareData, setCompareData] = useState({ hash1: '', hash2: '', hash_type: 'phash' })
  const [compareResult, setCompareResult] = useState(null)

  const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

  const fetchDuplicates = async () => {
    try {
      const res = await fetch(`${API_BASE}/duplicates`, {
        headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
      })
      if (res.ok) setDuplicates(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { fetchDuplicates() }, [])

  const handleScan = async () => {
    await fetch(`${API_BASE}/duplicates/scan`, {
      method: 'POST',
      headers: {
        'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
      }
    })
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Scan started! Refresh in a few moments.', severity: 'success' } }))
  }

  const resolveDuplicate = async (id, action) => {
    await fetch(`${API_BASE}/duplicates/${id}/resolve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
      },
      body: JSON.stringify({ action })
    })
    fetchDuplicates()
  }

  const handleCompare = async () => {
    setCompareResult(null)
    try {
      const res = await fetch(`${API_BASE}/duplicates/compare`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
        },
        body: JSON.stringify(compareData)
      })
      const data = await res.json()
      if (res.ok) {
        setCompareResult(data)
      } else {
        setCompareResult({ error: data.detail })
      }
    } catch (e) {
      setCompareResult({ error: e.message })
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Duplicate Resolution Queue</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" color="secondary" onClick={() => setCompareOpen(true)}>Hash Tester</Button>
          <Button variant="contained" onClick={handleScan}>Scan for Duplicates</Button>
        </Box>
      </Box>
      {duplicates.length === 0 ? (
        <Typography>No pending duplicates found.</Typography>
      ) : (
        <Grid container spacing={3}>
          {duplicates.map(dupe => (
            <Grid item xs={12} key={dupe.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Match Score: {dupe.similarity_score}% - Reason: {dupe.reason}</Typography>
                  <Box sx={{ display: 'flex', gap: 4, my: 2 }}>
                    <Box flex={1}>
                      <Typography variant="subtitle1" color="primary">Entry 1 (Existing File)</Typography>
                      <Typography variant="body1">{dupe.entry1?.title || 'Unknown Title'}</Typography>
                      <Typography variant="body2" color="textSecondary">{dupe.entry1?.path || 'Unknown Path'}</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box flex={1}>
                      <Typography variant="subtitle1" color="secondary">Entry 2 (New File)</Typography>
                      <Typography variant="body1">{dupe.entry2?.title || 'Unknown Title'}</Typography>
                      <Typography variant="body2" color="textSecondary">{dupe.entry2?.path || 'Unknown Path'}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                    <Button variant="contained" color="error" onClick={() => resolveDuplicate(dupe.id, 'overwrite')}>Overwrite Existing</Button>
                    <Button variant="outlined" onClick={() => resolveDuplicate(dupe.id, 'keep_both')}>Keep Both</Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={compareOpen} onClose={() => setCompareOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Hash Comparison Tool</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 3 }}>
            Test the difference scores of two specific ohash or phash values side by side.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Hash Type</InputLabel>
            <Select 
              value={compareData.hash_type} 
              label="Hash Type" 
              onChange={e => setCompareData({...compareData, hash_type: e.target.value})}
            >
              <MenuItem value="phash">Perceptual Hash (phash)</MenuItem>
              <MenuItem value="ohash">OpenSubtitles Hash (ohash)</MenuItem>
            </Select>
          </FormControl>
          <TextField 
            fullWidth size="small" label="Hash 1" sx={{ mb: 2 }}
            value={compareData.hash1} onChange={e => setCompareData({...compareData, hash1: e.target.value})} 
          />
          <TextField 
            fullWidth size="small" label="Hash 2" sx={{ mb: 2 }}
            value={compareData.hash2} onChange={e => setCompareData({...compareData, hash2: e.target.value})} 
          />
          
          {compareResult && !compareResult.error && (
            <Alert severity={compareResult.match ? "success" : "warning"} sx={{ mt: 2 }}>
              Similarity Score: <strong>{compareResult.score.toFixed(2)}%</strong><br/>
              Match Threshold Met: {compareResult.match ? 'Yes' : 'No'}
            </Alert>
          )}
          {compareResult && compareResult.error && (
            <Alert severity="error" sx={{ mt: 2 }}>{compareResult.error}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompareOpen(false)}>Close</Button>
          <Button onClick={handleCompare} variant="contained" disabled={!compareData.hash1 || !compareData.hash2}>Compare</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}