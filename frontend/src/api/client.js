// frontend/src/api/client.js
import axios from 'axios';
import { getAuthToken, removeAuthToken, saveAuthToken } from '../lib/auth.js';

// Determine the base URL. Use the environment variable if it exists, otherwise use the current page's origin.
const envCandidates = [
  import.meta?.env?.VITE_API_BASE_URL,
  import.meta?.env?.VITE_API_BASE,
  typeof process !== 'undefined' ? process.env?.VITE_API_BASE_URL : undefined,
  typeof process !== 'undefined' ? process.env?.VITE_API_BASE : undefined,
];
const rawEnvBase = envCandidates.find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';
const envBase = rawEnvBase.trim().length > 0 ? rawEnvBase.trim() : null;

function getWindowOrigin() {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '';
  }
  return window.location.origin;
}

const defaultOrigin = getWindowOrigin().replace(/\/$/, '');
const baseURL = envBase
  ? envBase.replace(/\/$/, '')
  : defaultOrigin
    ? `${defaultOrigin}/api`
    : '/api';

const API_PATH_PREFIX = '/api';

const apiClient = axios.create({
  baseURL,
  // Don't use withCredentials when using Bearer tokens - it can cause CORS issues
  withCredentials: false,
});

function normalizeRelativeUrl(url) {
  if (!url) return url;

  const stringUrl = `${url}`;
  if (/^https?:\/\//i.test(stringUrl) || stringUrl.startsWith('//')) {
    return stringUrl;
  }

  const hashSegments = stringUrl.split('#');
  const basePart = hashSegments.shift() ?? '';
  const hash = hashSegments.length > 0 ? `#${hashSegments.join('#')}` : '';

  const [pathPart, ...queryParts] = basePart.split('?');

  const withLeadingSlash = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const cleanedPath = withLeadingSlash.replace(/\/{2,}/g, '/');

  const shouldPrefixApi =
    cleanedPath !== API_PATH_PREFIX &&
    !cleanedPath.startsWith(`${API_PATH_PREFIX}/`) &&
    !cleanedPath.startsWith('/socket.io');

  const normalizedPath = shouldPrefixApi
    ? `${API_PATH_PREFIX}${cleanedPath}`
    : cleanedPath;

  const query = queryParts.length > 0 ? `?${queryParts.join('?')}` : '';

  return `${normalizedPath}${query}${hash}`;
}

let refreshRequest = null;

function redirectToSignin() {
  if (typeof window === 'undefined') return;
  const { pathname } = window.location;
  if (!pathname.startsWith('/signin') && !pathname.startsWith('/signup')) {
    window.location.href = '/signin';
  }
}

/**
 * Get CSRF token from cookie
 * @returns {string|null} CSRF token or null
 */
function getCSRFTokenFromCookie() {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'XSRF-TOKEN') {
      return decodeURIComponent(value);
    }
  }
  
  return null;
}

function handleUnauthorized({ error, forceLogout = false }) {
  if (import.meta.env.DEV && error?.config) {
    console.error('[API Client] 401 Unauthorized:', {
      url: error.config.url,
      method: error.config.method,
      response: error.response?.data,
    });
  }

  if (forceLogout) {
    removeAuthToken();
    if (typeof window !== 'undefined') {
      window._401ErrorCount = 0;
      window._last401Error = Date.now();
    }
    redirectToSignin();
    return;
  }

  if (typeof window === 'undefined') return;

  const now = Date.now();
  const lastError = window._last401Error || 0;
  const errorCount = window._401ErrorCount || 0;

  if (now - lastError < 5000) {
    window._401ErrorCount = errorCount + 1;

    if (window._401ErrorCount >= 3) {
      removeAuthToken();
      redirectToSignin();
    }
  } else {
    window._401ErrorCount = 1;
  }

  window._last401Error = now;
}

async function requestNewAccessToken() {
  if (!refreshRequest) {
    refreshRequest = apiClient
      .post('/auth/refresh', {}, {
        withCredentials: true,
        __isRefreshRequest: true,
        _skipAuth: true,
      })
      .then((response) => {
        const newToken = response.data?.token || response.data?.accessToken;
        if (!newToken) {
          throw new Error('Refresh response did not include an access token');
        }
        saveAuthToken(newToken);
        return newToken;
      })
      .catch((error) => {
        removeAuthToken();
        throw error;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

// Request interceptor: Attach auth token to every request
apiClient.interceptors.request.use(
  (config) => {
    if (typeof config.url === 'string') {
      config.url = normalizeRelativeUrl(config.url);
    }

    if (config.__isRefreshRequest || config._skipAuth) {
      if (config.headers?.Authorization) {
        delete config.headers.Authorization;
      }
      return config;
    }

    const ensureHeadersObject = () => {
      if (!config.headers) {
        config.headers = {};
      }
      return config.headers;
    };

    const normaliseHeaderAccess = (headers) => ({
      set(name, value) {
        if (typeof headers.set === 'function') {
          headers.set(name, value);
        } else {
          headers[name] = value;
        }
      },
      delete(name) {
        if (typeof headers.delete === 'function') {
          headers.delete(name);
        } else {
          delete headers[name];
          delete headers[name?.toLowerCase?.()];
        }
      },
      get(name) {
        if (typeof headers.get === 'function') {
          return headers.get(name);
        }
        return headers[name] ?? headers[name?.toLowerCase?.()];
      },
    });

    const headers = normaliseHeaderAccess(ensureHeadersObject());

    const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;

    if (isFormData) {
      headers.delete('Content-Type');
    } else if (
      config.data !== undefined &&
      config.data !== null &&
      typeof config.data === 'object' &&
      !(config.data instanceof URLSearchParams)
    ) {
      headers.set('Content-Type', 'application/json');
    }

    // Attach the auth token to the request
    try {
      const token = getAuthToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      // Only log in development mode and avoid excessive logging
      // Removed: debug logs that were polluting console in production
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[API Client] Error attaching auth token:', error);
      }
    }

    // Attach CSRF token for state-changing requests
    const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (stateChangingMethods.includes(config.method?.toUpperCase())) {
      try {
        // Get CSRF token from cookie (set by backend)
        const csrfToken = getCSRFTokenFromCookie();
        if (csrfToken) {
          headers.set('X-XSRF-TOKEN', csrfToken);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[API Client] Error attaching CSRF token:', error);
        }
      }
    }

    return config;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('[API Client] Request interceptor error:', error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 errors with refresh flow
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    if (status === 401) {
      const originalRequest = error.config || {};

      if (originalRequest.__isRefreshRequest) {
        handleUnauthorized({ error, forceLogout: true });
        return Promise.reject(error);
      }

      const url = originalRequest.url || '';
      const skipRefresh =
        originalRequest._retry === true ||
        ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].some((path) => url.includes(path));

      if (!skipRefresh) {
        originalRequest._retry = true;
        try {
          const newToken = await requestNewAccessToken();
          if (newToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(originalRequest);
          }
        } catch (refreshError) {
          handleUnauthorized({ error: refreshError, forceLogout: true });
          return Promise.reject(refreshError);
        }
      }

      handleUnauthorized({ error });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
export { apiClient };