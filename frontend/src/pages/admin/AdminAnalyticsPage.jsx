import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
  People,
  MonitorHeart,
  Work,
  Assignment,
  Build,
  Insights,
  Paid,
} from '@mui/icons-material';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiClient } from '../../api/client';
import logger from '../../utils/logger';

const PERIOD_OPTIONS = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

const PIE_COLORS = ['#b91c1c', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** idx;
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatHours(value) {
  if (!Number.isFinite(value)) return '—';
  if (value < 24) return `${value.toFixed(1)}h`;
  return `${(value / 24).toFixed(1)}d`;
}

function StatCard({ title, value, icon, color = 'primary', loading }) {
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

function TabPanel({ children, value, tabValue }) {
  return (
    <Box role="tabpanel" hidden={value !== tabValue} sx={{ pt: 2 }}>
      {value === tabValue ? children : null}
    </Box>
  );
}

export default function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [userAnalytics, setUserAnalytics] = useState(null);
  const [subscriptionAnalytics, setSubscriptionAnalytics] = useState(null);
  const [operationsAnalytics, setOperationsAnalytics] = useState(null);
  const [productAnalytics, setProductAnalytics] = useState(null);
  const [revenueAnalytics, setRevenueAnalytics] = useState(null);
  const [health, setHealth] = useState(null);
  const [observability, setObservability] = useState(null);
  const [trafficAnalytics, setTrafficAnalytics] = useState(null);

  const userGrowth = userAnalytics?.userGrowth || [];

  const subscriptionDistribution = useMemo(() => {
    const dist = subscriptionAnalytics?.distribution;
    if (!Array.isArray(dist)) return [];
    return dist
      .map((d) => ({ plan: d.subscriptionPlan || 'UNKNOWN', count: Number(d._count) || 0 }))
      .filter((d) => d.count > 0);
  }, [subscriptionAnalytics]);

  const userGrowthSeries = useMemo(() => {
    if (!Array.isArray(userGrowth) || userGrowth.length === 0) {
      return { data: [], roles: [] };
    }

    const roles = Array.from(new Set(userGrowth.map((row) => row.role).filter(Boolean))).sort();
    const byDate = new Map();

    userGrowth.forEach((row) => {
      const date = String(row.date || '');
      if (!byDate.has(date)) byDate.set(date, { date });
      const entry = byDate.get(date);
      const role = row.role || 'UNKNOWN';
      entry[role] = (entry[role] || 0) + (Number(row.count) || 0);
    });

    const data = Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // Ensure all series keys exist for consistent legend/tooltips
    data.forEach((row) => {
      roles.forEach((role) => {
        if (row[role] == null) row[role] = 0;
      });
    });

    return { data, roles };
  }, [userGrowth]);

  const subscriptionPieData = useMemo(() => {
    return subscriptionDistribution
      .map((row) => ({ name: String(row.plan).replace('_', ' '), value: row.count }))
      .filter((row) => row.value > 0);
  }, [subscriptionDistribution]);

  const signupsByRole = useMemo(() => {
    if (!Array.isArray(userGrowth) || userGrowth.length === 0) return [];
    const totals = new Map();
    userGrowth.forEach((row) => {
      const role = row.role || 'UNKNOWN';
      totals.set(role, (totals.get(role) || 0) + (Number(row.count) || 0));
    });
    return Array.from(totals.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);
  }, [userGrowth]);

  const subscriptionMetrics = subscriptionAnalytics?.metrics || {};

  const operationsSeries = useMemo(() => {
    const series = operationsAnalytics?.timeSeries;
    if (!Array.isArray(series)) return [];
    return [...series].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [operationsAnalytics]);

  const operationsBacklog = operationsAnalytics?.backlog || {};
  const operationsCycleTimes = operationsAnalytics?.cycleTimes || {};

  const productFunnel = productAnalytics?.funnel || {};
  const productFunnelSteps = Array.isArray(productFunnel?.steps) ? productFunnel.steps : [];
  const productRetentionSeries = useMemo(() => {
    const series = productAnalytics?.retention?.series;
    if (!Array.isArray(series)) return [];
    return [...series].sort((a, b) => String(a.week).localeCompare(String(b.week)));
  }, [productAnalytics]);

  const revenueSummary = revenueAnalytics?.summary || {};
  const revenueSeries = useMemo(() => {
    const series = revenueAnalytics?.timeSeries;
    if (!Array.isArray(series)) return [];
    return [...series].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [revenueAnalytics]);

  const revenueMrrByPlan = useMemo(() => {
    const byPlan = revenueAnalytics?.mrrByPlan;
    if (!byPlan || typeof byPlan !== 'object') return [];
    return Object.entries(byPlan)
      .map(([plan, row]) => ({
        plan,
        count: Number(row?.count) || 0,
        price: Number(row?.price) || 0,
        revenue: Number(row?.revenue) || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [revenueAnalytics]);

  const telemetry = observability?.telemetry;
  const dq = observability?.dataQuality?.subscriptionConsistency;
  const stripeWebhooks = observability?.stripeWebhooks;

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');

      const [
        usersRes,
        subsRes,
        opsRes,
        productRes,
        revenueRes,
        healthRes,
        obsRes,
        trafficRes,
      ] = await Promise.all([
        apiClient.get('/admin/analytics/users', { params: { period } }),
        apiClient.get('/admin/analytics/subscriptions'),
        apiClient.get('/admin/analytics/operations', { params: { period } }),
        apiClient.get('/admin/analytics/product', { params: { period } }),
        apiClient.get('/admin/analytics/revenue', { params: { period } }),
        apiClient.get('/admin/health'),
        apiClient.get('/admin/observability', { params: { windowMs: 15 * 60 * 1000 } }),
        apiClient.get('/admin/analytics/traffic', { params: { period } }),
      ]);

      setUserAnalytics(usersRes?.data?.data || null);
      setSubscriptionAnalytics(subsRes?.data?.data || null);
      setOperationsAnalytics(opsRes?.data?.data || null);
      setProductAnalytics(productRes?.data?.data || null);
      setRevenueAnalytics(revenueRes?.data?.data || null);
      setHealth(healthRes?.data?.data || null);
      setObservability(obsRes?.data?.data || null);
      setTrafficAnalytics(trafficRes?.data?.data || null);
    } catch (err) {
      logger.error('Failed to fetch admin analytics:', err);
      setError(err?.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Platform-level product and business performance
        </Typography>
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 70 }}>
            Period
          </Typography>
          <ToggleButtonGroup
            value={period}
            exclusive
            size="small"
            onChange={(_, next) => {
              if (next) setPeriod(next);
            }}
          >
            {PERIOD_OPTIONS.map((p) => (
              <ToggleButton key={p.value} value={p.value}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <Button
          variant="contained"
          onClick={fetchAll}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          sx={{ textTransform: 'none' }}
        >
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 1 }}>
        <Tab value="overview" label="Overview" />
        <Tab value="product" label="Product" />
        <Tab value="operations" label="Operations" />
        <Tab value="users" label="Users" />
        <Tab value="subscriptions" label="Subscriptions" />
        <Tab value="revenue" label="Revenue" />
        <Tab value="system" label="System" />
        <Tab value="traffic" label="Traffic" />
      </Tabs>

      <TabPanel value={tab} tabValue="overview">
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Drilldowns
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Use Analytics for trends. Use these pages for operational detail.
                </Typography>
                <Stack spacing={1.25}>
                  <Button
                    variant="contained"
                    startIcon={<DashboardIcon />}
                    onClick={() => navigate('/admin/dashboard')}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                    fullWidth
                  >
                    View Admin Dashboard
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<People />}
                    onClick={() => navigate('/admin/users')}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                    fullWidth
                  >
                    Open User Management
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<MonitorHeart />}
                    onClick={() => setTab('system')}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                    fullWidth
                  >
                    System Health
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  User Signups Trend
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  New users created per day (by role) for {period}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : userGrowthSeries.data.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No signup data available
                  </Typography>
                ) : (
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={userGrowthSeries.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                          }}
                        />
                        <Legend />
                        {userGrowthSeries.roles.map((role, index) => (
                          <Line
                            key={role}
                            type="monotone"
                            dataKey={role}
                            stroke={PIE_COLORS[index % PIE_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}

                {signupsByRole.length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                    {signupsByRole.slice(0, 6).map((row) => (
                      <Chip key={row.role} label={`${row.role}: ${row.count}`} size="small" />
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Plan Mix
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Distribution of property manager subscription plans
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : subscriptionPieData.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No subscription distribution available
                  </Typography>
                ) : (
                  <Box sx={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={subscriptionPieData} dataKey="value" nameKey="name" outerRadius={90}>
                          {subscriptionPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Conversion & Churn
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Based on current subscription statuses
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  <Chip label={`Trial users: ${subscriptionMetrics.trialUsers ?? 0}`} />
                  <Chip label={`Converted (active with trialEndDate): ${subscriptionMetrics.convertedUsers ?? 0}`} />
                  <Chip label={`Conversion rate: ${(subscriptionMetrics.conversionRate ?? 0).toFixed(2)}%`} />
                  <Chip label={`Suspended: ${subscriptionMetrics.suspendedUsers ?? 0}`} color="warning" />
                  <Chip label={`Canceled: ${subscriptionMetrics.canceledUsers ?? 0}`} color="default" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  System Snapshot
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Basic health status (see System tab for details)
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <CircularProgress size={24} />
                ) : !health ? (
                  <Typography variant="body2" color="text.secondary">
                    No health data available
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        icon={<MonitorHeart />}
                        label={health.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
                        color={health.status === 'healthy' ? 'success' : 'error'}
                        size="small"
                      />
                      <Chip
                        label={`DB: ${health.database || 'unknown'}`}
                        color={health.database === 'connected' ? 'success' : 'warning'}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Uptime: {Number.isFinite(health.uptime) ? `${Math.round(health.uptime)}s` : '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Memory RSS: {formatBytes(health.memory?.rss)}
                    </Typography>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} tabValue="users">
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  User Management
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  For user-level details and actions, use the Users page.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<People />}
                  onClick={() => navigate('/admin/users')}
                  sx={{ textTransform: 'none' }}
                >
                  Open User Management
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} tabValue="operations">
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Drilldowns
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Use these pages for operational queues and individual records.
                </Typography>
                <Stack spacing={1.25}>
                  <Button
                    variant="contained"
                    startIcon={<Work />}
                    onClick={() => navigate('/jobs')}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                    fullWidth
                  >
                    Jobs
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Assignment />}
                    onClick={() => navigate('/inspections')}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                    fullWidth
                  >
                    Inspections
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Build />}
                    onClick={() => navigate('/service-requests')}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                    fullWidth
                  >
                    Service Requests
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  title="Open Jobs"
                  value={(operationsBacklog.openJobs ?? 0).toLocaleString()}
                  icon={<Work />}
                  color="warning"
                  loading={loading}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  title="Unassigned Jobs"
                  value={(operationsBacklog.unassignedJobs ?? 0).toLocaleString()}
                  icon={<Work />}
                  color="error"
                  loading={loading}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  title="Overdue Jobs"
                  value={(operationsBacklog.overdueJobs ?? 0).toLocaleString()}
                  icon={<Work />}
                  color="error"
                  loading={loading}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <StatCard
                  title="Pending Inspections"
                  value={(operationsBacklog.pendingInspections ?? 0).toLocaleString()}
                  icon={<Assignment />}
                  color="info"
                  loading={loading}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <StatCard
                  title="Service Requests Backlog"
                  value={(operationsBacklog.serviceRequestsBacklog ?? 0).toLocaleString()}
                  icon={<Build />}
                  color="secondary"
                  loading={loading}
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Jobs Volume
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Created vs completed per day ({period})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : operationsSeries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No operations data available
                  </Typography>
                ) : (
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={operationsSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="jobsCreated" name="Created" stroke={PIE_COLORS[1]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="jobsCompleted" name="Completed" stroke={PIE_COLORS[3]} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Inspections Volume
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Created vs completed per day ({period})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : operationsSeries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No operations data available
                  </Typography>
                ) : (
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={operationsSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="inspectionsCreated" name="Created" stroke={PIE_COLORS[0]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="inspectionsCompleted" name="Completed" stroke={PIE_COLORS[4]} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Service Requests Volume
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Created vs converted to jobs per day ({period})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : operationsSeries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No operations data available
                  </Typography>
                ) : (
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={operationsSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="serviceRequestsCreated" name="Created" stroke={PIE_COLORS[2]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="serviceRequestsConverted" name="Converted" stroke={PIE_COLORS[5]} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Cycle Times
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Average / median / p90
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={`Job completion avg: ${formatHours(operationsCycleTimes.jobCompletion?.avgHours)}`}
                      size="small"
                    />
                    <Chip
                      label={`median: ${formatHours(operationsCycleTimes.jobCompletion?.medianHours)}`}
                      size="small"
                    />
                    <Chip
                      label={`p90: ${formatHours(operationsCycleTimes.jobCompletion?.p90Hours)}`}
                      size="small"
                    />
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={`Inspection completion avg: ${formatHours(operationsCycleTimes.inspectionCompletion?.avgHours)}`}
                      size="small"
                    />
                    <Chip
                      label={`median: ${formatHours(operationsCycleTimes.inspectionCompletion?.medianHours)}`}
                      size="small"
                    />
                    <Chip
                      label={`p90: ${formatHours(operationsCycleTimes.inspectionCompletion?.p90Hours)}`}
                      size="small"
                    />
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={`SR approval avg: ${formatHours(operationsCycleTimes.serviceRequestApproval?.avgHours)}`}
                      size="small"
                    />
                    <Chip
                      label={`median: ${formatHours(operationsCycleTimes.serviceRequestApproval?.medianHours)}`}
                      size="small"
                    />
                    <Chip
                      label={`p90: ${formatHours(operationsCycleTimes.serviceRequestApproval?.p90Hours)}`}
                      size="small"
                    />
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={`SR conversion avg: ${formatHours(operationsCycleTimes.serviceRequestConversion?.avgHours)}`}
                      size="small"
                    />
                    <Chip
                      label={`median: ${formatHours(operationsCycleTimes.serviceRequestConversion?.medianHours)}`}
                      size="small"
                    />
                    <Chip
                      label={`p90: ${formatHours(operationsCycleTimes.serviceRequestConversion?.p90Hours)}`}
                      size="small"
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} tabValue="product">
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  What this measures
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Lightweight product analytics derived from core workflow activity.
                </Typography>
                <Stack spacing={1.25}>
                  <Button
                    variant="outlined"
                    startIcon={<Insights />}
                    onClick={() => setTab('overview')}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                    fullWidth
                  >
                    Back to Overview
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  title="New PM signups"
                  value={(productFunnel.cohortNewPropertyManagers ?? 0).toLocaleString()}
                  icon={<People />}
                  color="primary"
                  loading={loading}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  title="Activated (completed workflow)"
                  value={(productFunnelSteps.find((s) => s.key === 'completed_workflow')?.count ?? 0).toLocaleString()}
                  icon={<Insights />}
                  color="success"
                  loading={loading}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  title="Latest weekly active PMs"
                  value={(productRetentionSeries[productRetentionSeries.length - 1]?.activePropertyManagers ?? 0).toLocaleString()}
                  icon={<Insights />}
                  color="info"
                  loading={loading}
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Activation funnel
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  New property managers in the selected period
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Step</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Conversion</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                          <CircularProgress size={22} />
                        </TableCell>
                      </TableRow>
                    ) : productFunnelSteps.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                          No data
                        </TableCell>
                      </TableRow>
                    ) : (
                      productFunnelSteps.map((step, idx) => {
                        const denom = idx === 0 ? step.count : productFunnelSteps[idx - 1]?.count;
                        const conversion = denom > 0 ? (step.count / denom) * 100 : null;
                        return (
                          <TableRow key={step.key || step.label} hover>
                            <TableCell>{step.label}</TableCell>
                            <TableCell align="right">{Number(step.count || 0).toLocaleString()}</TableCell>
                            <TableCell align="right">{conversion == null ? '—' : `${conversion.toFixed(1)}%`}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Weekly active property managers
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Managers with at least one core workflow action (properties/units/jobs/inspections)
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : productRetentionSeries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No data
                  </Typography>
                ) : (
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={productRetentionSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="activePropertyManagers"
                          name="Active PMs"
                          stroke={PIE_COLORS[0]}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} tabValue="revenue">
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Notes
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Revenue metrics are derived from stored subscription state (Stripe-synced) and plan price assumptions.
                </Typography>
                <Stack spacing={1.25}>
                  <Button
                    variant="outlined"
                    startIcon={<Paid />}
                    onClick={() => navigate('/subscriptions')}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                    fullWidth
                  >
                    Open Billing (User)
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  title="MRR"
                  value={`$${Number(revenueSummary.currentMRR ?? 0).toLocaleString()}`}
                  icon={<Paid />}
                  color="success"
                  loading={loading}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  title="ARR"
                  value={`$${Number(revenueSummary.arr ?? 0).toLocaleString()}`}
                  icon={<Paid />}
                  color="success"
                  loading={loading}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  title="Churn rate"
                  value={`${Number(revenueSummary.churnRate ?? 0).toFixed(2)}%`}
                  icon={<Paid />}
                  color="warning"
                  loading={loading}
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Subscription movement ({period})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  <Chip label={`New subscriptions: ${revenueSummary.newSubscriptionsInPeriod ?? 0}`} />
                  <Chip label={`Cancellations: ${revenueSummary.cancellationsInPeriod ?? 0}`} />
                  <Chip label={`Reactivations: ${revenueSummary.reactivationsInPeriod ?? 0}`} />
                  <Chip label={`Suspended: ${revenueSummary.suspendedCount ?? 0}`} color="warning" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Net MRR movement
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  New MRR minus churned MRR per day
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : revenueSeries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No data
                  </Typography>
                ) : (
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="netMRR" name="Net MRR" stroke={PIE_COLORS[3]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="newMRR" name="New MRR" stroke={PIE_COLORS[1]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="churnedMRR" name="Churned MRR" stroke={PIE_COLORS[0]} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  MRR by plan
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Plan</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">MRR</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          <CircularProgress size={22} />
                        </TableCell>
                      </TableRow>
                    ) : revenueMrrByPlan.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          No data
                        </TableCell>
                      </TableRow>
                    ) : (
                      revenueMrrByPlan.map((row) => (
                        <TableRow key={row.plan} hover>
                          <TableCell>{String(row.plan).replace('_', ' ')}</TableCell>
                          <TableCell align="right">{row.count.toLocaleString()}</TableCell>
                          <TableCell align="right">${row.price.toLocaleString()}</TableCell>
                          <TableCell align="right">${row.revenue.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} tabValue="subscriptions">
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Plan Distribution
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Property manager subscriptions grouped by plan
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : subscriptionPieData.length === 0 ? null : (
                  <Box sx={{ height: 240, mb: 2 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={subscriptionPieData} dataKey="value" nameKey="name" outerRadius={90}>
                          {subscriptionPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                )}
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Plan</TableCell>
                      <TableCell align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                          <CircularProgress />
                        </TableCell>
                      </TableRow>
                    ) : subscriptionDistribution.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                          No data
                        </TableCell>
                      </TableRow>
                    ) : (
                      subscriptionDistribution.map((row) => (
                        <TableRow key={row.plan} hover>
                          <TableCell>{String(row.plan).replace('_', ' ')}</TableCell>
                          <TableCell align="right">{row.count.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Conversion & Churn
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Based on current subscription statuses
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  <Chip label={`Trial users: ${subscriptionMetrics.trialUsers ?? 0}`} />
                  <Chip label={`Converted (active with trialEndDate): ${subscriptionMetrics.convertedUsers ?? 0}`} />
                  <Chip label={`Conversion rate: ${(subscriptionMetrics.conversionRate ?? 0).toFixed(2)}%`} />
                  <Chip label={`Suspended: ${subscriptionMetrics.suspendedUsers ?? 0}`} color="warning" />
                  <Chip label={`Canceled: ${subscriptionMetrics.canceledUsers ?? 0}`} color="default" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} tabValue="system">
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  System Health
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Current backend + database status
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <CircularProgress />
                ) : !health ? (
                  <Typography variant="body2" color="text.secondary">
                    No health data available
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        icon={<MonitorHeart />}
                        label={health.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
                        color={health.status === 'healthy' ? 'success' : 'error'}
                      />
                      <Chip
                        label={`DB: ${health.database || 'unknown'}`}
                        color={health.database === 'connected' ? 'success' : 'warning'}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Uptime: {Number.isFinite(health.uptime) ? `${Math.round(health.uptime)}s` : '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Memory RSS: {formatBytes(health.memory?.rss)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Generated: {formatDateTime(health.timestamp)}
                    </Typography>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Observability (last 15m)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  API latency, error rate, Stripe webhook backlog, and data quality checks
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {loading ? (
                  <CircularProgress />
                ) : !telemetry && !stripeWebhooks && !dq ? (
                  <Typography variant="body2" color="text.secondary">
                    No observability data available
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                      <Chip label={`Requests: ${telemetry?.totals?.requests ?? 0}`} />
                      <Chip
                        label={`Error rate: ${(((telemetry?.totals?.errorRate ?? 0) * 100) || 0).toFixed(2)}%`}
                        color={(telemetry?.totals?.errorRate ?? 0) > 0.02 ? 'warning' : 'success'}
                      />
                      <Chip label={`p95: ${telemetry?.latencyMs?.p95 != null ? `${Math.round(telemetry.latencyMs.p95)}ms` : '—'}`} />
                      <Chip label={`max: ${telemetry?.latencyMs?.max != null ? `${Math.round(telemetry.latencyMs.max)}ms` : '—'}`} />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                      <Chip
                        label={`Stripe webhooks unprocessed: ${stripeWebhooks?.unprocessedCount ?? 0}`}
                        color={(stripeWebhooks?.unprocessedCount ?? 0) > 50 ? 'warning' : 'default'}
                      />
                      <Chip
                        label={
                          stripeWebhooks?.oldestUnprocessed
                            ? `Oldest: ${stripeWebhooks.oldestUnprocessed.eventType} (${stripeWebhooks.oldestUnprocessed.ageMinutes ?? '?'}m)`
                            : 'Oldest: —'
                        }
                      />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                      <Chip
                        label={`PMs missing subscription record: ${dq?.missingSubscriptionCount ?? 0}`}
                        color={(dq?.missingSubscriptionCount ?? 0) > 0 ? 'warning' : 'success'}
                      />
                      <Chip
                        label={`PM subscription mismatches: ${dq?.mismatchCount ?? 0}`}
                        color={(dq?.mismatchCount ?? 0) > 0 ? 'warning' : 'success'}
                      />
                    </Stack>

                    {Array.isArray(telemetry?.topRoutes) && telemetry.topRoutes.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                          Top routes
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Route</TableCell>
                              <TableCell align="right">Count</TableCell>
                              <TableCell align="right">Errors</TableCell>
                              <TableCell align="right">p95</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {telemetry.topRoutes.map((row) => (
                              <TableRow key={`${row.method}-${row.path}`} hover>
                                <TableCell>{`${row.method} ${row.path}`}</TableCell>
                                <TableCell align="right">{Number(row.count || 0).toLocaleString()}</TableCell>
                                <TableCell align="right">{Number(row.errors || 0).toLocaleString()}</TableCell>
                                <TableCell align="right">{row.p95Ms != null ? `${Math.round(row.p95Ms)}ms` : '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} tabValue="traffic">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : trafficAnalytics ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { sm: 'stretch' } }}
            >
              <Box sx={{ flex: 1 }}>
                <StatCard
                  title="Total Visits"
                  value={trafficAnalytics.totalVisits}
                  trend={null}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <StatCard
                  title="Unique Visitors"
                  value={trafficAnalytics.uniqueVisitors}
                  trend={null}
                />
              </Box>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      Top Pages
                    </Typography>
                    <Stack spacing={0.75}>
                      {trafficAnalytics.topPages.map((page, i) => (
                        <Box
                          key={i}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 2,
                            py: 0.5,
                            borderBottom: i === trafficAnalytics.topPages.length - 1 ? 'none' : '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {page.path}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {page?._count?.path ?? 0}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      Top Referrers
                    </Typography>
                    <Stack spacing={0.75}>
                      {trafficAnalytics.topReferrers.map((ref, i) => (
                        <Box
                          key={i}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 2,
                            py: 0.5,
                            borderBottom: i === trafficAnalytics.topReferrers.length - 1 ? 'none' : '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                            {ref.referrer}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {ref?._count?.referrer ?? 0}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Alert severity="info" sx={{ mt: 2 }}>
            No traffic data is available yet for this period.
          </Alert>
        )}
      </TabPanel>
    </Box>
  );
}
