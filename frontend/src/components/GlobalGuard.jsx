// frontend/src/components/GlobalGuard.jsx
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuthToken, setCurrentUser } from '../lib/auth.js';
import { apiClient } from '../api/client.js';

// Public paths that don't require authentication
const PUBLIC_PATHS = new Set([
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/',
  '/pricing',
  '/blog',
  '/admin/setup',
  '/admin/blog/login',
]);

// Paths that start with these prefixes are also public
const PUBLIC_PATH_PREFIXES = ['/blog/'];

const SUBS_PATH = '/subscriptions';

function isPublicPath(path) {
  if (PUBLIC_PATHS.has(path)) return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export default function GlobalGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const inFlight = useRef(false);

  useEffect(() => {
    const path = location.pathname;
    const token = getAuthToken();
    if (isPublicPath(path) || !token || inFlight.current) return;

    inFlight.current = true;

    apiClient
      .get('/auth/me')
      .then((response) => response?.data ?? response)
      .then((data) => {
        const user = data?.user ?? data;
        if (!user) return;

        setCurrentUser(user);
        const isSubscriptionOwnerRole = user.role === 'PROPERTY_MANAGER';
        const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;
        const trialActive =
          user.subscriptionStatus === 'TRIAL' && (!trialEndDate || trialEndDate.getTime() > Date.now());
        const isActive = user.subscriptionStatus === 'ACTIVE' || trialActive;

        if (isSubscriptionOwnerRole && !isActive && path !== SUBS_PATH) {
          navigate(SUBS_PATH, { replace: true });
        }
      })
      .finally(() => { inFlight.current = false; });
  }, [location.key, navigate]);

  return null;
}
