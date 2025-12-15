import { useEffect, useMemo, useState } from 'react';
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
  People,
  TrendingUp,
  Business,
  Assessment,
  Work,
  MonitorHeart,
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
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [dashboardData, setDashboardData] = useState(null);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [subscriptionAnalytics, setSubscriptionAnalytics] = useState(null);
  const [health, setHealth] = useState(null);

  const overview = dashboardData?.overview || {};
  const subscriptionOverviewRows = dashboardData?.subscriptions || [];
  const topPropertyManagers = userAnalytics?.topPropertyManagers || [];
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

  const subscriptionMetrics = subscriptionAnalytics?.metrics || {};

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');

      const [dashboardRes, usersRes, subsRes, healthRes] = await Promise.all([
        apiClient.get('/admin/dashboard'),
        apiClient.get('/admin/analytics/users', { params: { period } }),
        apiClient.get('/admin/analytics/subscriptions'),
        apiClient.get('/admin/health'),
      ]);

      setDashboardData(dashboardRes?.data?.data || null);
      setUserAnalytics(usersRes?.data?.data || null);
      setSubscriptionAnalytics(subsRes?.data?.data || null);
      setHealth(healthRes?.data?.data || null);
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
        <Tab value="users" label="Users" />
        <Tab value="subscriptions" label="Subscriptions" />
        <Tab value="system" label="System" />
      </Tabs>

      <TabPanel value={tab} tabValue="overview">
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Total Users"
              value={(overview.totalUsers || 0).toLocaleString()}
              icon={<People />}
              color="primary"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Active Users (30d)"
              value={(overview.activeUsers || 0).toLocaleString()}
              icon={<People />}
              color="success"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="New Signups (7d)"
              value={(overview.recentSignups || 0).toLocaleString()}
              icon={<TrendingUp />}
              color="info"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Total Properties"
              value={(overview.totalProperties || 0).toLocaleString()}
              icon={<Business />}
              color="secondary"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Total Inspections"
              value={(overview.totalInspections || 0).toLocaleString()}
              icon={<Assessment />}
              color="warning"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Total Jobs"
              value={(overview.totalJobs || 0).toLocaleString()}
              icon={<Work />}
              color="error"
              loading={loading}
            />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Subscription Overview
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Property manager plan/status distribution
                </Typography>
                {loading ? (
                  <CircularProgress size={24} />
                ) : subscriptionOverviewRows.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No subscription data available
                  </Typography>
                ) : (
                  <Stack spacing={1.25}>
                    {subscriptionOverviewRows.map((row) => (
                      <Stack
                        key={`${row.subscriptionPlan}-${row.subscriptionStatus}`}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" fontWeight={500}>
                            {String(row.subscriptionPlan || '').replace('_', ' ')}
                          </Typography>
                          <Chip label={row.subscriptionStatus} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {(row._count || 0).toLocaleString()}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  System Status
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Backend health snapshot
                </Typography>
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
          <Grid item xs={12} lg={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Top Property Managers
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Ranked by number of managed properties
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Plan</TableCell>
                      <TableCell align="right">Managed Properties</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          <CircularProgress />
                        </TableCell>
                      </TableRow>
                    ) : topPropertyManagers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          No data
                        </TableCell>
                      </TableRow>
                    ) : (
                      topPropertyManagers.map((u) => (
                        <TableRow key={u.id} hover>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</TableCell>
                          <TableCell>
                            <Chip label={u.subscriptionPlan || '—'} size="small" />
                          </TableCell>
                          <TableCell align="right">{u._count?.managedProperties ?? 0}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  User Growth
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Daily counts by role for {period}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : userGrowthSeries.data.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No user growth data available
                  </Typography>
                ) : (
                  <Box sx={{ height: 260 }}>
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
      </TabPanel>
    </Box>
  );
}
