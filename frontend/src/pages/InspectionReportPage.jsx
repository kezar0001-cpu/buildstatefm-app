import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  List,
  ListItem,
  ListItemText,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import { formatDateTime } from '../utils/date';
import { queryKeys } from '../utils/queryKeys';
import { useReactToPrint } from 'react-to-print';

const InspectionReportPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();

  // Fetch inspection details
  const { data: inspection, isLoading, error } = useQuery({
    queryKey: queryKeys.inspections.detail(id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${id}`);
      return response.data;
    },
  });

  // Fetch rooms data
  const { data: roomsData } = useQuery({
    queryKey: queryKeys.inspections.rooms(id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${id}/rooms`);
      return response.data;
    },
    enabled: !!inspection,
  });

  // Fetch issues data
  const { data: issuesData } = useQuery({
    queryKey: queryKeys.inspections.issues(id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${id}/issues`);
      return response.data;
    },
    enabled: !!inspection,
  });

  // Fetch photos data
  const { data: photosData } = useQuery({
    queryKey: queryKeys.inspections.photos(id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${id}/photos`);
      return response.data;
    },
    enabled: !!inspection,
  });

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Inspection_Report_${inspection?.id}_${new Date().toISOString().split('T')[0]}`,
  });

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <DataState type="loading" message="Loading inspection report..." />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <DataState type="error" message="Failed to load inspection report" />
      </Container>
    );
  }

  const rooms = roomsData?.rooms || [];
  const issues = issuesData?.issues || [];
  const photos = photosData?.photos || [];

  const getStatusColor = (status) => {
    switch (status) {
      case 'PASSED':
        return 'success';
      case 'FAILED':
        return 'error';
      case 'NA':
        return 'default';
      default:
        return 'default';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Action Buttons */}
      <Stack direction="row" spacing={2} justifyContent="space-between" sx={{ mb: 3, '@media print': { display: 'none' } }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/inspections/${id}`)}>
          Back to Details
        </Button>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
            Print Report
          </Button>
          <Button variant="contained" startIcon={<PdfIcon />} onClick={handlePrint}>
            Export PDF
          </Button>
        </Stack>
      </Stack>

      {/* Printable Report */}
      <Paper ref={printRef} sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h3" gutterBottom>
            Inspection Report
          </Typography>
          <Typography variant="h6" color="text.secondary">
            {inspection.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Report Generated: {formatDateTime(new Date())}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Inspection Overview */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Overview
          </Typography>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Inspection Type
                </Typography>
                <Typography variant="h6">{inspection.type}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Chip label={inspection.status} color={inspection.status === 'COMPLETED' ? 'success' : 'default'} />
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Scheduled Date
                </Typography>
                <Typography variant="body1">{formatDateTime(inspection.scheduledDate)}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Completed Date
                </Typography>
                <Typography variant="body1">
                  {inspection.completedDate ? formatDateTime(inspection.completedDate) : 'Not completed'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Property
                </Typography>
                <Typography variant="body1">{inspection.property?.name || 'N/A'}</Typography>
                {inspection.property?.address && (
                  <Typography variant="body2" color="text.secondary">
                    {inspection.property.address}, {inspection.property.city}, {inspection.property.state}
                  </Typography>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Unit
                </Typography>
                <Typography variant="body1">
                  {inspection.unit ? `Unit ${inspection.unit.unitNumber}` : 'Common areas / General'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Conducted By
                </Typography>
                <Typography variant="body1">
                  {inspection.completedBy
                    ? `${inspection.completedBy.firstName} ${inspection.completedBy.lastName}`
                    : inspection.assignedTo
                    ? `${inspection.assignedTo.firstName} ${inspection.assignedTo.lastName}`
                    : 'Not assigned'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Summary Statistics */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Summary
          </Typography>
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <Typography variant="h2">{rooms.length}</Typography>
                <Typography variant="body1">Rooms Inspected</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                <Typography variant="h2">{issues.length}</Typography>
                <Typography variant="body1">Issues Found</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
                <Typography variant="h2">{photos.length}</Typography>
                <Typography variant="body1">Photos Taken</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Room-by-Room Details */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Room-by-Room Inspection
          </Typography>
          {rooms.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No rooms were inspected or this inspection used the legacy format.
            </Alert>
          ) : (
            rooms.map((room, index) => (
              <Card key={room.id} sx={{ mt: 3, pageBreakInside: 'avoid' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">
                      {index + 1}. {room.name}
                    </Typography>
                    {room.roomType && <Chip label={room.roomType.replace('_', ' ')} size="small" />}
                  </Stack>

                  {room.notes && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      {room.notes}
                    </Alert>
                  )}

                  {/* Checklist Items */}
                  {room.checklistItems && room.checklistItems.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Checklist
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Item</TableCell>
                              <TableCell align="center">Status</TableCell>
                              <TableCell>Notes</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {room.checklistItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell align="center">
                                  <Chip
                                    label={item.status}
                                    size="small"
                                    color={getStatusColor(item.status)}
                                    icon={
                                      item.status === 'PASSED' ? (
                                        <CheckCircleIcon />
                                      ) : item.status === 'FAILED' ? (
                                        <CancelIcon />
                                      ) : null
                                    }
                                  />
                                </TableCell>
                                <TableCell>{item.notes || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* Room Photos */}
                  {room.photos && room.photos.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Photos ({room.photos.length})
                      </Typography>
                      <Grid container spacing={2}>
                        {room.photos.map((photo) => (
                          <Grid item xs={12} sm={6} md={4} key={photo.id}>
                            <Paper sx={{ p: 1 }}>
                              <img
                                src={photo.url}
                                alt={photo.caption || 'Room photo'}
                                style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 4 }}
                              />
                              {photo.caption && (
                                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                                  {photo.caption}
                                </Typography>
                              )}
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Issues Found */}
        {issues.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Issues Found
            </Typography>
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Issue</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell align="center">Severity</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Photos</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {issue.title}
                        </Typography>
                        {issue.description && (
                          <Typography variant="caption" color="text.secondary">
                            {issue.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{issue.room?.name || 'General'}</TableCell>
                      <TableCell align="center">
                        <Chip label={issue.severity} size="small" color={getSeverityColor(issue.severity)} />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={issue.status} size="small" />
                      </TableCell>
                      <TableCell align="center">{issue.photos?.length || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Issue Photos */}
            {issues.some((i) => i.photos?.length > 0) && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Issue Evidence Photos
                </Typography>
                {issues
                  .filter((i) => i.photos?.length > 0)
                  .map((issue) => (
                    <Box key={issue.id} sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        {issue.title}
                      </Typography>
                      <Grid container spacing={2}>
                        {issue.photos.map((photo) => (
                          <Grid item xs={12} sm={6} md={4} key={photo.id}>
                            <Paper sx={{ p: 1 }}>
                              <img
                                src={photo.url}
                                alt={photo.caption || 'Issue photo'}
                                style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 4 }}
                              />
                              {photo.caption && (
                                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                                  {photo.caption}
                                </Typography>
                              )}
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  ))}
              </Box>
            )}
          </Box>
        )}

        {/* Findings and Notes */}
        {inspection.findings && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>
                Inspector Findings
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                  {inspection.findings}
                </Typography>
              </Paper>
            </Box>
          </>
        )}

        {inspection.notes && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>
                Additional Notes
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                  {inspection.notes}
                </Typography>
              </Paper>
            </Box>
          </>
        )}

        {/* Footer */}
        <Divider sx={{ my: 3 }} />
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            This is an official inspection report generated by BuildState Property Management
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Report ID: {inspection.id}
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default InspectionReportPage;
