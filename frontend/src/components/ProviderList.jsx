import { useState, useEffect } from 'react'
import { Card, CardContent, CardActions, Typography, Button, Grid, TextField, Box, LinearProgress } from '@mui/material'
import apiFetch from '../api'

export default function ProviderList({ providers, onSelectProvider, searchQuery, setSearchQuery }) {
  const [cookies, setCookies] = useState([])
  const [credentials, setCredentials] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cookieRes, credRes] = await Promise.all([
          apiFetch('/cookies'),
          apiFetch('/credentials')
        ])
        if (cookieRes.ok) setCookies(await cookieRes.json())
        if (credRes.ok) setCredentials(await credRes.json())
      } catch (error) {
        console.error('Failed to fetch limit data:', error)
      }
    }
    fetchData()
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
          const providerCred = credentials.find(c => c.provider_id === provider.id)
          
          const accountLimit = (providerCred?.custom_limits?.daily_downloads) || (provider.automatic_limits?.daily_downloads) || 0
          const accountUsed = providerCred?.downloads_used || 0
          const accountPercentage = accountLimit > 0 ? Math.min((accountUsed / accountLimit) * 100, 100) : 0

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
                  
                  {/* Account Level Limit Meter */}
                  <Box sx={{ mt: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="subtitle2">Account Daily Limit</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {accountLimit > 0 ? `${accountUsed} / ${accountLimit}` : `${accountUsed} / ∞`}
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={accountLimit > 0 ? accountPercentage : 100} 
                      color={accountLimit === 0 ? 'primary' : accountPercentage >= 90 ? 'error' : accountPercentage >= 75 ? 'warning' : 'primary'}
                      sx={{ height: 8, borderRadius: 4, ...(accountLimit === 0 && { opacity: 0.5 }) }}
                    />
                  </Box>

                  {providerCookies.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Session Quotas (Cookies)</Typography>
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
