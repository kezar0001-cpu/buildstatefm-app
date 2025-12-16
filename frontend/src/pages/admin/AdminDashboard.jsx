import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  People,
  Business,
  Assessment,
  Work,
  CheckCircle,
} from '@mui/icons-material';
import { apiClient } from '../../api/client';
import logger from '../../utils/logger';

function formatTimeAgo(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function StatCard({ title, value, icon, trend, color = 'primary', loading }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
                {value}
              </Typography>
            )}
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                <TrendingUp fontSize="small" color={trend > 0 ? 'success' : 'error'} />
                <Typography
                  variant="caption"
                  color={trend > 0 ? 'success.main' : 'error.main'}
                  fontWeight={600}
                >
                  {trend > 0 ? '+' : ''}{trend}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  vs last month
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: `${color}.lighter`,
              color: `${color}.main`,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function SubscriptionCard({ data, loading }) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Subscription Overview
          </Typography>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  const total = data?.reduce((sum, item) => sum + item._count, 0) || 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom fontWeight={600}>
          Subscription Overview
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Total Property Managers: {total}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {data?.map((item) => {
            const percentage = total > 0 ? (item._count / total) * 100 : 0;
            const planColors = {
              FREE_TRIAL: 'info',
              STARTER: 'success',
              PROFESSIONAL: 'primary',
              ENTERPRISE: 'secondary',
            };
            const color = planColors[item.subscriptionPlan] || 'primary';

            return (
              <Box key={`${item.subscriptionPlan}-${item.subscriptionStatus}`}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2" fontWeight={500}>
                      {item.subscriptionPlan.replace('_', ' ')}
                    </Typography>
                    <Chip
                      label={item.subscriptionStatus}
                      size="small"
                      color={item.subscriptionStatus === 'ACTIVE' ? 'success' : 'default'}
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {item._count} ({percentage.toFixed(1)}%)
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  color={color}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}

function RecentActivity({ activities, loading }) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom fontWeight={600}>
          Recent Activity
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Latest system events
        </Typography>

        {activities && activities.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {activities.map((activity, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  gap: 2,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                }}
              >
                <CheckCircle color="success" fontSize="small" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {activity.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {activity.description}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {activity.time}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No recent activity
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/dashboard');
      setDashboardData(response.data.data);
      setError('');
    } catch (err) {
      logger.error('Failed to fetch admin dashboard:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Admin Dashboard
        </Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  const overview = dashboardData?.overview || {};
  const subscriptions = dashboardData?.subscriptions || [];
  const recentActivitiesRaw = Array.isArray(dashboardData?.recentActivity) ? dashboardData.recentActivity : [];
  const recentActivities = recentActivitiesRaw.map((row) => ({
    ...row,
    time: formatTimeAgo(row.createdAt),
  }));

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview of your platform's key metrics and activity
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Total Users"
            value={overview.totalUsers?.toLocaleString() || '0'}
            icon={<People />}
            color="primary"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Active Users"
            value={overview.activeUsers?.toLocaleString() || '0'}
            icon={<People />}
            color="success"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="New Signups (7d)"
            value={overview.recentSignups?.toLocaleString() || '0'}
            icon={<TrendingUp />}
            trend={overview.growthRate}
            color="info"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Total Properties"
            value={overview.totalProperties?.toLocaleString() || '0'}
            icon={<Business />}
            color="secondary"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Total Inspections"
            value={overview.totalInspections?.toLocaleString() || '0'}
            icon={<Assessment />}
            color="warning"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Total Jobs"
            value={overview.totalJobs?.toLocaleString() || '0'}
            icon={<Work />}
            color="error"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Subscription Overview and Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <SubscriptionCard data={subscriptions} loading={loading} />
        </Grid>
        <Grid item xs={12} md={6}>
          <RecentActivity activities={recentActivities} loading={loading} />
        </Grid>
      </Grid>
    </Box>
  );
}
