import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import CardMembershipIcon from '@mui/icons-material/CardMembership';

function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [providers, setProviders] = useState([]);
  
  // Forms state
  const [emailText, setEmailText] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [newTier, setNewTier] = useState({ provider_id: '', name: '', level: 0, price: 0, features: [] });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subsRes, tiersRes, provRes] = await Promise.all([
        apiFetch('/subscriptions/'),
        apiFetch('/subscriptions/tiers'),
        apiFetch('/providers/')
      ]);
      if (subsRes.ok) setSubscriptions(await subsRes.json());
      if (tiersRes.ok) setTiers(await tiersRes.json());
      if (provRes.ok) setProviders(await provRes.json());
    } catch (e) {
      console.error("Failed to fetch subscription data", e);
    }
  };

  const handleParseEmail = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/subscriptions/parse-email', {
        method: 'POST',
        body: JSON.stringify({ email_text: emailText }),
      });
      if (!res.ok) throw new Error('Parse failed');
      const data = await res.json();
      setParseResult(data.parsed_data);
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to parse email. Verify contents and try again.', severity: 'error' } }));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveParsedSub = async () => {
    if (!parseResult) return;
    try {
      const payload = {
        provider_id: providers[0]?.id || 1, // Fallback
        ...parseResult
      };
      const res = await apiFetch('/subscriptions/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Subscription successfully imported!', severity: 'success' } }));
      fetchData();
      setParseResult(null);
      setEmailText('');
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to save parsed subscription.', severity: 'error' } }));
    }
  };

  // Tier CRUD
  const handleCreateTier = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/subscriptions/tiers', {
        method: 'POST',
        body: JSON.stringify({
          ...newTier,
          provider_id: parseInt(newTier.provider_id)
        }),
      });
      if (!res.ok) throw new Error('Create tier failed');
      setNewTier({ provider_id: '', name: '', level: 0, price: 0, features: [] });
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Subscription tier added successfully!', severity: 'success' } }));
      fetchData();
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to create subscription tier.', severity: 'error' } }));
    }
  };

  const handleDeleteTier = async (id) => {
    try {
      await apiFetch(`/subscriptions/tiers/${id}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Subscription tier deleted.', severity: 'success' } }));
      fetchData();
    } catch(e) {
      console.error(e);
    }
  };

  const handleDeleteSubscription = async (id) => {
    const confirmed = await window.appConfirm('Are you sure you want to delete this subscription?');
    if (!confirmed) return;
    try {
      const res = await apiFetch(`/subscriptions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Subscription deleted successfully.', severity: 'success' } }));
        fetchData();
      } else {
        throw new Error('Delete failed');
      }
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to delete subscription.', severity: 'error' } }));
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: '800', mb: 4, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CardMembershipIcon sx={{ fontSize: 36, color: 'primary.main' }} />
        Subscription &amp; Trial Manager
      </Typography>

      <Grid container spacing={4}>
        {/* Email Parser */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: '700', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoFixHighIcon color="primary" /> Import from Email
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Paste your raw subscription or trial confirmation email below to automatically parse and record details.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={5}
                variant="outlined"
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder="Paste email headers and content here..."
                sx={{ mb: 2 }}
              />
              <Button 
                variant="contained" 
                onClick={handleParseEmail}
                disabled={loading}
                fullWidth
              >
                {loading ? <CircularProgress size={24} /> : "Parse Email"}
              </Button>
              
              {parseResult && (
                <Box sx={{ mt: 3, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Detected Data Summary:</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                    <Typography variant="body2"><strong>Biller:</strong> {parseResult.biller || 'Unknown'}</Typography>
                    <Typography variant="body2"><strong>Cost:</strong> ${parseResult.cost}</Typography>
                    <Typography variant="body2"><strong>Cycle:</strong> {parseResult.billing_cycle}</Typography>
                    <Typography variant="body2"><strong>Trial:</strong> {parseResult.is_trial ? 'Yes' : 'No'}</Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    color="success"
                    fullWidth
                    onClick={handleSaveParsedSub}
                  >
                    Save as Subscription
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Trial Manager */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: '700', mb: 2 }}>
                Active Trials &amp; Subscriptions
              </Typography>
              {subscriptions.length === 0 ? (
                <Typography variant="body2" color="textSecondary">No active subscriptions or trials found.</Typography>
              ) : (
                <List sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {subscriptions.map(sub => {
                    const provider = providers.find(p => p.id === sub.provider_id);
                    return (
                      <ListItem 
                        key={sub.id} 
                        sx={{ 
                          border: '1px solid rgba(255,255,255,0.05)', 
                          borderRadius: 2, 
                          bgcolor: 'background.paper',
                          flexWrap: 'wrap'
                        }}
                      >
                        <ListItemText 
                          primary={
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              {provider?.name || `Provider ID: ${sub.provider_id}`}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                              Biller: {sub.biller || 'Unknown'} | Cost: ${sub.cost} | Cycle: {sub.billing_cycle}
                            </Typography>
                          }
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                          {sub.is_trial && (
                            <Chip label="Trial" color="warning" size="small" />
                          )}
                          <IconButton color="error" size="small" onClick={() => handleDeleteSubscription(sub.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Tiers CRUD */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: '700', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LibraryAddIcon color="primary" /> Manage Subscription Tiers
              </Typography>
              
              <Box 
                component="form" 
                onSubmit={handleCreateTier} 
                sx={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: 2, 
                  alignItems: 'center', 
                  mb: 4 
                }}
              >
                <FormControl sx={{ minWidth: 200 }} size="small" required>
                  <InputLabel>Select Provider</InputLabel>
                  <Select 
                    value={newTier.provider_id}
                    label="Select Provider"
                    onChange={e => setNewTier({...newTier, provider_id: e.target.value})}
                  >
                    {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                  </Select>
                </FormControl>
                
                <TextField 
                  size="small" 
                  label="Tier Name" 
                  required
                  value={newTier.name} 
                  onChange={e => setNewTier({...newTier, name: e.target.value})}
                />
                
                <TextField 
                  size="small" 
                  label="Price" 
                  type="number" 
                  inputProps={{ step: "0.01" }}
                  sx={{ width: 120 }}
                  value={newTier.price} 
                  onChange={e => setNewTier({...newTier, price: parseFloat(e.target.value) || 0})}
                />
                
                <Button type="submit" variant="contained" color="secondary">
                  Add Tier
                </Button>
              </Box>

              <TableContainer component={Paper} sx={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Provider</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Price</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tiers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="textSecondary" sx={{ py: 2 }}>
                            No subscription tiers configured yet.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      tiers.map(tier => (
                        <TableRow key={tier.id} hover>
                          <TableCell>{providers.find(p => p.id === tier.provider_id)?.name || tier.provider_id}</TableCell>
                          <TableCell>{tier.name}</TableCell>
                          <TableCell>${tier.price}</TableCell>
                          <TableCell align="right">
                            <IconButton color="error" size="small" onClick={() => handleDeleteTier(tier.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
}

export default SubscriptionManager;
