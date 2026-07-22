import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import AlertTriangleIcon from '@mui/icons-material/WarningAmber';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught component error in Voyarr UI:', error, errorInfo);
    this.setState({ errorInfo });

    // Automatically recover from stale asset chunk hashes after new deployments
    const isChunkError = /Failed to fetch dynamically imported module|Loading chunk|Failed to load resource|net::ERR_ABORTED/i.test(
      (error?.message || '') + ' ' + (error?.stack || '')
    );
    if (isChunkError) {
      const pageHasBeenRefreshed = JSON.parse(
        window.sessionStorage.getItem('voyarr_lazy_retry') || 'false'
      );
      if (!pageHasBeenRefreshed) {
        window.sessionStorage.setItem('voyarr_lazy_retry', 'true');
        console.warn('Stale frontend chunk detected after build release. Reloading page...');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          sx={{
            minHeight: '100vh',
            width: '100vw',
            backgroundColor: '#0b0f19',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            boxSizing: 'border-box',
          }}
        >

          <Paper
            elevation={6}
            sx={{
              p: 4,
              maxWidth: 600,
              width: '100%',
              borderRadius: '20px',
              background: 'rgba(28, 37, 65, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                mb: 2,
              }}
            >
              <AlertTriangleIcon style={{ fontSize: 36 }} />
            </Box>

            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ color: '#ffffff' }}>
              {this.props.title || 'Component Rendering Error'}
            </Typography>

            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
              {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
            </Typography>

            {this.state.error && (
              <Box
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: '10px',
                  background: 'rgba(0,0,0,0.4)',
                  textAlign: 'left',
                  maxHeight: 120,
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#f87171',
                }}
              >
                {this.state.error.toString()}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onClick={this.handleReset}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#ffffff',
                }}
              >
                Try Again
              </Button>
              <Button
                variant="contained"
                onClick={this.handleReload}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                }}
              >
                Reload Page
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
