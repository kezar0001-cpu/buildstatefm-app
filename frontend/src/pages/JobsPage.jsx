
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
  CalendarToday as CalendarTodayIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useQuery, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import EmptyState from '../components/EmptyState';
import JobForm from '../components/JobForm';
import ensureArray from '../utils/ensureArray';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import JobDetailModal from '../components/JobDetailModal';
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

const localizer = momentLocalizer(moment);

const KANBAN_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];


const JobsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    propertyId: '',
    filter: '',
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [view, setView] = useState('card'); // 'card', 'kanban', 'calendar'
  const [searchTerm, setSearchTerm] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [bulkTechnicianId, setBulkTechnicianId] = useState('');
  const [isConfirmBulkAssignOpen, setIsConfirmBulkAssignOpen] = useState(false);

  // Job status update hook
  const {
    updateStatus,
    confirmStatusUpdate,
    closeConfirmDialog,
    confirmDialogState,
    isUpdating: isStatusUpdating,
  } = useJobStatusUpdate();

  // Build query params
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.priority) queryParams.append('priority', filters.priority);
  if (filters.propertyId) queryParams.append('propertyId', filters.propertyId);
  if (filters.filter) queryParams.append('filter', filters.filter);

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
    queryKey: queryKeys.jobs.list(filters),
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
  });

  // Flatten all pages into a single array
  const jobs = data?.pages?.flatMap(page => page.items) || [];

  // Fetch properties for filter
  const { data: propertiesData } = useQuery({
    queryKey: queryKeys.properties.all(),
    queryFn: async () => {
      const response = await apiClient.get('/properties?limit=100&offset=0');
      return response.data;
    },
  });

  const properties = propertiesData?.items || [];

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

  const handleQuickFilterToggle = (value) => {
    setFilters((prev) => ({
      ...prev,
      filter: prev.filter === value ? '' : value,
    }));
  };

  const handleViewChange = (event, nextView) => {
    if (nextView !== null) {
      setView(nextView);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleOpenDetailModal = (job) => {
    setSelectedJob(job);
    setDetailModalOpen(true);
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

  const handleConfirmBulkAssign = () => {
    if (selectedJobIds.length === 0 || !bulkTechnicianId) {
      return;
    }

    bulkAssignMutation.mutate({ jobIds: selectedJobIds, technicianId: bulkTechnicianId });
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedCount = selectedJobIds.length;
  const allVisibleSelected = filteredJobs.length > 0 && selectedCount === filteredJobs.length;
  const isSelectionIndeterminate = selectedCount > 0 && !allVisibleSelected;

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
    if (view !== 'card' && selectedJobIds.length > 0) {
      setSelectedJobIds([]);
    }
  }, [view, selectedJobIds.length]);

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
    const job = jobs.find(j => j.id === draggableId);
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
          size="medium"
          sx={{
            maxWidth: { xs: '100%', md: 'auto' },
            minHeight: { xs: 48, md: 36 },
          }}
        >
          Create Job
        </GradientButton>
      </Stack>

      <Paper
        sx={{
          p: { xs: 2.5, md: 3 },
          mb: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
            {[{ value: 'overdue', label: 'Overdue' }, { value: 'unassigned', label: 'Unassigned' }].map((quickFilter) => (
              <Chip
                key={quickFilter.value}
                label={quickFilter.label}
                color={filters.filter === quickFilter.value ? 'primary' : 'default'}
                variant={filters.filter === quickFilter.value ? 'filled' : 'outlined'}
                onClick={() => handleQuickFilterToggle(quickFilter.value)}
              />
            ))}
          </Stack>

          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', lg: 'center' }}
          >
            <TextField
              variant="outlined"
              placeholder="Search jobs by title, property, or notes..."
              value={searchTerm}
              onChange={handleSearchChange}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton aria-label="clear search" onClick={() => setSearchTerm('')} edge="end" size="small">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, minWidth: 240 }}
            />

            <TextField
              select
              fullWidth
              id="jobs-filter-status"
              name="status"
              label="Status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              size="small"
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="OPEN">Open</MenuItem>
              <MenuItem value="ASSIGNED">Assigned</MenuItem>
              <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </TextField>

            <TextField
              select
              fullWidth
              id="jobs-filter-priority"
              name="priority"
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

            <TextField
              select
              fullWidth
              id="jobs-filter-property"
              name="propertyId"
              label="Property"
              value={filters.propertyId}
              onChange={(e) => handleFilterChange('propertyId', e.target.value)}
              size="small"
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All Properties</MenuItem>
              {properties.map((property) => (
                <MenuItem key={property.id} value={property.id}>
                  {property.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              id="jobs-filter-quick"
              name="filter"
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

            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={handleViewChange}
              aria-label="view toggle"
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
                  px: 1,
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                },
                '& .Mui-selected': {
                  color: 'primary.main',
                  backgroundColor: 'transparent !important',
                  '&:hover': {
                    backgroundColor: 'action.hover !important',
                  },
                },
              }}
            >
              <ToggleButton value="card" aria-label="card view">
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="kanban" aria-label="kanban view">
                <ViewKanbanIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="calendar" aria-label="calendar view">
                <CalendarTodayIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>
      </Paper>

      {view === 'card' && selectedCount > 0 && (
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
                  Choose a technician to assign all selected jobs
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
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Jobs List / Views */}
      {!filteredJobs || filteredJobs.length === 0 ? (
        <EmptyState
          icon={BuildIcon}
          title={filters.status || filters.priority || filters.propertyId || filters.filter || searchTerm ? 'No jobs match your filters' : 'No jobs yet'}
          description={
            filters.status || filters.priority || filters.propertyId || filters.filter || searchTerm
              ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
              : 'Get started by creating your first maintenance job. Track work orders, assign technicians, and monitor progress all in one place.'
          }
          actionLabel={filters.status || filters.priority || filters.propertyId || filters.filter || searchTerm ? undefined : 'Create First Job'}
          onAction={filters.status || filters.priority || filters.propertyId || filters.filter || searchTerm ? undefined : handleCreate}
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
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleToggleJobSelection(job.id)}
                          color="primary"
                          sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
                          inputProps={{ 'aria-label': `Select job ${job.title}` }}
                        />
                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5, pt: 5, pb: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 2,
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="h6"
                            gutterBottom
                            sx={{
                              fontSize: '1.125rem',
                              fontWeight: 700,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.3,
                              mb: 1.5,
                            }}
                          >
                            {job.title}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
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
                          <TextField
                            select
                            size="small"
                            value={job.status}
                            onChange={(e) => updateStatus(job.id, job.status, e.target.value, job.title)}
                            label="Update Status"
                            sx={{
                              minWidth: 160,
                              mb: 1.5,
                              '& .MuiOutlinedInput-root': {
                                fontSize: '0.875rem',
                              }
                            }}
                            disabled={(VALID_STATUS_TRANSITIONS[job.status] || []).length === 0}
                            helperText={getStatusHelperText(job.status)}
                          >
                            {getAllowedStatuses(job.status).map((statusOption) => (
                              <MenuItem key={statusOption} value={statusOption}>
                                {statusOption.replace('_', ' ')}
                              </MenuItem>
                            ))}
                          </TextField>
                          {isOverdue(job) && (
                            <Chip
                              icon={<ErrorIcon fontSize="small" />}
                              label="OVERDUE"
                              color="error"
                              size="small"
                              sx={{ mb: 1 }}
                            />
                          )}
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <IconButton
                            size="small"
                            color="default"
                            onClick={() => handleOpenDetailModal(job)}
                          >
                            <VisibilityIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEdit(job)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Stack>
                      </Box>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.5,
                        }}
                      >
                        {job.description || 'No description provided'}
                      </Typography>

                      <Stack spacing={1} sx={{ mt: 'auto' }}>
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
                            }}
                          >
                            {job.property?.name || 'N/A'}
                          </Typography>
                        </Box>
                      </Stack>
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
              <Grid container spacing={{ xs: 2, md: 3 }}>
                {KANBAN_STATUSES.map((status) => (
                  <Grid item xs={12} md={4} key={status}>
                    <Paper sx={{ p: { xs: 2, md: 3 }, backgroundColor: '#f5f5f5' }}>
                      <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
                        {JOB_STATUS_LABELS[status] || status.replace('_', ' ')}
                      </Typography>
                      <Droppable droppableId={status}>
                        {(provided) => (
                          <Box
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            sx={{ minHeight: '500px' }}
                          >
                            {filteredJobs
                              .filter((job) => job.status === status)
                              .map((job, index) => (
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
                                      sx={{ mb: 2 }}
                                    >
                                      <CardContent>
                                        <Stack spacing={1.25}>
                                          <Typography variant="subtitle1" fontWeight={700}>
                                            {job.title}
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            {[job.property?.name, job.unit?.unitNumber ? `Unit ${job.unit.unitNumber}` : null]
                                              .filter(Boolean)
                                              .join(' • ')}
                                          </Typography>
                                          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                                            <Chip
                                              label={job.priority}
                                              color={getPriorityColor(job.priority)}
                                              size="small"
                                            />
                                            <Chip
                                              label={JOB_STATUS_LABELS[job.status] || job.status}
                                              color={getStatusColor(job.status)}
                                              size="small"
                                              variant="outlined"
                                            />
                                          </Stack>
                                          <Stack direction="row" spacing={1} alignItems="center">
                                            <PersonIcon fontSize="small" color="action" />
                                            <Typography variant="body2" color="text.primary">
                                              {job.assignedTo
                                                ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}`
                                                : 'Unassigned'}
                                            </Typography>
                                          </Stack>
                                          <Stack direction="row" spacing={1} alignItems="center">
                                            <AccessTimeIcon
                                              fontSize="small"
                                              color={isOverdue(job) ? 'error' : 'action'}
                                            />
                                            <Typography
                                              variant="body2"
                                              color={isOverdue(job) ? 'error.main' : 'text.secondary'}
                                            >
                                              {job.scheduledDate
                                                ? moment(job.scheduledDate).format('MMM D, YYYY')
                                                : 'No schedule'}
                                            </Typography>
                                            {isOverdue(job) && (
                                              <Chip label="Overdue" size="small" color="error" variant="outlined" />
                                            )}
                                          </Stack>
                                        </Stack>
                                      </CardContent>
                                    </Card>
                                  )}
                                </Draggable>
                              ))}
                            {provided.placeholder}
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
            <Paper sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
              <Box sx={{ overflowX: 'auto' }}>
                <Calendar
                  localizer={localizer}
                  events={filteredJobs
                    .filter((job) => job.scheduledDate)
                    .map((job) => ({
                      id: job.id,
                      title: job.title,
                      start: new Date(job.scheduledDate),
                      end: new Date(job.scheduledDate),
                      allDay: true,
                      resource: job,
                    }))}
                  startAccessor="start"
                  endAccessor="end"
                  style={{
                    height: 600,
                    minWidth: 600
                  }}
                  onSelectEvent={(event) => handleOpenDetailModal(event.resource)}
                />
              </Box>
            </Paper>
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
        onClose={() => setDetailModalOpen(false)}
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
    </Container>
  );
};

export default JobsPage;
