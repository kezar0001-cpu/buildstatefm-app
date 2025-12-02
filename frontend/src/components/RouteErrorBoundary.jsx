import React from 'react';
import { Box, Button, Typography, Paper, Stack, Alert } from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  BugReport as BugReportIcon,
} from '@mui/icons-material';

/**
 * Error fallback component displayed when an error is caught
 */
function ErrorFallback({ error, resetErrorBoundary, errorInfo }) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 600,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: 'error.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
          }}
        >
          <ErrorIcon sx={{ fontSize: 40, color: 'error.main' }} />
        </Box>

        <Typography variant="h5" fontWeight={600} gutterBottom>
          Something went wrong
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          We encountered an unexpected error. Please try again or return to the home page.
        </Typography>

        {/* Show error details in development */}
        {isDev && error && (
          <Alert
            severity="error"
            icon={<BugReportIcon />}
            sx={{ mb: 3, textAlign: 'left' }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              {error.name}: {error.message}
            </Typography>
            {errorInfo?.componentStack && (
              <Box
                component="pre"
                sx={{
                  mt: 1,
                  p: 1,
                  backgroundColor: 'grey.100',
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  overflow: 'auto',
                  maxHeight: 200,
                }}
              >
                {errorInfo.componentStack}
              </Box>
            )}
          </Alert>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
        >
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={resetErrorBoundary}
          >
            Try Again
          </Button>
          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Go to Home
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

/**
 * Route-level error boundary component.
 * Catches errors in child components and displays a fallback UI.
 * 
 * Features:
 * - Automatic error logging
 * - Retry functionality
 * - Development mode error details
 * - Navigation back to home
 * 
 * @example
 * <RouteErrorBoundary>
 *   <MyPage />
 * </RouteErrorBoundary>
 */
class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log error (can be extended to send to error tracking service)
    console.error('RouteErrorBoundary caught error:', error);
    console.error('Component stack:', errorInfo?.componentStack);

    // Call optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call optional onReset callback
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
          errorInfo: this.state.errorInfo,
        });
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetErrorBoundary={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
}

export { ErrorFallback };
export default RouteErrorBoundary;

