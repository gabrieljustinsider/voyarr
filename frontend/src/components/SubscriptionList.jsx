import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, CircularProgress, Button, ButtonGroup } from '@mui/material';
import SubscriptionCard from './SubscriptionCard';

export default function SubscriptionList({ onEdit, onDelete }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active'); // Default to 'active'

  useEffect(() => {
    const fetchSubscriptions = async () => {
      setLoading(true);
      try {
        // Pass the status filter as a query parameter to the API
        const response = await axios.get('/api/subscriptions', {
          params: { status: statusFilter === 'all' ? null : statusFilter }
        });
        setSubscriptions(response.data);
      } catch (error) {
        console.error("Failed to fetch subscriptions", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSubscriptions();
  }, [statusFilter]); // Re-fetch whenever the statusFilter changes

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        My Subscriptions
      </Typography>

      <ButtonGroup variant="outlined" sx={{ mb: 2 }}>
        <Button onClick={() => setStatusFilter('all')} variant={statusFilter === 'all' ? 'contained' : 'outlined'}>All</Button>
        <Button onClick={() => setStatusFilter('active')} variant={statusFilter === 'active' ? 'contained' : 'outlined'}>Active</Button>
        <Button onClick={() => setStatusFilter('trial')} variant={statusFilter === 'trial' ? 'contained' : 'outlined'}>Trials</Button>
        <Button onClick={() => setStatusFilter('expired')} variant={statusFilter === 'expired' ? 'contained' : 'outlined'}>Expired</Button>
        <Button onClick={() => setStatusFilter('cancelled')} variant={statusFilter === 'cancelled' ? 'contained' : 'outlined'}>Cancelled</Button>
      </ButtonGroup>

      {subscriptions.length === 0 ? (
        <Typography>No subscriptions found.</Typography>
      ) : (
        subscriptions.map((sub) => (
          <SubscriptionCard 
            key={sub.id} 
            subscription={sub}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </Box>
  );
}