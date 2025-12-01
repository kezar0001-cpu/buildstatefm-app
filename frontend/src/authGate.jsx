import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { refreshCurrentUser } from './lib/auth.js';
import logger from './utils/logger';

function AuthGate({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await refreshCurrentUser();

        logger.log('AuthGate checking authentication:', !!user);

        if (!user) {
          // Check if this is a blog admin route
          const isBlogAdminRoute = location.pathname.startsWith('/admin/blog');
          const loginPath = isBlogAdminRoute ? '/admin/blog/login' : '/signin';

          logger.log('Not authenticated, redirecting to', loginPath);
          navigate(loginPath, { replace: true });
        } else {
          logger.log('Authentication valid, proceeding');
          setIsChecking(false);
        }
      } catch (error) {
        logger.error('Auth check error:', error);

        // Check if this is a blog admin route
        const isBlogAdminRoute = location.pathname.startsWith('/admin/blog');
        const loginPath = isBlogAdminRoute ? '/admin/blog/login' : '/signin';

        navigate(loginPath, { replace: true });
      }
    };

    checkAuth();
  }, [navigate, location.pathname]);

  if (isChecking) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#f5f5f5'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return children;
}

export default AuthGate;