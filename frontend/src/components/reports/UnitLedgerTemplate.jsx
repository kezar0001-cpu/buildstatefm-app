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

export default function UnitLedgerTemplate({ reportData, report }) {
  if (!reportData) return null;

  const { property, dateRange, sections, summary, unit } = reportData;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Unit Ledger Report
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {property?.name}
        </Typography>
        {unit && (
          <Typography variant="body1" color="text.secondary">
            Unit {unit.unitNumber} • {unit.bedrooms} Bed, {unit.bathrooms} Bath • {unit.area ? `${unit.area} sq ft` : 'N/A'}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Period: {dateRange?.from ? format(new Date(dateRange.from), 'PP') : 'N/A'} - {dateRange?.to ? format(new Date(dateRange.to), 'PP') : 'N/A'}
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Unit Information */}
      {unit && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600}>
                  Unit Status
                </Typography>
                <Chip label={unit.status || 'N/A'} color={unit.status === 'OCCUPIED' ? 'success' : 'default'} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600}>
                  Monthly Rent
                </Typography>
                <Typography variant="h5" color="primary" sx={{ mt: 1 }}>
                  ${unit.rentAmount ? unit.rentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tenant Information */}
      {sections?.find(s => s.title === 'Current Tenant Information') && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Current Tenant Information
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Lease Start</TableCell>
                  <TableCell>Lease End</TableCell>
                  <TableCell>Rent Amount</TableCell>
                  <TableCell>Deposit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sections.find(s => s.title === 'Current Tenant Information')?.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.name || 'N/A'}</TableCell>
                    <TableCell>{item.email || 'N/A'}</TableCell>
                    <TableCell>{item.leaseStart ? format(new Date(item.leaseStart), 'PP') : 'N/A'}</TableCell>
                    <TableCell>{item.leaseEnd ? format(new Date(item.leaseEnd), 'PP') : 'N/A'}</TableCell>
                    <TableCell>${item.rentAmount ? item.rentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                    <TableCell>${item.depositAmount ? item.depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Maintenance Costs */}
      {sections?.find(s => s.title === 'Maintenance Costs') && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Maintenance Costs
          </Typography>
          {sections.find(s => s.title === 'Maintenance Costs')?.summary && (
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Total Costs</Typography>
                    <Typography variant="h5" color="error.main">
                      ${(sections.find(s => s.title === 'Maintenance Costs')?.summary?.totalCosts || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Request Count</Typography>
                    <Typography variant="h5">
                      {sections.find(s => s.title === 'Maintenance Costs')?.summary?.requestCount || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Average Cost</Typography>
                    <Typography variant="h5">
                      ${(sections.find(s => s.title === 'Maintenance Costs')?.summary?.averageCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Costs</TableCell>
                  <TableCell>Job Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sections.find(s => s.title === 'Maintenance Costs')?.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                    <TableCell>{item.title || 'N/A'}</TableCell>
                    <TableCell>{item.category || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={item.status || 'N/A'} size="small" color={item.status === 'RESOLVED' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>${(item.costs || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>{item.jobCount || 0}</TableCell>
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

