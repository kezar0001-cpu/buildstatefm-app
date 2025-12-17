import { useState, useMemo } from 'react';
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
  Paper,
  Divider,
  Avatar,
  AvatarGroup,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  MoreVert as MoreVertIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  Directions as DirectionsIcon,
  PlayArrow as PlayArrowIcon,
  Map as MapIcon,
  AccessTime as AccessTimeIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Phone as PhoneIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import RejectedInspectionsBanner from '../components/RejectedInspectionsBanner';
import { format, isToday, isTomorrow, parseISO, compareAsc, isValid } from 'date-fns';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useCurrentUser();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [actionError, setActionError] = useState('');

  const PAGE_SIZE = 50; // Increased page size for "Schedule View"

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
        sort: 'scheduledDate:asc', // Request server-side sort if available
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

  const allJobs = useMemo(() => {
    return data?.pages?.flatMap((page) => page.items) || [];
  }, [data]);

  // Process Jobs: Sort and Group
  const { upNextJob, todayJobs, upcomingJobs, completedRecent } = useMemo(() => {
    // 1. Filter out cancelled
    const active = allJobs.filter(j => j.status !== 'CANCELLED');

    // 2. Separate completed
    const completed = active.filter(j => j.status === 'COMPLETED');
    const incomplete = active.filter(j => j.status !== 'COMPLETED');

    // 3. Sort incomplete by Date, then Priority
    incomplete.sort((a, b) => {
      // Sort by status first (IN_PROGRESS on top)
      if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
      if (b.status === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return 1;

      // Then by Date
      const dateA = a.scheduledDate ? parseISO(a.scheduledDate) : new Date(8640000000000000);
      const dateB = b.scheduledDate ? parseISO(b.scheduledDate) : new Date(8640000000000000);
      const dateComp = compareAsc(dateA, dateB);
      if (dateComp !== 0) return dateComp;

      // Then by Priority
      const pMap = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (pMap[a.priority] || 4) - (pMap[b.priority] || 4);
    });

    // 4. Identify "Up Next"
    // First IN_PROGRESS job, or first ASSIGNED/OPEN job
    const upNext = incomplete.length > 0 ? incomplete[0] : null;

    // 5. Group the rest
    const today = [];
    const upcoming = [];

    incomplete.forEach(job => {
      if (job.id === upNext?.id) return; // Skip the "Up Next" job

      const date = job.scheduledDate ? parseISO(job.scheduledDate) : null;
      if (!date || !isValid(date)) {
        upcoming.push(job); // No date goes to upcoming
      } else if (isToday(date) || date < new Date()) { // Today or Overdue
        today.push(job);
      } else {
        upcoming.push(job);
      }
    });

    return {
      upNextJob: upNext,
      todayJobs: today,
      upcomingJobs: upcoming,
      completedRecent: completed.slice(0, 5), // Last 5 completed
    };
  }, [allJobs]);

  const statusMutation = useMutation({
    mutationFn: async ({ jobId, status }) => {
      const response = await apiClient.patch(`/jobs/${jobId}/status`, { status });
      return response.data;
    },
    onMutate: async ({ jobId, status }) => {
      setActionError('');
      await queryClient.cancelQueries({ queryKey: ['jobs'] });

      const previousJobs = snapshotJobQueries(queryClient);
      const existingJob = allJobs.find((job) => job.id === jobId) || { id: jobId };

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

  const handleViewDetails = (jobId) => {
    navigate(`/technician/jobs/${jobId}`);
    handleMenuClose();
  };

  const handleStatusUpdate = (job, nextStatus) => {
    if (!job || !canTransition(job.status, nextStatus)) return;
    statusMutation.mutate({ jobId: job.id, status: nextStatus });
  };

  const handleNavigate = (address) => {
    if (!address) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  const JobCard = ({ job, isUpNext = false }) => {
    if (!job) return null;
    const date = job.scheduledDate ? parseISO(job.scheduledDate) : null;
    const isOverdue = date && date < new Date() && !isToday(date);

    return (
      <Card
        elevation={isUpNext ? 4 : 1}
        sx={{
          mb: 2,
          borderLeft: isUpNext ? `6px solid ${theme.palette.primary.main}` : 'none',
          position: 'relative',
          overflow: 'visible'
        }}
      >
        {isUpNext && (
          <Chip
            label="UP NEXT"
            color="primary"
            size="small"
            sx={{
              position: 'absolute',
              top: -12,
              left: 16,
              fontWeight: 'bold',
              boxShadow: 2
            }}
          />
        )}
        <CardContent sx={{ pt: isUpNext ? 3 : 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="h6" fontWeight={isUpNext ? 700 : 500} gutterBottom={false}>
                {job.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {job.property?.name}
              </Typography>
            </Box>
            <IconButton size="small" onClick={(e) => handleMenuOpen(e, job)}>
              <MoreVertIcon />
            </IconButton>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <Chip
              label={job.status.replace('_', ' ')}
              color={STATUS_COLORS[job.status]}
              size="small"
              icon={job.status === 'IN_PROGRESS' ? <PlayArrowIcon /> : undefined}
            />
            <Chip
              label={job.priority}
              color={PRIORITY_COLORS[job.priority]}
              size="small"
              variant="outlined"
            />
            {date && (
              <Chip
                icon={<AccessTimeIcon />}
                label={isToday(date) ? 'Today' : isTomorrow(date) ? 'Tomorrow' : format(date, 'MMM dd')}
                color={isOverdue ? 'error' : 'default'}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>

          <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', mb: 2, bgcolor: isMobile ? 'background.default' : 'transparent' }}>
            <LocationIcon fontSize="small" color="action" sx={{ mr: 1, flexShrink: 0 }} />
            <Typography variant="body2" noWrap>
              {job.property?.address || 'No address provided'}
            </Typography>
          </Paper>

          {isUpNext && (
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Button
                  variant="contained"
                  color={job.status === 'IN_PROGRESS' ? 'success' : 'primary'}
                  fullWidth
                  startIcon={job.status === 'IN_PROGRESS' ? <CheckCircleIcon /> : <PlayArrowIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (job.status === 'IN_PROGRESS') {
                      handleStatusUpdate(job, 'COMPLETED');
                    } else if (job.status === 'ASSIGNED') {
                      handleStatusUpdate(job, 'IN_PROGRESS');
                    } else {
                      handleViewDetails(job.id);
                    }
                  }}
                >
                  {job.status === 'IN_PROGRESS' ? 'Finish Job' : 'Start Job'}
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<DirectionsIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigate(`${job.property?.address} ${job.property?.city || ''}`);
                  }}
                >
                  Navigate
                </Button>
              </Grid>
            </Grid>
          )}

          {!isUpNext && (
            <Button
              variant="text"
              size="small"
              fullWidth
              onClick={() => handleViewDetails(job.id)}
            >
              View Details
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Hello, {user?.firstName || 'Tech'} 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Ready for your day? You have <Box component="span" fontWeight="bold" color="primary.main">{todayJobs.length + (upNextJob ? 1 : 0)} jobs</Box> scheduled today.
        </Typography>
      </Box>

      {actionError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      <RejectedInspectionsBanner currentUser={user} />

      <DataState data={allJobs} isLoading={isLoading} error={error} emptyMessage="No jobs assigned yet.">
        <Box>
          {/* UP NEXT SECTION */}
          <Typography variant="overline" color="text.secondary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
            CURRENTLY ACTIVE / UP NEXT
          </Typography>

          {upNextJob ? (
            <JobCard job={upNextJob} isUpNext={true} />
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center', mb: 4, bgcolor: 'background.default' }} variant="outlined">
              <CheckCircleOutlineIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">All caught up!</Typography>
              <Typography variant="body2" color="text.secondary">No immediate jobs scheduled.</Typography>
            </Paper>
          )}

          {/* TODAY'S QUEUE */}
          {todayJobs.length > 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                Today's Queue
              </Typography>
              {todayJobs.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
            </>
          )}

          {/* UPCOMING */}
          {upcomingJobs.length > 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>
                Upcoming
              </Typography>
              {upcomingJobs.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
            </>
          )}
          {/* COMPLETED RECENTLY */}
          {completedRecent.length > 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="caption" fontWeight="bold" sx={{ mb: 2, color: 'text.disabled', display: 'block' }}>
                RECENTLY COMPLETED
              </Typography>
              {completedRecent.map(job => (
                <Paper key={job.id} sx={{ p: 2, mb: 1, opacity: 0.7 }} variant="outlined">
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ textDecoration: 'line-through' }}>{job.title}</Typography>
                    <Chip label="Done" size="small" color="default" />
                  </Stack>
                </Paper>
              ))}
            </>
          )}

          {hasNextPage && (
            <Button
              fullWidth
              variant="text"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              sx={{ mt: 2 }}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load All Jobs'}
            </Button>
          )}
        </Box>
      </DataState>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleViewDetails(selectedJob?.id)}>View Details</MenuItem>
        {selectedJob && (
          <MenuItem onClick={() => {
            handleNavigate(`${selectedJob.property?.address} ${selectedJob.property?.city || ''}`);
            handleMenuClose();
          }}>
            Navigate
          </MenuItem>
        )}
      </Menu>
    </Container>
  );
}
