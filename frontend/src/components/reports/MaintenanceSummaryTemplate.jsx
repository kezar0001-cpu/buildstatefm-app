import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import { format } from 'date-fns';

export default function MaintenanceSummaryTemplate({ reportData, report }) {
  if (!reportData) return null;

  const { property, dateRange, sections, summary } = reportData;

  const overviewSection = sections?.find(s => s.title === 'Overview');
  const statusSection = sections?.find(s => s.title === 'Status Breakdown');
  const prioritySection = sections?.find(s => s.title === 'Priority Breakdown');

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Maintenance Summary Report
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {property?.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Period: {dateRange?.from ? format(new Date(dateRange.from), 'PP') : 'N/A'} - {dateRange?.to ? format(new Date(dateRange.to), 'PP') : 'N/A'}
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Overview Section */}
      {overviewSection?.summary && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Overview
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" fontWeight={700} color="primary">
                    {overviewSection.summary.totalJobs || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Jobs
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" fontWeight={700} color="success.main">
                    {overviewSection.summary.completedJobs || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed Jobs
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" fontWeight={700} color="info.main">
                    {overviewSection.summary.completionRate || '0%'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completion Rate
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" fontWeight={700} color="error.main">
                    ${(overviewSection.summary.totalCosts || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Costs
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" fontWeight={700}>
                    {overviewSection.summary.totalServiceRequests || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Service Requests
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" fontWeight={700}>
                    {overviewSection.summary.averageCompletionTime || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Completion Time
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Status Breakdown */}
      {statusSection && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Status Breakdown
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Count</TableCell>
                  <TableCell>Percentage</TableCell>
                  <TableCell>Visual</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statusSection.items?.map((item, index) => {
                  const percentage = parseFloat(item.percentage || '0');
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Chip label={item.status || 'N/A'} size="small" color={item.status === 'COMPLETED' ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>{item.count || 0}</TableCell>
                      <TableCell>{item.percentage || '0%'}</TableCell>
                      <TableCell>
                        <Box sx={{ width: '100%', maxWidth: 200 }}>
                          <LinearProgress variant="determinate" value={percentage} sx={{ height: 8, borderRadius: 4 }} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Priority Breakdown */}
      {prioritySection && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Priority Breakdown
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Priority</TableCell>
                  <TableCell>Count</TableCell>
                  <TableCell>Percentage</TableCell>
                  <TableCell>Visual</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {prioritySection.items?.map((item, index) => {
                  const percentage = parseFloat(item.percentage || '0');
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Chip 
                          label={item.priority || 'N/A'} 
                          size="small" 
                          color={item.priority === 'URGENT' ? 'error' : item.priority === 'HIGH' ? 'warning' : 'default'} 
                        />
                      </TableCell>
                      <TableCell>{item.count || 0}</TableCell>
                      <TableCell>{item.percentage || '0%'}</TableCell>
                      <TableCell>
                        <Box sx={{ width: '100%', maxWidth: 200 }}>
                          <LinearProgress variant="determinate" value={percentage} sx={{ height: 8, borderRadius: 4 }} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Footer */}
      <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Generated on {reportData.generatedAt ? format(new Date(reportData.generatedAt), 'PPp') : 'N/A'} | BuildState FM
        </Typography>
      </Box>
    </Box>
  );
}

