
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  ViewList as ViewListIcon,
  TableChart as TableChartIcon,
  CalendarMonth as CalendarMonthIcon,
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
import FilterBar from '../components/FilterBar/FilterBar';
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
import PageShell from '../components/PageShell';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import {
  JOB_STATUS_LABELS,
  VALID_STATUS_TRANSITIONS,
  getAllowedStatuses,
  getStatusHelperText,
} from '../constants/jobStatuses.js';
import { useCurrentUser } from '../context/UserContext';
import logger from '../utils/logger';

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
    includeArchived: false,
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  // View state
  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return 'kanban';
    return localStorage.getItem('jobsViewPreference') || 'kanban';
  }); // 'kanban', 'list', 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
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

  const searchQuery = useMemo(() => debouncedSearchTerm.trim(), [debouncedSearchTerm]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count += 1;
    if (filters.priority) count += 1;
    if (filters.filter) count += 1;
    if (filters.includeArchived) count += 1;
    return count;
  }, [filters.filter, filters.includeArchived, filters.priority, filters.status]);

  const hasAnyActiveFilters = !!searchQuery || activeFilterCount > 0;

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({
      status: '',
      priority: '',
      filter: '',
      includeArchived: false,
    });
  };

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
    if (filters.includeArchived) params.append('includeArchived', 'true');
    return params;
  }, [filters.filter, filters.includeArchived, filters.priority, filters.status, searchQuery]);

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


  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleViewChange = (_event, newView) => {
    if (newView !== null) {
      setView(newView);
      try {
        localStorage.setItem('jobsViewPreference', newView);
      } catch (error) {
        logger.warn('Failed to save view preference:', error);
      }
    }
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
    return Array.isArray(technicians) ? technicians.find((tech) => tech.id === bulkTechnicianId) || null : null;
  }, [technicians, bulkTechnicianId]);

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ jobIds, technicianId }) => {
      const response = await apiClient.post('/jobs/bulk-assign', { jobIds, technicianId });
      return response.data;
    },
    // Phase 2: Add optimistic update for better UX
    onMutate: async ({ jobIds, technicianId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.jobs.list(queryFilters) });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKeys.jobs.list(queryFilters));

      // Optimistically update jobs in cache
      queryClient.setQueryData(queryKeys.jobs.list(queryFilters), (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            items: page.items.map(job =>
              jobIds.includes(job.id)
                ? { ...job, assignedToId: technicianId, status: job.status === 'OPEN' ? 'ASSIGNED' : job.status }
                : job
            ),
          })),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.jobs.list(queryFilters), context.previousData);
      }
      toast.error(err?.response?.data?.message || 'Failed to assign jobs');
    },
    onSuccess: () => {
      toast.success('Jobs assigned successfully');
      setSelectedJobIds([]);
      setBulkTechnicianId('');
      setIsConfirmBulkAssignOpen(false);
      refetch();
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
      logger.error('Delete failed:', error);
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
        <PageShell
          title="Jobs"
          subtitle="Manage maintenance jobs and assignments"
          actions={
            user?.role === 'PROPERTY_MANAGER' ? (
              <GradientButton
                startIcon={<AddIcon />}
                disabled
                size="large"
                sx={{ width: { xs: '100%', md: 'auto' } }}
              >
                Create Job
              </GradientButton>
            ) : null
          }
        >
          <Box sx={{ mt: 3 }}>
            <LoadingSkeleton variant="card" count={9} height={150} />
          </Box>
        </PageShell>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <DataState
          isError={true}
          error={error}
          onRetry={refetch}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      <PageShell
        title="Jobs"
        subtitle="Manage and track maintenance jobs"
        actions={
          user?.role === 'PROPERTY_MANAGER' ? (
            <GradientButton
              startIcon={<AddIcon />}
              onClick={handleCreate}
              size="large"
              sx={{ width: { xs: '100%', md: 'auto' } }}
            >
              Create Job
            </GradientButton>
          ) : null
        }
        contentSpacing={{ xs: 3, md: 3 }}
      >
        {/* Filters */}
        <Box sx={{ mb: 3 }}>
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={handleSearchChange}
            onSearchClear={() => setSearchTerm('')}
            searchPlaceholder="Search jobs..."
            filters={[
              {
                key: 'status',
                label: 'Status',
                type: 'select',
                primary: true,
                minWidth: 150,
                options: [
                  { value: '', label: 'All' },
                  { value: 'OPEN', label: 'Open' },
                  { value: 'ASSIGNED', label: 'Assigned' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ],
              },
              {
                key: 'priority',
                label: 'Priority',
                type: 'select',
                primary: true,
                minWidth: 150,
                options: [
                  { value: '', label: 'All' },
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'URGENT', label: 'Urgent' },
                ],
              },
              {
                key: 'filter',
                label: 'Quick Filter',
                type: 'select',
                primary: true,
                minWidth: 150,
                options: [
                  { value: '', label: 'None' },
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'unassigned', label: 'Unassigned' },
                ],
              },
              {
                key: 'includeArchived',
                label: 'Show Archived',
                type: 'checkbox',
                primary: false,
              },
            ]}
            filterValues={filters}
            onFilterChange={(key, value) => handleFilterChange(key, value)}
            onClearFilters={handleClearFilters}
            viewMode={view}
            onViewModeChange={handleViewChange}
            viewModes={['kanban', 'list', 'table']}
            maxDesktopInlineFilters={3}
          />
        </Box>

        {selectedCount > 0 && (
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

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems="stretch"
              >
                <TextField
                  select
                  size="small"
                  value={bulkTechnicianId}
                  onChange={(e) => setBulkTechnicianId(e.target.value)}
                  placeholder="Select Technician"
                  sx={{
                    minWidth: { xs: '100%', sm: 200 },
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'background.paper',
                    },
                  }}
                >
                  <MenuItem value="" disabled>Select Technician</MenuItem>
                  {ensureArray(technicians).map((tech) => (
                    <MenuItem key={tech.id} value={tech.id}>
                      {tech.firstName} {tech.lastName}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack direction="row" spacing={2}>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleBulkDelete}
                  >
                    Delete ({selectedCount})
                  </Button>
                  <GradientButton
                    variant="contained"
                    onClick={handleOpenBulkAssignConfirm}
                    disabled={!bulkTechnicianId}
                  >
                    Assign ({selectedCount})
                  </GradientButton>
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        )}

        {/* Confirmation Dialogs */}
        <Dialog
          open={isConfirmBulkAssignOpen}
          onClose={handleCloseBulkAssignConfirm}
        >
          <DialogTitle>Confirm Assignment</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to assign <strong>{selectedJobIds.length} job(s)</strong> to{' '}
              <strong>{selectedTechnician?.firstName} {selectedTechnician?.lastName}</strong>?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseBulkAssignConfirm}>Cancel</Button>
            <Button onClick={handleConfirmBulkAssign} variant="contained" autoFocus>
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete Job</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete <strong>{jobToDelete?.title}</strong>? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmDelete} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Bulk Delete Progress Dialog */}
        <Dialog
          open={bulkDeleteOpen}
          // Don't allow closing while deleting
          onClose={!isBulkDeleting ? closeBulkDeleteDialog : undefined}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {isBulkDeleting ? 'Deleting Jobs...' : 'Delete Jobs'}
          </DialogTitle>
          <DialogContent>
            {!isBulkDeleting && bulkDeleteResults.succeeded.length === 0 && bulkDeleteResults.failed.length === 0 ? (
              <DialogContentText>
                Are you sure you want to delete <strong>{selectedJobIds.length}</strong> selected jobs? This action cannot be undone.
              </DialogContentText>
            ) : (
              <Box sx={{ mt: 2 }}>
                {isBulkDeleting && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Processing {bulkDeleteProgress.current} of {bulkDeleteProgress.total}...
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}
                    />
                  </Box>
                )}

                {!isBulkDeleting && (
                  <>
                    {bulkDeleteResults.failed.length > 0 && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        Failed to delete {bulkDeleteResults.failed.length} jobs.
                      </Alert>
                    )}
                    {bulkDeleteResults.succeeded.length > 0 && (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        Successfully deleted {bulkDeleteResults.succeeded.length} jobs.
                      </Alert>
                    )}

                    {bulkDeleteResults.failed.length > 0 && (
                      <Box sx={{ maxHeight: 200, overflow: 'auto', mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Failed Items:</Typography>
                        <List dense>
                          {bulkDeleteResults.failed.map(item => (
                            <ListItem key={item.id}>
                              <ListItemText
                                primary={item.title}
                                secondary={item.error}
                                primaryTypographyProps={{ color: 'error' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            {isBulkDeleting ? (
              <Button disabled>Processing...</Button>
            ) : (
              <>
                <Button onClick={closeBulkDeleteDialog}>
                  {bulkDeleteResults.succeeded.length > 0 || bulkDeleteResults.failed.length > 0 ? 'Close' : 'Cancel'}
                </Button>
                {bulkDeleteResults.succeeded.length === 0 && bulkDeleteResults.failed.length === 0 && (
                  <Button onClick={confirmBulkDelete} color="error" variant="contained">
                    Delete
                  </Button>
                )}
              </>
            )}
          </DialogActions>
        </Dialog>


        {/* Main Content */}
        <Box>
          {view === 'kanban' && (
            <DragDropContext onDragEnd={onDragEnd}>
              <Grid container spacing={3} sx={{ height: 'calc(100vh - 280px)', minHeight: 600, overflowX: 'auto', flexWrap: 'nowrap', pb: 2 }}>
                {KANBAN_STATUSES.map((status) => {
                  const statusJobs = filteredJobs.filter((job) => job.status === status);
                  return (
                    <Grid item key={status} sx={{ minWidth: 320, width: 320, height: '100%' }}>
                      <Paper
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          bgcolor: 'background.default',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={statusJobs.length}
                              size="small"
                              color={getStatusColor(status)}
                              sx={{ fontWeight: 'bold' }}
                            />
                            <Typography variant="subtitle1" fontWeight="bold">
                              {JOB_STATUS_LABELS[status]}
                            </Typography>
                          </Stack>
                        </Box>
                        <Droppable droppableId={status}>
                          {(provided, snapshot) => (
                            <Box
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              sx={{
                                p: 1,
                                flexGrow: 1,
                                overflowY: 'auto',
                                transition: 'background-color 0.2s',
                                bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'inherit',
                              }}
                            >
                              <Stack spacing={2}>
                                {statusJobs.map((job, index) => {
                                  const isSelected = selectedJobIds.includes(job.id);
                                  return (
                                    <Draggable key={job.id} draggableId={job.id.toString()} index={index} isDragDisabled={user?.role === 'TECHNICIAN'}>
                                      {(provided, snapshot) => (
                                        <Card
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          elevation={snapshot.isDragging ? 8 : 1}
                                          sx={{
                                            cursor: 'grab',
                                            border: isSelected ? `2px solid ${theme.palette.primary.main}` : '1px solid transparent',
                                            '&:hover': {
                                              borderColor: theme.palette.divider,
                                              boxShadow: 3
                                            },
                                            transition: 'all 0.2s'
                                          }}
                                          onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey) {
                                              handleToggleJobSelection(job.id);
                                            } else {
                                              handleOpenDetailModal(job);
                                            }
                                          }}
                                        >
                                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                                              <Box>
                                                <Typography variant="subtitle2" gutterBottom>
                                                  {job.title}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                  {job.property?.name ?? 'No Property'}
                                                  {job.unit ? ` • Unit ${job.unit.unitNumber}` : ''}
                                                </Typography>
                                              </Box>
                                              {isSelected && <CheckCircleIcon color="primary" fontSize="small" />}
                                            </Stack>

                                            <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
                                              <Chip
                                                label={job.priority}
                                                size="small"
                                                color={getPriorityColor(job.priority)}
                                                variant="outlined"
                                                sx={{ height: 24, fontSize: '0.7rem' }}
                                              />
                                              {job.assignedTo && (
                                                <Tooltip title={`Assigned to ${job.assignedTo.firstName}`}>
                                                  <PersonIcon fontSize="small" color="action" />
                                                </Tooltip>
                                              )}
                                              {isOverdue(job) && (
                                                <Tooltip title="Overdue">
                                                  <ErrorIcon fontSize="small" color="error" />
                                                </Tooltip>
                                              )}
                                            </Stack>
                                          </CardContent>
                                        </Card>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {provided.placeholder}
                              </Stack>
                            </Box>
                          )}
                        </Droppable>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </DragDropContext>
          )}

          {view === 'list' && (
            <Stack spacing={2}>
              {filteredJobs.map((job) => (
                <Card
                  key={job.id}
                  variant="outlined"
                  sx={{
                    borderColor: selectedJobIds.includes(job.id) ? 'primary.main' : 'divider',
                    borderWidth: selectedJobIds.includes(job.id) ? 2 : 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  onClick={(e) => {
                    // Multi-select on list view via click
                    if (e.target.closest('.MuiCheckbox-root') || e.target.closest('.MuiIconButton-root')) return;
                    handleOpenDetailModal(job);
                  }}
                >
                  <CardContent sx={{ py: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Checkbox
                      checked={selectedJobIds.includes(job.id)}
                      onChange={() => handleToggleJobSelection(job.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                        <Typography variant="subtitle1" fontWeight="bold">{job.title}</Typography>
                        {isOverdue(job) && <Chip label="Overdue" color="error" size="small" sx={{ height: 20, fontSize: '0.65rem' }} />}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {job.property?.name} {job.unit && `• Unit ${job.unit.unitNumber}`}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ textAlign: 'right', minWidth: 120 }}>
                        <Typography variant="caption" display="block" color="text.secondary">Priority</Typography>
                        <Chip size="small" label={job.priority} color={getPriorityColor(job.priority)} variant="outlined" />
                      </Box>
                      <Box sx={{ textAlign: 'right', minWidth: 120 }}>
                        <Typography variant="caption" display="block" color="text.secondary">Status</Typography>
                        <Chip size="small" label={JOB_STATUS_LABELS[job.status]} color={getStatusColor(job.status)} />
                      </Box>
                      <Box sx={{ textAlign: 'right', minWidth: 140 }}>
                        <Typography variant="caption" display="block" color="text.secondary">Assigned To</Typography>
                        <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={0.5}>
                          {job.assignedTo ? (
                            <>
                              <PersonIcon fontSize="small" color="action" />
                              <Typography variant="body2">{job.assignedTo.firstName} {job.assignedTo.lastName}</Typography>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary">Unassigned</Typography>
                          )}
                        </Stack>
                      </Box>

                      <IconButton size="small" onClick={(e) => handleStatusMenuOpen(e, job)}>
                        <MoreVertIcon />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {filteredJobs.length === 0 && <EmptyState title="No Jobs Found" description="Try adjusting your filters" icon={<BuildIcon fontSize="large" />} />}
            </Stack>
          )}

          {view === 'table' && (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={allVisibleSelected}
                        indeterminate={isSelectionIndeterminate}
                        onChange={handleToggleSelectAllVisible}
                      />
                    </TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Assigned To</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow key={job.id} hover selected={selectedJobIds.includes(job.id)}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedJobIds.includes(job.id)}
                          onChange={() => handleToggleJobSelection(job.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                          onClick={() => handleOpenDetailModal(job)}
                        >
                          {job.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {job.property?.name}
                        {job.unit && <Typography variant="caption" display="block" color="text.secondary">Unit {job.unit.unitNumber}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Chip label={job.priority} size="small" color={getPriorityColor(job.priority)} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip label={JOB_STATUS_LABELS[job.status]} size="small" color={getStatusColor(job.status)} />
                      </TableCell>
                      <TableCell>
                        {job.assignedTo ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}` : '-'}
                      </TableCell>
                      <TableCell>{moment(job.createdAt).format('MMM D, YYYY')}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleStatusMenuOpen(e, job)}>
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredJobs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                        <EmptyState title="No jobs found" description="Try adjusting your filters" icon={<BuildIcon fontSize="large" />} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Status Menu */}
          <Menu
            anchorEl={statusMenuAnchor}
            open={Boolean(statusMenuAnchor)}
            onClose={handleStatusMenuClose}
          >
            {['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((status) => (
              <MenuItem
                key={status}
                onClick={() => handleStatusChange(statusMenuJob, status)}
                selected={statusMenuJob?.status === status}
                disabled={statusMenuJob?.status === status}
              >
                <ListItemIcon>
                  {status === 'COMPLETED' ? <CheckCircleIcon fontSize="small" color="success" /> :
                    status === 'CANCELLED' ? <CloseIcon fontSize="small" color="error" /> :
                      <BuildIcon fontSize="small" />}
                </ListItemIcon>
                <ListItemText>{JOB_STATUS_LABELS[status]}</ListItemText>
              </MenuItem>
            ))}
            <MenuItem divider />
            <MenuItem onClick={() => {
              handleDeleteClick(statusMenuJob);
              handleStatusMenuClose();
            }} sx={{ color: 'error.main' }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Delete Job</ListItemText>
            </MenuItem>
          </Menu>
        </Box>

      </PageShell>

      {/* Forms & Dialogs */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        keepMounted={false}
      >
        <JobForm
          job={selectedJob}
          onSuccess={handleSuccess}
          onCancel={handleCloseDialog}
        />
      </Dialog>

      {detailModalOpen && selectedJob && (
        <JobDetailModal
          open={detailModalOpen}
          onClose={handleCloseDetailModal}
          jobId={selectedJob.id}
          onStatusChange={refetch}
          onEdit={() => {
            handleCloseDetailModal();
            handleEdit(selectedJob);
          }}
          onViewFull={() => handleOpenFullDetailPage(selectedJob.id)}
        />
      )}

      {/* Confirmation Dialog for Status Change (from hook) */}
      <JobStatusConfirmDialog
        open={confirmDialogState.open}
        onClose={closeConfirmDialog}
        onConfirm={confirmStatusUpdate}
        newStatus={confirmDialogState.newStatus}
        jobTitle={confirmDialogState.jobTitle}
        isUpdating={isStatusUpdating}
      />
    </Container>
  );
};

export default JobsPage;
