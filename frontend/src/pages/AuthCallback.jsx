import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { saveAuthToken, setCurrentUser } from '../lib/auth.js';
import { apiClient } from '../api/client.js';
import logger from '../utils/logger';

// Helper function to get dashboard path based on user role
const getDashboardPath = (role) => {
  const dashboardPaths = {
    TECHNICIAN: '/technician/dashboard',
    OWNER: '/owner/dashboard',
    TENANT: '/tenant/home',
    PROPERTY_MANAGER: '/dashboard',
    ADMIN: '/dashboard',
  };
  return dashboardPaths[role] || '/dashboard';
};

/**
 * OAuth Callback Handler
 * Receives token from OAuth providers (Google, etc.) and stores it
 * then redirects to the appropriate dashboard based on user role
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const next = searchParams.get('next');
    const error = searchParams.get('error');

    // Handle error case
    if (error) {
      logger.error('OAuth error:', error);
      navigate(`/signin?error=${error}`);
      return;
    }

    const completeSignIn = async () => {
      // Handle success case
      if (token) {
        // Store the token in localStorage
        saveAuthToken(token);

        let userRole = null;

        // Attempt to hydrate the SPA with the latest user context
        try {
          const response = await apiClient.get('/auth/me');
          const payload = response?.data ?? response;
          const user = payload?.user ?? payload;
          if (user) {
            setCurrentUser(user);
            userRole = user.role;
          }
        } catch (fetchError) {
          logger.error('Failed to fetch current user after OAuth callback:', fetchError);
        }

        // Redirect to the next page or role-specific dashboard
        const defaultDashboard = getDashboardPath(userRole);
        const redirectPath = next || defaultDashboard;
        navigate(redirectPath, { replace: true });
      } else {
        // No token provided
        logger.error('No token received from OAuth');
        navigate('/signin?error=no_token');
      }
    };

    completeSignIn();
  }, [searchParams, navigate]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={2}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" color="text.secondary">
        Completing sign in...
      </Typography>
    </Box>
  );
}
