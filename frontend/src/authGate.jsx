import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentUser, getAuthToken, refreshCurrentUser } from './lib/auth.js';
import { silentRefreshAccessToken } from './api/client.js';
import logger from './utils/logger';

/**
 * AuthGate - Optimized authentication gate
 * 
 * Industry best practices implemented:
 * 1. Optimistic rendering: If we have a cached user + token, render immediately
 * 2. Background validation: Validate token in background, redirect only if invalid
 * 3. No blocking spinner: Eliminates one loading screen from the flow
 * 4. Deferred refresh: Only call API if necessary, not on every route
 */
function AuthGate({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we have cached credentials (optimistic check - no API call)
  const cachedUser = getCurrentUser();
  const hasToken = !!getAuthToken();
  
  // If we have both token and cached user, render immediately (optimistic)
  // Otherwise, we need to verify
  const [isVerified, setIsVerified] = useState(hasToken && cachedUser);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasValidatedRef = useRef(false);
  const hasAttemptedSilentRefreshRef = useRef(false);

  useEffect(() => {
    // Skip if already redirecting
    if (isRedirecting) return;
    
    // If no access token, attempt silent refresh (cookie-based) before redirecting.
    if (!hasToken) {
      if (hasAttemptedSilentRefreshRef.current) {
        const isBlogAdminRoute = location.pathname.startsWith('/admin/blog');
        const loginPath = isBlogAdminRoute ? '/admin/blog/login' : '/signin';
        logger.log('AuthGate: No token and silent refresh failed, redirecting to', loginPath);
        setIsRedirecting(true);
        navigate(loginPath, { replace: true });
        return;
      }

      hasAttemptedSilentRefreshRef.current = true;

      silentRefreshAccessToken()
        .then((token) => {
          if (!token) return null;
          return refreshCurrentUser();
        })
        .then((user) => {
          if (!user) {
            const isBlogAdminRoute = location.pathname.startsWith('/admin/blog');
            const loginPath = isBlogAdminRoute ? '/admin/blog/login' : '/signin';
            logger.log('AuthGate: Silent refresh did not restore session, redirecting');
            setIsRedirecting(true);
            navigate(loginPath, { replace: true });
            return;
          }

          logger.log('AuthGate: Silent refresh succeeded');
          setIsVerified(true);
        })
        .catch((error) => {
          logger.error('AuthGate: Silent refresh error:', error);
          const isBlogAdminRoute = location.pathname.startsWith('/admin/blog');
          const loginPath = isBlogAdminRoute ? '/admin/blog/login' : '/signin';
          setIsRedirecting(true);
          navigate(loginPath, { replace: true });
        });

      return;
    }

    // If we have token + cached user, we're already rendering optimistically
    // Do a background validation to ensure token is still valid
    // But don't block rendering
    if (cachedUser && !hasValidatedRef.current) {
      hasValidatedRef.current = true;
      
      // Background validation - don't block UI
      refreshCurrentUser()
        .then((user) => {
          if (!user) {
            // Token was invalid, redirect
            const isBlogAdminRoute = location.pathname.startsWith('/admin/blog');
            const loginPath = isBlogAdminRoute ? '/admin/blog/login' : '/signin';
            logger.log('AuthGate: Token invalid on background check, redirecting');
            setIsRedirecting(true);
            navigate(loginPath, { replace: true });
          } else {
            logger.log('AuthGate: Background validation successful');
          }
        })
        .catch((error) => {
          logger.error('AuthGate: Background validation error:', error);
          // Only redirect on 401, other errors might be network issues
          if (error?.status === 401 || error?.response?.status === 401) {
            const isBlogAdminRoute = location.pathname.startsWith('/admin/blog');
            const loginPath = isBlogAdminRoute ? '/admin/blog/login' : '/signin';
            setIsRedirecting(true);
            navigate(loginPath, { replace: true });
          }
        });
      
      return;
    }

    // If we have token but no cached user, we need to fetch user data
    // This is the only case where we block rendering
    if (!cachedUser) {
      refreshCurrentUser()
        .then((user) => {
          if (!user) {
            const isBlogAdminRoute = location.pathname.startsWith('/admin/blog');
            const loginPath = isBlogAdminRoute ? '/admin/blog/login' : '/signin';
            logger.log('AuthGate: Could not fetch user, redirecting');
            setIsRedirecting(true);
            navigate(loginPath, { replace: true });
          } else {
            logger.log('AuthGate: User fetched, proceeding');
            setIsVerified(true);
          }
        })
        .catch((error) => {
          logger.error('AuthGate: Auth check error:', error);
          const isBlogAdminRoute = location.pathname.startsWith('/admin/blog');
          const loginPath = isBlogAdminRoute ? '/admin/blog/login' : '/signin';
          setIsRedirecting(true);
          navigate(loginPath, { replace: true });
        });
    }
  }, [navigate, location.pathname, hasToken, cachedUser, isRedirecting]);

  // If redirecting, render nothing (navigation is in progress)
  if (isRedirecting) {
    return null;
  }

  // If verified (optimistically or after fetch), render children immediately
  // No spinner - the page components handle their own loading states
  if (isVerified) {
    return children;
  }

  // Only show minimal loading if we're fetching user data (token exists but no cached user)
  // This is a rare case (e.g., after clearing localStorage but keeping token)
  return null;
}

export default AuthGate;