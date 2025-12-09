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

export default function TenantIssueHistoryTemplate({ reportData, report }) {
  if (!reportData) return null;

  const { property, dateRange, sections, summary } = reportData;

  const requestsSection = sections?.find(s => s.title === 'Service Requests');
  const categorySection = sections?.find(s => s.title === 'Category Breakdown');
  const statusSection = sections?.find(s => s.title === 'Status Breakdown');

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Tenant Issue History Report
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {property?.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Period: {dateRange?.from ? format(new Date(dateRange.from), 'PP') : 'N/A'} - {dateRange?.to ? format(new Date(dateRange.to), 'PP') : 'N/A'}
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Summary */}
      {summary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {summary.totalRequests || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Requests
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {summary.resolvedRequests || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Resolved Requests
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="info.main">
                  {summary.resolutionRate || '0%'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Resolution Rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="error.main">
                  ${(summary.totalCosts || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Costs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Service Requests */}
      {requestsSection && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Service Requests
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Tenant</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Resolved Date</TableCell>
                  <TableCell>Total Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requestsSection.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                    <TableCell>{item.unit || 'N/A'}</TableCell>
                    <TableCell>{item.tenant || 'N/A'}</TableCell>
                    <TableCell>{item.title || 'N/A'}</TableCell>
                    <TableCell>{item.category || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={item.status || 'N/A'} size="small" color={item.status === 'RESOLVED' || item.status === 'COMPLETED' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={item.priority || 'N/A'} 
                        size="small" 
                        color={item.priority === 'URGENT' ? 'error' : item.priority === 'HIGH' ? 'warning' : 'default'} 
                      />
                    </TableCell>
                    <TableCell>{item.resolvedDate ? format(new Date(item.resolvedDate), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                    <TableCell>${(item.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Category Breakdown */}
      {categorySection && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Category Breakdown
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell>Count</TableCell>
                  <TableCell>Percentage</TableCell>
                  <TableCell>Visual</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categorySection.items?.map((item, index) => {
                  const percentage = parseFloat(item.percentage || '0');
                  return (
                    <TableRow key={index}>
                      <TableCell>{item.category || 'N/A'}</TableCell>
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
                </TableRow>
              </TableHead>
              <TableBody>
                {statusSection.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Chip label={item.status || 'N/A'} size="small" color={item.status === 'RESOLVED' || item.status === 'COMPLETED' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>{item.count || 0}</TableCell>
                    <TableCell>{item.percentage || '0%'}</TableCell>
                  </TableRow>
                ))}
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

