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
  LinearProgress,
  List,
  ListItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ViewKanban as ViewKanbanIcon,
  ViewList as ViewListIcon,
  TableChart as TableChartIcon,
  CalendarMonth as CalendarMonthIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  FilterList as FilterListIcon,
  FileDownload as FileDownloadIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import EmptyState from '../components/EmptyState';
import GradientButton from '../components/GradientButton';
import PageShell from '../components/PageShell';
import InspectionForm from '../components/InspectionForm';
import InspectionCalendarBoard from '../components/InspectionCalendarBoard';
import InspectionProgressIndicator from '../components/InspectionProgressIndicator';
import { InspectionContextActions } from '../components/InspectionContextActions';
import PageHeader from '../components/PageHeader';
import InspectionKanbanSkeleton from '../components/skeletons/InspectionKanbanSkeleton';
import InspectionListSkeleton from '../components/skeletons/InspectionListSkeleton';
import CardGridSkeleton from '../components/skeletons/CardGridSkeleton';
import VirtualizedInspectionList from '../components/VirtualizedInspectionList';
import { formatDateTime, formatDate } from '../utils/date';
import { queryKeys } from '../utils/queryKeys.js';
import { useCurrentUser } from '../context/UserContext.jsx';
import { useInspectionStatusUpdate } from '../hooks/useInspectionStatusUpdate';
import logger from '../utils/logger';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Inspections are only accessible to Property Managers and Technicians
  useEffect(() => {
    if (currentUser && !['PROPERTY_MANAGER', 'TECHNICIAN'].includes(currentUser.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  // Don't render if user doesn't have access
  if (currentUser && !['PROPERTY_MANAGER', 'TECHNICIAN'].includes(currentUser.role)) {
    return null;
  }

  // State management
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [propertyFilter, setPropertyFilter] = useState(searchParams.get('property') || '');
  const [technicianFilter, setTechnicianFilter] = useState(searchParams.get('technician') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');

  // View mode state
  const [viewMode, setViewMode] = useState(() => {
    try {
      const stored = localStorage.getItem('inspections-view-mode');
      return stored && ['grid', 'list', 'table'].includes(stored) ? stored : 'grid';
    } catch {
      return 'grid';
    }
  });

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Menu states for status change
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [statusMenuInspection, setStatusMenuInspection] = useState(null);

  // Inspection status update hook
  const { updateStatus, isUpdating: isUpdatingStatus } = useInspectionStatusUpdate();

  // Bulk selection state (for table views)
  const [selectedIds, setSelectedIds] = useState([]);

  // Bulk delete state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0 });
  const [bulkDeleteResults, setBulkDeleteResults] = useState({ succeeded: [], failed: [] });
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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
    if (technicianFilter) params.append('assignedToId', technicianFilter);
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
      technicianId: technicianFilter,
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

  // Fetch technicians for filter dropdown
  const { data: techniciansData } = useQuery({
    queryKey: queryKeys.users.technicians(),
    queryFn: async () => {
      const response = await apiClient.get('/inspections/inspectors');
      return response.data;
    },
  });

  const technicians = techniciansData?.inspectors || [];

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

  const handleStatusChange = (inspection, newStatus) => {
    if (inspection) {
      setStatusMenuAnchor(null); // Close menu immediately
      setStatusMenuInspection(null);
      updateStatus(inspection.id, newStatus);
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
      logger.error('Delete failed:', error);
    }
  };

  // Context action handlers
  const handleStartInspection = (inspection) => {
    updateStatus(inspection.id, 'IN_PROGRESS');
  };

  const handleCompleteInspection = (inspection) => {
    // Navigate to detail page where completion happens
    navigate(`/inspections/${inspection.id}`);
  };

  const handleApprove = (inspection) => {
    updateStatus(inspection.id, 'COMPLETED');
  };

  const handleReject = (inspection) => {
    // Navigate to detail page for rejection with reason
    navigate(`/inspections/${inspection.id}`);
  };

  const handleCancelInspection = (inspection) => {
    updateStatus(inspection.id, 'CANCELLED');
  };

  const handleViewModeChange = (_event, nextView) => {
    if (nextView !== null) {
      setViewMode(nextView);
      try {
        localStorage.setItem('inspections-view-mode', nextView);
      } catch (error) {
        logger.warn('Failed to save view mode preference:', error);
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
    setBulkDeleteOpen(true);
  };

  const confirmBulkDelete = async () => {
    setIsBulkDeleting(true);
    setBulkDeleteProgress({ current: 0, total: selectedIds.length });
    setBulkDeleteResults({ succeeded: [], failed: [] });

    const results = { succeeded: [], failed: [] };

    for (let i = 0; i < selectedIds.length; i++) {
      const inspectionId = selectedIds[i];
      const inspection = inspectionsWithOverdue.find(item => item.id === inspectionId);

      try {
        setBulkDeleteProgress({ current: i + 1, total: selectedIds.length });
        await apiClient.delete(`/inspections/${inspectionId}`);

        results.succeeded.push({
          id: inspectionId,
          title: inspection?.title || `Inspection ${inspectionId}`,
        });
      } catch (error) {
        results.failed.push({
          id: inspectionId,
          title: inspection?.title || `Inspection ${inspectionId}`,
          error: error.response?.data?.message || error.message || 'Unknown error',
        });
      }
    }

    setBulkDeleteResults(results);
    setIsBulkDeleting(false);

    // Invalidate queries to refresh the list
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() });

    // Clear selection if all succeeded
    if (results.failed.length === 0) {
      setSelectedIds([]);
    } else {
      // Keep only failed items selected
      setSelectedIds(results.failed.map(item => item.id));
    }
  };

  const closeBulkDeleteDialog = () => {
    setBulkDeleteOpen(false);
    setBulkDeleteProgress({ current: 0, total: 0 });
    setBulkDeleteResults({ succeeded: [], failed: [] });
    setIsBulkDeleting(false);
  };

  // Helper functions for status styling
  const getStatusColor = (displayStatus) => {
    const colors = {
      SCHEDULED: 'info',
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

  const renderListItem = (inspection) => {
    if (!inspection) return null;

    const displayStatus = inspection.displayStatus || inspection.status;

    return (
      <Card
        sx={{
          mb: 1.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          '&:hover': {
            boxShadow: 3,
          },
        }}
        onClick={() => handleView(inspection.id)}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {inspection.title || inspection.name || 'Inspection'}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {inspection.property?.name || 'Unassigned property'}
              </Typography>
            </Box>

            <Stack
              direction={{ xs: 'row', md: 'row' }}
              spacing={2}
              alignItems="center"
              sx={{ flexWrap: 'wrap', rowGap: 1 }}
            >
              <Stack spacing={0.5} sx={{ minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  icon={getStatusIcon(displayStatus)}
                  label={formatStatusText(displayStatus)}
                  size="small"
                  color={getStatusColor(displayStatus)}
                />
              </Stack>

              <Stack spacing={0.5} sx={{ minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">
                  Scheduled
                </Typography>
                <Typography variant="body2">
                  {inspection.scheduledDate
                    ? formatDate(inspection.scheduledDate)
                    : 'Not scheduled'}
                </Typography>
              </Stack>

              <Stack spacing={0.5} sx={{ minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">
                  Inspector
                </Typography>
                <Typography variant="body2">
                  {inspection.assignedTo
                    ? `${inspection.assignedTo.firstName} ${inspection.assignedTo.lastName}`
                    : 'Unassigned'}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
                <Tooltip title="View details">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleView(inspection.id);
                    }}
                    aria-label="View inspection"
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
        {(inspection.status === 'SCHEDULED' || inspection.status === 'IN_PROGRESS') && (
          <Tooltip title="Cancel inspection">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelInspection(inspection);
              }}
              aria-label={`Cancel ${inspection.title}`}
            >
              <CancelIcon />
            </IconButton>
          </Tooltip>
        )}
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(inspection);
                    }}
                    aria-label="Edit inspection"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(inspection);
                    }}
                    aria-label="Delete inspection"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  // Loading state with skeleton loaders
  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <PageShell
          title="Inspections"
          subtitle="Schedule and manage property inspections"
          actions={(
            <GradientButton
              startIcon={<AddIcon />}
              disabled
              size="large"
              sx={{ width: { xs: '100%', md: 'auto' } }}
            >
              Create Inspection
            </GradientButton>
          )}
        >
          <Box sx={{ mb: 3 }}>
            {/* Skeleton for toolbar/filters */}
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  placeholder="Search inspections..."
                  disabled
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Stack>
          </Box>

          {/* Skeleton based on view mode */}
          <InspectionKanbanSkeleton cardsPerColumn={3} />
        </PageShell>
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

  const hasFilters = debouncedSearch || statusFilter || propertyFilter || technicianFilter || dateFrom || dateTo;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, position: 'relative' }}>
      <PageShell
        title="Inspections"
        subtitle="Schedule and manage property inspections"
        actions={(
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            <GradientButton
              startIcon={<AddIcon />}
              onClick={handleCreate}
              size="large"
              sx={{ width: { xs: '100%', md: 'auto' } }}
            >
              Schedule Inspection
            </GradientButton>
          </Stack>
        )}
        contentSpacing={{ xs: 3, md: 3 }}
      >
        {/* Filters */}
        <Paper
          sx={{
            p: { xs: 2, sm: 2.5, md: 3.5 },
            mb: 3,
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
            placeholder="Search inspections..."
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
            sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 200, lg: 250 } }}
          />

          {/* Filter Row */}
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={1.5} 
            sx={{ 
              flexWrap: 'wrap', 
              gap: 1.5,
              width: { xs: '100%', lg: 'auto' },
            }}
          >
            {/* Status Filter */}
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 130 } }}>
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


            {/* Date From */}
            <TextField
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                updateSearchParam('dateFrom', e.target.value);
              }}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: { xs: '100%', sm: 130 } }}
            />

            {/* Date To */}
            <TextField
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                updateSearchParam('dateTo', e.target.value);
              }}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: { xs: '100%', sm: 130 } }}
            />
          </Stack>

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
              <ToggleButton value="grid" aria-label="kanban view">
                <Tooltip title="Kanban View">
                  <ViewKanbanIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="list" aria-label="list view">
                <Tooltip title="List View">
                  <ViewListIcon fontSize="small" />
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

      {/* Bulk Actions Toolbar - only show when items are selected */}
      {selectedIds.length > 0 && (
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

      {/* Error Alerts */}
      {deleteMutation.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => {
            deleteMutation.reset();
          }}
        >
          {deleteMutation.error?.message || 'An error occurred'}
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
          {/* Conditional rendering based on view mode */}
          {viewMode === 'grid' && (
            <InspectionKanban
              inspections={inspectionsWithOverdue}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onStartInspection={handleStartInspection}
              onCompleteInspection={handleCompleteInspection}
              onApprove={handleApprove}
              onReject={handleReject}
              onCancel={handleCancelInspection}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              formatStatusText={formatStatusText}
            />
          )}
          {viewMode === 'list' && (
            <VirtualizedInspectionList
              inspections={inspectionsWithOverdue}
              renderItem={renderListItem}
              scrollKey="inspections-list"
            />
          )}
          {viewMode === 'table' && (
            <InspectionTable
              inspections={inspectionsWithOverdue}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              onSelect={handleSelectOne}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onCancel={handleCancelInspection}
              onStatusMenuOpen={handleStatusMenuOpen}
              getStatusColor={getStatusColor}
              formatStatusText={formatStatusText}
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

      </PageShell>

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

      {/* Bulk Delete Dialog with Progress */}
      <Dialog
        open={bulkDeleteOpen}
        onClose={isBulkDeleting ? undefined : closeBulkDeleteDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {isBulkDeleting
            ? `Deleting Inspections (${bulkDeleteProgress.current}/${bulkDeleteProgress.total})`
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
                Are you sure you want to delete <strong>{selectedIds.length}</strong> inspection{selectedIds.length !== 1 ? 's' : ''}?
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
                Deleting inspection {bulkDeleteProgress.current} of {bulkDeleteProgress.total}...
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
                  Successfully deleted {bulkDeleteResults.succeeded.length} inspection{bulkDeleteResults.succeeded.length !== 1 ? 's' : ''}
                </Alert>
              )}

              {bulkDeleteResults.failed.length > 0 && (
                <>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to delete {bulkDeleteResults.failed.length} inspection{bulkDeleteResults.failed.length !== 1 ? 's' : ''}
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
                Delete {selectedIds.length} Item{selectedIds.length !== 1 ? 's' : ''}
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
        <MenuItem
          onClick={() => handleStatusChange(statusMenuInspection, 'SCHEDULED')}
          disabled={statusMenuInspection?.status === 'SCHEDULED' || isUpdatingStatus}
        >
          <ListItemIcon>
            <ScheduleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Scheduled</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange(statusMenuInspection, 'IN_PROGRESS')}
          disabled={statusMenuInspection?.status === 'IN_PROGRESS' || isUpdatingStatus}
        >
          <ListItemIcon>
            <PlayArrowIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>In Progress</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange(statusMenuInspection, 'COMPLETED')}
          disabled={statusMenuInspection?.status === 'COMPLETED' || isUpdatingStatus}
        >
          <ListItemIcon>
            <CheckCircleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Completed</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange(statusMenuInspection, 'CANCELLED')}
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
    </Container>
  );
};

// ============================================================================
// Inspection Kanban Board Component
// ============================================================================

const InspectionKanban = ({
  inspections,
  onView,
  onEdit,
  onDelete,
  onStartInspection,
  onCompleteInspection,
  onApprove,
  onReject,
  onCancel,
  getStatusColor,
  getStatusIcon,
  formatStatusText,
}) => {
  const navigate = useNavigate();

  // Group inspections by status
  const columns = useMemo(() => {
    const grouped = {
      SCHEDULED: [],
      IN_PROGRESS: [],
      COMPLETED: [],
      CANCELLED: [],
    };

    inspections.forEach((inspection) => {
      const status = inspection.status || 'SCHEDULED';
      if (grouped[status]) {
        grouped[status].push(inspection);
      }
    });

    return [
      { id: 'SCHEDULED', title: 'Scheduled', inspections: grouped.SCHEDULED, color: 'info' },
      { id: 'IN_PROGRESS', title: 'In Progress', inspections: grouped.IN_PROGRESS, color: 'warning' },
      { id: 'COMPLETED', title: 'Completed', inspections: grouped.COMPLETED, color: 'success' },
      { id: 'CANCELLED', title: 'Cancelled', inspections: grouped.CANCELLED, color: 'error' },
    ];
  }, [inspections]);

  return (
    <Grid container spacing={2}>
      {columns.map((column) => (
        <Grid item xs={12} md={6} lg={3} key={column.id}>
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
              <Chip label={column.inspections.length} size="small" color={column.color} />
            </Box>

            {/* Column Cards */}
            <Stack spacing={2}>
              {column.inspections.map((inspection) => {
                const inspectionWithRooms = {
                  ...inspection,
                  rooms: (inspection.rooms || inspection.InspectionRoom || []).map((room) => ({
                    ...room,
                    checklistItems: room.checklistItems || room.InspectionChecklistItem || [],
                  })),
                };

                return (
                  <Card
                    key={inspection.id}
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.3s ease-in-out',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6,
                        borderColor: 'primary.main',
                      },
                    }}
                    onClick={() => onView(inspection.id)}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      {/* Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1, pr: 1 }}>
                          {inspection.title}
                        </Typography>
                        <Chip
                          icon={getStatusIcon(inspection.displayStatus || inspection.status)}
                          label={formatStatusText(inspection.displayStatus || inspection.status)}
                          size="small"
                          color={getStatusColor(inspection.displayStatus || inspection.status)}
                        />
                      </Box>

                      {/* Details */}
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: 'action.hover',
                          border: '1px solid',
                          borderColor: 'divider',
                          mb: 1.5,
                        }}
                      >
                        <Stack spacing={1.5}>
                          {/* Property */}
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}
                            >
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
                                color: 'primary.main',
                                textDecoration: 'none',
                                '&:hover': { textDecoration: 'underline' },
                                mt: 0.5,
                                display: 'block',
                              }}
                            >
                              {inspection.property?.name || 'N/A'}
                            </Typography>
                          </Box>

                          {/* Unit */}
                          {inspection.unit && (
                            <Box>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                                sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}
                              >
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
                                  color: 'primary.main',
                                  textDecoration: 'none',
                                  '&:hover': { textDecoration: 'underline' },
                                  mt: 0.5,
                                  display: 'block',
                                }}
                              >
                                Unit {inspection.unit.unitNumber}
                              </Typography>
                            </Box>
                          )}

                          {/* Scheduled Date */}
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}
                            >
                              Scheduled
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {formatDateTime(inspection.scheduledDate)}
                            </Typography>
                          </Box>

                          {/* Assigned To */}
                          {inspection.assignedTo && (
                            <Box>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                                sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}
                              >
                                Assigned To
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {inspection.assignedTo.firstName} {inspection.assignedTo.lastName}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Box>

                      {/* Progress Indicator */}
                      <Box sx={{ mb: 1.5 }}>
                        <InspectionProgressIndicator inspection={inspectionWithRooms} variant="full" />
                      </Box>

                      {/* Card Actions */}
                      <InspectionContextActions
                        inspection={inspection}
                        onStartInspection={onStartInspection}
                        onCompleteInspection={onCompleteInspection}
                        onApprove={onApprove}
                        onReject={onReject}
                        onCancel={onCancel}
                        onView={onView}
                        onEdit={onEdit}
                        variant="button"
                        size="small"
                        showSecondaryActions={false}
                      />
                    </CardContent>
                  </Card>
                );
              })}

              {column.inspections.length === 0 && (
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
                  <Typography variant="body2">No inspections</Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid>
      ))}
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

        {/* Progress Indicator */}
        <Box sx={{ mt: 2 }}>
          <InspectionProgressIndicator inspection={inspectionWithRooms} variant="compact" />
        </Box>
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
        {(inspection.status === 'SCHEDULED' || inspection.status === 'IN_PROGRESS') && onCancel && (
          <Tooltip title="Cancel inspection">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                onCancel(inspection);
              }}
              aria-label={`Cancel ${inspection.title}`}
            >
              <CancelIcon />
            </IconButton>
          </Tooltip>
        )}
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
  onSelect,
  onView,
  onEdit,
  onDelete,
  onCancel,
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
            <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {inspections.map((inspection) => {
            const inspectionWithRooms = {
              ...inspection,
              rooms: (inspection.rooms || inspection.InspectionRoom || []).map((room) => ({
                ...room,
                checklistItems: room.checklistItems || room.InspectionChecklistItem || [],
              })),
            };

            return (
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
                  onChange={() => onSelect && onSelect(inspection.id)}
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
              <TableCell>
                <Box sx={{ minWidth: 150 }}>
                  <InspectionProgressIndicator inspection={inspectionWithRooms} variant="compact" />
                </Box>
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
                  {(inspection.status === 'SCHEDULED' || inspection.status === 'IN_PROGRESS') && onCancel && (
                    <Tooltip title="Cancel inspection">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancel(inspection);
                        }}
                        aria-label={`Cancel ${inspection.title}`}
                      >
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
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
          );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default InspectionsPage;
