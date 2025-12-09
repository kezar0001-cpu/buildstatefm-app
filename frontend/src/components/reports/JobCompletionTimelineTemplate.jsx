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

export default function JobCompletionTimelineTemplate({ reportData, report }) {
  if (!reportData) return null;

  const { property, dateRange, sections, summary } = reportData;

  const timelineSection = sections?.find(s => s.title === 'Completion Timeline');

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Job Completion Timeline Report
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
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {summary.totalJobs || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Jobs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
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
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight={700} color="info.main">
                  {summary.averageCompletionTime || 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Average Completion Time
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Timeline Table */}
      {timelineSection && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Completion Timeline
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Created Date</TableCell>
                  <TableCell>Completed Date</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {timelineSection.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                    <TableCell>{item.completedDate ? format(new Date(item.completedDate), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                    <TableCell>{item.title || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={item.status || 'N/A'} size="small" color={item.status === 'COMPLETED' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={item.priority || 'N/A'} 
                        size="small" 
                        color={item.priority === 'URGENT' ? 'error' : item.priority === 'HIGH' ? 'warning' : 'default'} 
                      />
                    </TableCell>
                    <TableCell>{item.assignedTo || 'N/A'}</TableCell>
                    <TableCell>{item.duration || 'N/A'}</TableCell>
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

