import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Box,
  Typography,
  TextField,
  Autocomplete
} from '@mui/material';
import apiFetch from '../api';

export default function SubscriptionForm({ existingSubscription, onSave }) {
  const [billers, setBillers] = useState([]);
  const [billerId, setBillerId] = useState(existingSubscription?.biller_id || null);

  // 1. Fetch the list of billers when the form loads
  useEffect(() => {
    const fetchBillers = async () => {
      try {
        const response = await apiFetch('/billers');
        if (response.ok) {
          setBillers(await response.json());
        }
      } catch (error) {
        console.error("Failed to fetch billers", error);
      }
    };
    fetchBillers();
  }, []);

  // 2. Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      biller_id: billerId
    };

    try {
      if (existingSubscription?.id) {
        await apiFetch(`/subscriptions/${existingSubscription.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/subscriptions', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      if (onSave) onSave();
    } catch (error) {
      console.error("Failed to save subscription", error);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>Subscription Details</Typography>

      <Autocomplete
        options={billers}
        getOptionLabel={(option) => option.name || ''}
        value={billers.find(b => b.id === billerId) || null}
        onChange={(event, newValue) => {
          setBillerId(newValue ? newValue.id : null);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Biller / Payment Gateway (Searchable)"
            placeholder="Search payment gateway..."
            fullWidth
            margin="normal"
          />
        )}
      />

      <Button type="submit" variant="contained" sx={{ mt: 3 }}>
        Save Subscription
      </Button>
    </Box>
  );
}