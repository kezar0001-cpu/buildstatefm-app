import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  TextField,
  MenuItem,
  IconButton,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Backdrop,
  Checkbox,
  FormControlLabel,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Build as BuildIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  ViewKanban as ViewKanbanIcon,
  TableChart as TableChartIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import EmptyState from '../components/EmptyState';
import ServiceRequestForm from '../components/ServiceRequestForm';
import ServiceRequestDetailModal from '../components/ServiceRequestDetailModal';
import ensureArray from '../utils/ensureArray';
import { parseListResponse, parsePaginatedResponse, parseItemResponse } from '../utils/apiResponseParser';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { queryKeys } from '../utils/queryKeys.js';
import { formatDate } from '../utils/date';
import GradientButton from '../components/GradientButton';
import PageShell from '../components/PageShell';
import { useCurrentUser } from '../context/UserContext.jsx';

const ServiceRequestsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
    includeArchived: false,
  });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [convertDialog, setConvertDialog] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState([]);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('service-requests-view-mode') || 'kanban';
    } catch {
      return 'kanban';
    }
  });
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get user role from auth context
  const userRole = user?.role || 'TENANT';

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build query params
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.category) queryParams.append('category', filters.category);
  if (filters.priority) queryParams.append('priority', filters.priority);
  if (debouncedSearch) queryParams.append('search', debouncedSearch);
  if (filters.includeArchived) queryParams.append('includeArchived', 'true');

  // Fetch service requests with infinite query
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.serviceRequests.list({ ...filters, search: debouncedSearch }),
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams(queryParams);
      params.append('limit', '50');
      params.append('offset', pageParam.toString());
      const response = await apiClient.get(`/service-requests?${params.toString()}`);
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page * 50 : undefined;
    },
    initialPageParam: 0,
    refetchOnWindowFocus: true, // Refresh when window regains focus
  });

  // Flatten all pages into a single array
  const requests = data?.pages?.flatMap(page => page.items) || [];
  const requestList = Array.isArray(requests) ? requests : [];

  // Fetch properties for filter (only for non-tenants)
  const { data: propertiesData } = useQuery({
    queryKey: queryKeys.properties.all(),
    queryFn: async () => {
      const response = await apiClient.get('/properties?limit=100&offset=0');
      return response.data;
    },
    enabled: userRole !== 'TENANT',
  });

  const properties = propertiesData?.items || [];
  const propertyOptions = useMemo(() => {
    return Array.isArray(properties) ? properties : [];
  }, [properties]);

  const handleClearFilters = () => {
    setFilters({
      status: '',
      category: '',
      priority: '',
      includeArchived: false,
    });
    setSearchInput('');
    setDebouncedSearch('');
  };

  const handleViewDetails = (request) => {
    setSelectedRequest(request.id);
  };

  const handleEdit = (request) => {
    // Check if request is rejected
    if (request.status === 'REJECTED' || request.status === 'REJECTED_BY_OWNER') {
      toast.error('Cannot edit a rejected service request');
      return;
    }
    
    // Check if user is the creator
    if (request.requestedById !== user?.id) {
      toast.error('You can only edit service requests that you created');
      return;
    }
    
    setSelectedRequest(request.id);
    setOpenDialog(true);
  };

  const handleDelete = (request) => {
    // Check if user is the creator
    if (request.requestedById !== user?.id) {
      toast.error('You can only delete service requests that you created');
      return;
    }
    
    setRequestToDelete(request);
    setDeleteConfirmDialogOpen(true);
  };

  const handleDeleteConfirmClose = () => {
    setDeleteConfirmDialogOpen(false);
    setRequestToDelete(null);
  };

  // Phase 2: Add optimistic delete mutation with better UX
  const deleteMutation = useMutation({
    mutationFn: async (requestId) => {
      const response = await apiClient.delete(`/service-requests/${requestId}`);
      return response.data;
    },
    onMutate: async (requestId) => {
      // Cancel outgoing refetches for all service request queries
      const queryKey = queryKeys.serviceRequests.list({ ...filters, search: debouncedSearch });
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically remove from cache
      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            items: page.items?.filter(item => item.id !== requestId) || [],
            total: Math.max(0, (page.total || 0) - 1),
          })),
        };
      });
      
      return { previousData, queryKey };
    },
    onError: (err, requestId, context) => {
      // Rollback on error
      if (context?.previousData && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      toast.error(err?.response?.data?.message || 'Failed to delete service request');
    },
    onSuccess: () => {
      toast.success('Service request deleted successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });
    },
  });

  const handleDeleteConfirm = async () => {
    if (!requestToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(requestToDelete.id);
      handleDeleteConfirmClose();
    } catch (error) {
      // Error already handled in mutation
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewModeChange = (event, newViewMode) => {
    if (newViewMode !== null) {
      setViewMode(newViewMode);
      try {
        localStorage.setItem('service-requests-view-mode', newViewMode);
      } catch (err) {
        // Ignore localStorage errors
      }
    }
  };

  const handleToggleRequestSelection = (requestId) => {
    setSelectedRequestIds((prev) => {
      if (prev.includes(requestId)) {
        return prev.filter((id) => id !== requestId);
      }
      return [...prev, requestId];
    });
  };

  const handleToggleSelectAllVisible = (event) => {
    const { checked } = event.target;
    if (checked) {
      setSelectedRequestIds(requestList.map((request) => request.id));
    } else {
      setSelectedRequestIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRequestIds.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedRequestIds.length} service request(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      // Delete all selected requests in parallel
      const deletePromises = selectedRequestIds.map((id) =>
        apiClient.delete(`/service-requests/${id}`)
      );

      await Promise.all(deletePromises);
      toast.success(`Successfully deleted ${selectedRequestIds.length} service request(s)`);
      setSelectedRequestIds([]);
      refetch();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to delete some service requests');
      // Still clear selection even if some failed
      setSelectedRequestIds([]);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSuccess = () => {
    refetch();
    handleCloseDialog();
  };

  useEffect(() => {
    if (location.state?.openCreateDialog) {
      setOpenDialog(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.state, navigate]);

  const handleReview = (request) => {
    setReviewDialog(request);
  };

  const handleConvert = (request) => {
    setConvertDialog(request);
  };

  const getCategoryColor = (category) => {
    const colors = {
      PLUMBING: 'info',
      ELECTRICAL: 'warning',
      HVAC: 'primary',
      APPLIANCE: 'secondary',
      STRUCTURAL: 'error',
      PEST_CONTROL: 'default',
      LANDSCAPING: 'success',
      GENERAL: 'default',
      OTHER: 'default',
    };
    return colors[category] || 'default';
  };

  const getStatusColor = (status) => {
    const colors = {
      SUBMITTED: 'warning',
      UNDER_REVIEW: 'info',
      PENDING_MANAGER_REVIEW: 'info',
      PENDING_OWNER_APPROVAL: 'warning',
      APPROVED: 'success',
      APPROVED_BY_OWNER: 'success',
      REJECTED: 'error',
      REJECTED_BY_OWNER: 'error',
      CONVERTED_TO_JOB: 'primary',
      COMPLETED: 'success',
      ARCHIVED: 'default',
    };
    return colors[status] || 'default';
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <PageShell
          title="Service Requests"
          subtitle={
            userRole === 'TENANT'
              ? 'Submit and track your maintenance requests'
              : 'Review and manage tenant service requests'
          }
          actions={(
            <GradientButton
              startIcon={<AddIcon />}
              disabled
              size="medium"
              sx={{ width: { xs: '100%', md: 'auto' } }}
            >
              {userRole === 'TENANT' ? 'Submit Request' : 'Create Request'}
            </GradientButton>
          )}
        >
          <Box sx={{ mt: 3 }}>
            <LoadingSkeleton variant="list" count={5} showAvatar={true} height={120} />
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
        title="Service Requests"
        subtitle={
          userRole === 'TENANT'
            ? 'Submit and track your maintenance requests'
            : 'Review and manage tenant service requests'
        }
        actions={
          userRole !== 'PROPERTY_MANAGER' ? (
            <GradientButton
              startIcon={<AddIcon />}
              onClick={handleCreate}
              size="medium"
              sx={{ width: { xs: '100%', md: 'auto' } }}
            >
              {userRole === 'TENANT' ? 'Submit Request' : 'Create Request'}
            </GradientButton>
          ) : undefined
        }
        contentSpacing={{ xs: 3, md: 3 }}
      >
        {/* Filters */}
        <Paper
          sx={{
            mb: 3,
            p: { xs: 2, md: 3.5 },
            borderRadius: { xs: 2, md: 2 },
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
            animation: 'fade-in-up 0.6s ease-out',
          }}
        >
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', lg: 'center' }}
            sx={{ flexWrap: 'wrap', gap: { xs: 1.5, lg: 2 } }}
          >
            {/* Search */}
            <TextField
              placeholder="Search service requests..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    <SearchIcon />
                  </Box>
                ),
                endAdornment: searchInput && (
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                    <IconButton
                      aria-label="clear search"
                      onClick={() => setSearchInput('')}
                      edge="end"
                      size="small"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ),
              }}
              size="small"
              sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 300, lg: 400 } }}
            />

            {/* Filter Row */}
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                flexWrap: 'nowrap',
                gap: 1.5,
                width: { xs: '100%', lg: 'auto' },
                overflowX: 'auto',
                overflowY: 'hidden',
                whiteSpace: 'nowrap',
                pb: 0.5,
                '&::-webkit-scrollbar': { height: 6 },
              }}
            >
              {/* Status Filter */}
              <TextField
                id="service-requests-filter-status"
                name="status"
                select
                label="Status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                size="small"
                sx={{ minWidth: 150, flexShrink: 0 }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="SUBMITTED">Submitted</MenuItem>
                <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
                <MenuItem value="PENDING_MANAGER_REVIEW">Pending Manager Review</MenuItem>
                <MenuItem value="PENDING_OWNER_APPROVAL">Pending Owner Approval</MenuItem>
                <MenuItem value="APPROVED">Approved</MenuItem>
                <MenuItem value="APPROVED_BY_OWNER">Approved by Owner</MenuItem>
                <MenuItem value="REJECTED">Rejected</MenuItem>
                <MenuItem value="REJECTED_BY_OWNER">Rejected by Owner</MenuItem>
                <MenuItem value="CONVERTED_TO_JOB">Converted to Job</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="ARCHIVED">Archived</MenuItem>
              </TextField>

              {/* Category Filter */}
              <TextField
                id="service-requests-filter-category"
                name="category"
                select
                label="Category"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                size="small"
                sx={{ minWidth: 150, flexShrink: 0 }}
              >
                <MenuItem value="">All Categories</MenuItem>
                <MenuItem value="PLUMBING">Plumbing</MenuItem>
                <MenuItem value="ELECTRICAL">Electrical</MenuItem>
                <MenuItem value="HVAC">HVAC</MenuItem>
                <MenuItem value="APPLIANCE">Appliance</MenuItem>
                <MenuItem value="STRUCTURAL">Structural</MenuItem>
                <MenuItem value="PEST_CONTROL">Pest Control</MenuItem>
                <MenuItem value="LANDSCAPING">Landscaping</MenuItem>
                <MenuItem value="GENERAL">General</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </TextField>

              {/* Priority Filter */}
              <TextField
                id="service-requests-filter-priority"
                name="priority"
                select
                label="Priority"
                value={filters.priority || ''}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                size="small"
                sx={{ minWidth: 150, flexShrink: 0 }}
              >
                <MenuItem value="">All Priorities</MenuItem>
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="URGENT">Urgent</MenuItem>
              </TextField>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!filters.includeArchived}
                    onChange={(e) => handleFilterChange('includeArchived', e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ userSelect: 'none' }}>
                    Show Archived
                  </Typography>
                }
                sx={{ ml: 0, flexShrink: 0 }}
              />
            </Stack>

            {/* Clear Filters Button */}
            {(debouncedSearch || filters.status || filters.category || filters.priority) && (
              <Button
                variant="text"
                color="inherit"
                size="small"
                onClick={handleClearFilters}
                sx={{ textTransform: 'none', minWidth: 'auto' }}
                startIcon={<CloseIcon />}
              >
                Clear filters
              </Button>
            )}

            {/* View Toggle - Desktop only */}
            {!isMobile && (
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={handleViewModeChange}
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
                <ToggleButton value="grid" aria-label="grid view">
                  <Tooltip title="Grid View">
                    <ViewModuleIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="kanban" aria-label="kanban view">
                  <Tooltip title="Kanban View">
                    <ViewKanbanIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="table" aria-label="table view">
                  <Tooltip title="Table View">
                    <TableChartIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          </Stack>
        </Paper>

      {/* Bulk Actions Bar */}
      {selectedRequestIds.length > 0 && (
        <Paper
          elevation={2}
          sx={{
            mb: 3,
            px: { xs: 2, md: 3 },
            py: { xs: 2, md: 2.5 },
            borderRadius: { xs: 2, md: 3 },
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
                checked={requestList.length > 0 && selectedRequestIds.length === requestList.length}
                indeterminate={selectedRequestIds.length > 0 && selectedRequestIds.length < requestList.length}
                onChange={handleToggleSelectAllVisible}
                inputProps={{ 'aria-label': 'Select all visible service requests' }}
              />
              <Box>
                <Typography variant="subtitle1">{selectedRequestIds.length} selected</Typography>
                <Typography variant="body2" color="text.secondary">
                  Delete selected service requests
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button
                variant="outlined"
                color="error"
                onClick={handleBulkDelete}
                startIcon={<DeleteIcon />}
              >
                Delete Selected
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Service Requests List */}
      {requestList.length === 0 ? (
        <EmptyState
          icon={AssignmentIcon}
          iconColor="#dc2626"
          title={
            filters.status || filters.category || filters.priority
              ? 'No service requests match your filters'
              : 'No service requests yet'
          }
          description={
            filters.status || filters.category || filters.priority
              ? 'Try adjusting your search terms or filters to find what you\'re looking for. Clear filters to see all requests.'
              : userRole === 'TENANT'
                ? 'Need maintenance or repairs? Submit your first service request and we\'ll take care of it promptly.'
                : 'Start managing service requests from your tenants. Track issues, assign jobs, and keep everyone informed.'
          }
          actionLabel={
            filters.status || filters.category || filters.priority || userRole === 'PROPERTY_MANAGER'
              ? undefined
              : userRole === 'TENANT'
                ? 'Submit First Request'
                : 'Create Request'
          }
          onAction={
            filters.status || filters.category || filters.priority || userRole === 'PROPERTY_MANAGER'
              ? undefined
              : handleCreate
          }
          helperText={
            filters.status || filters.category || filters.priority
              ? 'Filters are still applied. Clear them to view all service requests or create a new one from here.'
              : undefined
          }
        />
      ) : (
        <Stack spacing={3}>
          {/* Mobile Card View */}
          {isMobile ? (
            <Stack spacing={2}>
              {requestList.map((request) => {
                const description = typeof request.description === 'string' ? request.description : '';
                const displayDescription = description
                  ? description.length > 100
                    ? `${description.substring(0, 100)}...`
                    : description
                  : 'No description provided.';
                const statusLabel = request.status ? request.status.replace(/_/g, ' ') : 'Unknown';
                const categoryLabel = request.category ? request.category.replace(/_/g, ' ') : 'Uncategorized';
                const priorityLabel = request.priority ? request.priority.replace(/_/g, ' ') : null;

                const isSelected = selectedRequestIds.includes(request.id);

                return (
                  <Card
                    key={request.id}
                    sx={{
                      boxShadow: isSelected ? 4 : 2,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      position: 'relative',
                      transition: 'all 0.3s ease-in-out',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
                        opacity: isSelected ? 1 : 0,
                        transition: 'opacity 0.3s ease-in-out',
                      },
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6,
                        borderColor: 'primary.main',
                        '&::before': {
                          opacity: 1,
                        },
                      },
                    }}
                    onClick={(e) => {
                      // Don't open modal if clicking on checkbox or its container
                      if (e.target.closest('input[type="checkbox"]') || e.target.closest('.MuiCheckbox-root')) {
                        return;
                      }
                      handleViewDetails(request);
                    }}
                  >
                    <CardContent 
                      sx={{ p: 2.5 }}
                      onClick={(e) => {
                        // Don't open modal if clicking on checkbox or its container
                        if (e.target.closest('input[type="checkbox"]') || e.target.closest('.MuiCheckbox-root')) {
                          return;
                        }
                        handleViewDetails(request);
                      }}
                    >
                      <Stack spacing={2}>
                        {/* Header Row */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Checkbox
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleRequestSelection(request.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                color="primary"
                                sx={{ p: 0.5 }}
                                inputProps={{ 'aria-label': `Select service request ${request.title}` }}
                              />
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                Title
                              </Typography>
                            </Box>
                            <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5, wordBreak: 'break-word' }}>
                              {request.title}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                              <Chip
                                label={statusLabel}
                                color={getStatusColor(request.status)}
                                size="small"
                              />
                              <Chip
                                label={categoryLabel}
                                color={getCategoryColor(request.category)}
                                size="small"
                                variant="outlined"
                              />
                              {priorityLabel && (
                                <Chip
                                  label={priorityLabel}
                                  size="small"
                                />
                              )}
                            </Stack>
                          </Box>
                          {request.requestedById === user?.id && (
                            <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(request);
                                }}
                                sx={{ color: 'text.secondary' }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(request);
                                }}
                                sx={{ color: 'error.main' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          )}
                        </Box>
                        <Divider />

                        {/* Property */}
                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: 'action.hover',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
                            Property
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5, wordBreak: 'break-word' }}>
                            {request.property?.name || 'N/A'}
                          </Typography>
                        </Box>

                        {/* Unit */}
                        {request.unit && (
                          <Box>
                            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                              Unit
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              Unit {request.unit.unitNumber}
                            </Typography>
                          </Box>
                        )}

                        {/* Submitted By */}
                        {userRole !== 'TENANT' && (
                          <Box>
                            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                              Submitted By
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {request.requestedBy?.firstName} {request.requestedBy?.lastName}
                            </Typography>
                          </Box>
                        )}

                        {/* Submitted Date */}
                        <Box>
                          <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                            Submitted
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {formatDate(request.createdAt)}
                          </Typography>
                        </Box>

                        {/* Jobs Created */}
                        {request.jobs && request.jobs.length > 0 && (
                          <Box>
                            <Chip
                              icon={<BuildIcon fontSize="small" />}
                              label={`${request.jobs.length} Job(s) Created`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </Box>
                        )}

                        {/* Description */}
                        <Box>
                          <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                            Description
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
                            {displayDescription}
                          </Typography>
                        </Box>

                        {/* Action Buttons */}
                        {userRole !== 'TENANT' && request.status === 'SUBMITTED' && (
                          <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                            <Button
                              fullWidth
                              variant="outlined"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReview(request);
                              }}
                            >
                              Review
                            </Button>
                            <Button
                              fullWidth
                              variant="contained"
                              size="small"
                              startIcon={<BuildIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConvert(request);
                              }}
                            >
                              Convert to Job
                            </Button>
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          ) : viewMode === 'kanban' && !isMobile ? (
            /* Kanban View */
            <ServiceRequestKanban
              requests={requestList}
              onView={handleViewDetails}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReview={handleReview}
              onConvert={handleConvert}
              user={user}
              userRole={userRole}
              getCategoryColor={getCategoryColor}
              getStatusColor={getStatusColor}
            />
          ) : viewMode === 'grid' ? (
            /* Desktop Grid View */
            <Grid container spacing={{ xs: 2, md: 3 }}>
              {requestList.map((request) => {
                const description = typeof request.description === 'string' ? request.description : '';
                const displayDescription = description
                  ? description.length > 100
                    ? `${description.substring(0, 100)}...`
                    : description
                  : 'No description provided.';
                const statusLabel = request.status ? request.status.replace(/_/g, ' ') : 'Unknown';
                const categoryLabel = request.category ? request.category.replace(/_/g, ' ') : 'Uncategorized';
                const priorityLabel = request.priority ? request.priority.replace(/_/g, ' ') : null;

                const isSelected = selectedRequestIds.includes(request.id);

                return (
                  <Grid item xs={12} md={6} lg={4} key={request.id}>
                    <Card
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        boxShadow: isSelected ? 4 : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease-in-out',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '4px',
                          background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
                          opacity: isSelected ? 1 : 0,
                          transition: 'opacity 0.3s ease-in-out',
                        },
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 6,
                          borderColor: 'primary.main',
                          '&::before': {
                            opacity: 1,
                          },
                        },
                    }}
                    onClick={(e) => {
                      // Don't open modal if clicking on checkbox or its container
                      if (e.target.closest('input[type="checkbox"]') || e.target.closest('.MuiCheckbox-root')) {
                        return;
                      }
                      handleViewDetails(request);
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleRequestSelection(request.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              color="primary"
                              sx={{ p: 0.5 }}
                              inputProps={{ 'aria-label': `Select service request ${request.title}` }}
                            />
                            <Typography variant="h6" sx={{ flex: 1 }}>
                              {request.title}
                            </Typography>
                          </Box>
                          {request.requestedById === user?.id && (
                            <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(request);
                                }}
                                sx={{ color: 'text.secondary' }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(request);
                                }}
                                sx={{ color: 'error.main' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          )}
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={statusLabel}
                            color={getStatusColor(request.status)}
                            size="small"
                          />
                          <Chip
                            label={categoryLabel}
                            color={getCategoryColor(request.category)}
                            size="small"
                            variant="outlined"
                          />
                          {priorityLabel && (
                            <Chip
                              label={priorityLabel}
                              size="small"
                            />
                          )}
                        </Stack>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {displayDescription}
                        </Typography>

                        <Stack spacing={1}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Property
                            </Typography>
                            <Typography variant="body2">
                              {request.property?.name || 'N/A'}
                            </Typography>
                          </Box>

                          {request.unit && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Unit
                              </Typography>
                              <Typography variant="body2">
                                Unit {request.unit.unitNumber}
                              </Typography>
                            </Box>
                          )}

                          {userRole !== 'TENANT' && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Submitted By
                              </Typography>
                              <Typography variant="body2">
                                {request.requestedBy?.firstName} {request.requestedBy?.lastName}
                              </Typography>
                            </Box>
                          )}

                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Submitted
                            </Typography>
                            <Typography variant="body2">
                              {formatDate(request.createdAt)}
                            </Typography>
                          </Box>

                          {request.jobs && request.jobs.length > 0 && (
                            <Box>
                              <Chip
                                icon={<BuildIcon fontSize="small" />}
                                label={`${request.jobs.length} Job(s) Created`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </Box>
                          )}
                        </Stack>
                      </CardContent>

                      {userRole !== 'TENANT' && request.status === 'SUBMITTED' && (
                        <Box
                          sx={{
                            p: 2,
                            pt: 0,
                            display: 'flex',
                            gap: 1,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            onClick={() => handleReview(request)}
                          >
                            Review
                          </Button>
                          <Button
                            fullWidth
                            variant="contained"
                            size="small"
                            startIcon={<BuildIcon />}
                            onClick={() => handleConvert(request)}
                          >
                            Convert to Job
                          </Button>
                        </Box>
                      )}
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : viewMode === 'table' && !isMobile ? (
            /* Table View - Desktop only */
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={requestList.length > 0 && selectedRequestIds.length === requestList.length}
                          indeterminate={selectedRequestIds.length > 0 && selectedRequestIds.length < requestList.length}
                          onChange={handleToggleSelectAllVisible}
                          inputProps={{ 'aria-label': 'Select all visible service requests' }}
                        />
                      </TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Property</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Submitted</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requestList.map((request) => {
                      const isSelected = selectedRequestIds.includes(request.id);
                      const statusLabel = request.status ? request.status.replace(/_/g, ' ') : 'Unknown';
                      const categoryLabel = request.category ? request.category.replace(/_/g, ' ') : 'Uncategorized';
                      const priorityLabel = request.priority ? request.priority.replace(/_/g, ' ') : null;
                      return (
                        <TableRow
                          key={request.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleViewDetails(request)}
                        >
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleRequestSelection(request.id);
                              }}
                              color="primary"
                              inputProps={{ 'aria-label': `Select service request ${request.title}` }}
                            />
                          </TableCell>
                          <TableCell>{request.title}</TableCell>
                          <TableCell>{request.property?.name || 'N/A'}</TableCell>
                          <TableCell>
                            <Chip
                              label={statusLabel}
                              color={getStatusColor(request.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={categoryLabel}
                              color={getCategoryColor(request.category)}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            {priorityLabel && (
                              <Chip
                                label={priorityLabel}
                                size="small"
                              />
                            )}
                          </TableCell>
                          <TableCell>{formatDate(request.createdAt)}</TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            {request.requestedById === user?.id && (
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(request);
                                  }}
                                  sx={{ color: 'text.secondary' }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(request);
                                  }}
                                  sx={{ color: 'error.main' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : null}

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

      </PageShell>

      {/* Create Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, md: 3 },
            maxHeight: { xs: '100vh', md: '90vh' },
          },
        }}
      >
        <ServiceRequestForm
          onSuccess={handleSuccess}
          onCancel={handleCloseDialog}
        />
      </Dialog>

      {/* Review Dialog */}
      {reviewDialog && (
        <ReviewDialog
          request={reviewDialog}
          onClose={() => setReviewDialog(null)}
          onSuccess={() => {
            refetch();
            setReviewDialog(null);
          }}
        />
      )}

      {/* Convert to Job Dialog */}
      {convertDialog && (
        <ConvertToJobDialog
          request={convertDialog}
          onClose={() => setConvertDialog(null)}
          onSuccess={() => {
            refetch();
            setConvertDialog(null);
          }}
        />
      )}

      {/* Service Request Detail Modal */}
      <ServiceRequestDetailModal
        requestId={selectedRequest}
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialogOpen}
        onClose={isDeleting ? undefined : handleDeleteConfirmClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Delete Service Request</Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleDeleteConfirmClose}
              aria-label="close"
              disabled={isDeleting}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the service request &quot;{requestToDelete?.title}&quot;? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDeleteConfirmClose} variant="outlined" disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

// Service Request Kanban Board Component
const ServiceRequestKanban = ({
  requests,
  onView,
  onEdit,
  onDelete,
  onReview,
  onConvert,
  user,
  userRole,
  getCategoryColor,
  getStatusColor,
}) => {
  const { useMemo } = React;
  
  // Group requests by status
  const columns = useMemo(() => {
    const grouped = {
      SUBMITTED: [],
      UNDER_REVIEW: [],
      PENDING_MANAGER_REVIEW: [],
      PENDING_OWNER_APPROVAL: [],
      APPROVED: [],
      APPROVED_BY_OWNER: [],
      REJECTED: [],
      REJECTED_BY_OWNER: [],
      CONVERTED_TO_JOB: [],
      COMPLETED: [],
      ARCHIVED: [],
    };

    requests.forEach(request => {
      const status = request.status || 'SUBMITTED';
      if (grouped[status]) {
        grouped[status].push(request);
      }
    });

    return [
      { id: 'SUBMITTED', title: 'Submitted', requests: grouped.SUBMITTED, color: 'warning' },
      { id: 'UNDER_REVIEW', title: 'Under Review', requests: grouped.UNDER_REVIEW, color: 'info' },
      { id: 'PENDING_MANAGER_REVIEW', title: 'Pending Manager Review', requests: grouped.PENDING_MANAGER_REVIEW, color: 'info' },
      { id: 'PENDING_OWNER_APPROVAL', title: 'Pending Owner Approval', requests: grouped.PENDING_OWNER_APPROVAL, color: 'warning' },
      { id: 'APPROVED', title: 'Approved', requests: grouped.APPROVED, color: 'success' },
      { id: 'APPROVED_BY_OWNER', title: 'Approved by Owner', requests: grouped.APPROVED_BY_OWNER, color: 'success' },
      { id: 'REJECTED', title: 'Rejected', requests: grouped.REJECTED, color: 'error' },
      { id: 'REJECTED_BY_OWNER', title: 'Rejected by Owner', requests: grouped.REJECTED_BY_OWNER, color: 'error' },
      { id: 'CONVERTED_TO_JOB', title: 'Converted to Job', requests: grouped.CONVERTED_TO_JOB, color: 'primary' },
      { id: 'COMPLETED', title: 'Completed', requests: grouped.COMPLETED, color: 'success' },
      { id: 'ARCHIVED', title: 'Archived', requests: grouped.ARCHIVED, color: 'default' },
    ].filter(column => column.requests.length > 0 || ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(column.id));
  }, [requests]);

  // Render a kanban column
  const renderKanbanColumn = (column) => (
    <Grid item xs={12} sm={6} md={4} lg={3} key={column.id}>
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
                {column.title}
              </Typography>
              <Chip
                label={column.requests.length}
                size="small"
                color={column.color}
              />
            </Box>

            {/* Column Cards */}
            <Stack spacing={2} sx={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
              {column.requests.map(request => {
                const statusLabel = request.status ? request.status.replace(/_/g, ' ') : 'Unknown';
                const categoryLabel = request.category ? request.category.replace(/_/g, ' ') : 'Uncategorized';
                const priorityLabel = request.priority ? request.priority.replace(/_/g, ' ') : null;
                const description = typeof request.description === 'string' ? request.description : '';
                const displayDescription = description
                  ? description.length > 100
                    ? `${description.substring(0, 100)}...`
                    : description
                  : 'No description provided.';

                return (
                  <Card
                    key={request.id}
                    sx={{
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
                        opacity: 0,
                        transition: 'opacity 0.3s ease-in-out',
                      },
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6,
                        borderColor: 'primary.main',
                        '&::before': {
                          opacity: 1,
                        },
                      },
                    }}
                    onClick={() => onView(request)}
                  >
                    <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, '&:last-child': { pb: 2 } }}>
                      {/* Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1, pr: 1 }}>
                          {request.title}
                        </Typography>
                        <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                          {request.requestedById === user?.id && (
                            <>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(request);
                                  }}
                                  sx={{ color: 'text.secondary' }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(request);
                                  }}
                                  sx={{ color: 'error.main' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                      </Box>

                      {/* Status and Category Chips */}
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          label={statusLabel}
                          color={getStatusColor(request.status)}
                        />
                        <Chip
                          size="small"
                          label={categoryLabel}
                          color={getCategoryColor(request.category)}
                          variant="outlined"
                        />
                        {priorityLabel && (
                          <Chip
                            size="small"
                            label={priorityLabel}
                          />
                        )}
                      </Box>

                      {/* Details */}
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: 'action.hover',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Stack spacing={1}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                              Property
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                              {request.property?.name || 'N/A'}
                            </Typography>
                          </Box>
                          {request.unit && (
                            <Box>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                                Unit
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                                Unit {request.unit.unitNumber}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Box>

                      {/* Description */}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontSize: '0.875rem',
                        }}
                      >
                        {displayDescription}
                      </Typography>

                      {/* Rejection Reason */}
                      {(request.status === 'REJECTED' || request.status === 'REJECTED_BY_OWNER') && request.rejectionReason && (
                        <Alert severity="error" sx={{ py: 0.5, mt: 'auto' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Rejection Reason:</Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                            {request.rejectionReason}
                          </Typography>
                        </Alert>
                      )}

                      {/* Actions */}
                      <Stack direction="column" spacing={1} sx={{ mt: 'auto', pt: 1 }}>
                        {userRole !== 'TENANT' && request.status === 'SUBMITTED' && (
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              fullWidth
                              onClick={(e) => {
                                e.stopPropagation();
                                onReview(request);
                              }}
                            >
                              Review
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<BuildIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                onConvert(request);
                              }}
                              fullWidth
                            >
                              Convert
                            </Button>
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Paper>
    </Grid>
  );

  return (
    <Stack spacing={3}>
      {/* Status Row */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          By Status
        </Typography>
        <Grid container spacing={2}>
          {columns.map(renderKanbanColumn)}
        </Grid>
      </Box>
    </Stack>
  );
};

// Review Dialog Component
const ReviewDialog = ({ request, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    status: 'UNDER_REVIEW',
    reviewNotes: '',
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.patch(`/service-requests/${request.id}`, data);
      return response.data;
    },
    // Optimistic update: immediately update the UI before server responds
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.serviceRequests.all() });
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.serviceRequests.all() });
      
      queryClient.setQueriesData({ queryKey: queryKeys.serviceRequests.all() }, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            items: page.items?.map(item => 
              item.id === request.id 
                ? { ...item, ...newData } 
                : item
            ) || [],
          })),
        };
      });

      return { previousData };
    },
    onError: (_err, _data, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });
      onSuccess();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Review Service Request</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              id="service-requests-review-status"
              name="status"
              select
              fullWidth
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
              <MenuItem value="APPROVED">Approved</MenuItem>
              <MenuItem value="REJECTED">Rejected</MenuItem>
            </TextField>
            <TextField
              id="service-requests-review-notes"
              name="reviewNotes"
              fullWidth
              label="Review Notes"
              value={formData.reviewNotes}
              onChange={(e) => setFormData({ ...formData, reviewNotes: e.target.value })}
              multiline
              rows={4}
              placeholder="Add notes about your review decision..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
            Submit Review
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

// Convert to Job Dialog
const ConvertToJobDialog = ({ request, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    assignedToId: '',
    scheduledDate: '',
    estimatedCost: '',
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const response = await apiClient.get('/users?role=TECHNICIAN');
      return ensureArray(response.data, ['items', 'data.items', 'users']);
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post(`/service-requests/${request.id}/convert-to-job`, data);
      return response.data;
    },
    onSuccess: () => onSuccess(),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
      scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate).toISOString() : undefined,
    };
    convertMutation.mutate(payload);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Convert to Job</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">
              This will create a new job and update the service request status.
            </Alert>
            <TextField
              id="service-requests-convert-technician"
              name="assignedToId"
              select
              fullWidth
              label="Assign to Technician (Optional)"
              value={formData.assignedToId}
              onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {technicians.map((tech) => (
                <MenuItem key={tech.id} value={tech.id}>
                  {tech.firstName} {tech.lastName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              id="service-requests-convert-scheduled-date"
              name="scheduledDate"
              fullWidth
              label="Scheduled Date (Optional)"
              type="datetime-local"
              value={formData.scheduledDate}
              onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              id="service-requests-convert-estimated-cost"
              name="estimatedCost"
              fullWidth
              label="Estimated Cost (Optional)"
              type="number"
              value={formData.estimatedCost}
              onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
              InputProps={{ startAdornment: '$' }}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={convertMutation.isPending}
            startIcon={<BuildIcon />}
          >
            Create Job
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ServiceRequestsPage;
