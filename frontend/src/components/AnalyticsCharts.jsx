import { useTheme } from '@mui/material/styles';

const AnalyticsCharts = ({ months = 6 }) => {
  const theme = useTheme();

  // Define dynamic colors based on the theme
  const PIE_COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.warning.main,
    theme.palette.success.main,
    theme.palette.info.main,
    theme.palette.augmentColor({ color: { main: '#8b5cf6' } }).main,
  ];

  const {
    data: analytics,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.dashboard.analytics({ months }),
    queryFn: async () => {
      const response = await apiClient.get(`/dashboard/analytics?months=${months}`);
      return response.data?.data || response.data;
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading analytics...</Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <DataState
          type="error"
          message="Failed to load analytics data"
          onRetry={refetch}
        />
      </Paper>
    );
  }

  if (!analytics) {
    return (
      <Paper sx={{ p: 3 }}>
        <DataState
          type="empty"
          message="No analytics data available"
          icon={<AssessmentIcon />}
        />
      </Paper>
    );
  }

  const { comparison, jobsCompletedOverTime, inspectionCompletionRate, jobsByPriority, serviceRequestCategories } = analytics;
  const gridStrokeColor = theme.palette.mode === 'dark' ? '#4b5563' : '#e5e7eb';
  const axisStrokeColor = theme.palette.mode === 'dark' ? '#9ca3af' : '#6b7280';

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <AssessmentIcon sx={{ color: 'primary.main' }} />
          Analytics Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Performance metrics and insights from the last {months} months
        </Typography>
      </Box>

      {/* Comparison Cards */}
      {comparison && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <ComparisonCard
              title="Jobs Completed"
              thisMonth={comparison.thisMonth.jobs}
              lastMonth={comparison.lastMonth.jobs}
              change={comparison.changes.jobs}
              color={theme.palette.warning.main}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ComparisonCard
              title="Inspections Completed"
              thisMonth={comparison.thisMonth.inspections}
              lastMonth={comparison.lastMonth.inspections}
              change={comparison.changes.inspections}
              color={PIE_COLORS[5]} // Purple
            />
          </Grid>
        </Grid>
      )}

      {/* Line Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={6}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="h6" gutterBottom fontWeight={700}>
              Jobs Completed Over Time
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {jobsCompletedOverTime && jobsCompletedOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={jobsCompletedOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStrokeColor} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: axisStrokeColor }}
                    stroke={axisStrokeColor}
                  />
                  <YAxis tick={{ fontSize: 12, fill: axisStrokeColor }} stroke={axisStrokeColor} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 8,
                      color: theme.palette.text.primary,
                    }}
                  />
                  <Legend wrapperStyle={{ color: theme.palette.text.secondary }} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Jobs Completed"
                    stroke={theme.palette.warning.main}
                    strokeWidth={2}
                    dot={{ fill: theme.palette.warning.main, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <DataState type="empty" message="No job completion data available" />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="h6" gutterBottom fontWeight={700}>
              Inspection Completion Rate
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {inspectionCompletionRate && inspectionCompletionRate.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={inspectionCompletionRate}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStrokeColor} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: axisStrokeColor }}
                    stroke={axisStrokeColor}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: axisStrokeColor }}
                    stroke={axisStrokeColor}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 8,
                      color: theme.palette.text.primary,
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Legend wrapperStyle={{ color: theme.palette.text.secondary }} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="Completion Rate"
                    stroke={PIE_COLORS[5]} // Purple
                    strokeWidth={2}
                    dot={{ fill: PIE_COLORS[5], r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <DataState type="empty" message="No inspection data available" />
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Pie Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="h6" gutterBottom fontWeight={700}>
              Job Distribution by Priority
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {jobsByPriority && jobsByPriority.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={jobsByPriority}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {jobsByPriority.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 8,
                      color: theme.palette.text.primary,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <DataState type="empty" message="No job priority data available" />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="h6" gutterBottom fontWeight={700}>
              Service Request Categories
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {serviceRequestCategories && serviceRequestCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={serviceRequestCategories}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {serviceRequestCategories.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 8,
                      color: theme.palette.text.primary,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <DataState
                type="empty"
                message="No service request category data available"
              />
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Summary Stats */}
      {analytics && (
        <Alert
          severity="info"
          sx={{ mt: 3 }}
          icon={<AssessmentIcon fontSize="inherit" />}
        >
          <Typography variant="body2">
            <strong>Summary:</strong> {analytics.totalJobsCompleted || 0} jobs
            completed, {analytics.completedInspections || 0} of{' '}
            {analytics.totalInspections || 0} inspections completed, and{' '}
            {analytics.totalServiceRequests || 0} service requests processed in
            the last {months} months.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

// Comparison Card Component
const ComparisonCard = ({ title, thisMonth, lastMonth, change, color }) => {
  const getTrendIcon = () => {
    if (change > 0) return <TrendingUpIcon fontSize="small" />;
    if (change < 0) return <TrendingDownIcon fontSize="small" />;
    return <TrendingFlatIcon fontSize="small" />;
  };

  const getTrendColor = () => {
    if (change > 0) return 'success';
    if (change < 0) return 'error';
    return 'default';
  };

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.1)',
        },
      }}
    >
      <CardContent>
        <Typography variant="overline" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 2,
            mb: 2,
          }}
        >
          <Typography
            variant="h3"
            component="div"
            sx={{ fontWeight: 700, color }}
          >
            {thisMonth}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            this month
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Last month: {lastMonth}
          </Typography>
          <Chip
            icon={getTrendIcon()}
            label={`${change > 0 ? '+' : ''}${change}%`}
            size="small"
            color={getTrendColor()}
            sx={{ fontWeight: 600 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default AnalyticsCharts;
