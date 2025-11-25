import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  TextField,
  Alert,
  Divider,
  Grid,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import Breadcrumbs from '../components/Breadcrumbs';
import { format } from 'date-fns';
import { queryKeys } from '../utils/queryKeys.js';
import { canTransition } from '../constants/jobStatuses.js';
import {
  applyJobUpdateToQueries,
  restoreJobQueries,
  snapshotJobQueries,
} from '../utils/jobCache.js';

const STATUS_OPTIONS = [
  { value: 'IN_PROGRESS', label: 'Start Job', color: 'warning' },
  { value: 'COMPLETED', label: 'Mark Complete', color: 'success' },
];

export default function TechnicianJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [notes, setNotes] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  // Fetch job details
  const { data: job, isLoading, error } = useQuery({
    queryKey: queryKeys.jobs.detail(id),
    queryFn: async () => {
      const response = await apiClient.get(`/jobs/${id}`);
      return response.data;
    },
  });

  // Update job mutation (for notes and cost)
  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      const response = await apiClient.patch(`/jobs/${id}`, updates);
      return response.data;
    },
    onMutate: async (updates) => {
      setUpdateError('');
      await queryClient.cancelQueries({ queryKey: ['jobs'] });

      const previousJobs = snapshotJobQueries(queryClient);
      const baseJob = job || { id };

      applyJobUpdateToQueries(queryClient, {
        ...baseJob,
        id,
        ...updates,
        updatedAt: new Date().toISOString(),
      });

      return { previousJobs };
    },
    onSuccess: (updatedJob) => {
      const normalizedJob = updatedJob?.job || updatedJob;
      applyJobUpdateToQueries(queryClient, normalizedJob);
      setUpdateSuccess('Job updated successfully');
      setUpdateError('');
      setTimeout(() => setUpdateSuccess(''), 3000);
    },
    onError: (error, _variables, context) => {
      setUpdateError(error.response?.data?.message || 'Failed to update job');
      setUpdateSuccess('');
      restoreJobQueries(queryClient, context?.previousJobs);
    },
  });

  // Status update mutation (uses new status endpoint)
  const statusMutation = useMutation({
    mutationFn: async (status) => {
      const response = await apiClient.patch(`/jobs/${id}/status`, { status });
      return response.data;
    },
    onMutate: async (status) => {
      setUpdateError('');
      await queryClient.cancelQueries({ queryKey: ['jobs'] });

      const previousJobs = snapshotJobQueries(queryClient);
      const baseJob = job || { id };

      applyJobUpdateToQueries(queryClient, {
        ...baseJob,
        id,
        status,
        updatedAt: new Date().toISOString(),
      });

      return { previousJobs };
    },
    onSuccess: (updatedJob) => {
      const normalizedJob = updatedJob?.job || updatedJob;
      applyJobUpdateToQueries(queryClient, normalizedJob);
      setUpdateSuccess('Job status updated successfully');
      setUpdateError('');
      setConfirmDialogOpen(false);
      setPendingStatus(null);
      setTimeout(() => setUpdateSuccess(''), 3000);
    },
    onError: (error, _variables, context) => {
      setUpdateError(error.response?.data?.message || 'Failed to update job status');
      setUpdateSuccess('');
      setConfirmDialogOpen(false);
      setPendingStatus(null);
      restoreJobQueries(queryClient, context?.previousJobs);
    },
  });

  const handleStatusChange = (newStatus) => {
    setPendingStatus(newStatus);
    setConfirmDialogOpen(true);
  };

  const handleConfirmStatusChange = () => {
    if (pendingStatus) {
      statusMutation.mutate(pendingStatus);
    }
  };

  const handleCancelStatusChange = () => {
    setConfirmDialogOpen(false);
    setPendingStatus(null);
  };

  const handleAddNotes = () => {
    if (!notes.trim()) return;
    
    const existingNotes = job?.notes || '';
    const timestamp = format(new Date(), 'MMM dd, yyyy HH:mm');
    const newNotes = existingNotes 
      ? `${existingNotes}\n\n[${timestamp}]\n${notes}`
      : `[${timestamp}]\n${notes}`;
    
    updateMutation.mutate({ notes: newNotes });
    setNotes('');
  };

  const handleUpdateCost = () => {
    const cost = parseFloat(actualCost);
    if (isNaN(cost) || cost < 0) {
      setUpdateError('Please enter a valid cost');
      return;
    }
    
    updateMutation.mutate({ actualCost: cost });
    setActualCost('');
  };

  const canUpdateStatus = (status) => canTransition(job?.status, status);

  const jobDetailPath = `/technician/jobs/${id}`;
  const propertyLink = job?.property?.id
    ? `/properties/${job.property.id}`
    : job?.propertyId
      ? `/properties/${job.propertyId}`
      : null;
  const unitLink = job?.unit?.id
    ? `/units/${job.unit.id}`
    : job?.unitId
      ? `/units/${job.unitId}`
      : null;

  const breadcrumbOverrides = {
    '/dashboard': { label: 'Technician Dashboard', to: '/technician/dashboard' },
    '/technician': { hidden: true },
    '/technician/jobs': { label: 'Jobs', to: '/technician/dashboard' },
    [jobDetailPath]: job?.title || 'Job Details',
  };

  const breadcrumbExtras = [];

  if (propertyLink) {
    breadcrumbExtras.push({
      key: 'job-property',
      label: job.property.name,
      to: propertyLink,
      after: '/technician/jobs',
    });
  }

  if (unitLink) {
    breadcrumbExtras.push({
      key: 'job-unit',
      label: job?.unit?.unitNumber ? `Unit ${job.unit.unitNumber}` : 'Unit Details',
      to: unitLink,
      after: propertyLink || '/technician/jobs',
    });
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs
        labelOverrides={breadcrumbOverrides}
        extraCrumbs={breadcrumbExtras}
      />
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/technician/dashboard')}
        sx={{ mb: 3 }}
      >
        Back to Jobs
      </Button>

      <DataState data={job} isLoading={isLoading} error={error}>
        {job && (
          <Grid container spacing={3}>
            {/* Main Content */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                    <Chip label={job.status} color="primary" />
                    <Chip label={job.priority} color="warning" />
                  </Stack>

                  <Typography variant="h4" gutterBottom>
                    {job.title}
                  </Typography>

                  <Typography variant="body1" color="text.secondary" paragraph>
                    {job.description}
                  </Typography>

                  <Divider sx={{ my: 3 }} />

                  {/* Property Info */}
                  {job.property && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Property Information
                      </Typography>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LocationIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {job.property.name}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {job.property.address}, {job.property.city}, {job.property.state}
                        </Typography>
                      </Stack>
                    </Box>
                  )}

                  {/* Unit Info */}
                  {job.unit && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Unit
                      </Typography>
                      <Typography variant="body2">
                        Unit {job.unit.unitNumber}
                      </Typography>
                    </Box>
                  )}

                  {/* Schedule */}
                  {job.scheduledDate && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Scheduled Date
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CalendarIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {format(new Date(job.scheduledDate), 'MMMM dd, yyyy')}
                        </Typography>
                      </Stack>
                    </Box>
                  )}

                  {/* Cost Info */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Cost Information
                    </Typography>
                    <Grid container spacing={2}>
                      {job.estimatedCost && (
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Estimated Cost
                          </Typography>
                          <Typography variant="h6">
                            ${job.estimatedCost.toFixed(2)}
                          </Typography>
                        </Grid>
                      )}
                      {job.actualCost && (
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Actual Cost
                          </Typography>
                          <Typography variant="h6">
                            ${job.actualCost.toFixed(2)}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>

                  {/* Existing Notes */}
                  {job.notes && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Notes
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Typography 
                          variant="body2" 
                          sx={{ whiteSpace: 'pre-wrap' }}
                        >
                          {job.notes}
                        </Typography>
                      </Paper>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Actions Sidebar */}
            <Grid item xs={12} md={4}>
              <Stack spacing={3}>
                {/* Status Updates */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Update Status
                    </Typography>
                    
                    {updateSuccess && (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        {updateSuccess}
                      </Alert>
                    )}
                    
                    {updateError && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {updateError}
                      </Alert>
                    )}

                    <Stack spacing={2}>
                      {STATUS_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          variant="contained"
                          color={option.color}
                          fullWidth
                          disabled={!canUpdateStatus(option.value) || updateMutation.isPending}
                          onClick={() => handleStatusChange(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Add Notes */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Add Notes
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      placeholder="Enter notes about the job..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <Button
                      variant="contained"
                      fullWidth
                      disabled={!notes.trim() || updateMutation.isPending}
                      onClick={handleAddNotes}
                    >
                      Add Notes
                    </Button>
                  </CardContent>
                </Card>

                {/* Update Actual Cost */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Update Actual Cost
                    </Typography>
                    <TextField
                      fullWidth
                      type="number"
                      placeholder="Enter actual cost"
                      value={actualCost}
                      onChange={(e) => setActualCost(e.target.value)}
                      InputProps={{
                        startAdornment: <MoneyIcon sx={{ mr: 1, color: 'action.active' }} />,
                      }}
                      sx={{ mb: 2 }}
                    />
                    <Button
                      variant="contained"
                      fullWidth
                      disabled={!actualCost || updateMutation.isPending}
                      onClick={handleUpdateCost}
                    >
                      Update Cost
                    </Button>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        )}
      </DataState>

      {/* Status Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={statusMutation.isPending ? undefined : handleCancelStatusChange}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Status Change</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingStatus === 'IN_PROGRESS' && (
              <>
                Are you sure you want to start this job? This will notify the property manager that work has begun.
              </>
            )}
            {pendingStatus === 'COMPLETED' && (
              <>
                Are you sure you want to mark this job as completed? This will notify the property manager that the job is finished.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelStatusChange} disabled={statusMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmStatusChange}
            variant="contained"
            color="primary"
            disabled={statusMutation.isPending}
            startIcon={statusMutation.isPending ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {statusMutation.isPending ? 'Updating...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
