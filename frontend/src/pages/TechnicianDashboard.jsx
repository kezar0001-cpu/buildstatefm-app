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
  CircularProgress,
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
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import RejectedInspectionsBanner from '../components/RejectedInspectionsBanner';
import { format } from 'date-fns';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';
import { canTransition } from '../constants/jobStatuses';
import { useCurrentUser } from '../context/UserContext';
import {
  applyJobUpdateToQueries,
  restoreJobQueries,
  snapshotJobQueries,
} from '../utils/jobCache.js';

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

export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [actionError, setActionError] = useState('');

  const PAGE_SIZE = 25;

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.jobs.technician(),
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: pageParam.toString(),
      });

      const response = await apiClient.get(`/jobs?${params.toString()}`);
      const items = ensureArray(response.data, ['items', 'data.items', 'jobs']);
      const hasMore = response.data?.hasMore ?? items.length === PAGE_SIZE;

      return {
        items,
        hasMore,
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasMore) return undefined;
      const totalFetched = allPages.reduce(
        (sum, page) => sum + (page.items?.length || 0),
        0,
      );
      return totalFetched;
    },
    initialPageParam: 0,
  });

  const jobs = data?.pages?.flatMap((page) => page.items) || [];

  const statusMutation = useMutation({
    mutationFn: async ({ jobId, status }) => {
      const response = await apiClient.patch(`/jobs/${jobId}/status`, { status });
      return response.data;
    },
    onMutate: async ({ jobId, status }) => {
      setActionError('');
      await queryClient.cancelQueries({ queryKey: ['jobs'] });

      const previousJobs = snapshotJobQueries(queryClient);
      const existingJob = jobs.find((job) => job.id === jobId) || { id: jobId };

      applyJobUpdateToQueries(queryClient, {
        ...existingJob,
        status,
        updatedAt: new Date().toISOString(),
      });

      return { previousJobs };
    },
    onSuccess: (updatedJob) => {
      const normalizedJob = updatedJob?.job || updatedJob;
      applyJobUpdateToQueries(queryClient, normalizedJob);
      setActionError('');
      handleMenuClose();
    },
    onError: (mutationError, _variables, context) => {
      setActionError(
        mutationError?.response?.data?.message || 'Failed to update job status',
      );
      restoreJobQueries(queryClient, context?.previousJobs);
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

  const handleStatusUpdate = (job, nextStatus) => {
    if (!job || !canTransition(job.status, nextStatus)) return;
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

      {/* Rejected inspections banner */}
      <RejectedInspectionsBanner currentUser={user} />

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
        <Stack spacing={3}>
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
                        disabled={!canTransition(job.status, 'IN_PROGRESS') || statusMutation.isPending}
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
                        disabled={!canTransition(job.status, 'COMPLETED') || statusMutation.isPending}
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

          {hasNextPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
              <Button
                variant="outlined"
                size="large"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                startIcon={isFetchingNextPage ? <CircularProgress size={20} /> : null}
              >
                {isFetchingNextPage ? 'Loading...' : 'Load More'}
              </Button>
            </Box>
          )}
        </Stack>
      </DataState>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>View Details</MenuItem>
        {selectedJob && canTransition(selectedJob.status, 'IN_PROGRESS') && (
          <MenuItem onClick={() => handleStatusUpdate(selectedJob, 'IN_PROGRESS')}>
            Start Job
          </MenuItem>
        )}
        {selectedJob && canTransition(selectedJob.status, 'COMPLETED') && (
          <MenuItem onClick={() => handleStatusUpdate(selectedJob, 'COMPLETED')}>
            Mark Complete
          </MenuItem>
        )}
      </Menu>
    </Container>
  );
}
