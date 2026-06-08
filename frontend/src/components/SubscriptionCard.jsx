import React from 'react';
import { Card, CardContent, Typography, Box, Chip, IconButton, Tooltip } from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export default function SubscriptionCard({ subscription, onEdit, onDelete }) {
  // Format the cost as a standard US Dollar currency string (e.g., "$19.99")
  const formattedCost = subscription.cost 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subscription.cost)
    : 'Free';

  // Safely extract the Biller's name, defaulting to 'Direct' if no biller is associated
  const billerName = subscription.biller ? subscription.biller.name : 'Direct';
  
  // Safely extract Provider and Tier names
  const providerName = subscription.provider ? subscription.provider.name : 'Unknown Provider';
  const tierName = subscription.tier ? subscription.tier.name : '';
  const cardTitle = tierName ? `${providerName} - ${tierName}` : providerName;

  // Safely format dates to a clean, readable string
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }).format(new Date(dateString));
  };

  return (
    <Card sx={{ minWidth: 275, mb: 2, background: 'rgba(255, 255, 255, 0.02)' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" gutterBottom>
            {cardTitle}
          </Typography>
          {(onEdit || onDelete) && (
            <Box>
              {onEdit && (
                <Tooltip title="Edit Subscription">
                  <IconButton size="small" onClick={() => onEdit(subscription)}><EditIcon fontSize="small" /></IconButton>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip title="Delete Subscription">
                  <IconButton size="small" color="error" onClick={() => onDelete(subscription.id)}><DeleteIcon fontSize="small" /></IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Box>
            <Typography color="textSecondary" variant="caption">
              Billing Cycle
            </Typography>
            <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
              {subscription.billing_cycle || 'N/A'}
            </Typography>
          </Box>
          
          <Box sx={{ textAlign: 'right' }}>
            <Typography color="textSecondary" variant="caption">
              Cost
            </Typography>
            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
              {formattedCost}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Box>
            <Typography color="textSecondary" variant="caption">
              Start Date
            </Typography>
            <Typography variant="body2">
              {formatDate(subscription.start_date)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography color="textSecondary" variant="caption">
              End Date
            </Typography>
            <Typography variant="body2">
              {formatDate(subscription.end_date)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography color="textSecondary" variant="caption" display="block" gutterBottom>
            Payment Gateway
          </Typography>
          <Chip 
            icon={<PaymentsIcon />} 
            label={billerName} 
            variant="outlined" 
            size="small" 
          />
        </Box>
      </CardContent>
    </Card>
  );
}