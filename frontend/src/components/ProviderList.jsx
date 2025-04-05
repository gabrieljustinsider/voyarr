import { useState, useEffect } from 'react'
import { Card, CardContent, CardActions, Typography, Button, Grid, TextField, Box, LinearProgress } from '@mui/material'
import apiFetch from '../api'

export default function ProviderList({ providers, onSelectProvider, searchQuery, setSearchQuery }) {
  const [cookies, setCookies] = useState([])

  useEffect(() => {
    const fetchCookies = async () => {
      try {
        const response = await apiFetch('/cookies')
        if (response.ok) {
          const data = await response.json()
          setCookies(data)
        }
      } catch (error) {
        console.error('Failed to fetch cookies for provider list:', error)
      }
    }
    fetchCookies()
  }, [])

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Media Providers
      </Typography>
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Search Providers"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          variant="outlined"
        />
      </Box>
      <Grid container spacing={3}>
        {providers.map(provider => {
          const providerCookies = cookies.filter(c => c.provider_id === provider.id)
          
          return (
            <Grid item xs={12} sm={6} md={4} key={provider.id}>
              <Card>
                <CardContent>
                  <Typography variant="h5" component="div">
                    {provider.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {provider.base_url}
                  </Typography>
                  {provider.automatic_limits && (
                    <Typography variant="body2" gutterBottom>
                      Default Daily Limit: {provider.automatic_limits.daily_downloads || 'None'}
                    </Typography>
                  )}
                  {providerCookies.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Active Session Quotas</Typography>
                      {providerCookies.map(cookie => {
                        const limit = cookie.download_limit || 0;
                        const used = cookie.downloads_used || 0;
                        const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                        const isUnlimited = limit === 0;

                        return (
                          <Box key={cookie.id} sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {cookie.status === 'active' ? 'Active' : 'Inactive'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={isUnlimited ? 100 : percentage} 
                              color={isUnlimited ? 'primary' : percentage >= 90 ? 'error' : percentage >= 75 ? 'warning' : 'primary'}
                              sx={{ height: 6, borderRadius: 3, ...(isUnlimited && { opacity: 0.5 }) }}
                            />
                          </Box>
                        )
                      })}
                    </Box>
                  )}
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => onSelectProvider(provider.id)}>
                    Configure Credentials
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </div>
  )
}
