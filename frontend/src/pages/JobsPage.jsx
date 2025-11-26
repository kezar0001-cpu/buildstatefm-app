
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  TextField,
  MenuItem,
  IconButton,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Checkbox,
  useMediaQuery,
  useTheme,
  InputAdornment,
  Menu,
  ListItemIcon,
  ListItemText,
  Alert,
  Backdrop,
  LinearProgress,
  List,
  ListItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Build as BuildIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  ViewModule as ViewModuleIcon,
  ViewKanban as ViewKanbanIcon,
  CalendarMonth as CalendarMonthIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import EmptyState from '../components/EmptyState';
import JobForm from '../components/JobForm';
import ensureArray from '../utils/ensureArray';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import moment from 'moment';
import JobDetailModal from '../components/JobDetailModal';
import JobCalendarBoard from '../components/JobCalendarBoard';
import JobStatusConfirmDialog from '../components/JobStatusConfirmDialog';
import { CircularProgress } from '@mui/material';
import { queryKeys } from '../utils/queryKeys.js';
import toast from 'react-hot-toast';
import { useJobStatusUpdate } from '../hooks/useJobStatusUpdate';
import GradientButton from '../components/GradientButton';
import {
  JOB_STATUS_LABELS,
  VALID_STATUS_TRANSITIONS,
  getAllowedStatuses,
  getStatusHelperText,
} from '../constants/jobStatuses.js';
import { useCurrentUser } from '../context/UserContext';

const KANBAN_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];


const JobsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    filter: '',
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return 'card';
    return localStorage.getItem('jobsViewPreference') || 'card';
  }); // 'card', 'kanban', 'calendar'
  const [searchTerm, setSearchTerm] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [bulkTechnicianId, setBulkTechnicianId] = useState('');
  const [isConfirmBulkAssignOpen, setIsConfirmBulkAssignOpen] = useState(false);
  const [detailReturnPath, setDetailReturnPath] = useState(location.pathname + location.search);

  // Delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);

  // Bulk delete states
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0 });
  const [bulkDeleteResults, setBulkDeleteResults] = useState({ succeeded: [], failed: [] });
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Status menu states
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [statusMenuJob, setStatusMenuJob] = useState(null);

  // Calendar navigation state
  const [calendarStartDate, setCalendarStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    return today;
  });

  // Job status update hook
  const {
    updateStatus,
    confirmStatusUpdate,
    closeConfirmDialog,
    confirmDialogState,
    isUpdating: isStatusUpdating,
  } = useJobStatusUpdate();

  useEffect(() => {
    if (user?.role === 'TECHNICIAN') {
      navigate('/technician/dashboard', { replace: true });
    }
  }, [navigate, user?.role]);

  const searchQuery = useMemo(() => searchTerm.trim(), [searchTerm]);

  const queryFilters = useMemo(
    () => ({
      ...filters,
      search: searchQuery || undefined,
    }),
    [filters, searchQuery],
  );

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.filter) params.append('filter', filters.filter);
    if (searchQuery) params.append('search', searchQuery);
    return params;
  }, [filters.filter, filters.priority, filters.status, searchQuery]);

  // Fetch jobs with infinite query
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.jobs.list(queryFilters),
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams(queryParams);
      params.append('limit', '50');
      params.append('offset', pageParam.toString());
      const response = await apiClient.get(`/jobs?${params.toString()}`);
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page * 50 : undefined;
    },
    initialPageParam: 0,
    enabled: user?.role !== 'TECHNICIAN',
  });

  // Flatten all pages into a single array
  const jobs = data?.pages?.flatMap(page => page.items) || [];

  const { data: technicians = [] } = useQuery({
    queryKey: queryKeys.users.list({ role: 'TECHNICIAN' }),
    queryFn: async () => {
      const response = await apiClient.get('/users?role=TECHNICIAN');
      return ensureArray(response.data, ['users', 'data', 'items', 'results']);
    },
  });

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleViewChange = (event, nextView) => {
    if (nextView !== null) {
      setView(nextView);
      if (typeof window !== 'undefined') {
        localStorage.setItem('jobsViewPreference', nextView);
      }
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleOpenDetailModal = (job) => {
    setSelectedJob(job);
    setDetailModalOpen(true);
    setDetailReturnPath(location.pathname + location.search);
  };

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedJob(null);
  };

  const handleOpenFullDetailPage = (jobId) => {
    if (!jobId) return;

    navigate(`/jobs/${jobId}`, {
      state: { from: detailReturnPath },
    });
  };

  const handleToggleJobSelection = (jobId) => {
    setSelectedJobIds((prev) => {
      if (prev.includes(jobId)) {
        return prev.filter((id) => id !== jobId);
      }
      return [...prev, jobId];
    });
  };

  const handleToggleSelectAllVisible = (event) => {
    const { checked } = event.target;
    if (checked) {
      setSelectedJobIds(filteredJobs.map((job) => job.id));
    } else {
      setSelectedJobIds([]);
    }
  };

  const handleOpenBulkAssignConfirm = () => {
    if (!bulkTechnicianId || selectedJobIds.length === 0) {
      return;
    }
    setIsConfirmBulkAssignOpen(true);
  };

  const handleCloseBulkAssignConfirm = () => {
    setIsConfirmBulkAssignOpen(false);
  };

  const selectedTechnician = useMemo(() => {
    return technicians.find((tech) => tech.id === bulkTechnicianId) || null;
  }, [technicians, bulkTechnicianId]);

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ jobIds, technicianId }) => {
      const response = await apiClient.post('/jobs/bulk-assign', { jobIds, technicianId });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Jobs assigned successfully');
      setSelectedJobIds([]);
      setBulkTechnicianId('');
      setIsConfirmBulkAssignOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to assign jobs');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (jobId) => {
      const response = await apiClient.delete(`/jobs/${jobId}`);
      return response.data;
    },
    onMutate: async (jobId) => {
      // Optimistic update: Remove from UI immediately
      await queryClient.cancelQueries({ queryKey: queryKeys.jobs.all() });
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.jobs.all() });

      queryClient.setQueriesData({ queryKey: queryKeys.jobs.all() }, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            items: page.items?.filter(job => job.id !== jobId) || [],
            total: Math.max(0, (page.total || 0) - 1),
          })),
        };
      });

      return { previousData };
    },
    onError: (_err, _jobId, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error('Failed to delete job');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      toast.success('Job deleted successfully');
    },
  });

  const handleConfirmBulkAssign = () => {
    if (selectedJobIds.length === 0 || !bulkTechnicianId) {
      return;
    }

    bulkAssignMutation.mutate({ jobIds: selectedJobIds, technicianId: bulkTechnicianId });
  };

  // Delete handlers
  const handleDeleteClick = (job) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!jobToDelete) return;
    try {
      await deleteMutation.mutateAsync(jobToDelete.id);
      setDeleteDialogOpen(false);
      setJobToDelete(null);
      setSelectedJobIds(prev => prev.filter(id => id !== jobToDelete.id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // Bulk delete handlers
  const handleBulkDelete = () => {
    if (selectedJobIds.length === 0) return;
    setBulkDeleteOpen(true);
  };

  const confirmBulkDelete = async () => {
    setIsBulkDeleting(true);
    setBulkDeleteProgress({ current: 0, total: selectedJobIds.length });
    setBulkDeleteResults({ succeeded: [], failed: [] });

    const results = { succeeded: [], failed: [] };

    for (let i = 0; i < selectedJobIds.length; i++) {
      const jobId = selectedJobIds[i];
      const job = jobs.find(item => item.id === jobId);

      try {
        setBulkDeleteProgress({ current: i + 1, total: selectedJobIds.length });
        await apiClient.delete(`/jobs/${jobId}`);

        results.succeeded.push({
          id: jobId,
          title: job?.title || `Job ${jobId}`,
        });
      } catch (error) {
        results.failed.push({
          id: jobId,
          title: job?.title || `Job ${jobId}`,
          error: error.response?.data?.message || error.message || 'Unknown error',
        });
      }
    }

    setBulkDeleteResults(results);
    setIsBulkDeleting(false);

    // Invalidate queries to refresh the list
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });

    // Clear selection if all succeeded
    if (results.failed.length === 0) {
      setSelectedJobIds([]);
    } else {
      // Keep only failed items selected
      setSelectedJobIds(results.failed.map(item => item.id));
    }
  };

  const closeBulkDeleteDialog = () => {
    setBulkDeleteOpen(false);
    setBulkDeleteProgress({ current: 0, total: 0 });
    setBulkDeleteResults({ succeeded: [], failed: [] });
    setIsBulkDeleting(false);
  };

  // Status menu handlers
  const handleStatusMenuOpen = (event, job) => {
    event.stopPropagation();
    setStatusMenuAnchor(event.currentTarget);
    setStatusMenuJob(job);
  };

  const handleStatusMenuClose = () => {
    setStatusMenuAnchor(null);
    setStatusMenuJob(null);
  };

  const handleStatusChange = (job, newStatus) => {
    if (job) {
      handleStatusMenuClose();
      updateStatus(job.id, job.status, newStatus, job.title);
    }
  };

  const filteredJobs = jobs;

  const hasActiveFilters = Boolean(
    filters.status || filters.priority || filters.filter || searchQuery
  );

  const filterSummary = useMemo(() => {
    const parts = [];

    if (filters.status) parts.push(`Status: ${filters.status.replace('_', ' ')}`);
    if (filters.priority) parts.push(`Priority: ${filters.priority}`);
    if (filters.filter) {
      const quickFilters = {
        overdue: 'Overdue jobs',
        unassigned: 'Unassigned jobs',
      };
      parts.push(quickFilters[filters.filter] || filters.filter);
    }
    if (searchQuery) parts.push(`Search: "${searchQuery}"`);

    return parts.join(' • ') || 'No filters applied';
  }, [filters.filter, filters.priority, filters.status, searchQuery]);

  const selectedCount = selectedJobIds.length;
  const allVisibleSelected = filteredJobs.length > 0 && selectedCount === filteredJobs.length;
  const isSelectionIndeterminate = selectedCount > 0 && !allVisibleSelected;

  if (user?.role === 'TECHNICIAN') {
    return null;
  }

  const handleCreate = () => {
    setSelectedJob(null);
    setOpenDialog(true);
  };

  const handleEdit = (job) => {
    setSelectedJob(job);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedJob(null);
  };

  const handleSuccess = () => {
    refetch();
    handleCloseDialog();
  };

  useEffect(() => {
    if (location.state?.openCreateDialog) {
      setSelectedJob(null);
      setOpenDialog(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    setSelectedJobIds((prev) => {
      const visibleIds = new Set(filteredJobs.map((job) => job.id));
      const next = prev.filter((id) => visibleIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [filteredJobs]);

  useEffect(() => {
    if (selectedJobIds.length === 0) {
      setIsConfirmBulkAssignOpen(false);
    }
  }, [selectedJobIds.length]);

  const getPriorityColor = (priority) => {
    const colors = {
      LOW: 'default',
      MEDIUM: 'info',
      HIGH: 'warning',
      URGENT: 'error',
    };
    return colors[priority] || 'default';
  };

  const getStatusColor = (status) => {
    const colors = {
      OPEN: 'default',
      ASSIGNED: 'info',
      IN_PROGRESS: 'primary',
      COMPLETED: 'success',
      CANCELLED: 'error',
    };
    return colors[status] || 'default';
  };

  const getPriorityIcon = (priority) => {
    const icons = {
      LOW: null,
      MEDIUM: <AccessTimeIcon fontSize="small" />,
      HIGH: <WarningIcon fontSize="small" />,
      URGENT: <ErrorIcon fontSize="small" />,
    };
    return icons[priority];
  };

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) {
      return;
    }

    // Dropped in the same column
    if (source.droppableId === destination.droppableId) {
      return;
    }

    // Find the job being dragged
    const job = jobs.find((j) => j.id?.toString() === draggableId);
    if (!job) {
      return;
    }

    const newStatus = destination.droppableId;
    const currentStatus = job.status;

    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      const transitionList = allowedTransitions.map((status) => status.replace('_', ' ')).join(', ');
      toast.error(
        transitionList
          ? `You can only move ${job.title} to: ${transitionList}`
          : `${currentStatus.replace('_', ' ')} is a terminal status.`
      );
      return;
    }

    // Update the job status
    updateStatus(job.id, currentStatus, newStatus, job.title);
  };

  const isOverdue = (job) => {
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') return false;
    if (!job.scheduledDate) return false;
    return new Date(job.scheduledDate) < new Date();
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <DataState type="loading" message="Loading jobs..." />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <DataState
          type="error"
          message="Failed to load jobs"
          onRetry={refetch}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2, md: 0 }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 3, animation: 'fade-in-down 0.5s ease-out' }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            sx={{
              fontSize: { xs: '1.75rem', md: '2.125rem' },
              fontWeight: 800,
              background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            Jobs
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
            Manage and track maintenance jobs
          </Typography>
        </Box>
        <GradientButton
          startIcon={<AddIcon />}
          onClick={handleCreate}
          size="large"
          sx={{
            maxWidth: { xs: '100%', md: 'auto' },
          }}
        >
          Create Job
        </GradientButton>
      </Stack>

      {/* Filters */}
      <Paper
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
          animation: 'fade-in-up 0.6s ease-out',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Search */}
          <TextField
            placeholder="Search jobs by title, property, assignee, unit, or notes..."
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="clear search"
                    onClick={() => setSearchTerm('')}
                    edge="end"
                    size="small"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            size="small"
            sx={{ flexGrow: 1, minWidth: 250 }}
          />

          {/* Status Filter */}
          <TextField
            select
            label="Status"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="OPEN">Open</MenuItem>
            <MenuItem value="ASSIGNED">Assigned</MenuItem>
            <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
            <MenuItem value="COMPLETED">Completed</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </TextField>

          {/* Priority Filter */}
          <TextField
            select
            label="Priority"
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            size="small"
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="LOW">Low</MenuItem>
            <MenuItem value="MEDIUM">Medium</MenuItem>
            <MenuItem value="HIGH">High</MenuItem>
            <MenuItem value="URGENT">Urgent</MenuItem>
          </TextField>

          {/* Quick Filter */}
          <TextField
            select
            label="Quick Filter"
            value={filters.filter}
            onChange={(e) => handleFilterChange('filter', e.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">None</MenuItem>
            <MenuItem value="overdue">Overdue</MenuItem>
            <MenuItem value="unassigned">Unassigned</MenuItem>
          </TextField>

          {/* View Toggle */}
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={handleViewChange}
            aria-label="View mode toggle"
            size="small"
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              '& .MuiToggleButtonGroup-grouped': {
                minWidth: 40,
                border: 'none',
                '&:not(:first-of-type)': {
                  borderRadius: 2,
                },
                '&:first-of-type': {
                  borderRadius: 2,
                },
              },
              '& .MuiToggleButton-root': {
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              },
              '& .Mui-selected': {
                color: 'error.main',
                backgroundColor: 'transparent !important',
                '&:hover': {
                  backgroundColor: 'action.hover !important',
                },
              },
            }}
          >
            <ToggleButton value="card" aria-label="grid view">
              <Tooltip title="Grid View">
                <ViewModuleIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="kanban" aria-label="kanban view">
              <Tooltip title="Kanban View">
                <ViewKanbanIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="calendar" aria-label="calendar view">
              <Tooltip title="Calendar View">
                <CalendarMonthIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {view !== 'calendar' && selectedCount > 0 && (
        <Paper
          elevation={2}
          sx={{
            mb: 3,
            px: { xs: 2, md: 3 },
            py: { xs: 2, md: 2.5 },
            borderRadius: 3,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 2, md: 3 }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Checkbox
                color="primary"
                checked={allVisibleSelected}
                indeterminate={isSelectionIndeterminate}
                onChange={handleToggleSelectAllVisible}
                inputProps={{ 'aria-label': 'Select all visible jobs' }}
              />
              <Box>
                <Typography variant="subtitle1">{selectedCount} selected</Typography>
                <Typography variant="body2" color="text.secondary">
                  Assign to technician or delete selected jobs
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <TextField
                select
                label="Assign to technician"
                size="small"
                value={bulkTechnicianId}
                onChange={(event) => setBulkTechnicianId(event.target.value)}
                sx={{ minWidth: { xs: '100%', sm: 240 } }}
                helperText={!bulkTechnicianId ? 'Select a technician' : ' '}
              >
                <MenuItem value="">
                  Select technician
                </MenuItem>
                {technicians.map((tech) => (
                  <MenuItem key={tech.id} value={tech.id}>
                    {tech.firstName} {tech.lastName}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenBulkAssignConfirm}
                disabled={!bulkTechnicianId || bulkAssignMutation.isPending}
                startIcon={
                  bulkAssignMutation.isPending ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <BuildIcon />
                  )
                }
              >
                {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign Jobs'}
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={handleBulkDelete}
                startIcon={<DeleteIcon />}
              >
                Delete
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Jobs List / Views */}
      {!filteredJobs || filteredJobs.length === 0 ? (
        <EmptyState
          icon={BuildIcon}
          title={hasActiveFilters ? 'No jobs match your filters' : 'No jobs yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting your search terms or filters to find what you\'re looking for. Clear filters to see all jobs, or create a new one to get started.'
              : 'Get started by creating your first maintenance job. Track work orders, assign technicians, and monitor progress all in one place.'
          }
          actionLabel="Create Job"
          onAction={handleCreate}
          helperText={
            hasActiveFilters
              ? 'Filters are still applied. Clear them to view all jobs or create a new job from here.'
              : undefined
          }
        />
      ) : (
        <>
          {view === 'card' && (
            <Stack spacing={3}>
              <Grid container spacing={{ xs: 2, md: 3 }}>
                {filteredJobs.map((job) => {
                  const isSelected = selectedJobIds.includes(job.id);
                  return (
                    <Grid item xs={12} sm={6} md={6} lg={4} key={job.id}>
                      <Card
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          borderLeft: isOverdue(job) ? '4px solid' : 'none',
                          borderLeftColor: 'error.main',
                          borderRadius: 3,
                          position: 'relative',
                          outline: isSelected ? '2px solid' : 'none',
                          outlineColor: 'primary.main',
                          border: '1px solid',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 4,
                          },
                        }}
                      >
                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, pt: 2, pb: 2, '&:last-child': { pb: 2 } }}>
                      {/* Header with Checkbox */}
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleToggleJobSelection(job.id)}
                            color="primary"
                            sx={{ p: 0.5 }}
                            inputProps={{ 'aria-label': `Select job ${job.title}` }}
                          />
                          <Typography
                            variant="h6"
                            sx={{
                              fontSize: '1.125rem',
                              fontWeight: 700,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.3,
                              mb: 0,
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {job.title}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => handleStatusMenuOpen(e, job)}
                          aria-label={`Change status for ${job.title}`}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      {/* Status and Priority */}
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                        <Chip
                          label={job.status.replace('_', ' ')}
                          color={getStatusColor(job.status)}
                          size="small"
                          sx={{ fontWeight: 500 }}
                        />
                        <Chip
                          icon={getPriorityIcon(job.priority)}
                          label={job.priority}
                          color={getPriorityColor(job.priority)}
                          size="small"
                          sx={{ fontWeight: 500 }}
                        />
                      </Stack>

                      {/* Overdue Alert */}
                      {isOverdue(job) && (
                        <Alert severity="error" sx={{ py: 0 }}>
                          <Typography variant="caption">Overdue</Typography>
                        </Alert>
                      )}

                      {/* Description */}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.5,
                        }}
                      >
                        {job.description || 'No description provided'}
                      </Typography>

                      {/* Property Details - Grouped in subtle box */}
                      <Box
                        sx={{
                          mt: 'auto',
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: 'action.hover',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                              Property
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontWeight: 500,
                                mt: 0.5,
                              }}
                            >
                              {job.property?.name || 'N/A'}
                            </Typography>
                          </Box>

                          {job.scheduledDate && (
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                                Scheduled
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {moment(job.scheduledDate).format('MMM D, YYYY')}
                              </Typography>
                            </Box>
                          )}

                          {job.assignedTo && (
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                                Assigned To
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {job.assignedTo.firstName} {job.assignedTo.lastName}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Box>

                      {/* Actions - with divider */}
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          pt: 1.5,
                          justifyContent: 'flex-end',
                          borderTop: '1px solid',
                          borderColor: 'divider',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetailModal(job);
                            }}
                            aria-label={`View details for ${job.title}`}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {job.status !== 'COMPLETED' && (
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(job);
                              }}
                              aria-label={`Edit ${job.title}`}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(job);
                            }}
                            aria-label={`Delete ${job.title}`}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            {/* Load More Button */}
            {hasNextPage && (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
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
          )}

          {view === 'kanban' && (
            <DragDropContext onDragEnd={onDragEnd}>
              <Grid container spacing={2}>
                {KANBAN_STATUSES.map((status) => (
                  <Grid item xs={12} md={6} lg={3} key={status}>
                    <Paper
                      sx={{
                        p: 2,
                        height: '100%',
                        minHeight: 400,
                        bgcolor: 'background.default',
                        borderRadius: 2,
                      }}
                    >
                      {/* Column Header */}
                      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                          {JOB_STATUS_LABELS[status] || status.replace('_', ' ')}
                        </Typography>
                        <Chip
                          label={filteredJobs.filter((job) => job.status === status).length}
                          size="small"
                          color={getStatusColor(status)}
                        />
                      </Box>
                      <Droppable droppableId={status}>
                        {(provided) => (
                          <Box
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            sx={{ minHeight: '500px' }}
                          >
                            {filteredJobs
                              .filter((job) => job.status === status)
                              .map((job, index) => {
                                const isSelected = selectedJobIds.includes(job.id);
                                return (
                                  <Draggable
                                    key={job.id}
                                    draggableId={job.id.toString()}
                                    index={index}
                                    isDragDisabled={(VALID_STATUS_TRANSITIONS[job.status] || []).length === 0}
                                  >
                                    {(provided) => (
                                      <Card
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        sx={{
                                          mb: 2,
                                          cursor: 'pointer',
                                          transition: 'transform 0.2s, box-shadow 0.2s',
                                          '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: 3,
                                          },
                                        }}
                                        onClick={() => handleOpenDetailModal(job)}
                                      >
                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                          {/* Header */}
                                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1, pr: 1 }}>
                                              {job.title}
                                            </Typography>
                                            <IconButton
                                              size="small"
                                              onClick={(e) => handleStatusMenuOpen(e, job)}
                                              aria-label={`Change status for ${job.title}`}
                                            >
                                              <MoreVertIcon fontSize="small" />
                                            </IconButton>
                                          </Box>

                                          {/* Priority Chip */}
                                          <Chip
                                            icon={getPriorityIcon(job.priority)}
                                            label={job.priority}
                                            size="small"
                                            color={getPriorityColor(job.priority)}
                                            sx={{ mb: 1.5 }}
                                          />

                                          {/* Overdue Warning */}
                                          {isOverdue(job) && (
                                            <Alert severity="error" sx={{ mb: 1.5, py: 0 }}>
                                              <Typography variant="caption">Overdue</Typography>
                                            </Alert>
                                          )}

                                          {/* Details */}
                                          <Stack spacing={1}>
                                            {/* Property */}
                                            <Box>
                                              <Typography variant="caption" color="text.secondary" display="block">
                                                Property
                                              </Typography>
                                              <Typography variant="body2">
                                                {job.property?.name || 'N/A'}
                                              </Typography>
                                            </Box>

                                            {/* Scheduled Date */}
                                            {job.scheduledDate && (
                                              <Box>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                  Scheduled
                                                </Typography>
                                                <Typography variant="body2">
                                                  {moment(job.scheduledDate).format('MMM D, YYYY')}
                                                </Typography>
                                              </Box>
                                            )}

                                            {/* Assigned To */}
                                            {job.assignedTo && (
                                              <Box>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                  Assigned To
                                                </Typography>
                                                <Typography variant="body2">
                                                  {job.assignedTo.firstName} {job.assignedTo.lastName}
                                                </Typography>
                                              </Box>
                                            )}
                                          </Stack>

                                          {/* Actions */}
                                          <Box
                                            sx={{ display: 'flex', gap: 0.5, mt: 2, justifyContent: 'flex-end' }}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <Tooltip title="View Details">
                                              <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenDetailModal(job);
                                                }}
                                                aria-label={`View details for ${job.title}`}
                                              >
                                                <VisibilityIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                            {job.status !== 'COMPLETED' && (
                                              <Tooltip title="Edit">
                                                <IconButton
                                                  size="small"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit(job);
                                                  }}
                                                  aria-label={`Edit ${job.title}`}
                                                >
                                                  <EditIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                            )}
                                            <Tooltip title="Delete">
                                              <IconButton
                                                size="small"
                                                color="error"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteClick(job);
                                                }}
                                                aria-label={`Delete ${job.title}`}
                                              >
                                                <DeleteIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          </Box>
                                        </CardContent>
                                      </Card>
                                    )}
                                  </Draggable>
                                );
                              })}
                            {provided.placeholder}
                            {filteredJobs.filter((job) => job.status === status).length === 0 && (
                              <Box
                                sx={{
                                  p: 3,
                                  textAlign: 'center',
                                  color: 'text.secondary',
                                  bgcolor: 'background.paper',
                                  borderRadius: 1,
                                  border: '1px dashed',
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="body2">
                                  No jobs
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Droppable>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </DragDropContext>
          )}

          {view === 'calendar' && (
            <JobCalendarBoard
              startDate={calendarStartDate}
              events={filteredJobs
                .filter((job) => job.scheduledDate)
                .map((job) => ({
                  id: job.id,
                  title: job.title,
                  start: job.scheduledDate,
                  status: job.status,
                  priority: job.priority,
                  property: job.property?.name || null,
                  assignedTo: job.assignedTo
                    ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}`
                    : null,
                }))}
              onChangeRange={(days) => {
                const newStart = new Date(calendarStartDate);
                newStart.setDate(newStart.getDate() + days);
                setCalendarStartDate(newStart);
              }}
              onMove={async (jobId, newDate) => {
                try {
                  await apiClient.patch(`/jobs/${jobId}`, {
                    scheduledDate: newDate.toISOString(),
                  });
                  refetch();
                } catch (error) {
                  console.error('Failed to reschedule job:', error);
                  toast.error('Failed to reschedule job');
                }
              }}
              canDrag={true}
            />
          )}
        </>
      )}

      <Dialog
        open={isConfirmBulkAssignOpen}
        onClose={handleCloseBulkAssignConfirm}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm bulk assignment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to assign {selectedCount} job{selectedCount === 1 ? '' : 's'} to{' '}
            {selectedTechnician
              ? `${selectedTechnician.firstName} ${selectedTechnician.lastName}`
              : 'the selected technician'}
            ? This will replace any existing assignments for those jobs.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBulkAssignConfirm} disabled={bulkAssignMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmBulkAssign}
            variant="contained"
            color="primary"
            disabled={bulkAssignMutation.isPending}
            startIcon={
              bulkAssignMutation.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <BuildIcon />
              )
            }
          >
            {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign Jobs'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Dialog */}
      {openDialog && (
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <JobForm
            job={selectedJob}
            onSuccess={handleSuccess}
            onCancel={handleCloseDialog}
          />
        </Dialog>
      )}

      {/* Job Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        open={detailModalOpen}
        onClose={handleCloseDetailModal}
        returnPath={detailReturnPath}
        onViewFullPage={() => {
          handleCloseDetailModal();
          handleOpenFullDetailPage(selectedJob?.id);
        }}
      />

      {/* Job Status Confirmation Dialog */}
      <JobStatusConfirmDialog
        open={confirmDialogState.open}
        onClose={closeConfirmDialog}
        onConfirm={confirmStatusUpdate}
        currentStatus={confirmDialogState.currentStatus}
        newStatus={confirmDialogState.newStatus}
        jobTitle={confirmDialogState.jobTitle}
        isLoading={isStatusUpdating}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Job</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the job{' '}
            <strong>{jobToDelete?.title}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
          {deleteMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteMutation.error?.response?.data?.message ||
               deleteMutation.error?.message ||
               'Failed to delete job. Please try again.'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog with Progress */}
      <Dialog
        open={bulkDeleteOpen}
        onClose={isBulkDeleting ? undefined : closeBulkDeleteDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {isBulkDeleting
            ? `Deleting Jobs (${bulkDeleteProgress.current}/${bulkDeleteProgress.total})`
            : bulkDeleteResults.succeeded.length > 0 || bulkDeleteResults.failed.length > 0
            ? 'Bulk Delete Results'
            : 'Confirm Bulk Delete'
          }
        </DialogTitle>
        <DialogContent>
          {/* Initial confirmation */}
          {!isBulkDeleting && bulkDeleteResults.succeeded.length === 0 && bulkDeleteResults.failed.length === 0 && (
            <>
              <Typography>
                Are you sure you want to delete <strong>{selectedJobIds.length}</strong> job{selectedJobIds.length !== 1 ? 's' : ''}?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                This action cannot be undone.
              </Typography>
            </>
          )}

          {/* Progress indicator */}
          {isBulkDeleting && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Deleting job {bulkDeleteProgress.current} of {bulkDeleteProgress.total}...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}
              />
            </Box>
          )}

          {/* Results summary */}
          {!isBulkDeleting && (bulkDeleteResults.succeeded.length > 0 || bulkDeleteResults.failed.length > 0) && (
            <Box sx={{ mt: 2 }}>
              {bulkDeleteResults.succeeded.length > 0 && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Successfully deleted {bulkDeleteResults.succeeded.length} job{bulkDeleteResults.succeeded.length !== 1 ? 's' : ''}
                </Alert>
              )}

              {bulkDeleteResults.failed.length > 0 && (
                <>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to delete {bulkDeleteResults.failed.length} job{bulkDeleteResults.failed.length !== 1 ? 's' : ''}
                  </Alert>

                  <Typography variant="subtitle2" gutterBottom>
                    Failed items:
                  </Typography>
                  <List dense>
                    {bulkDeleteResults.failed.map((item) => (
                      <ListItem key={item.id}>
                        <ErrorIcon color="error" sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="body2">
                          <strong>{item.title}</strong>: {item.error}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {bulkDeleteResults.succeeded.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Successfully deleted:
                  </Typography>
                  <List dense>
                    {bulkDeleteResults.succeeded.map((item) => (
                      <ListItem key={item.id}>
                        <CheckCircleIcon color="success" sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="body2">{item.title}</Typography>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!isBulkDeleting && bulkDeleteResults.succeeded.length === 0 && bulkDeleteResults.failed.length === 0 && (
            <>
              <Button onClick={closeBulkDeleteDialog}>Cancel</Button>
              <Button
                onClick={confirmBulkDelete}
                color="error"
                variant="contained"
              >
                Delete {selectedJobIds.length} Item{selectedJobIds.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}

          {!isBulkDeleting && (bulkDeleteResults.succeeded.length > 0 || bulkDeleteResults.failed.length > 0) && (
            <Button onClick={closeBulkDeleteDialog} variant="contained">
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Status Change Menu */}
      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={handleStatusMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        MenuListProps={{
          'aria-labelledby': 'status-menu-button',
          dense: true,
        }}
      >
        {statusMenuJob && getAllowedStatuses(statusMenuJob.status).map((statusOption) => (
          <MenuItem
            key={statusOption}
            onClick={() => handleStatusChange(statusMenuJob, statusOption)}
            disabled={statusMenuJob.status === statusOption}
          >
            <ListItemText>{statusOption.replace('_', ' ')}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Container>
  );
};

export default JobsPage;
