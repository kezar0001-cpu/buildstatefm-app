import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Toolbar,
  InputAdornment,
  Link as MuiLink,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
  CalendarMonth as CalendarMonthIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  AccessTime as AccessTimeIcon,
  FilterList as FilterListIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import EmptyState from '../components/EmptyState';
import InspectionForm from '../components/InspectionForm';
import { formatDateTime, formatDate } from '../utils/date';
import { queryKeys } from '../utils/queryKeys.js';
import { useCurrentUser } from '../context/UserContext.jsx';
import { calculateDaysRemaining } from '../utils/date.js';

/**
 * Enhanced Inspections Page Component
 *
 * Features:
 * - Multiple view modes: Grid (cards), List, Table, and Calendar
 * - Advanced filtering: Search, status filter, date range, property filter
 * - Status management: Quick status change via dropdown menu
 * - Delete functionality with confirmation
 * - Overdue detection based on scheduled date
 * - Bulk actions for list/table views
 * - Trial banner notification
 * - Responsive design with mobile support
 * - Accessibility features (ARIA labels, keyboard navigation)
 */

const InspectionsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useCurrentUser();

  // State management
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [propertyFilter, setPropertyFilter] = useState(searchParams.get('property') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');

  // View mode: grid, list, table, calendar - persisted in localStorage
  const [viewMode, setViewMode] = useState(() => {
    try {
      const stored = localStorage.getItem('inspections-view-mode');
      return stored && ['grid', 'list', 'table', 'calendar'].includes(stored) ? stored : 'list';
    } catch {
      return 'list';
    }
  });

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Menu states for status change
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [statusMenuInspection, setStatusMenuInspection] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Bulk selection state (for table/list views)
  const [selectedIds, setSelectedIds] = useState([]);

  // Calculate trial information
  const trialEndDate = currentUser?.trialEndDate;
  const trialDaysRemaining = calculateDaysRemaining(trialEndDate);
  const isTrialActive = currentUser?.subscriptionStatus === 'TRIAL' && trialDaysRemaining > 0;

  // Debounce search input to avoid excessive API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchInput);
      if (searchInput !== searchParams.get('search')) {
        updateSearchParam('search', searchInput);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL search params
  const updateSearchParam = (key, value) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
      return newParams;
    });
  };

  // Build query params for API
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (statusFilter) params.append('status', statusFilter);
    if (propertyFilter) params.append('propertyId', propertyFilter);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    return params;
  };

  // Fetch inspections with infinite query for pagination
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.inspections.list({
      search: debouncedSearch,
      status: statusFilter,
      propertyId: propertyFilter,
      dateFrom,
      dateTo,
    }),
    queryFn: async ({ pageParam = 0 }) => {
      const params = buildQueryParams();
      params.append('limit', '50');
      params.append('offset', pageParam.toString());
      const response = await apiClient.get(`/inspections?${params.toString()}`);
      return response.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + (page.items?.length || 0), 0);
      return lastPage.hasMore ? totalFetched : undefined;
    },
    initialPageParam: 0,
    gcTime: 5 * 60 * 1000, // Garbage collect after 5 minutes
  });

  // Fetch properties for filter dropdown
  const { data: propertiesData } = useQuery({
    queryKey: queryKeys.properties.all(),
    queryFn: async () => {
      const response = await apiClient.get('/properties?limit=100&offset=0');
      return response.data;
    },
  });

  const properties = propertiesData?.items || [];

  // Flatten all pages into a single array
  const inspections = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items || []);
  }, [data?.pages]);

  // Calculate overdue status for each inspection
  const inspectionsWithOverdue = useMemo(() => {
    const now = new Date();
    return inspections.map(inspection => {
      const scheduledDate = new Date(inspection.scheduledDate);
      const isOverdue =
        scheduledDate < now &&
        inspection.status !== 'COMPLETED' &&
        inspection.status !== 'CANCELLED';

      return {
        ...inspection,
        isOverdue,
        displayStatus: isOverdue ? 'OVERDUE' : inspection.status,
      };
    });
  }, [inspections]);

  // Mutation for updating inspection status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await apiClient.patch(`/inspections/${id}`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() });
      setStatusMenuAnchor(null);
      setStatusMenuInspection(null);
      setIsUpdatingStatus(false);
    },
    onError: (error) => {
      console.error('Failed to update status:', error);
      setIsUpdatingStatus(false);
    },
  });

  // Mutation for deleting inspection
  const deleteMutation = useMutation({
    mutationFn: async (inspectionId) => {
      const response = await apiClient.delete(`/inspections/${inspectionId}`);
      return response.data;
    },
    onMutate: async (inspectionId) => {
      // Optimistic update: Remove from UI immediately
      await queryClient.cancelQueries({ queryKey: queryKeys.inspections.all() });
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.inspections.all() });

      queryClient.setQueriesData({ queryKey: queryKeys.inspections.all() }, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            items: page.items?.filter(inspection => inspection.id !== inspectionId) || [],
            total: Math.max(0, (page.total || 0) - 1),
          })),
        };
      });

      return { previousData };
    },
    onError: (_err, _inspectionId, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() });
    },
  });

  // Event handlers
  const handleCreate = () => {
    setSelectedInspection(null);
    setOpenDialog(true);
  };

  const handleEdit = (inspection) => {
    setSelectedInspection(inspection);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedInspection(null);
  };

  const handleSuccess = () => {
    refetch();
    handleCloseDialog();
  };

  const handleView = (id) => {
    navigate(`/inspections/${id}`);
  };

  const handleStatusMenuOpen = (event, inspection) => {
    event.stopPropagation();
    setStatusMenuAnchor(event.currentTarget);
    setStatusMenuInspection(inspection);
  };

  const handleStatusMenuClose = () => {
    setStatusMenuAnchor(null);
    setStatusMenuInspection(null);
  };

  const handleStatusChange = (newStatus) => {
    if (statusMenuInspection) {
      setIsUpdatingStatus(true);
      updateStatusMutation.mutate({
        id: statusMenuInspection.id,
        status: newStatus,
      });
    }
  };

  const handleDeleteClick = (inspection) => {
    setSelectedInspection(inspection);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedInspection) return;
    try {
      await deleteMutation.mutateAsync(selectedInspection.id);
      setDeleteDialogOpen(false);
      setSelectedInspection(null);
      setSelectedIds(prev => prev.filter(id => id !== selectedInspection.id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleViewModeChange = (_event, nextView) => {
    if (nextView !== null) {
      setViewMode(nextView);
      try {
        localStorage.setItem('inspections-view-mode', nextView);
      } catch (error) {
        console.warn('Failed to save view mode preference:', error);
      }
    }
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedIds(inspectionsWithOverdue.map(i => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    // For simplicity, delete the first selected for demonstration
    // In production, you'd implement a bulk delete API endpoint
    const firstId = selectedIds[0];
    const inspection = inspectionsWithOverdue.find(i => i.id === firstId);
    if (inspection) {
      handleDeleteClick(inspection);
    }
  };

  // Helper functions for status styling
  const getStatusColor = (displayStatus) => {
    const colors = {
      SCHEDULED: 'success',
      IN_PROGRESS: 'warning',
      COMPLETED: 'success',
      CANCELLED: 'error',
      OVERDUE: 'error',
    };
    return colors[displayStatus] || 'default';
  };

  const getStatusIcon = (displayStatus) => {
    const icons = {
      SCHEDULED: <ScheduleIcon fontSize="small" />,
      IN_PROGRESS: <PlayArrowIcon fontSize="small" />,
      COMPLETED: <CheckCircleIcon fontSize="small" />,
      CANCELLED: <CancelIcon fontSize="small" />,
      OVERDUE: <WarningIcon fontSize="small" />,
    };
    return icons[displayStatus];
  };

  const formatStatusText = (displayStatus) => {
    return displayStatus.replace(/_/g, ' ');
  };

  // Loading state
  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <DataState type="loading" message="Loading inspections..." />
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <DataState
          type="error"
          message="Failed to load inspections"
          onRetry={refetch}
        />
      </Container>
    );
  }

  const hasFilters = debouncedSearch || statusFilter || propertyFilter || dateFrom || dateTo;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, position: 'relative', pb: isTrialActive ? 12 : 4 }}>
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
              fontWeight: 800,
              background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            Inspections
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Schedule and manage property inspections
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          size="large"
          fullWidth
          sx={{
            maxWidth: { xs: '100%', md: 'auto' },
            background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
            boxShadow: '0 4px 14px 0 rgb(185 28 28 / 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
              boxShadow: '0 6px 20px 0 rgb(185 28 28 / 0.4)',
            },
          }}
        >
          Schedule Inspection
        </Button>
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
        <Grid container spacing={2} alignItems="center">
          {/* Search */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search inspections by unit, property, type, or notes..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchInput && (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="clear search"
                      onClick={() => setSearchInput('')}
                      edge="end"
                      size="small"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              size="small"
            />
          </Grid>

          {/* Status Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  updateSearchParam('status', e.target.value);
                }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="SCHEDULED">Scheduled</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Property Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Property</InputLabel>
              <Select
                value={propertyFilter}
                label="Property"
                onChange={(e) => {
                  setPropertyFilter(e.target.value);
                  updateSearchParam('property', e.target.value);
                }}
              >
                <MenuItem value="">All Properties</MenuItem>
                {properties.map((property) => (
                  <MenuItem key={property.id} value={property.id}>
                    {property.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Date From */}
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                updateSearchParam('dateFrom', e.target.value);
              }}
              size="small"
              InputLabelProps={{ shrink: true }}
              inputProps={{
                placeholder: 'mm/dd/yyyy',
              }}
            />
          </Grid>

          {/* Date To */}
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="To Date"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                updateSearchParam('dateTo', e.target.value);
              }}
              size="small"
              InputLabelProps={{ shrink: true }}
              inputProps={{
                placeholder: 'mm/dd/yyyy',
              }}
            />
          </Grid>
        </Grid>

        {/* View Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            aria-label="View mode toggle"
            size="small"
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 999,
              border: '1px solid',
              borderColor: 'divider',
              '& .MuiToggleButtonGroup-grouped': {
                minWidth: 0,
                px: 1.5,
                py: 0.5,
                border: 'none',
              },
              '& .MuiToggleButton-root': {
                borderRadius: '8px !important',
                color: 'text.secondary',
              },
              '& .Mui-selected': {
                color: 'primary.main',
                backgroundColor: 'action.selected',
              },
            }}
          >
            <ToggleButton value="grid" aria-label="grid view">
              <Tooltip title="Grid View">
                <GridViewIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="list" aria-label="list view">
              <Tooltip title="List View">
                <ViewListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="table" aria-label="table view">
              <Tooltip title="Table View">
                <FilterListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="calendar" aria-label="calendar view">
              <Tooltip title="Calendar View">
                <CalendarMonthIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Bulk Actions Toolbar (for table/list views with selections) */}
      {selectedIds.length > 0 && (viewMode === 'list' || viewMode === 'table') && (
        <Paper
          sx={{
            mb: 2,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: 'action.selected',
          }}
        >
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {selectedIds.length} selected
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleBulkDelete}
          >
            Delete
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadIcon />}
          >
            Export
          </Button>
        </Paper>
      )}

      {/* Error Alert */}
      {(deleteMutation.isError || updateStatusMutation.isError) && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => {
            deleteMutation.reset();
            updateStatusMutation.reset();
          }}
        >
          {deleteMutation.error?.message || updateStatusMutation.error?.message || 'An error occurred'}
        </Alert>
      )}

      {/* Inspections List */}
      {inspectionsWithOverdue.length === 0 ? (
        <EmptyState
          icon={CheckCircleIcon}
          title={hasFilters ? 'No inspections match your filters' : 'No inspections yet'}
          description={
            hasFilters
              ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
              : 'Get started by scheduling your first property inspection. Stay on top of maintenance, document findings, and ensure compliance with ease.'
          }
          actionLabel={hasFilters ? undefined : 'Schedule First Inspection'}
          onAction={hasFilters ? undefined : handleCreate}
        />
      ) : (
        <Stack spacing={3} sx={{ animation: 'fade-in 0.7s ease-out' }}>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <Grid container spacing={{ xs: 2, md: 3 }}>
              {inspectionsWithOverdue.map((inspection) => (
                <InspectionCard
                  key={inspection.id}
                  inspection={inspection}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onStatusMenuOpen={handleStatusMenuOpen}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                  formatStatusText={formatStatusText}
                />
              ))}
            </Grid>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <Stack spacing={2}>
              {inspectionsWithOverdue.map((inspection) => (
                <InspectionListItem
                  key={inspection.id}
                  inspection={inspection}
                  selected={selectedIds.includes(inspection.id)}
                  onSelect={handleSelectOne}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onStatusMenuOpen={handleStatusMenuOpen}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                  formatStatusText={formatStatusText}
                />
              ))}
            </Stack>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <InspectionTable
              inspections={inspectionsWithOverdue}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              onSelectOne={handleSelectOne}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onStatusMenuOpen={handleStatusMenuOpen}
              getStatusColor={getStatusColor}
              formatStatusText={formatStatusText}
            />
          )}

          {/* Calendar View (Placeholder) */}
          {viewMode === 'calendar' && (
            <InspectionCalendar
              inspections={inspectionsWithOverdue}
              onView={handleView}
              getStatusColor={getStatusColor}
            />
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

      {/* Create/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <InspectionForm
          inspection={selectedInspection}
          onSuccess={handleSuccess}
          onCancel={handleCloseDialog}
        />
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Inspection</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the inspection{' '}
            <strong>{selectedInspection?.title}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
          {deleteMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteMutation.error?.response?.data?.message ||
               deleteMutation.error?.message ||
               'Failed to delete inspection. Please try again.'}
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

      {/* Status Change Menu */}
      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={handleStatusMenuClose}
      >
        <MenuItem
          onClick={() => handleStatusChange('SCHEDULED')}
          disabled={statusMenuInspection?.status === 'SCHEDULED' || isUpdatingStatus}
        >
          <ListItemIcon>
            <ScheduleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Scheduled</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange('IN_PROGRESS')}
          disabled={statusMenuInspection?.status === 'IN_PROGRESS' || isUpdatingStatus}
        >
          <ListItemIcon>
            <PlayArrowIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>In Progress</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange('COMPLETED')}
          disabled={statusMenuInspection?.status === 'COMPLETED' || isUpdatingStatus}
        >
          <ListItemIcon>
            <CheckCircleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Completed</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange('CANCELLED')}
          disabled={statusMenuInspection?.status === 'CANCELLED' || isUpdatingStatus}
        >
          <ListItemIcon>
            <CancelIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Cancelled</ListItemText>
        </MenuItem>
      </Menu>

      {/* Status Update Backdrop */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={isUpdatingStatus}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Trial Banner */}
      {isTrialActive && (
        <Alert
          severity="warning"
          icon={<AccessTimeIcon />}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            borderRadius: 0,
            background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
            color: 'white',
            '& .MuiAlert-icon': {
              color: 'white',
            },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left in your trial
          </Typography>
        </Alert>
      )}
    </Container>
  );
};

// ============================================================================
// Inspection Card Component (Grid View)
// ============================================================================

const InspectionCard = ({
  inspection,
  onView,
  onEdit,
  onDelete,
  onStatusMenuOpen,
  getStatusColor,
  getStatusIcon,
  formatStatusText,
}) => {
  const navigate = useNavigate();

  return (
    <Grid item xs={12} md={6} lg={4}>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
          borderRadius: 3,
          cursor: 'pointer',
        }}
        onClick={() => onView(inspection.id)}
      >
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" gutterBottom noWrap>
                {inspection.title}
              </Typography>
              <Chip
                icon={getStatusIcon(inspection.displayStatus)}
                label={formatStatusText(inspection.displayStatus)}
                color={getStatusColor(inspection.displayStatus)}
                size="small"
                sx={{ mb: 1 }}
              />
            </Box>
            <Chip
              label={inspection.type?.replace(/_/g, ' ')}
              size="small"
              variant="outlined"
            />
          </Box>

          {/* Details */}
          <Stack spacing={1}>
            {/* Property */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Property
              </Typography>
              <Typography
                variant="body2"
                component={MuiLink}
                onClick={(e) => {
                  e.stopPropagation();
                  if (inspection.property?.id) {
                    navigate(`/properties/${inspection.property.id}`);
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  color: 'primary.main',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {inspection.property?.name || 'N/A'}
              </Typography>
            </Box>

            {/* Unit */}
            {inspection.unit && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Unit
                </Typography>
                <Typography
                  variant="body2"
                  component={MuiLink}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inspection.unit?.id) {
                      navigate(`/units/${inspection.unit.id}`);
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    color: 'primary.main',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  Unit {inspection.unit.unitNumber}
                </Typography>
              </Box>
            )}

            {/* Scheduled Date */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Scheduled Date
              </Typography>
              <Typography variant="body2">
                {formatDateTime(inspection.scheduledDate)}
              </Typography>
            </Box>

            {/* Assigned To */}
            {inspection.assignedTo && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Assigned To
                </Typography>
                <Typography variant="body2">
                  {inspection.assignedTo.firstName} {inspection.assignedTo.lastName}
                </Typography>
              </Box>
            )}
          </Stack>
        </CardContent>

        {/* Actions */}
        <Box
          sx={{
            p: 2,
            pt: 0,
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title="View Details">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                onView(inspection.id);
              }}
              aria-label={`View details for ${inspection.title}`}
            >
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          {inspection.status !== 'COMPLETED' && (
            <Tooltip title="Edit">
              <IconButton
                size="small"
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(inspection);
                }}
                aria-label={`Edit ${inspection.title}`}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Change Status">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => onStatusMenuOpen(e, inspection)}
              aria-label={`Change status for ${inspection.title}`}
            >
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(inspection);
              }}
              aria-label={`Delete ${inspection.title}`}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Card>
    </Grid>
  );
};

// ============================================================================
// Inspection List Item Component (List View)
// ============================================================================

const InspectionListItem = ({
  inspection,
  selected,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onStatusMenuOpen,
  getStatusColor,
  getStatusIcon,
  formatStatusText,
}) => {
  const navigate = useNavigate();

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        cursor: 'pointer',
        borderRadius: 2,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper',
        '&:hover': {
          boxShadow: 3,
        },
      }}
      onClick={() => onView(inspection.id)}
    >
      {/* Checkbox */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          pr: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onChange={() => onSelect(inspection.id)}
          aria-label={`Select ${inspection.title}`}
        />
      </Box>

      {/* Content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          p: 2,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 1.5,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {inspection.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              <Chip
                icon={getStatusIcon(inspection.displayStatus)}
                label={formatStatusText(inspection.displayStatus)}
                color={getStatusColor(inspection.displayStatus)}
                size="small"
              />
              <Chip
                label={inspection.type?.replace(/_/g, ' ')}
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>
        </Box>

        {/* Details Grid */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary">
              Property
            </Typography>
            <Typography
              variant="body2"
              component={MuiLink}
              onClick={(e) => {
                e.stopPropagation();
                if (inspection.property?.id) {
                  navigate(`/properties/${inspection.property.id}`);
                }
              }}
              sx={{
                cursor: 'pointer',
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {inspection.property?.name || 'N/A'}
            </Typography>
          </Grid>

          {inspection.unit && (
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Unit
              </Typography>
              <Typography
                variant="body2"
                component={MuiLink}
                onClick={(e) => {
                  e.stopPropagation();
                  if (inspection.unit?.id) {
                    navigate(`/units/${inspection.unit.id}`);
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  color: 'primary.main',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Unit {inspection.unit.unitNumber}
              </Typography>
            </Grid>
          )}

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary">
              Scheduled Date
            </Typography>
            <Typography variant="body2">
              {formatDateTime(inspection.scheduledDate)}
            </Typography>
          </Grid>

          {inspection.assignedTo && (
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Assigned To
              </Typography>
              <Typography variant="body2">
                {inspection.assignedTo.firstName} {inspection.assignedTo.lastName}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Actions */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'row', md: 'column' },
          gap: 1,
          p: 2,
          justifyContent: { xs: 'flex-end', md: 'center' },
          alignItems: 'center',
          borderLeft: { md: '1px solid' },
          borderTop: { xs: '1px solid', md: 'none' },
          borderColor: 'divider',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip title="View Details">
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              onView(inspection.id);
            }}
            aria-label={`View details for ${inspection.title}`}
          >
            <VisibilityIcon />
          </IconButton>
        </Tooltip>
        {inspection.status !== 'COMPLETED' && (
          <Tooltip title="Edit">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(inspection);
              }}
              aria-label={`Edit ${inspection.title}`}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Change Status">
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => onStatusMenuOpen(e, inspection)}
            aria-label={`Change status for ${inspection.title}`}
          >
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(inspection);
            }}
            aria-label={`Delete ${inspection.title}`}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Card>
  );
};

// ============================================================================
// Inspection Table Component (Table View)
// ============================================================================

const InspectionTable = ({
  inspections,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onView,
  onEdit,
  onDelete,
  onStatusMenuOpen,
  getStatusColor,
  formatStatusText,
}) => {
  const navigate = useNavigate();
  const allSelected = inspections.length > 0 && selectedIds.length === inspections.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small" aria-label="inspections table">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={someSelected}
                checked={allSelected}
                onChange={onSelectAll}
                aria-label="Select all inspections"
              />
            </TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Property</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Scheduled</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {inspections.map((inspection) => (
            <TableRow
              key={inspection.id}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => onView(inspection.id)}
              selected={selectedIds.includes(inspection.id)}
            >
              <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.includes(inspection.id)}
                  onChange={() => onSelectOne(inspection.id)}
                  aria-label={`Select ${inspection.title}`}
                />
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {inspection.title}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography
                  variant="body2"
                  component={MuiLink}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inspection.property?.id) {
                      navigate(`/properties/${inspection.property.id}`);
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    color: 'primary.main',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {inspection.property?.name || '—'}
                </Typography>
              </TableCell>
              <TableCell>
                {inspection.unit ? (
                  <Typography
                    variant="body2"
                    component={MuiLink}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (inspection.unit?.id) {
                        navigate(`/units/${inspection.unit.id}`);
                      }
                    }}
                    sx={{
                      cursor: 'pointer',
                      color: 'primary.main',
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    Unit {inspection.unit.unitNumber}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {inspection.type?.replace(/_/g, ' ') || '—'}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {formatDate(inspection.scheduledDate)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={formatStatusText(inspection.displayStatus)}
                  color={getStatusColor(inspection.displayStatus)}
                  size="small"
                />
              </TableCell>
              <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                  <Tooltip title="View">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(inspection.id);
                      }}
                      aria-label={`View ${inspection.title}`}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {inspection.status !== 'COMPLETED' && (
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(inspection);
                        }}
                        aria-label={`Edit ${inspection.title}`}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Change Status">
                    <IconButton
                      size="small"
                      onClick={(e) => onStatusMenuOpen(e, inspection)}
                      aria-label={`Change status for ${inspection.title}`}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(inspection);
                      }}
                      aria-label={`Delete ${inspection.title}`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ============================================================================
// Inspection Calendar Component (Calendar View - Placeholder)
// ============================================================================

const InspectionCalendar = ({ inspections, onView, getStatusColor }) => {
  // Group inspections by date
  const groupedByDate = useMemo(() => {
    const groups = {};
    inspections.forEach(inspection => {
      const dateKey = formatDate(inspection.scheduledDate);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(inspection);
    });
    return groups;
  }, [inspections]);

  // Get current month's dates
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = lastDay.getDate();

  const dates = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), i);
    dates.push(date);
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
      </Typography>

      <Grid container spacing={1}>
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Grid item xs={12/7} key={day}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textAlign: 'center',
                fontWeight: 700,
                color: 'text.secondary',
              }}
            >
              {day}
            </Typography>
          </Grid>
        ))}

        {/* Calendar Days */}
        {dates.map(date => {
          const dateKey = formatDate(date);
          const dayInspections = groupedByDate[dateKey] || [];
          const isToday = date.toDateString() === now.toDateString();

          return (
            <Grid item xs={12/7} key={dateKey}>
              <Paper
                sx={{
                  p: 1,
                  minHeight: 80,
                  bgcolor: isToday ? 'action.selected' : 'background.paper',
                  border: '1px solid',
                  borderColor: isToday ? 'primary.main' : 'divider',
                  cursor: dayInspections.length > 0 ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (dayInspections.length === 1) {
                    onView(dayInspections[0].id);
                  }
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    textAlign: 'right',
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'primary.main' : 'text.primary',
                  }}
                >
                  {date.getDate()}
                </Typography>

                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {dayInspections.slice(0, 3).map(inspection => (
                    <Chip
                      key={inspection.id}
                      label={inspection.title}
                      size="small"
                      color={getStatusColor(inspection.displayStatus)}
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        '& .MuiChip-label': {
                          px: 0.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(inspection.id);
                      }}
                    />
                  ))}
                  {dayInspections.length > 3 && (
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                      +{dayInspections.length - 3} more
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default InspectionsPage;
