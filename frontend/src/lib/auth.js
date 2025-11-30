// frontend/src/lib/auth.js
import { apiClient } from '../api/client.js';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export const USER_UPDATED_EVENT = 'buildstate:user-updated';

function dispatchUserUpdated(user) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    const detail = user ?? null;
    window.dispatchEvent(new CustomEvent(USER_UPDATED_EVENT, { detail }));
  } catch (error) {
    console.error('Failed to dispatch user update event:', error);
  }
}

export function setCurrentUser(user) {
  try {
    if (user) {
      const serialised = typeof user === 'string' ? user : JSON.stringify(user);
      localStorage.setItem('user', serialised);
      const parsed = typeof user === 'string'
        ? (() => { try { return JSON.parse(user); } catch { return null; } })()
        : user;
      dispatchUserUpdated(parsed ?? null);
      return parsed ?? null;
    }

    localStorage.removeItem('user');
  } catch (error) {
    console.error('Failed to persist user data:', error);
  }

  dispatchUserUpdated(null);
  return null;
}

export function getAuthToken() {
  try {
    return localStorage.getItem('auth_token') || localStorage.getItem('token');
  } catch (error) {
    console.error('Failed to read auth token from storage:', error);
    return null;
  }
}

export function saveAuthToken(token) {
  if (!token) {
    removeAuthToken();
    return null;
  }

  try {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('token', token);
  } catch (error) {
    console.error('Failed to persist auth token:', error);
  }

  return token;
}

export function removeAuthToken() {
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token');
  } catch (error) {
    console.error('Failed to clear auth token:', error);
  }

  setCurrentUser(null);
}

export function portalPathForRole(role) {
  switch (role) {
    case 'ADMIN': return '/admin/dashboard';
    case 'PROPERTY_MANAGER': return '/dashboard';
    case 'OWNER': return '/owner/dashboard';
    case 'TECHNICIAN': return '/tech/dashboard';
    case 'TENANT': return '/tenant/dashboard';
    default: return '/dashboard';
  }
}

export function saveTokenFromUrl(autoRedirect = true) {
  try {
    const u = new URL(window.location.href);
    const token = u.searchParams.get('token');
    const next = u.searchParams.get('next') || '/dashboard';
    const userParam = u.searchParams.get('user');
    if (!token) return false;

    saveAuthToken(token);

    if (userParam) {
      try {
        const decoded = decodeURIComponent(userParam);
        setCurrentUser(decoded);
      } catch (error) {
        console.error('Failed to restore user from URL parameter:', error);
      }
    } else if (!localStorage.getItem('user')) {
      apiClient
        .get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => response?.data ?? response)
        .then((payload) => {
          if (!payload?.user) return;
          setCurrentUser(payload.user);
          const target = portalPathForRole(payload.user.role);
          const here = window.location.pathname;
          if (autoRedirect && !here.startsWith(target)) {
            window.location.replace(target);
          }
        })
        .catch(() => {});
    }

    u.searchParams.delete('token'); u.searchParams.delete('next'); u.searchParams.delete('user');
    const cleanedQuery = u.searchParams.toString();
    const cleaned = `${u.pathname}${cleanedQuery ? `?${cleanedQuery}` : ''}${u.hash || ''}`;
    window.history.replaceState({}, '', cleaned);

    if (autoRedirect) window.location.replace(next);
    return true;
  } catch {
    return false;
  }
}

export function isAuthenticated() { return !!getAuthToken(); }
export function getCurrentUser() {
  const userStr = localStorage.getItem('user'); if (!userStr) return null;
  try { return JSON.parse(userStr); } catch (e) { console.error('Error parsing user data:', e); return null; }
}
export async function logout() {
  try {
    await apiClient.post('/auth/logout', undefined, { withCredentials: true });
  } catch (e) { console.warn('Server logout failed (continuing):', e); }
  sessionStorage.clear();
  removeAuthToken();
}

/**
 * Fetches the latest user data from the server and updates localStorage.
 * This is useful after events like subscription changes.
 */
export async function refreshCurrentUser() {
  const token = getAuthToken();
  if (!token) {
    console.warn('Cannot refresh user without an auth token.');
    removeAuthToken();
    return null;
  }

  try {
    const data = await apiClient.get('/auth/me');
    const payload = data?.data ?? data ?? null;
    const user = payload?.user ?? payload ?? null;

    if (user) {
      return setCurrentUser(user);
    }

    removeAuthToken();
    return null;
  } catch (error) {
    console.error('Failed to refresh user data:', error);

    if (error?.status === 401) {
      removeAuthToken();
    }

    return null;
  }
}

