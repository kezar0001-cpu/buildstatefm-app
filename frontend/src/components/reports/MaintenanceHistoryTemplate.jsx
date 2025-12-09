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
  Stack,
  Divider,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { format } from 'date-fns';

export default function MaintenanceHistoryTemplate({ reportData, report }) {
  if (!reportData) return null;

  const { property, dateRange, sections, summary } = reportData;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Maintenance History Report
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {property?.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {property?.address}, {property?.city}, {property?.state} {property?.zipCode}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Period: {dateRange?.from ? format(new Date(dateRange.from), 'PP') : 'N/A'} - {dateRange?.to ? format(new Date(dateRange.to), 'PP') : 'N/A'}
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {summary.totalServiceRequests || 0}
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
                <Typography variant="h4" fontWeight={700} color="primary">
                  {summary.totalJobs || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Maintenance Jobs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {summary.completedJobs || 0}
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

      {/* Service Requests Section */}
      {sections?.find(s => s.title === 'Service Requests') && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Service Requests ({sections.find(s => s.title === 'Service Requests')?.count || 0})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Requested By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sections.find(s => s.title === 'Service Requests')?.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                    <TableCell>{item.unit || 'N/A'}</TableCell>
                    <TableCell>{item.title || 'N/A'}</TableCell>
                    <TableCell>{item.category || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={item.status || 'N/A'} size="small" color={item.status === 'RESOLVED' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip label={item.priority || 'N/A'} size="small" color={item.priority === 'URGENT' ? 'error' : item.priority === 'HIGH' ? 'warning' : 'default'} />
                    </TableCell>
                    <TableCell>{item.requestedBy || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Maintenance Jobs Section */}
      {sections?.find(s => s.title === 'Maintenance Jobs') && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Maintenance Jobs ({sections.find(s => s.title === 'Maintenance Jobs')?.count || 0})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell>Estimated Cost</TableCell>
                  <TableCell>Actual Cost</TableCell>
                  <TableCell>Completed Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sections.find(s => s.title === 'Maintenance Jobs')?.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                    <TableCell>{item.unit || 'N/A'}</TableCell>
                    <TableCell>{item.title || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={item.status || 'N/A'} size="small" color={item.status === 'COMPLETED' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip label={item.priority || 'N/A'} size="small" color={item.priority === 'URGENT' ? 'error' : item.priority === 'HIGH' ? 'warning' : 'default'} />
                    </TableCell>
                    <TableCell>{item.assignedTo || 'N/A'}</TableCell>
                    <TableCell>${item.estimatedCost ? item.estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                    <TableCell>${item.actualCost ? item.actualCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                    <TableCell>{item.completedDate ? format(new Date(item.completedDate), 'MMM dd, yyyy') : 'N/A'}</TableCell>
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

