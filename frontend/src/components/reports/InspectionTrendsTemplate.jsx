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

export default function InspectionTrendsTemplate({ reportData, report }) {
  if (!reportData) return null;

  const { property, dateRange, sections, summary } = reportData;

  const overviewSection = sections?.find(s => s.title === 'Inspection Overview');
  const statusSection = sections?.find(s => s.title === 'Status Breakdown');
  const typeSection = sections?.find(s => s.title === 'Type Breakdown');
  const monthlySection = sections?.find(s => s.title === 'Monthly Trend');

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Inspection Trends Report
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {property?.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Period: {dateRange?.from ? format(new Date(dateRange.from), 'PP') : 'N/A'} - {dateRange?.to ? format(new Date(dateRange.to), 'PP') : 'N/A'}
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Overview */}
      {overviewSection?.summary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {overviewSection.summary.totalInspections || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Inspections
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {overviewSection.summary.completedInspections || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed Inspections
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
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
        </Grid>
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

      {/* Type Breakdown */}
      {typeSection && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Type Breakdown
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Count</TableCell>
                  <TableCell>Percentage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {typeSection.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.type || 'N/A'}</TableCell>
                    <TableCell>{item.count || 0}</TableCell>
                    <TableCell>{item.percentage || '0%'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Monthly Trend */}
      {monthlySection && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Monthly Trend
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell>Count</TableCell>
                  <TableCell>Visual</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlySection.items?.map((item, index) => {
                  const maxCount = Math.max(...(monthlySection.items?.map(i => i.count || 0) || [1]));
                  const percentage = maxCount > 0 ? ((item.count || 0) / maxCount) * 100 : 0;
                  return (
                    <TableRow key={index}>
                      <TableCell>{item.month ? format(new Date(item.month + '-01'), 'MMMM yyyy') : 'N/A'}</TableCell>
                      <TableCell>{item.count || 0}</TableCell>
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

