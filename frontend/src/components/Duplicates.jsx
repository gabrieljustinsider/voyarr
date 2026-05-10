import { useState, useEffect } from 'react'
import { Box, Typography, Card, CardContent, Button, Grid, Divider } from '@mui/material'

export default function Duplicates() {
  const [duplicates, setDuplicates] = useState([])

  const fetchDuplicates = async () => {
    try {
      const res = await fetch('http://localhost:8000/duplicates', {
        headers: { 'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY }
      })
      if (res.ok) setDuplicates(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { fetchDuplicates() }, [])

  const resolveDuplicate = async (id, action) => {
    await fetch(`http://localhost:8000/duplicates/${id}/resolve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Voyarr-Api-Key': import.meta.env.VITE_MASTER_KEY
      },
      body: JSON.stringify({ action })
    })
    fetchDuplicates()
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Duplicate Resolution Queue</Typography>
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
    </Box>
  )
}