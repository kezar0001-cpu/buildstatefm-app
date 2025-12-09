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

export default function FinancialSummaryTemplate({ reportData, report }) {
  if (!reportData) return null;

  const { property, dateRange, sections, summary } = reportData;

  const overviewSection = sections?.find(s => s.title === 'Financial Overview');
  const monthlySection = sections?.find(s => s.title === 'Monthly Breakdown');

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Financial Summary Report
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {property?.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Period: {dateRange?.from ? format(new Date(dateRange.from), 'PP') : 'N/A'} - {dateRange?.to ? format(new Date(dateRange.to), 'PP') : 'N/A'}
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Financial Overview */}
      {overviewSection?.summary && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Financial Overview
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Estimated</Typography>
                  <Typography variant="h5" color="primary" sx={{ mt: 1 }}>
                    ${(overviewSection.summary.totalEstimated || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Actual</Typography>
                  <Typography variant="h5" color="success.main" sx={{ mt: 1 }}>
                    ${(overviewSection.summary.totalActual || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Variance</Typography>
                  <Typography 
                    variant="h5" 
                    sx={{ mt: 1, color: (overviewSection.summary.variance || 0) >= 0 ? 'error.main' : 'success.main' }}
                  >
                    ${(overviewSection.summary.variance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {overviewSection.summary.variancePercentage || '0%'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Completed Costs</Typography>
                  <Typography variant="h5" color="info.main" sx={{ mt: 1 }}>
                    ${(overviewSection.summary.completedCosts || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Average Job Cost</Typography>
                  <Typography variant="h5" sx={{ mt: 1 }}>
                    ${(overviewSection.summary.averageJobCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Monthly Breakdown */}
      {monthlySection && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Monthly Breakdown
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Estimated</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">Variance</TableCell>
                  <TableCell align="right">Job Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlySection.items?.map((item, index) => {
                  const variance = item.actual - item.estimated;
                  return (
                    <TableRow key={index}>
                      <TableCell>{item.month ? format(new Date(item.month + '-01'), 'MMMM yyyy') : 'N/A'}</TableCell>
                      <TableCell align="right">${(item.estimated || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell align="right">${(item.actual || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell align="right">
                        <Typography color={variance >= 0 ? 'error.main' : 'success.main'}>
                          ${variance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{item.jobCount || 0}</TableCell>
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

