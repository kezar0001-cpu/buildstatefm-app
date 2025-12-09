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
} from '@mui/material';
import { format } from 'date-fns';

export default function PlannedVsExecutedTemplate({ reportData, report }) {
  if (!reportData) return null;

  const { property, dateRange, sections, summary } = reportData;

  const plannedSection = sections?.find(s => s.title === 'Planned Maintenance');
  const executionSection = sections?.find(s => s.title === 'Execution Summary');

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Planned vs Executed Report
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
      {plannedSection?.summary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {plannedSection.summary.totalPlans || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Plans
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {plannedSection.summary.plannedJobs || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Planned Jobs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="warning.main">
                  {plannedSection.summary.adHocJobs || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ad-Hoc Jobs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="info.main">
                  {plannedSection.summary.executionRate || '0%'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Execution Rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Planned Maintenance */}
      {plannedSection && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Planned Maintenance
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell>Next Due Date</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Related Jobs</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plannedSection.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.title || 'N/A'}</TableCell>
                    <TableCell>{item.frequency || 'N/A'}</TableCell>
                    <TableCell>{item.nextDueDate ? format(new Date(item.nextDueDate), 'PP') : 'N/A'}</TableCell>
                    <TableCell>{item.unit || 'N/A'}</TableCell>
                    <TableCell>{item.relatedJobs || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Execution Summary */}
      {executionSection && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Execution Summary
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Unit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {executionSection.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                    <TableCell>{item.title || 'N/A'}</TableCell>
                    <TableCell>{item.plan || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={item.status || 'N/A'} size="small" color={item.status === 'COMPLETED' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>{item.unit || 'N/A'}</TableCell>
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

