import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Stack,
} from '@mui/material';
import {
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  MoreVert as MoreVertIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import { format } from 'date-fns';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';

const STATUS_COLORS = {
  OPEN: 'default',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const PRIORITY_COLORS = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'error',
};

const VALID_TRANSITIONS = {
  OPEN: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'OPEN', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'ASSIGNED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [actionError, setActionError] = useState('');

  // Fetch jobs assigned to technician
  const { data: jobs = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.jobs.technician(),
    queryFn: async () => {
      const response = await apiClient.get('/jobs');
      return ensureArray(response.data, ['items', 'data.items', 'jobs']);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ jobId, status }) => {
      const response = await apiClient.patch(`/jobs/${jobId}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      setActionError('');
      refetch();
      handleMenuClose();
    },
    onError: (mutationError) => {
      setActionError(mutationError?.response?.data?.message || 'Failed to update job status');
      handleMenuClose();
    },
  });

  const handleMenuOpen = (event, job) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedJob(job);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedJob(null);
  };

  const handleViewDetails = () => {
    if (selectedJob) {
      navigate(`/technician/jobs/${selectedJob.id}`);
    }
    handleMenuClose();
  };

  const canTransition = (job, targetStatus) => {
    if (!job?.status) return false;
    return VALID_TRANSITIONS[job.status]?.includes(targetStatus);
  };

  const handleStatusUpdate = (job, nextStatus) => {
    if (!job || !canTransition(job, nextStatus)) return;
    statusMutation.mutate({ jobId: job.id, status: nextStatus });
  };

  const getJobsByStatus = (status) => jobs.filter(job => job.status === status);

  const openJobs = getJobsByStatus('OPEN');
  const inProgressJobs = getJobsByStatus('IN_PROGRESS');
  const completedJobs = getJobsByStatus('COMPLETED');

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          My Jobs
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View and manage your assigned jobs
        </Typography>
        {actionError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {actionError}
          </Alert>
        )}
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <ScheduleIcon color="info" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{openJobs.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Open Jobs
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <BuildIcon color="warning" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{inProgressJobs.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    In Progress
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{completedJobs.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Jobs List */}
      <DataState
        data={jobs}
        isLoading={isLoading}
        error={error}
        emptyMessage="No jobs assigned to you yet"
      >
        <Grid container spacing={3}>
          {jobs.map((job) => (
            <Grid item xs={12} md={6} key={job.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 4 },
                  transition: 'box-shadow 0.3s',
                }}
                onClick={() => navigate(`/technician/jobs/${job.id}`)}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {job.title}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <Chip 
                          label={job.status} 
                          color={STATUS_COLORS[job.status]} 
                          size="small" 
                        />
                        <Chip 
                          label={job.priority} 
                          color={PRIORITY_COLORS[job.priority]} 
                          size="small" 
                        />
                      </Stack>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {job.description}
                      </Typography>

                      {job.property && (
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <LocationIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {job.property.name}
                          </Typography>
                        </Stack>
                      )}

                      {job.scheduledDate && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CalendarIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {format(new Date(job.scheduledDate), 'MMM dd, yyyy')}
                          </Typography>
                        </Stack>
                      )}
                    </Box>

                    <IconButton
                      onClick={(e) => handleMenuOpen(e, job)}
                      size="small"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Stack>
                </CardContent>

                <CardActions>
                  {job.status === 'ASSIGNED' && (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!canTransition(job, 'IN_PROGRESS') || statusMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate(job, 'IN_PROGRESS');
                      }}
                    >
                      Start Job
                    </Button>
                  )}
                  {job.status === 'IN_PROGRESS' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      disabled={!canTransition(job, 'COMPLETED') || statusMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate(job, 'COMPLETED');
                      }}
                    >
                      Mark Complete
                    </Button>
                  )}
                  <Button 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/technician/jobs/${job.id}`);
                    }}
                  >
                    View Details
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DataState>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>View Details</MenuItem>
        {selectedJob && canTransition(selectedJob, 'IN_PROGRESS') && (
          <MenuItem onClick={() => handleStatusUpdate(selectedJob, 'IN_PROGRESS')}>
            Start Job
          </MenuItem>
        )}
        {selectedJob && canTransition(selectedJob, 'COMPLETED') && (
          <MenuItem onClick={() => handleStatusUpdate(selectedJob, 'COMPLETED')}>
            Mark Complete
          </MenuItem>
        )}
      </Menu>
    </Container>
  );
}
