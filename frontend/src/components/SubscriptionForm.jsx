import React, { useState, useEffect } from 'react';
import { 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button, 
  Box,
  Typography
} from '@mui/material';
import axios from 'axios';

export default function SubscriptionForm({ existingSubscription, onSave }) {
  const [billers, setBillers] = useState([]);
  const [billerId, setBillerId] = useState(existingSubscription?.biller_id || '');

  // 1. Fetch the list of billers when the form loads
  useEffect(() => {
    const fetchBillers = async () => {
      try {
        const response = await axios.get('/api/billers');
        setBillers(response.data);
      } catch (error) {
        console.error("Failed to fetch billers", error);
      }
    };
    fetchBillers();
  }, []);

  // 2. Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Construct your subscription payload, including the selected biller_id
    const payload = {
      // ... your other subscription fields (provider_id, tier_id, cost, etc.)
      biller_id: billerId === '' ? null : billerId, 
    };

    try {
      if (existingSubscription?.id) {
        await axios.put(`/api/subscriptions/${existingSubscription.id}`, payload);
      } else {
        await axios.post('/api/subscriptions', payload);
      }
      if (onSave) onSave(); // Trigger a refresh or close a dialog
    } catch (error) {
      console.error("Failed to save subscription", error);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>Subscription Details</Typography>
      {/* ... Your other form fields (Provider, Tier, Cost, Date) would go here ... */}

      {/* 3. The Biller Dropdown */}
      <FormControl fullWidth margin="normal">
        <InputLabel id="biller-select-label">Biller (Payment Gateway)</InputLabel>
        <Select
          labelId="biller-select-label"
          id="biller-select"
          value={billerId}
          label="Biller (Payment Gateway)"
          onChange={(e) => setBillerId(e.target.value)}
        >
          <MenuItem value="">
            <em>None (Direct)</em>
          </MenuItem>
          {billers.map((biller) => (
            <MenuItem key={biller.id} value={biller.id}>
              {biller.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button type="submit" variant="contained" sx={{ mt: 3 }}>
        Save Subscription
      </Button>
    </Box>
  );
}