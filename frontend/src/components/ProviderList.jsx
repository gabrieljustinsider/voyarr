import { Card, CardContent, CardActions, Typography, Button, Grid, TextField, Box } from '@mui/material'

export default function ProviderList({ providers, onSelectProvider, searchQuery, setSearchQuery }) {
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
        {providers.map(provider => (
          <Grid item xs={12} sm={6} md={4} key={provider.id}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="div">
                  {provider.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {provider.base_url}
                </Typography>
                {provider.automatic_limits && (
                  <Typography variant="body2">
                    Default Daily Limit: {provider.automatic_limits.daily_downloads || 'None'}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => onSelectProvider(provider.id)}>
                  Configure Credentials
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  )
}
