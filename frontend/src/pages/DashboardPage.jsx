import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Chip,
  IconButton,
  Paper,
  Divider,
  Stack,
  Skeleton,
} from '@mui/material';
import {
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  AccessTime as AccessTimeIcon, // Import clock icon for trial
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import GradientButton from '../components/GradientButton';
import AnalyticsCharts from '../components/AnalyticsCharts';
import UpgradePromptModal from '../components/UpgradePromptModal';
import PageShell from '../components/PageShell';
import RoleRouter from '../components/RoleRouter';
import OnboardingChecklist from '../components/OnboardingChecklist';
import DashboardControls from '../components/DashboardControls';
import { useCurrentUser } from '../context/UserContext.jsx'; // Hook to reactively read user data
import { useDashboardPreferences } from '../hooks/useDashboardPreferences';
import { calculateDaysRemaining, formatDateTime } from '../utils/date.js';
import { redirectToBillingPortal } from '../utils/billing.js';
import { queryKeys } from '../utils/queryKeys.js';

// Skeleton component for stat cards - shows immediately while data loads
const StatCardSkeleton = () => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={16} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="40%" height={40} sx={{ mb: 1.5 }} />
          <Stack spacing={0.5}>
            <Skeleton variant="text" width="80%" height={20} />
            <Skeleton variant="text" width="70%" height={20} />
          </Stack>
        </Box>
        <Skeleton variant="rounded" width={48} height={48} sx={{ borderRadius: 2 }} />
      </Box>
    </CardContent>
  </Card>
);

// Skeleton for activity items
const ActivityItemSkeleton = () => (
  <Box sx={{ display: 'flex', gap: 2, p: 2 }}>
    <Skeleton variant="rounded" width={44} height={44} />
    <Box sx={{ flex: 1 }}>
      <Skeleton variant="text" width="60%" height={20} />
      <Skeleton variant="text" width="80%" height={16} sx={{ mt: 0.5 }} />
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Skeleton variant="rounded" width={60} height={24} />
        <Skeleton variant="text" width={80} height={16} />
      </Stack>
    </Box>
  </Box>
);

// Full dashboard skeleton layout - shows the structure immediately
const DashboardSkeleton = () => (
  <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
    {/* Header skeleton */}
    <Box sx={{ mb: 4 }}>
      <Skeleton variant="text" width={200} height={40} />
      <Skeleton variant="text" width={350} height={24} sx={{ mt: 1 }} />
    </Box>

    {/* Stats Cards skeleton */}
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {[1, 2, 3, 4].map((i) => (
        <Grid item xs={12} sm={6} md={3} key={i}>
          <StatCardSkeleton />
        </Grid>
      ))}
    </Grid>

    {/* Content skeleton */}
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Skeleton variant="text" width={150} height={28} sx={{ mb: 2 }} />
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1}>
            {[1, 2, 3, 4].map((i) => (
              <ActivityItemSkeleton key={i} />
            ))}
          </Stack>
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Skeleton variant="text" width={120} height={28} sx={{ mb: 2 }} />
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rounded" height={40} sx={{ borderRadius: 1 }} />
            ))}
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  </Container>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { user: currentUser } = useCurrentUser();

  // Dashboard preferences hook
  const {
    autoRefresh,
    toggleAutoRefresh,
    refreshInterval,
    setRefreshInterval,
    canShowUpgradeModal,
    markUpgradeModalShown,
    setHideUpgradeModal,
  } = useDashboardPreferences();

  useEffect(() => {
    // Update the time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    // Cleanup interval on component unmount
    return () => clearInterval(timer);
  }, []);

  // Fetch dashboard summary
  // staleTime: Show cached data immediately, refetch in background after 30s
  // This eliminates loading screen on subsequent visits
  const {
    data: summary = { properties: {}, units: {}, jobs: {}, inspections: {}, serviceRequests: {} },
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/summary');
      // Backend returns { success: true, summary: {...} }
      return response.data?.summary || response.data;
    },
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false, // 5 minutes
  });

  // Fetch recent activity
  const { data: activity } = useQuery({
    queryKey: queryKeys.dashboard.activity(),
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/activity?limit=10');
      // Backend returns { success: true, items: [...] }
      return response.data?.items || response.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false,
  });

  // Fetch overdue inspections
  const { data: overdueData } = useQuery({
    queryKey: queryKeys.inspections.overdue(),
    queryFn: async () => {
      const response = await apiClient.get('/inspections/overdue');
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false,
  });

  const overdueInspections = overdueData?.inspections || [];

  const handleRefresh = () => {
    refetch();
  };

  // --- Subscription Status Logic ---
  const subscriptionStatus = currentUser?.subscriptionStatus;
  const trialEndDate = currentUser?.trialEndDate;
  const trialDaysRemaining = calculateDaysRemaining(trialEndDate);

  const isTrialActive = subscriptionStatus === 'TRIAL' && trialDaysRemaining > 0;
  const isSubscribed = subscriptionStatus === 'ACTIVE';

  // Show upgrade prompt at strategic moments for trial users
  useEffect(() => {
    // Check if we can show the modal (respects user preferences and throttling)
    if (!isSubscribed && canShowUpgradeModal() && summary) {
      // Show modal after user has made some progress
      const hasProgress =
        (summary.properties?.total || 0) >= 2 || // Created 2+ properties
        (summary.inspections?.total || 0) >= 1 || // Created an inspection
        (summary.jobs?.total || 0) >= 2; // Created 2+ jobs

      // Or show if trial is ending soon (3 days or less)
      const isTrialEndingSoon = isTrialActive && trialDaysRemaining <= 3;

      if (hasProgress || isTrialEndingSoon) {
        // Delay showing modal slightly so it doesn't feel intrusive
        const timer = setTimeout(() => {
          setShowUpgradeModal(true);
          markUpgradeModalShown();
        }, 3000); // Show after 3 seconds

        return () => clearTimeout(timer);
      }
    }
  }, [summary, isSubscribed, isTrialActive, trialDaysRemaining, canShowUpgradeModal, markUpgradeModalShown]);

  // Show skeleton layout while loading - maintains visual structure
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <DataState
          type="error"
          message="Failed to load dashboard"
          onRetry={refetch}
        />
      </Container>
    );
  }

  // Filter out the generic "no subscription" alert if we are handling it separately
  const activityItems = Array.isArray(activity) ? activity : [];

  return (
    <>
      <RoleRouter />
      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <PageShell
          title="Dashboard"
          subtitle="Welcome back! Here's what's happening with your properties."
          actions={(
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                onClick={handleRefresh}
                color="primary"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'rgba(185, 28, 28, 0.08)',
                    transform: 'rotate(180deg)',
                  },
                }}
              >
                <RefreshIcon />
              </IconButton>
              <GradientButton
                startIcon={<AddIcon />}
                onClick={() => navigate('/properties', { state: { openCreateDialog: true } })}
                size="large"
                sx={{ width: { xs: '100%', md: 'auto' } }}
              >
                Add Property
              </GradientButton>
            </Stack>
          )}
          contentSpacing={{ xs: 3, md: 4 }}
        >
          <DashboardControls
            onRefresh={handleRefresh}
            autoRefresh={autoRefresh}
            toggleAutoRefresh={toggleAutoRefresh}
            refreshInterval={refreshInterval}
            setRefreshInterval={setRefreshInterval}
          />

          {/* Overdue Inspections Alert */}
          {overdueInspections.length > 0 && (
            <Alert
              severity="error"
              icon={<WarningIcon />}
              sx={{
                mb: 3,
                animation: 'fade-in-down 0.5s ease-out',
                borderLeft: { xs: '3px solid #dc2626', sm: '4px solid #dc2626' },
                '& .MuiAlert-action': {
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  pt: { xs: 0.5, sm: 0 },
                },
              }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => navigate('/inspections', { state: { filter: 'overdue' } })}
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    py: { xs: 0.5, sm: 0.75 },
                    px: { xs: 1, sm: 1.5 },
                  }}
                >
                  View All
                </Button>
              }
            >
              <AlertTitle sx={{ fontWeight: 700, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                {overdueInspections.length} Overdue Inspection{overdueInspections.length > 1 ? 's' : ''}
              </AlertTitle>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {overdueInspections.slice(0, 3).map((inspection) => (
                  <Box
                    key={inspection.id}
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      gap: { xs: 0.75, sm: 1 },
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                    onClick={() => navigate(`/inspections/${inspection.id}`)}
                  >
                    <Chip
                      label={`${inspection.daysOverdue} day${inspection.daysOverdue > 1 ? 's' : ''} overdue`}
                      size="small"
                      color="error"
                      sx={{
                        fontWeight: 600,
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        height: { xs: 20, sm: 24 },
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        wordBreak: 'break-word',
                      }}
                    >
                      {inspection.title} - {inspection.property?.name}
                      {inspection.unit ? ` (Unit ${inspection.unit.unitNumber})` : ''}
                    </Typography>
                  </Box>
                ))}
                {overdueInspections.length > 3 && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                    and {overdueInspections.length - 3} more...
                  </Typography>
                )}
              </Stack>
            </Alert>
          )}

          {/* Onboarding Checklist */}
          <OnboardingChecklist />

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4, animation: 'fade-in-up 0.6s ease-out' }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Properties"
                value={summary?.properties?.total || 0}
                icon={<HomeIcon />}
                color="#3b82f6"
                details={[
                  { label: 'Active', value: summary?.properties?.active || 0 },
                  { label: 'Inactive', value: summary?.properties?.inactive || 0 },
                ]}
                onClick={() => navigate('/properties')}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Units"
                value={summary?.units?.total || 0}
                icon={<HomeIcon />}
                color="#10b981"
                details={[
                  { label: 'Occupied', value: summary?.units?.occupied || 0 },
                  { label: 'Available', value: summary?.units?.available || 0 },
                ]}
                onClick={() => navigate('/properties')}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Jobs"
                value={summary?.jobs?.total || 0}
                icon={<BuildIcon />}
                color="#f59e0b"
                details={[
                  { label: 'Open', value: summary?.jobs?.open || 0 },
                  { label: 'In Progress', value: summary?.jobs?.inProgress || 0 },
                  { label: 'Overdue', value: summary?.jobs?.overdue || 0, alert: true },
                ]}
                onClick={() => navigate('/jobs')}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Inspections"
                value={summary?.inspections?.total || 0}
                icon={<AssignmentIcon />}
                color="#8b5cf6"
                details={[
                  { label: 'Scheduled', value: summary?.inspections?.scheduled || 0 },
                  { label: 'Upcoming', value: summary?.inspections?.upcoming || 0 },
                ]}
                onClick={() => navigate('/inspections')}
              />
            </Grid>
          </Grid>

          {/* Analytics Charts Section */}
          {isSubscribed && (
            <Box sx={{ mb: 4 }}>
              <AnalyticsCharts months={6} />
            </Box>
          )}

          <Grid container spacing={3} sx={{ animation: 'fade-in 0.7s ease-out' }}>
            {/* Recent Activity */}
            <Grid item xs={12} md={8}>
              <Paper
                sx={{
                  p: { xs: 2.5, md: 3.5 },
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.1)',
                  },
                }}
              >
                <Typography variant="h6" gutterBottom fontWeight={700}>
                  Recent Activity
                </Typography>
                <Divider sx={{ mb: 2.5 }} />
                {activityItems.length === 0 ? (
                  <DataState
                    type="empty"
                    message="No recent activity"
                    icon={<InfoIcon />}
                  />
                ) : (
                  <Stack spacing={2}>
                    {activityItems.map((item) => (
                      <ActivityItem key={item.id} item={item} />
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12} md={4}>
              <Paper
                sx={{
                  p: { xs: 2.5, md: 3.5 },
                  mb: 3,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.1)',
                  },
                }}
              >
                <Typography variant="h6" gutterBottom fontWeight={700}>
                  Quick Actions
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/properties', { state: { openCreateDialog: true } })}
                  >
                    Add Property
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<AssignmentIcon />}
                    onClick={() => navigate('/inspections', { state: { openCreateDialog: true } })}
                  >
                    Schedule Inspection
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<BuildIcon />}
                    onClick={() => navigate('/jobs', { state: { openCreateDialog: true } })}
                  >
                    Create Job
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate('/service-requests')}
                  >
                    View Requests
                  </Button>
                </Stack>
              </Paper>

              {/* Service Requests Summary (if applicable) */}
              {summary?.serviceRequests && summary.serviceRequests.total > 0 && (
                <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" gutterBottom fontWeight={700}>
                    Service Requests
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Submitted
                      </Typography>
                      <Chip
                        label={summary.serviceRequests.submitted || 0}
                        size="small"
                        color="warning"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Under Review
                      </Typography>
                      <Chip
                        label={summary.serviceRequests.underReview || 0}
                        size="small"
                        color="info"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Approved
                      </Typography>
                      <Chip
                        label={summary.serviceRequests.approved || 0}
                        size="small"
                        color="success"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Converted to Jobs
                      </Typography>
                      <Chip
                        label={summary.serviceRequests.converted || 0}
                        size="small"
                        color="primary"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Completed
                      </Typography>
                      <Chip
                        label={summary.serviceRequests.completed || 0}
                        size="small"
                        color="default"
                      />
                    </Box>
                    <Button
                      fullWidth
                      size="small"
                      sx={{ mt: 2 }}
                      onClick={() => navigate('/service-requests')}
                    >
                      View All
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Grid>
          </Grid>
        </PageShell>

        {/* Upgrade Prompt Modal */}
        <UpgradePromptModal
          open={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          trigger={trialDaysRemaining <= 3 ? 'milestone' : 'milestone'}
          onNeverShowAgain={() => setHideUpgradeModal(true)}
        />
      </Container>
    </>
  );
};

// Stat Card Component
const StatCard = ({ title, value, icon, color, details, onClick }) => {
  const detailItems = Array.isArray(details) ? details : [];

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': onClick
          ? {
              transform: 'translateY(-4px)',
              boxShadow: 4,
            }
          : {},
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'flex-start' },
            gap: { xs: 2, sm: 3 },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography color="text.secondary" variant="overline" gutterBottom sx={{ letterSpacing: 0.8 }}>
              {title}
            </Typography>
            <Typography
              variant="h3"
              component="div"
              sx={{ mb: 1.5, fontSize: { xs: '2rem', md: '2.5rem' }, fontWeight: 700 }}
            >
              {value}
            </Typography>
            {detailItems.length > 0 && (
              <Stack spacing={0.5}>
                {detailItems.map((detail, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {detail.label}:
                    </Typography>
                    <Chip
                      label={detail.value}
                      size="small"
                      color={detail.alert && detail.value > 0 ? 'error' : 'default'}
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
          <Box
            sx={{
              bgcolor: color,
              color: 'white',
              borderRadius: 2,
              p: 1.5,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              alignSelf: { xs: 'flex-start', sm: 'center' },
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Activity Item Component
const ActivityItem = ({ item }) => {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    const normalizedStatus = status ? status.toUpperCase() : '';
    const statusColors = {
      COMPLETED: 'success',
      IN_PROGRESS: 'info',
      SCHEDULED: 'default',
      OPEN: 'warning',
      ASSIGNED: 'info',
      ACTIVE: 'success',
      INACTIVE: 'default',
      UNDER_MAINTENANCE: 'warning',
      AVAILABLE: 'success',
      OCCUPIED: 'info',
      MAINTENANCE: 'warning',
      SUBMITTED: 'warning',
      UNDER_REVIEW: 'info',
      APPROVED: 'success',
      CONVERTED_TO_JOB: 'primary',
      REJECTED: 'error',
      CANCELLED: 'default',
      SYSTEM: 'info',
      NOTIFICATION: 'info',
      INSPECTION_SCHEDULED: 'info',
      INSPECTION_REMINDER: 'info',
      JOB_ASSIGNED: 'info',
      JOB_COMPLETED: 'success',
      SERVICE_REQUEST_UPDATE: 'info',
      SUBSCRIPTION_EXPIRING: 'warning',
      PAYMENT_DUE: 'warning',
    };
    return statusColors[normalizedStatus] || 'default';
  };

  const getIcon = (type) => {
    const icons = {
      inspection: <AssignmentIcon fontSize="small" />,
      job: <BuildIcon fontSize="small" />,
      property: <HomeIcon fontSize="small" />,
      unit: <HomeIcon fontSize="small" />,
      service_request: <BuildIcon fontSize="small" />,
      notification: <InfoIcon fontSize="small" />,
    };
    return icons[type] || <InfoIcon fontSize="small" />;
  };

  const getIconColor = (type) => {
    const colors = {
      property: '#3b82f6', // Blue - matches Properties card
      unit: '#10b981',     // Green - matches Units card
      job: '#f59e0b',      // Orange - matches Jobs card
      inspection: '#8b5cf6', // Purple - matches Inspections card
      service_request: '#f59e0b', // Orange - same as jobs
      notification: '#3b82f6', // Blue - info color
    };
    return colors[type] || '#3b82f6'; // Default to blue
  };

  const getRoute = (type, id, currentItem) => {
    const routes = {
      inspection: '/inspections',
      job: '/jobs',
      service_request: '/service-requests',
    };
    if (type === 'unit' || type === 'property' || type === 'notification') {
      return currentItem?.link;
    }
    return routes[type];
  };

  const route = item.link || getRoute(item.type, item.id, item);
  const isClickable = Boolean(route);
  const statusLabel = item.status ? item.status.replace(/_/g, ' ') : null;
  const priorityLabel = item.priority ? item.priority.replace(/_/g, ' ') : null;
  const formattedDate = item.date
    ? formatDateTime(item.date)
    : 'Date unavailable';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'flex-start' },
        gap: { xs: 1.5, sm: 2 },
        p: 2,
        borderRadius: 1,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background-color 0.2s',
        '&:hover': isClickable
          ? {
              bgcolor: 'action.hover',
            }
          : undefined,
      }}
      onClick={isClickable ? () => navigate(route) : undefined}
    >
      <Box
        sx={{
          bgcolor: getIconColor(item.type),
          color: 'white',
          borderRadius: 1,
          p: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
        }}
      >
        {getIcon(item.type)}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {item.title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          gutterBottom
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.description || 'No additional details provided.'}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            rowGap: 0.5,
            mt: 0.5,
          }}
        >
          {statusLabel && (
            <Chip
              label={statusLabel}
              size="small"
              color={getStatusColor(item.status)}
            />
          )}
          {priorityLabel && (
            <Chip label={priorityLabel} size="small" variant="outlined" />
          )}
          <Typography variant="caption" color="text.secondary">
            {formattedDate}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardPage;