
import React, { useState, useMemo } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Paper,
  Divider,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  MoreVert as MoreVertIcon,
  LocationOn as LocationIcon,
  Directions as DirectionsIcon,
  PlayArrow as PlayArrowIcon,
  AccessTime as AccessTimeIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Phone as PhoneIcon,
  Assignment as AssignmentIcon,
  Home as HomeIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const INSPECTION_STATUS_COLORS = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
  REJECTED: 'error',
};

// ===== Job Card Component =====
const JobCard = React.memo(({ job, isUpNext = false, onMenuOpen, onNavigate, onStatusUpdate, onViewDetails }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!job) return null;
  const date = job.scheduledDate ? parseISO(job.scheduledDate) : null;
  const isOverdue = date && date < new Date() && !isToday(date);

  // Build full address with unit
  const buildAddress = () => {
    const parts = [];
    if (job.unit?.unitNumber) parts.push(`Unit ${job.unit.unitNumber}`);
    if (job.property?.address) parts.push(job.property.address);
    return parts.join(' / ') || 'No address provided';
  };

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
          <IconButton size="small" onClick={(e) => onMenuOpen(e, job)}>
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
            {buildAddress()}
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
                    onStatusUpdate(job, 'COMPLETED');
                  } else if (job.status === 'ASSIGNED') {
                    onStatusUpdate(job, 'IN_PROGRESS');
                  } else {
                    onViewDetails(job.id);
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
                  onNavigate(`${job.property?.address} ${job.property?.city || ''}`);
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
            onClick={() => onViewDetails(job.id)}
          >
            View Details
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

// ===== Inspection Card Component =====
const InspectionCard = React.memo(({ inspection, onNavigate }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const date = inspection.scheduledDate ? parseISO(inspection.scheduledDate) : null;
  const isOverdue = date && date < new Date() && inspection.status === 'SCHEDULED';

  const buildAddress = () => {
    const parts = [];
    if (inspection.unit?.unitNumber) parts.push(`Unit ${inspection.unit.unitNumber}`);
    if (inspection.property?.address) parts.push(inspection.property.address);
    return parts.join(' / ') || 'No address provided';
  };

  const handleStart = () => {
    navigate(`/inspections/${inspection.id}/conduct`);
  };

  return (
    <Card elevation={1} sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Box>
            <Typography variant="h6" fontWeight={500}>
              {inspection.template?.name || 'Inspection'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {inspection.property?.name}
            </Typography>
          </Box>
          {isOverdue && <WarningIcon color="error" />}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Chip
            label={inspection.status.replace('_', ' ')}
            color={INSPECTION_STATUS_COLORS[inspection.status]}
            size="small"
          />
          {date && (
            <Chip
              icon={<AccessTimeIcon />}
              label={isToday(date) ? 'Today' : isTomorrow(date) ? 'Tomorrow' : format(date, 'MMM dd, HH:mm')}
              color={isOverdue ? 'error' : 'default'}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>

        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', mb: 2, bgcolor: isMobile ? 'background.default' : 'transparent' }}>
          <LocationIcon fontSize="small" color="action" sx={{ mr: 1, flexShrink: 0 }} />
          <Typography variant="body2" noWrap>
            {buildAddress()}
          </Typography>
        </Paper>

        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Button
              variant="contained"
              color={inspection.status === 'IN_PROGRESS' ? 'warning' : 'primary'}
              fullWidth
              startIcon={<PlayArrowIcon />}
              onClick={handleStart}
              disabled={inspection.status === 'COMPLETED' || inspection.status === 'CANCELLED'}
            >
              {inspection.status === 'IN_PROGRESS' ? 'Continue' : 'Start'}
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<DirectionsIcon />}
              onClick={() => onNavigate(`${inspection.property?.address} ${inspection.property?.city || ''}`)}
            >
              Navigate
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
});

// ===== Main Component =====
export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useCurrentUser();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [actionError, setActionError] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0 = Jobs, 1 = Inspections

  const PAGE_SIZE = 50;

  // ===== Jobs Query =====
  const {
    data: jobsData,
    isLoading: isLoadingJobs,
    error: jobsError,
    fetchNextPage: fetchNextJobPage,
    hasNextPage: hasNextJobPage,
    isFetchingNextPage: isFetchingNextJobPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.jobs.technician(),
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: pageParam.toString(),
        sort: 'scheduledDate:asc',
      });
      const response = await apiClient.get(`/jobs?${params.toString()}`);
      const items = ensureArray(response.data, ['items', 'data.items', 'jobs']);
      const hasMore = response.data?.hasMore ?? items.length === PAGE_SIZE;
      return { items, hasMore };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasMore) return undefined;
      const totalFetched = allPages.reduce((sum, page) => sum + (page.items?.length || 0), 0);
      return totalFetched;
    },
    initialPageParam: 0,
  });

  // ===== Inspections Query =====
  const {
    data: inspectionsData,
    isLoading: isLoadingInspections,
    error: inspectionsError,
  } = useQuery({
    queryKey: ['inspections', 'technician', user?.id],
    queryFn: async () => {
      const response = await apiClient.get('/inspections?limit=50');
      return ensureArray(response.data, ['items', 'data', 'inspections']);
    },
    enabled: !!user?.id,
  });

  const allJobs = useMemo(() => {
    return jobsData?.pages?.flatMap((page) => page.items) || [];
  }, [jobsData]);

  const allInspections = useMemo(() => {
    return inspectionsData?.filter(i => i.inspectorId === user?.id && i.status !== 'COMPLETED' && i.status !== 'CANCELLED') || [];
  }, [inspectionsData, user?.id]);

  // Process Jobs: Sort and Group
  const { upNextJob, todayJobs, upcomingJobs, completedRecent } = useMemo(() => {
    const active = allJobs.filter(j => j.status !== 'CANCELLED');
    const completed = active.filter(j => j.status === 'COMPLETED');
    const incomplete = active.filter(j => j.status !== 'COMPLETED');

    incomplete.sort((a, b) => {
      if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
      if (b.status === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return 1;
      const dateA = a.scheduledDate ? parseISO(a.scheduledDate) : new Date(8640000000000000);
      const dateB = b.scheduledDate ? parseISO(b.scheduledDate) : new Date(8640000000000000);
      const dateComp = compareAsc(dateA, dateB);
      if (dateComp !== 0) return dateComp;
      const pMap = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (pMap[a.priority] || 4) - (pMap[b.priority] || 4);
    });

    const upNext = incomplete.length > 0 ? incomplete[0] : null;
    const today = [];
    const upcoming = [];

    incomplete.forEach(job => {
      if (job.id === upNext?.id) return;
      const date = job.scheduledDate ? parseISO(job.scheduledDate) : null;
      if (!date || !isValid(date)) {
        upcoming.push(job);
      } else if (isToday(date) || date < new Date()) {
        today.push(job);
      } else {
        upcoming.push(job);
      }
    });

    return {
      upNextJob: upNext,
      todayJobs: today,
      upcomingJobs: upcoming,
      completedRecent: completed.slice(0, 5),
    };
  }, [allJobs]);

  // Process Inspections: Sort by date
  const { todayInspections, upcomingInspections } = useMemo(() => {
    const sorted = [...allInspections].sort((a, b) => {
      const dateA = a.scheduledDate ? parseISO(a.scheduledDate) : new Date(8640000000000000);
      const dateB = b.scheduledDate ? parseISO(b.scheduledDate) : new Date(8640000000000000);
      return compareAsc(dateA, dateB);
    });

    const today = [];
    const upcoming = [];

    sorted.forEach(insp => {
      const date = insp.scheduledDate ? parseISO(insp.scheduledDate) : null;
      if (!date || !isValid(date)) {
        upcoming.push(insp);
      } else if (isToday(date) || date < new Date()) {
        today.push(insp);
      } else {
        upcoming.push(insp);
      }
    });

    return { todayInspections: today, upcomingInspections: upcoming };
  }, [allInspections]);

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
      applyJobUpdateToQueries(queryClient, { ...existingJob, status, updatedAt: new Date().toISOString() });
      return { previousJobs };
    },
    onSuccess: (updatedJob) => {
      const normalizedJob = updatedJob?.job || updatedJob;
      applyJobUpdateToQueries(queryClient, normalizedJob);
      setActionError('');
      handleMenuClose();
    },
    onError: (mutationError, _variables, context) => {
      setActionError(mutationError?.response?.data?.message || 'Failed to update job status');
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

  const jobCount = todayJobs.length + (upNextJob ? 1 : 0);
  const inspectionCount = todayInspections.length;

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Hello, {user?.firstName || 'Tech'} 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Ready for your day? You have{' '}
          <Box component="span" fontWeight="bold" color="primary.main">{jobCount} job{jobCount !== 1 ? 's' : ''}</Box>
          {inspectionCount > 0 && (
            <> and <Box component="span" fontWeight="bold" color="secondary.main">{inspectionCount} inspection{inspectionCount !== 1 ? 's' : ''}</Box></>
          )}
          {' '}scheduled today.
        </Typography>
      </Box>

      {actionError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      <RejectedInspectionsBanner currentUser={user} />

      {/* Tab Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newVal) => setActiveTab(newVal)}
          variant="fullWidth"
        >
          <Tab
            label={
              <Badge badgeContent={allJobs.filter(j => j.status !== 'COMPLETED' && j.status !== 'CANCELLED').length} color="primary">
                <Stack direction="row" spacing={1} alignItems="center">
                  <BuildIcon fontSize="small" />
                  <span>Jobs</span>
                </Stack>
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={allInspections.length} color="secondary">
                <Stack direction="row" spacing={1} alignItems="center">
                  <AssignmentIcon fontSize="small" />
                  <span>Inspections</span>
                </Stack>
              </Badge>
            }
          />
        </Tabs>
      </Paper>

      {/* Jobs Tab */}
      {activeTab === 0 && (
        <DataState data={allJobs} isLoading={isLoadingJobs} error={jobsError} emptyMessage="No jobs assigned yet.">
          <Box>
            <Typography variant="overline" color="text.secondary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
              CURRENTLY ACTIVE / UP NEXT
            </Typography>

            {upNextJob ? (
              <JobCard
                job={upNextJob}
                isUpNext={true}
                onMenuOpen={handleMenuOpen}
                onNavigate={handleNavigate}
                onStatusUpdate={handleStatusUpdate}
                onViewDetails={handleViewDetails}
              />
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center', mb: 4, bgcolor: 'background.default' }} variant="outlined">
                <CheckCircleOutlineIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">All caught up!</Typography>
                <Typography variant="body2" color="text.secondary">No immediate jobs scheduled.</Typography>
              </Paper>
            )}

            {todayJobs.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Today's Queue</Typography>
                {todayJobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onMenuOpen={handleMenuOpen}
                    onNavigate={handleNavigate}
                    onStatusUpdate={handleStatusUpdate}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </>
            )}

            {upcomingJobs.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>Upcoming</Typography>
                {upcomingJobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onMenuOpen={handleMenuOpen}
                    onNavigate={handleNavigate}
                    onStatusUpdate={handleStatusUpdate}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </>
            )}

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

            {hasNextJobPage && (
              <Button
                fullWidth
                variant="text"
                onClick={() => fetchNextJobPage()}
                disabled={isFetchingNextJobPage}
                sx={{ mt: 2 }}
              >
                {isFetchingNextJobPage ? 'Loading...' : 'Load All Jobs'}
              </Button>
            )}
          </Box>
        </DataState>
      )}

      {/* Inspections Tab */}
      {activeTab === 1 && (
        <DataState data={allInspections} isLoading={isLoadingInspections} error={inspectionsError} emptyMessage="No inspections assigned yet.">
          <Box>
            {todayInspections.length > 0 && (
              <>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Today's Inspections</Typography>
                {todayInspections.map(insp => (
                  <InspectionCard key={insp.id} inspection={insp} onNavigate={handleNavigate} />
                ))}
              </>
            )}

            {upcomingInspections.length > 0 && (
              <>
                {todayInspections.length > 0 && <Divider sx={{ my: 3 }} />}
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>Upcoming Inspections</Typography>
                {upcomingInspections.map(insp => (
                  <InspectionCard key={insp.id} inspection={insp} onNavigate={handleNavigate} />
                ))}
              </>
            )}

            {todayInspections.length === 0 && upcomingInspections.length === 0 && (
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }} variant="outlined">
                <CheckCircleOutlineIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">No inspections scheduled</Typography>
                <Typography variant="body2" color="text.secondary">Check back later for new assignments.</Typography>
              </Paper>
            )}

            <Button
              component={RouterLink}
              to="/inspections"
              variant="outlined"
              fullWidth
              sx={{ mt: 3 }}
            >
              View All Inspections
            </Button>
          </Box>
        </DataState>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
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
