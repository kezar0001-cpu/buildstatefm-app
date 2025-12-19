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
  FormControlLabel,
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
import FilterBar from '../components/FilterBar/FilterBar';
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
    if (currentUser && !['PROPERTY_MANAGER', 'TECHNICIAN', 'OWNER'].includes(currentUser.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  // Don't render if user doesn't have access
  if (currentUser && !['PROPERTY_MANAGER', 'TECHNICIAN', 'OWNER'].includes(currentUser.role)) {
    return null;
  }

  const isOwner = currentUser?.role === 'OWNER';
  const isTechnician = currentUser?.role === 'TECHNICIAN';

  // State management
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [propertyFilter, setPropertyFilter] = useState(searchParams.get('property') || '');
  const [technicianFilter, setTechnicianFilter] = useState(searchParams.get('technician') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [includeArchived, setIncludeArchived] = useState(searchParams.get('includeArchived') === 'true');

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
    if (includeArchived) params.append('includeArchived', 'true');
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
      includeArchived,
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
    navigate(isOwner ? `/inspections/${id}/report` : `/inspections/${id}`);
  };

  const handleViewReport = (id) => {
    navigate(`/inspections/${id}/report`);
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
    if (isOwner) return;
    if (event.target.checked) {
      setSelectedIds(inspectionsWithOverdue.map(i => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    if (isOwner) return;
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
              {!isTechnician &&
                (inspection.status === 'SCHEDULED' ||
                  inspection.status === 'IN_PROGRESS') && (
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
              {!isTechnician && (
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
              )}
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

// ...

{viewMode === 'grid' && (
  <InspectionKanban
    inspections={inspectionsWithOverdue}
    onView={handleView}
    onViewReport={handleViewReport}
    onEdit={isOwner || isTechnician ? undefined : handleEdit}
    onDelete={isOwner ? undefined : handleDeleteClick}
    onStartInspection={isOwner ? undefined : handleStartInspection}
    onCompleteInspection={isOwner ? undefined : handleCompleteInspection}
    onApprove={isOwner ? undefined : handleApprove}
    onReject={isOwner ? undefined : handleReject}
    onCancel={isOwner || isTechnician ? undefined : handleCancelInspection}
    getStatusColor={getStatusColor}
    getStatusIcon={getStatusIcon}
    formatStatusText={formatStatusText}
  />
)}

// ...

{viewMode === 'table' && (
  <InspectionTable
    inspections={inspectionsWithOverdue}
    selectedIds={selectedIds}
    onSelectAll={handleSelectAll}
    onSelect={handleSelectOne}
    onView={handleView}
    onEdit={isOwner || isTechnician ? undefined : handleEdit}
    onDelete={isOwner ? undefined : handleDeleteClick}
    onCancel={isOwner || isTechnician ? undefined : handleCancelInspection}
    onStatusMenuOpen={isOwner ? undefined : handleStatusMenuOpen}
    getStatusColor={getStatusColor}
    formatStatusText={formatStatusText}
  />
)}
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
