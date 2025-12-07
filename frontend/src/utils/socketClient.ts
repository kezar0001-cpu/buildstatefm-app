// frontend/src/utils/socketClient.ts
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../lib/auth';
import logger from './logger';

let socketInstance: Socket | null = null;
let isConnecting = false;

/**
 * Get the API base URL (same logic as apiClient)
 * Returns the base URL without /api suffix since Socket.IO path includes /api/socket.io
 */
function getApiBaseUrl(): string {
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
  let baseURL = envBase
    ? envBase.replace(/\/$/, '')
    : defaultOrigin
      ? `${defaultOrigin}/api`
      : '/api';

  // Remove /api suffix if present (Socket.IO path is /api/socket.io, so base URL should not include /api)
  // Example: https://api.buildstate.com.au/api -> https://api.buildstate.com.au
  baseURL = baseURL.replace(/\/api$/, '');
  
  // If baseURL is empty or just '/', use window origin
  if (!baseURL || baseURL === '/') {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }

  return baseURL;
}

/**
 * Get or create the Socket.IO client instance
 * @returns {Socket|null} Socket.IO client instance or null if not authenticated
 */
export function getSocket(): Socket | null {
  // Check if socket is disabled via environment variable
  const socketDisabled = String(import.meta.env.VITE_NOTIFICATIONS_DISABLE_SOCKET || '').toLowerCase() === 'true';
  if (socketDisabled) {
    logger.info('[socketClient] Socket.IO disabled via VITE_NOTIFICATIONS_DISABLE_SOCKET');
    return null;
  }

  // Return existing instance if connected or connecting
  if (socketInstance?.connected) {
    return socketInstance;
  }

  if (isConnecting) {
    return socketInstance;
  }

  // Get auth token
  const token = getAuthToken();
  if (!token) {
    logger.warn('[socketClient] No auth token available for Socket.IO connection');
    return null;
  }

  // Get API base URL
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    logger.warn('[socketClient] Unable to determine API base URL for Socket.IO connection');
    return null;
  }

  // Disconnect existing instance if it exists but is not connected
  if (socketInstance && !socketInstance.connected) {
    logger.debug('[socketClient] Disconnecting existing socket instance');
    socketInstance.disconnect();
    socketInstance = null;
  }

  // Create new Socket.IO client instance
  isConnecting = true;
  logger.log('[socketClient] Creating Socket.IO connection:', {
    url: apiBaseUrl,
    path: '/api/socket.io',
  });

  socketInstance = io(apiBaseUrl, {
    path: '/api/socket.io',
    transports: ['websocket'],
    withCredentials: true,
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  // Set up connection event handlers
  socketInstance.on('connect', () => {
    logger.log('[socketClient] Socket.IO connected:', socketInstance?.id);
    isConnecting = false;
  });

  socketInstance.on('disconnect', (reason) => {
    logger.log('[socketClient] Socket.IO disconnected:', reason);
    isConnecting = false;
  });

  socketInstance.on('connect_error', (error) => {
    logger.error('[socketClient] Socket.IO connection error:', error?.message || error);
    isConnecting = false;
  });

  return socketInstance;
}

/**
 * Disconnect the Socket.IO client
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    logger.log('[socketClient] Disconnecting Socket.IO client');
    socketInstance.disconnect();
    socketInstance = null;
    isConnecting = false;
  }
}

/**
 * Check if Socket.IO is connected
 */
export function isSocketConnected(): boolean {
  return socketInstance?.connected ?? false;
}

