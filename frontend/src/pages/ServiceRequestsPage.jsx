import React, { useEffect, useState, useMemo } from 'react';
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
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  useMediaQuery,
  useTheme,
  IconButton,
  Checkbox,
  Paper,
  Divider,
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
  });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [convertDialog, setConvertDialog] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState([]);

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
    });
    setSearchInput('');
    setDebouncedSearch('');
  };

  const handleViewDetails = (request) => {
    setSelectedRequest(request.id);
  };

  const handleEdit = (request) => {
    // TODO: Implement edit functionality
    console.log('Edit request:', request);
  };

  const handleDelete = (request) => {
    // TODO: Implement delete functionality
    console.log('Delete request:', request);
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

  const handleBulkDelete = () => {
    // TODO: Implement bulk delete
    console.log('Bulk delete requests:', selectedRequestIds);
    toast.success(`${selectedRequestIds.length} requests selected for deletion`);
    setSelectedRequestIds([]);
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
        actions={(
          <GradientButton
            startIcon={<AddIcon />}
            onClick={handleCreate}
            size="medium"
            sx={{ width: { xs: '100%', md: 'auto' } }}
          >
            {userRole === 'TENANT' ? 'Submit Request' : 'Create Request'}
          </GradientButton>
        )}
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
              sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 200, lg: 250 } }}
            />

            {/* Status Filter */}
            <TextField
              id="service-requests-filter-status"
              name="status"
              select
              label="Status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              size="small"
              sx={{ minWidth: { xs: '100%', sm: 150 } }}
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
              sx={{ minWidth: { xs: '100%', sm: 150 } }}
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

            {/* Property Filter - Only for non-tenants */}
            {/* Priority Filter */}
            <TextField
              id="service-requests-filter-priority"
              name="priority"
              select
              label="Priority"
              value={filters.priority || ''}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              size="small"
              sx={{ minWidth: { xs: '100%', sm: 150 } }}
            >
              <MenuItem value="">All Priorities</MenuItem>
              <MenuItem value="LOW">Low</MenuItem>
              <MenuItem value="MEDIUM">Medium</MenuItem>
              <MenuItem value="HIGH">High</MenuItem>
              <MenuItem value="URGENT">Urgent</MenuItem>
            </TextField>

            {/* Clear Filters Button */}
            {(debouncedSearch || filters.status || filters.category || filters.priority) && (
              <Button
                variant="text"
                color="inherit"
                size="small"
                onClick={handleClearFilters}
                sx={{ textTransform: 'none', minWidth: 'auto' }}
              >
                Clear filters
              </Button>
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
          title={filters.status || filters.category ? 'No service requests match your filters' : 'No service requests yet'}
          description={
            filters.status || filters.category
              ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
              : userRole === 'TENANT'
                ? 'Need maintenance or repairs? Submit your first service request and we\'ll take care of it promptly.'
                : 'Start managing service requests from your tenants. Track issues, assign jobs, and keep everyone informed.'
          }
          actionLabel={filters.status || filters.category ? undefined : (userRole === 'TENANT' ? 'Submit First Request' : 'Create Request')}
          onAction={filters.status || filters.category ? undefined : handleCreate}
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
                      boxShadow: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      outline: isSelected ? '2px solid' : 'none',
                      outlineColor: 'primary.main',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleViewDetails(request)}
                  >
                    <CardContent sx={{ p: 2.5 }}>
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
                          {userRole === 'PROPERTY_MANAGER' && (
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
          ) : (
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
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        borderRadius: 3,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        outline: isSelected ? '2px solid' : 'none',
                        outlineColor: 'primary.main',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4,
                        },
                      }}
                      onClick={() => handleViewDetails(request)}
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
                              color="primary"
                              sx={{ p: 0.5 }}
                              inputProps={{ 'aria-label': `Select service request ${request.title}` }}
                            />
                            <Typography variant="h6" sx={{ flex: 1 }}>
                              {request.title}
                            </Typography>
                          </Box>
                          {userRole === 'PROPERTY_MANAGER' && (
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
          )}

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
    </Container>
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
