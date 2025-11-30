import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Stack,
  Paper,
  Grid,
  Chip,
  Alert,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

/**
 * Redesigned Complete Inspection Dialog with Two-Column Layout
 * Left: Visual summary with pass/fail counts and charts
 * Right: Findings form
 *
 * @param {Boolean} open - Whether dialog is open
 * @param {Function} onClose - Handler for closing dialog
 * @param {Object} inspection - The inspection object
 * @param {Function} onSubmit - Handler for submitting completion
 * @param {Boolean} isLoading - Whether submission is in progress
 * @param {Array} previewJobs - Preview of jobs to be created
 * @param {Function} onPreviewJobs - Handler for previewing jobs
 */
export const CompleteInspectionDialog = ({
  open,
  onClose,
  inspection,
  onSubmit,
  isLoading = false,
  previewJobs = [],
  onPreviewJobs,
  initialFormData = null,
}) => {
  const [formData, setFormData] = useState({
    findings: '',
    notes: '',
    tags: [],
    autoCreateJobs: true,
    confirmJobCreation: false,
  });

  const [showPreview, setShowPreview] = useState(false);

  // Update form data when initial data changes (e.g., when dialog opens)
  useEffect(() => {
    if (open && initialFormData) {
      setFormData(initialFormData);
    }
  }, [open, initialFormData]);

  // Show preview when previewJobs are received
  useEffect(() => {
    if (previewJobs && previewJobs.length >= 0) {
      setShowPreview(true);
    }
  }, [previewJobs]);

  // Calculate inspection statistics from the inspection data
  const statistics = useMemo(() => {
    // This would be populated from actual inspection checklist/rooms data
    // For now, we'll calculate based on available data
    const rooms = inspection?.rooms || [];
    const issues = inspection?.issues || [];

    const totalRooms = rooms.length;
    const passedRooms = rooms.filter((r) => r.status === 'PASS' || r.passed).length;
    const failedRooms = rooms.filter((r) => r.status === 'FAIL' || r.failed).length;
    const totalIssues = issues.length;
    const criticalIssues = issues.filter((i) => i.severity === 'CRITICAL' || i.priority === 'URGENT').length;
    const highIssues = issues.filter((i) => i.severity === 'HIGH' || i.priority === 'HIGH').length;
    const mediumIssues = issues.filter(
      (i) => i.severity === 'MEDIUM' || i.priority === 'MEDIUM'
    ).length;
    const lowIssues = issues.filter((i) => i.severity === 'LOW' || i.priority === 'LOW').length;

    const totalItems = totalRooms || 1; // Avoid division by zero
    const passRate = ((passedRooms / totalItems) * 100).toFixed(1);

    return {
      totalRooms,
      passedRooms,
      failedRooms,
      passRate,
      totalIssues,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
    };
  }, [inspection]);

  // Chart data for pass/fail visualization
  const chartData = useMemo(() => {
    return [
      { name: 'Passed', value: statistics.passedRooms, color: '#4caf50' },
      { name: 'Failed', value: statistics.failedRooms, color: '#f44336' },
      {
        name: 'Not Inspected',
        value: Math.max(0, statistics.totalRooms - statistics.passedRooms - statistics.failedRooms),
        color: '#9e9e9e',
      },
    ].filter((item) => item.value > 0);
  }, [statistics]);

  // Issues severity chart data
  const issuesChartData = useMemo(() => {
    return [
      { name: 'Critical', value: statistics.criticalIssues, color: '#d32f2f' },
      { name: 'High', value: statistics.highIssues, color: '#f57c00' },
      { name: 'Medium', value: statistics.mediumIssues, color: '#fbc02d' },
      { name: 'Low', value: statistics.lowIssues, color: '#689f38' },
    ].filter((item) => item.value > 0);
  }, [statistics]);

  const handlePreview = async () => {
    if (onPreviewJobs) {
      await onPreviewJobs(formData);
      setShowPreview(true);
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  const handleClose = () => {
    setFormData({
      findings: '',
      notes: '',
      tags: [],
      autoCreateJobs: true,
      confirmJobCreation: false,
    });
    setShowPreview(false);
    onClose();
  };

  const overallStatus = statistics.passRate >= 90 ? 'excellent' : statistics.passRate >= 70 ? 'good' : 'needs-attention';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Complete Inspection</Typography>
          <Typography variant="caption" color="text.secondary">
            {inspection?.title}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Grid container sx={{ minHeight: 500 }}>
          {/* LEFT COLUMN: Visual Summary */}
          <Grid
            item
            xs={12}
            md={5}
            sx={{
              p: 3,
              bgcolor: 'background.default',
              borderRight: { md: 1 },
              borderColor: { md: 'divider' },
            }}
          >
            <Stack spacing={3}>
              {/* Overall Status Banner */}
              <Paper
                sx={{
                  p: 2,
                  bgcolor:
                    overallStatus === 'excellent'
                      ? 'success.light'
                      : overallStatus === 'good'
                      ? 'info.light'
                      : 'warning.light',
                  color:
                    overallStatus === 'excellent'
                      ? 'success.dark'
                      : overallStatus === 'good'
                      ? 'info.dark'
                      : 'warning.dark',
                }}
              >
                <Stack spacing={1} alignItems="center">
                  {overallStatus === 'excellent' ? (
                    <CheckCircleIcon sx={{ fontSize: 48 }} />
                  ) : overallStatus === 'good' ? (
                    <TrendingUpIcon sx={{ fontSize: 48 }} />
                  ) : (
                    <WarningIcon sx={{ fontSize: 48 }} />
                  )}
                  <Typography variant="h3" fontWeight="bold">
                    {statistics.passRate}%
                  </Typography>
                  <Typography variant="body1">
                    {overallStatus === 'excellent'
                      ? 'Excellent Inspection'
                      : overallStatus === 'good'
                      ? 'Good Inspection'
                      : 'Needs Attention'}
                  </Typography>
                </Stack>
              </Paper>

              {/* Pass/Fail Breakdown */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Inspection Breakdown
                </Typography>
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Passed</Typography>
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        {statistics.passedRooms} / {statistics.totalRooms}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(statistics.passedRooms / statistics.totalRooms) * 100}
                      color="success"
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>

                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Failed</Typography>
                      <Typography variant="body2" fontWeight={600} color="error.main">
                        {statistics.failedRooms} / {statistics.totalRooms}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(statistics.failedRooms / statistics.totalRooms) * 100}
                      color="error"
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>
                </Stack>
              </Paper>

              {/* Pass/Fail Pie Chart */}
              {chartData.length > 0 && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Visual Summary
                  </Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Paper>
              )}

              {/* Issues Summary */}
              {statistics.totalIssues > 0 && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Issues Found ({statistics.totalIssues})
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {statistics.criticalIssues > 0 && (
                      <Chip
                        label={`${statistics.criticalIssues} Critical`}
                        color="error"
                        size="small"
                        sx={{ width: 'fit-content' }}
                      />
                    )}
                    {statistics.highIssues > 0 && (
                      <Chip
                        label={`${statistics.highIssues} High`}
                        color="warning"
                        size="small"
                        sx={{ width: 'fit-content' }}
                      />
                    )}
                    {statistics.mediumIssues > 0 && (
                      <Chip
                        label={`${statistics.mediumIssues} Medium`}
                        color="default"
                        size="small"
                        sx={{ width: 'fit-content' }}
                      />
                    )}
                    {statistics.lowIssues > 0 && (
                      <Chip
                        label={`${statistics.lowIssues} Low`}
                        color="success"
                        size="small"
                        sx={{ width: 'fit-content' }}
                      />
                    )}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Grid>

          {/* RIGHT COLUMN: Findings Form */}
          <Grid item xs={12} md={7} sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Typography variant="subtitle2" fontWeight={600}>
                Inspection Completion Details
              </Typography>

              <TextField
                label="Summary of findings"
                multiline
                minRows={4}
                value={formData.findings}
                onChange={(e) => setFormData((prev) => ({ ...prev, findings: e.target.value }))}
                helperText="Tip: Use 'HIGH:' or 'URGENT:' prefix for high-priority items that need follow-up jobs"
                fullWidth
              />

              <TextField
                label="Additional notes"
                multiline
                minRows={3}
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                fullWidth
              />

              <TextField
                label="Tags"
                placeholder="Comma separated (e.g., plumbing, electrical, safety)"
                value={formData.tags.join(', ')}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tags: e.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  }))
                }
                fullWidth
              />

              <Divider />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.autoCreateJobs}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, autoCreateJobs: e.target.checked }))
                    }
                  />
                }
                label="Automatically create follow-up jobs for HIGH/URGENT findings"
              />

              {formData.autoCreateJobs && formData.findings && (
                <Button
                  variant="outlined"
                  onClick={handlePreview}
                  disabled={isLoading || !formData.findings.trim()}
                  size="small"
                >
                  {isLoading ? 'Loading preview...' : 'Preview follow-up jobs'}
                </Button>
              )}

              {showPreview && previewJobs.length > 0 && (
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Follow-up jobs that will be created ({previewJobs.length}):
                  </Typography>
                  <List dense>
                    {previewJobs.map((job, index) => (
                      <ListItem key={index} sx={{ px: 0 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {job.title}
                              </Typography>
                              <Chip
                                label={job.priority}
                                size="small"
                                color={job.priority === 'URGENT' ? 'error' : 'warning'}
                              />
                            </Box>
                          }
                          secondary={job.description}
                        />
                      </ListItem>
                    ))}
                  </List>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.confirmJobCreation}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, confirmJobCreation: e.target.checked }))
                        }
                      />
                    }
                    label="I confirm that I want to create these jobs"
                  />
                </Paper>
              )}

              {showPreview && previewJobs.length === 0 && (
                <Alert severity="info">
                  No high-priority findings detected. Jobs will not be auto-created.
                </Alert>
              )}
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleSubmit}
          startIcon={<CheckCircleIcon />}
          disabled={
            isLoading ||
            (showPreview && previewJobs.length > 0 && !formData.confirmJobCreation)
          }
        >
          {isLoading ? 'Completing...' : 'Complete Inspection'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
