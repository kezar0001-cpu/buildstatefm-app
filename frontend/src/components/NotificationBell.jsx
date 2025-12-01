import { useState, useEffect, useRef, useMemo } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  Stack,
  Chip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { format } from 'date-fns';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';
import io from 'socket.io-client';
import { getAuthToken } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger';

const SOCKET_DISABLED = String(import.meta.env.VITE_NOTIFICATIONS_DISABLE_SOCKET || '').toLowerCase() === 'true';

function normalizePathPrefix(pathname) {
  if (!pathname || pathname === '/') return '';
  const trimmed = `${pathname}`.trim();
  if (!trimmed) return '';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
}

function normalizeSocketPath(path) {
  if (!path) return null;
  const trimmed = `${path}`.trim();
  if (!trimmed) return null;
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
}

function resolveSocketConfiguration() {
  const explicitWsBase =
    import.meta.env.VITE_NOTIFICATIONS_WS_URL || import.meta.env.VITE_NOTIFICATIONS_SOCKET_URL;
  const apiBase =
    explicitWsBase ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_BASE ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  let resolvedUrl;
  try {
    resolvedUrl = new URL(apiBase, typeof window !== 'undefined' ? window.location.origin : undefined);
  } catch (error) {
    logger.warn('[NotificationBell] Failed to parse API base URL for WebSocket configuration:', error);
  }

  const protocol = resolvedUrl?.protocol === 'https:' ? 'wss:' : resolvedUrl?.protocol === 'http:' ? 'ws:' : null;
  const wsUrl = resolvedUrl
    ? `${protocol || 'ws:'}//${resolvedUrl.host}`.replace(/\/+$/, '')
    : apiBase.replace(/^http/, 'ws').replace(/\/+$/, '');

  const basePath = normalizePathPrefix(resolvedUrl?.pathname || '');
  const envSocketPath = normalizeSocketPath(import.meta.env.VITE_NOTIFICATIONS_SOCKET_PATH);

  const pathCandidates = [];
  if (envSocketPath) pathCandidates.push(envSocketPath);
  if (basePath) pathCandidates.push(normalizeSocketPath(`${basePath}/socket.io`));
  pathCandidates.push('/socket.io');
  pathCandidates.push('/api/socket.io');

  const socketPaths = Array.from(new Set(pathCandidates.filter(Boolean)));

  return {
    wsUrl,
    socketPaths,
  };
}

const NOTIFICATION_TYPE_COLORS = {
  INSPECTION_SCHEDULED: 'info',
  INSPECTION_REMINDER: 'warning',
  JOB_ASSIGNED: 'primary',
  JOB_COMPLETED: 'success',
  SERVICE_REQUEST_UPDATE: 'info',
  SUBSCRIPTION_EXPIRING: 'warning',
  PAYMENT_DUE: 'error',
  SYSTEM: 'default',
};

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [forcePollingTransport, setForcePollingTransport] = useState(false);
  const [disableSocketClient, setDisableSocketClient] = useState(false);
  const { wsUrl, socketPaths } = useMemo(() => resolveSocketConfiguration(), []);
  const [socketPathIndex, setSocketPathIndex] = useState(0);
  const activeSocketPath = socketPaths[socketPathIndex] || '/socket.io';
  const queryClient = useQueryClient();
  const socketRef = useRef(null);
  const navigate = useNavigate();

  // Fetch unread count
  const { data: countData } = useQuery({
    queryKey: queryKeys.notifications.count(),
    queryFn: async () => {
      const response = await apiClient.get('/notifications/unread-count');
      return response.data;
    },
    // Use longer polling interval when WebSocket is connected (fallback only)
    // Use shorter interval when WebSocket is not available
    refetchInterval: isWebSocketConnected ? 120000 : 30000, // 2 minutes vs 30 seconds
    initialData: { count: 0 },
    retry: 1,
  });

  // WebSocket connection setup
  useEffect(() => {
    if (SOCKET_DISABLED) {
      logger.info('[NotificationBell] WebSocket connection disabled via configuration');
      setIsWebSocketConnected(false);
      return undefined;
    }

    if (disableSocketClient) {
      logger.info('[NotificationBell] WebSocket client disabled after repeated connection failures');
      setIsWebSocketConnected(false);
      return undefined;
    }

    if (!wsUrl) {
      logger.warn('[NotificationBell] Unable to resolve WebSocket URL; relying on HTTP polling for notifications');
      setIsWebSocketConnected(false);
      return undefined;
    }

    const token = getAuthToken();

    if (!token) {
      logger.warn('[NotificationBell] No auth token available for WebSocket connection');
      return;
    }

    // Initialize Socket.IO client
    const transports = forcePollingTransport ? ['polling'] : ['polling', 'websocket'];

    logger.log('[NotificationBell] Connecting to WebSocket:', {
      url: wsUrl,
      path: activeSocketPath,
      transports,
    });

    const socket = io(wsUrl, {
      auth: {
        token,
      },
      path: activeSocketPath,
      transports,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      logger.log('[NotificationBell] WebSocket connected:', socket.id);
      setIsWebSocketConnected(true);
    });

    socket.on('disconnect', (reason) => {
      logger.log('[NotificationBell] WebSocket disconnected:', reason);
      setIsWebSocketConnected(false);
    });

    socket.on('connect_error', (error) => {
      logger.error(
        `[NotificationBell] WebSocket connection error on path ${activeSocketPath}:`,
        error?.message || error
      );
      setIsWebSocketConnected(false);

      if (!forcePollingTransport) {
        if (socketPathIndex + 1 < socketPaths.length) {
          const nextPath = socketPaths[socketPathIndex + 1];
          logger.warn('[NotificationBell] Retrying WebSocket connection with alternate path:', nextPath);
          setSocketPathIndex((prev) => (prev + 1 < socketPaths.length ? prev + 1 : prev));
          return;
        }

        if (error?.message === 'websocket error' || error?.message === 'xhr poll error') {
          logger.warn('[NotificationBell] Falling back to HTTP polling transport for notifications');
          setForcePollingTransport(true);
          return;
        }
      }

      const statusCode =
        error?.description?.status ||
        error?.context?.status ||
        error?.context?.response?.status ||
        error?.status;

      console.warn(
        `[NotificationBell] Disabling WebSocket after repeated connection failures${
          statusCode ? ` (status ${statusCode})` : ''
        }; relying on HTTP polling.`
      );
      setDisableSocketClient(true);
      setForcePollingTransport(false);
      setSocketPathIndex(0);
    });

    // Listen for new notifications
    socket.on('notification:new', (notification) => {
      logger.log('[NotificationBell] Received new notification:', notification);

      // Invalidate and refetch notification queries to update the UI
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.count() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
    });

    // Listen for notification count updates
    socket.on('notification:count', ({ count }) => {
      logger.log('[NotificationBell] Received notification count update:', count);

      // Update the count in the query cache
      queryClient.setQueryData(queryKeys.notifications.count(), { count });
    });

    // Cleanup on unmount
    return () => {
      logger.log('[NotificationBell] Cleaning up WebSocket connection');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('notification:new');
      socket.off('notification:count');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    activeSocketPath,
    disableSocketClient,
    forcePollingTransport,
    queryClient,
    socketPathIndex,
    socketPaths,
    wsUrl,
  ]);

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async () => {
      const response = await apiClient.get('/notifications?limit=10');
      return ensureArray(response.data, ['notifications', 'items', 'data.items']);
    },
    enabled: Boolean(anchorEl), // Only fetch when menu is open
  });

  const {
    data: dashboardAlerts = [],
    isLoading: isDashboardAlertsLoading,
  } = useQuery({
    queryKey: queryKeys.dashboard.alerts(),
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/summary');
      const summary = response.data?.summary || response.data;
      return ensureArray(summary?.alerts).filter((alert) => alert.id !== 'no_subscription');
    },
    staleTime: 60000,
    refetchInterval: isWebSocketConnected ? 120000 : 30000,
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.count() });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch('/notifications/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.count() });
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(`/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.count() });
    },
  });

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkRead = (id, event) => {
    event.stopPropagation();
    markReadMutation.mutate(id);
  };

  const handleDelete = (id, event) => {
    event.stopPropagation();
    deleteMutation.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  const handleNavigate = (path, event) => {
    if (event) {
      event.stopPropagation();
    }
    if (!path) {
      return;
    }
    handleClose();
    navigate(path);
  };

  const normalizedDashboardAlerts = useMemo(
    () =>
      ensureArray(dashboardAlerts).map((alert, index) => ({
        id: `dashboard-alert-${alert.id || index}`,
        title: alert.title || 'Dashboard Alert',
        message: alert.message || '',
        type: (alert.type || 'system').toString().toUpperCase(),
        createdAt: alert.createdAt || new Date().toISOString(),
        action: alert.action,
        source: 'dashboard-alert',
      })),
    [dashboardAlerts],
  );

  const dashboardAlertCount = normalizedDashboardAlerts.length;

  const combinedNotifications = useMemo(
    () => [...ensureArray(notifications), ...normalizedDashboardAlerts],
    [notifications, normalizedDashboardAlerts],
  );

  const resolveChipColor = (type) => {
    if (!type) {
      return 'default';
    }
    const normalizedType = type.toString();
    if (NOTIFICATION_TYPE_COLORS[normalizedType]) {
      return NOTIFICATION_TYPE_COLORS[normalizedType];
    }
    const upperType = normalizedType.toUpperCase();
    if (NOTIFICATION_TYPE_COLORS[upperType]) {
      return NOTIFICATION_TYPE_COLORS[upperType];
    }
    const fallbackMap = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
      SUCCESS: 'success',
    };
    return fallbackMap[upperType] || 'default';
  };

  const unreadCount = (countData && typeof countData === 'object' && 'count' in countData) ? countData.count : 0;
  const badgeCount = unreadCount + dashboardAlertCount;

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen}>
        <Badge badgeContent={badgeCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Notifications</Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
            >
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />

        {(isLoading || isDashboardAlertsLoading) && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Loading...
            </Typography>
          </Box>
        )}

        {!isLoading && !isDashboardAlertsLoading && combinedNotifications.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </Box>
        )}

        {!isLoading && !isDashboardAlertsLoading && combinedNotifications.map((notification) => {
          const isDashboardAlert = notification.source === 'dashboard-alert';
          const chipColor = resolveChipColor(notification.type);

          return (
            <MenuItem
              key={notification.id}
              sx={{
                py: 1.5,
                px: 2,
                bgcolor: notification.isRead && !isDashboardAlert ? 'transparent' : 'action.hover',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              }}
              onClick={() => {
                if (!isDashboardAlert && !notification.isRead) {
                  markReadMutation.mutate(notification.id);
                }
                if (isDashboardAlert && notification.action?.link) {
                  handleNavigate(notification.action.link);
                }
              }}
            >
              <Stack spacing={1} sx={{ width: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {notification.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {notification.message}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={(notification.type || 'ALERT').replace(/_/g, ' ')}
                        size="small"
                        color={chipColor}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(notification.createdAt), 'MMM dd, HH:mm')}
                      </Typography>
                    </Stack>
                    {notification.action?.label && notification.action?.link && (
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={(event) => handleNavigate(notification.action.link, event)}
                        >
                          {notification.action.label}
                        </Button>
                      </Box>
                    )}
                  </Box>
                  {!isDashboardAlert && (
                    <Stack direction="row" spacing={0.5}>
                      {!notification.isRead && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleMarkRead(notification.id, e)}
                          title="Mark as read"
                        >
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={(e) => handleDelete(notification.id, e)}
                        title="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )}
                </Stack>
              </Stack>
            </MenuItem>
          );
        })}

        {!isLoading && !isDashboardAlertsLoading && combinedNotifications.length > 0 && (
          <>
            <Divider />
            <Box sx={{ p: 1, textAlign: 'center' }}>
              <Button size="small" fullWidth onClick={handleClose}>
                Close
              </Button>
            </Box>
          </>
        )}
      </Menu>
    </>
  );
}
