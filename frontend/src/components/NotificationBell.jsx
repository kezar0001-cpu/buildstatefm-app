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
  useMediaQuery,
  useTheme,
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
import { getSocket, isSocketConnected } from '../utils/socketClient';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger';

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
  const queryClient = useQueryClient();
  const socketRef = useRef(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  // WebSocket connection setup using centralized socket client
  useEffect(() => {
    // Get socket instance from centralized client
    const socket = getSocket();

    if (!socket) {
      logger.info('[NotificationBell] Socket.IO not available (disabled or no auth token)');
      setIsWebSocketConnected(false);
      return;
    }

    socketRef.current = socket;

    // Update connection state based on current socket status
    setIsWebSocketConnected(socket.connected);

    // Connection event handlers
    const handleConnect = () => {
      logger.log('[NotificationBell] Socket.IO connected:', socket.id);
      setIsWebSocketConnected(true);
    };

    const handleDisconnect = (reason) => {
      logger.log('[NotificationBell] Socket.IO disconnected:', reason);
      setIsWebSocketConnected(false);
    };

    const handleConnectError = (error) => {
      logger.error('[NotificationBell] Socket.IO connection error:', error?.message || error);
      setIsWebSocketConnected(false);
    };

    // Listen for new notifications
    const handleNotificationNew = (notification) => {
      logger.log('[NotificationBell] Received new notification:', notification);
      // Invalidate and refetch notification queries to update the UI
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.count() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
    };

    // Listen for notification count updates
    const handleNotificationCount = ({ count }) => {
      logger.log('[NotificationBell] Received notification count update:', count);
      // Update the count in the query cache
      queryClient.setQueryData(queryKeys.notifications.count(), { count });
    };

    // Subscribe to events only after connection is established
    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('notification:new', handleNotificationNew);
    socket.on('notification:count', handleNotificationCount);

    // Cleanup on unmount
    return () => {
      logger.log('[NotificationBell] Cleaning up Socket.IO event listeners');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('notification:new', handleNotificationNew);
      socket.off('notification:count', handleNotificationCount);
      socketRef.current = null;
    };
  }, [queryClient]);

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
            width: { xs: 'calc(100vw - 32px)', sm: 400 },
            maxWidth: { xs: 'calc(100vw - 32px)', sm: 400 },
            maxHeight: { xs: 'calc(100vh - 100px)', sm: 500 },
            mt: { xs: 1, sm: 0 },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>Notifications</Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
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
                py: { xs: 1, sm: 1.5 },
                px: { xs: 1.5, sm: 2 },
                bgcolor: notification.isRead && !isDashboardAlert ? 'transparent' : 'action.hover',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
                whiteSpace: 'normal',
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
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, wordBreak: 'break-word' }}>
                      {notification.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: { xs: '0.75rem', sm: '0.875rem' }, wordBreak: 'break-word' }}>
                      {notification.message}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ flexWrap: 'wrap' }}>
                      <Chip
                        label={(notification.type || 'ALERT').replace(/_/g, ' ')}
                        size="small"
                        color={chipColor}
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                        {format(new Date(notification.createdAt), 'MMM dd, HH:mm')}
                      </Typography>
                    </Stack>
                    {notification.action?.label && notification.action?.link && (
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={(event) => handleNavigate(notification.action.link, event)}
                          sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, py: { xs: 0.5, sm: 0.75 } }}
                          fullWidth={false}
                        >
                          {notification.action.label}
                        </Button>
                      </Box>
                    )}
                  </Box>
                  {!isDashboardAlert && (
                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                      {!notification.isRead && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleMarkRead(notification.id, e)}
                          title="Mark as read"
                          sx={{ padding: { xs: '4px', sm: '8px' } }}
                        >
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={(e) => handleDelete(notification.id, e)}
                        title="Delete"
                        sx={{ padding: { xs: '4px', sm: '8px' } }}
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
