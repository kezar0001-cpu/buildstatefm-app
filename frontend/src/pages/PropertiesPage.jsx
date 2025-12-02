import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Home as HomeIcon,
  LocationOn as LocationIcon,
  Apartment as ApartmentIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  TableChart as TableChartIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import DataState from '../components/DataState';
import EmptyState from '../components/EmptyState';
import GradientButton from '../components/GradientButton';
import PageShell from '../components/PageShell';
import PropertyForm from '../components/PropertyForm';
import PropertyOnboardingWizard from '../components/PropertyOnboardingWizard';
import PropertyOccupancyWidget from '../components/PropertyOccupancyWidget';
import PropertyImageCarousel from '../components/PropertyImageCarousel';
import PageHeader from '../components/PageHeader';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { normaliseArray } from '../utils/error';
import { formatPropertyAddressLine } from '../utils/formatPropertyLocation';
import { queryKeys } from '../utils/queryKeys.js';
import logger from '../utils/logger';

// Helper function to get status color - defined outside component to avoid recreation on every render
const getStatusColor = (status) => {
  const colors = {
    ACTIVE: 'success',
    INACTIVE: 'default',
    UNDER_MAINTENANCE: 'warning',
  };
  return colors[status] || 'default';
};

// Helper function to format status text - replaces all underscores with spaces
const formatStatusText = (status) => {
  if (!status) return '';
  return status.replaceAll('_', ' ');
};

export default function PropertiesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Bug Fix #2: Use URL search params for search and filter state
  // This allows bookmarking, sharing, and proper back/forward navigation
  const searchTerm = searchParams.get('search') || '';
  const filterStatus = searchParams.get('status') || 'all';

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  // Bug Fix: Track local search input to avoid URL pollution on every keystroke
  const [localSearchInput, setLocalSearchInput] = useState(searchTerm);

  // Bug Fix #3: Persist view mode preference in localStorage
  const [viewMode, setViewMode] = useState(() => {
    try {
      const stored = localStorage.getItem('properties-view-mode');
      return stored && ['grid', 'list', 'table'].includes(stored) ? stored : 'grid';
    } catch {
      return 'grid';
    }
  });

  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [paginationError, setPaginationError] = useState(null);

  // Sync local search input with URL search param (for back/forward navigation)
  useEffect(() => {
    setLocalSearchInput(searchTerm);
  }, [searchTerm]);

  // Bug Fix: Debounce both search term AND URL updates to prevent URL pollution
  // This prevents creating excessive browser history entries on every keystroke
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(localSearchInput);
      // Only update URL if value has actually changed
      if (localSearchInput !== searchTerm) {
        updateSearchParam('search', localSearchInput);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localSearchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bug Fix: Clear pagination errors when search or filter changes
  // This prevents stale error messages from persisting after user changes query
  useEffect(() => {
    setPaginationError(null);
  }, [debouncedSearchTerm, filterStatus]);

  // Bug Fix: Auto-dismiss pagination errors after 5 seconds for better UX
  useEffect(() => {
    if (paginationError) {
      const timer = setTimeout(() => setPaginationError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [paginationError]);

  // Update search params when they change
  const updateSearchParam = (key, value) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (value && value !== 'all') {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
      return newParams;
    });
  };

  useEffect(() => {
    if (!location.state?.openCreateDialog) {
      return;
    }

    setEditMode(false);
    setSelectedProperty(null);
    setDialogOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state?.openCreateDialog, location.pathname, navigate]);

  // Fetch properties with infinite query (Bug Fix #1: Server-side search and filter)
  const PROPERTIES_PAGE_SIZE = 50;
  // Note: We rely on gcTime to manage memory instead of limiting page count
  // React Query v4+ removed maxPages option; gcTime handles cleanup of old data
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.properties.list({ search: debouncedSearchTerm, status: filterStatus }),
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: PROPERTIES_PAGE_SIZE.toString(),
        offset: pageParam.toString(),
      });

      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }

      if (filterStatus && filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      const response = await apiClient.get(`/properties?${params.toString()}`);
      return response.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      // Calculate actual offset based on items fetched (Bug Fix: Accurate pagination)
      const totalFetched = allPages.reduce((sum, page) => sum + (page.items?.length || 0), 0);
      return lastPage.hasMore ? totalFetched : undefined;
    },
    initialPageParam: 0,
    gcTime: 5 * 60 * 1000, // Bug Fix: Garbage collect unused queries after 5 minutes to prevent memory growth
  });

  // Delete mutation
  // Bug Fix: Add optimistic updates for better UX - property disappears immediately
  const deleteMutation = useMutation({
    mutationFn: async (propertyId) => {
      const response = await apiClient.delete(`/properties/${propertyId}`);
      return response.data;
    },
    // Bug Fix: Optimistically remove property from cache before server responds
    onMutate: async (propertyId) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.properties.all() });

      // Snapshot the previous value for rollback on error
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.properties.all() });

      // Optimistically update the cache by removing the property
      queryClient.setQueriesData({ queryKey: queryKeys.properties.all() }, (old) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            items: page.items?.filter(property => property.id !== propertyId) || [],
            total: Math.max(0, (page.total || 0) - 1),
          })),
        };
      });

      return { previousData };
    },
    // Bug Fix: Rollback optimistic update on error
    onError: (_err, _propertyId, context) => {
      // Restore previous data if mutation fails
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      // Still invalidate to ensure we have fresh data from server
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all() });
    },
  });

  // Bug Fix: Always use _count.units as source of truth for accurate unit counts
  // The totalUnits field may be stale if units are added/deleted, but _count is always current
  const getTotalUnits = (property) => {
    return property?._count?.units ?? property?.totalUnits ?? 0;
  };

  // Bug Fix: Memoize containerSx objects to prevent PropertyImageCarousel re-renders
  const gridCarouselContainerSx = useMemo(() => ({
    borderBottom: '1px solid',
    borderColor: 'divider',
  }), []);

  const listCarouselContainerSx = useMemo(() => ({
    width: '100%',
    height: '100%',
    borderRight: { md: '1px solid' },
    borderBottom: { xs: '1px solid', md: 'none' },
    borderColor: 'divider',
  }), []);

  // Bug Fix: Use ref to maintain stable property object references across renders
  // This prevents unnecessary re-renders when new pages load - only new properties are created
  const propertyCacheRef = useRef(new Map());

  // Bug Fix: Clear property cache on component unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      propertyCacheRef.current.clear();
    };
  }, []);

  // Flatten all pages into a single array and memoize to prevent unnecessary re-renders
  // Note: Filtering now happens server-side via API parameters (Bug Fix #1)
  // Bug Fix: Memoize properties list with pre-processed images to avoid re-processing on every render
  // Bug Fix: Maintain stable object references to prevent unnecessary re-renders when new pages load
  const properties = useMemo(() => {
    if (!data?.pages) return [];

    // Bug Fix: Filter out undefined/null items and safely flatten pages
    const flattenedProperties = data.pages
      .flatMap(page => page?.items || [])
      .filter(property => property != null);

    // Bug Fix: Maintain stable object references using Map cache keyed by property.id
    // Only create new objects for new/changed properties
    const result = flattenedProperties.map(property => {
      const cached = propertyCacheRef.current.get(property.id);

      // Check if we can reuse cached object (property hasn't changed)
      // Compare updatedAt timestamp to detect changes
      if (cached && cached.updatedAt === property.updatedAt) {
        return cached;
      }

      // Process images array
      const processedImages = (() => {
        if (Array.isArray(property.images) && property.images.length > 0) {
          return property.images;
        }
        if (property.imageUrl) {
          return [property.imageUrl];
        }
        return [];
      })();

      // Pre-compute values to avoid inline calculations during render
      const hasMultipleImages = processedImages.length > 1;
      const totalUnits = getTotalUnits(property);
      const statusColor = getStatusColor(property.status || '');
      const formattedStatus = formatStatusText(property.status || '');
      const formattedAddress = formatPropertyAddressLine(property);

      const processed = {
        ...property,
        // Derived properties computed once
        processedImages,
        hasMultipleImages,
        totalUnits,
        statusColor,
        formattedStatus,
        formattedAddress,
      };

      // Update cache with new processed object
      propertyCacheRef.current.set(property.id, processed);

      return processed;
    });

    // Clean up cache: remove properties that are no longer in the list
    const currentIds = new Set(flattenedProperties.map(p => p.id));
    for (const [id] of propertyCacheRef.current) {
      if (!currentIds.has(id)) {
        propertyCacheRef.current.delete(id);
      }
    }

    return result;
  }, [data?.pages]);

  const handleMenuOpen = (event, property) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedProperty(property);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCreate = () => {
    setEditMode(false);
    setSelectedProperty(null);
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleViewModeChange = (_event, nextView) => {
    if (nextView !== null) {
      setViewMode(nextView);
      // Bug Fix #3: Save view mode preference to localStorage
      try {
        localStorage.setItem('properties-view-mode', nextView);
      } catch (error) {
        logger.warn('Failed to save view mode preference:', error);
      }
    }
  };

  const handleEdit = () => {
    setEditMode(true);
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const confirmDelete = async () => {
    if (!selectedProperty) return;

    try {
      await deleteMutation.mutateAsync(selectedProperty.id);
      setDeleteDialogOpen(false);
      setSelectedProperty(null);
    } catch (error) {
      // Error is shown via mutation.error
    }
  };

  // Bug Fix: Validate property ID before navigation to prevent broken URLs
  const handleCardClick = (propertyId) => {
    if (!propertyId) {
      logger.error('Invalid property ID:', propertyId);
      return;
    }
    navigate(`/properties/${propertyId}`);
  };

  const handleFormSuccess = () => {
    setDialogOpen(false);
    setSelectedProperty(null);
    setEditMode(false);
  };

  // Bug Fix: Prevent double-fetch race condition by checking if already fetching
  const handleLoadMore = async () => {
    // Prevent double-fetch if already loading
    if (isFetchingNextPage) {
      return;
    }

    try {
      setPaginationError(null);
      await fetchNextPage();
    } catch (err) {
      setPaginationError(err.message || 'Failed to load more properties');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <PageShell
        title="Properties"
        subtitle="Manage your property portfolio"
        actions={(
          <GradientButton
            startIcon={<AddIcon />}
            onClick={handleCreate}
            size="large"
            sx={{ width: { xs: '100%', md: 'auto' } }}
          >
            Add Property
          </GradientButton>
        )}
        contentSpacing={{ xs: 3, md: 3 }}
      >
        {/* Search and Filter */}
        <Paper
          sx={{
            p: { xs: 2, sm: 2.5, md: 3.5 },
            borderRadius: { xs: 2, md: 3 },
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
            animation: 'fade-in-up 0.6s ease-out',
          }}
        >
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={{ xs: 2, sm: 2 }} 
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            {/* Search */}
            <TextField
              placeholder="Search properties by name, address, or city..."
              value={localSearchInput}
              onChange={(e) => setLocalSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: localSearchInput && (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="clear search"
                      onClick={() => setLocalSearchInput('')}
                      edge="end"
                      size="small"
                      sx={{ minWidth: 44, minHeight: 44 }} // Better touch target
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              size="small"
              sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 250 } }}
            />

            {/* Status Filter */}
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => updateSearchParam('status', e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
                <MenuItem value="UNDER_MAINTENANCE">Under Maintenance</MenuItem>
              </Select>
            </FormControl>

            {/* View Toggle */}
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
          </Stack>
        </Paper>

        {/* Error Alerts */}
        {deleteMutation.isError && (
          <Alert severity="error" onClose={() => deleteMutation.reset()}>
            {deleteMutation.error?.message || 'Failed to delete property'}
          </Alert>
        )}
        {paginationError && (
          <Alert severity="error" onClose={() => setPaginationError(null)}>
            {paginationError}
          </Alert>
        )}

        {/* Loading State */}
        {isLoading ? (
          <Box sx={{ mt: 3 }}>
            {viewMode === 'grid' && <LoadingSkeleton variant="card" count={6} height={300} />}
            {viewMode === 'list' && <LoadingSkeleton variant="list" count={5} showAvatar={true} height={120} />}
            {viewMode === 'table' && <LoadingSkeleton variant="table" count={5} />}
          </Box>
        ) : isError ? (
          <DataState
            type="error"
            message={error?.message || 'Failed to load properties'}
            onRetry={refetch}
          />
        ) : properties.length === 0 ? (
            <EmptyState
              icon={HomeIcon}
              title={debouncedSearchTerm || filterStatus !== 'all' ? 'No properties match your filters' : 'No properties yet'}
              description={
                debouncedSearchTerm || filterStatus !== 'all'
                  ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                  : 'Get started by adding your first property. You can manage units, track maintenance, and monitor inspections all in one place.'
              }
              actionLabel={debouncedSearchTerm || filterStatus !== 'all' ? undefined : 'Add First Property'}
              onAction={debouncedSearchTerm || filterStatus !== 'all' ? undefined : handleCreate}
            />
          ) : (
            <Stack spacing={3} sx={{ animation: 'fade-in 0.7s ease-out' }}>
              {/* Grid View */}
              {viewMode === 'grid' && (
                <Grid container spacing={3}>
                  {properties.map((property) => (
                    <Grid item xs={12} sm={6} md={4} key={property.id}>
                      <Card
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          cursor: 'pointer',
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: 'divider',
                          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                          overflow: 'hidden',
                          position: 'relative',
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
                          '&:hover::before': {
                            opacity: 1,
                          },
                        }}
                        onClick={() => handleCardClick(property.id)}
                      >
                        <PropertyImageCarousel
                          images={property.processedImages}
                          fallbackText={property.name}
                          height={{ xs: 180, sm: 200 }}
                          showDots={property.hasMultipleImages}
                          showArrows={property.hasMultipleImages}
                          showCounter={property.hasMultipleImages}
                          containerSx={gridCarouselContainerSx}
                        />

                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: 1,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {property.name}
                            </Typography>
                            {/* Bug Fix: Add ARIA label for accessibility */}
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuOpen(e, property)}
                              aria-label={`Actions for ${property.name}`}
                            >
                              <MoreVertIcon />
                            </IconButton>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocationIcon fontSize="small" color="action" />
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ flexGrow: 1, minWidth: 0 }}
                            >
                              {property.formattedAddress}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              size="small"
                              label={property.formattedStatus}
                              color={property.statusColor}
                            />
                            <Chip
                              size="small"
                              icon={<ApartmentIcon />}
                              label={`${property.totalUnits} units`}
                              variant="outlined"
                            />
                          </Box>

                          {property.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {property.description}
                            </Typography>
                          )}
                        </CardContent>

                        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                          <Stack spacing={0.5} sx={{ width: '100%' }}>
                            <Typography variant="caption" color="text.secondary">
                              Type: {property.propertyType || 'N/A'}
                            </Typography>
                            {property._count && (
                              <Typography variant="caption" color="text.secondary">
                                {property._count.jobs ?? 0} active jobs • {property._count.inspections ?? 0} inspections
                              </Typography>
                            )}
                          </Stack>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* List View */}
              {viewMode === 'list' && (
                <Stack spacing={2}>
                  {properties.map((property) => (
                    <Card
                      key={property.id}
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        cursor: 'pointer',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        overflow: 'hidden',
                        '&:hover': {
                          boxShadow: 3,
                        },
                      }}
                      onClick={() => handleCardClick(property.id)}
                    >
                      {/* Property Image */}
                      <Box
                        sx={{
                          width: { xs: '100%', md: 250 },
                          height: { xs: 180, md: 'auto' },
                          minHeight: { md: 200 },
                          flexShrink: 0,
                        }}
                      >
                        <PropertyImageCarousel
                          images={property.processedImages}
                          fallbackText={property.name}
                          height={{ xs: 180, md: '100%' }}
                          showDots={property.hasMultipleImages}
                          showArrows={property.hasMultipleImages}
                          showCounter={property.hasMultipleImages}
                          containerSx={listCarouselContainerSx}
                        />
                      </Box>

                      {/* Property Content */}
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
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {property.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <LocationIcon fontSize="small" color="action" />
                              <Typography variant="body2" color="text.secondary">
                                {property.formattedAddress}
                              </Typography>
                            </Box>
                          </Box>
                          {/* Bug Fix: Add ARIA label for accessibility */}
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, property)}
                            aria-label={`Actions for ${property.name}`}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </Box>

                        {/* Description */}
                        {property.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mb: 2,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {property.description}
                          </Typography>
                        )}

                        {/* Chips and Stats */}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                          <Chip
                            size="small"
                            label={property.formattedStatus}
                            color={property.statusColor}
                          />
                          <Chip
                            size="small"
                            icon={<ApartmentIcon />}
                            label={`${property.totalUnits} units`}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={property.propertyType || 'N/A'}
                            variant="outlined"
                          />
                        </Box>

                        {/* Footer Stats */}
                        {property._count && (
                          <Typography variant="caption" color="text.secondary">
                            {property._count.jobs ?? 0} active jobs • {property._count.inspections ?? 0} inspections
                          </Typography>
                        )}
                      </Box>

                      {/* Occupancy Widget (List View Only) */}
                      {/* Bug Fix: Only show occupancy widget if occupancyStats is available */}
                      {/* occupancyStats is only calculated in detail view, not list view */}
                      {property.occupancyStats && (
                        <Box
                          sx={{
                            display: { xs: 'none', lg: 'flex' },
                            alignItems: 'center',
                            p: 2,
                            borderLeft: '1px solid',
                            borderColor: 'divider',
                            minWidth: 200,
                          }}
                        >
                          <PropertyOccupancyWidget
                            occupancyStats={property.occupancyStats}
                            totalUnits={property.totalUnits}
                            compact={true}
                          />
                        </Box>
                      )}
                    </Card>
                  ))}
                </Stack>
              )}

              {/* Table View */}
              {viewMode === 'table' && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small" aria-label="properties table view">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Property</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          Units
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          Jobs
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          Inspections
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {properties.map((property) => {
                        const jobsCount = property._count?.jobs ?? 0;
                        const inspectionsCount = property._count?.inspections ?? 0;

                        return (
                          <TableRow
                            key={property.id}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => handleCardClick(property.id)}
                          >
                            <TableCell>
                              <Stack spacing={0.5}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {property.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {property.propertyType || '—'}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {property.formattedAddress || '—'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={600}>
                                {property.totalUnits}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">{jobsCount}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">{inspectionsCount}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={property.formattedStatus || 'Unknown'}
                                color={property.statusColor}
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </TableCell>
                            <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                              {/* Bug Fix: Add ARIA label for accessibility */}
                              <IconButton
                                size="small"
                                onClick={(e) => handleMenuOpen(e, property)}
                                aria-label={`Actions for ${property.name}`}
                              >
                                <MoreVertIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Load More Button */}
              {hasNextPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={handleLoadMore}
                    disabled={isFetchingNextPage}
                    startIcon={isFetchingNextPage ? <CircularProgress size={20} /> : null}
                  >
                    {/* Bug Fix: Show remaining count for better user awareness */}
                    {(() => {
                      const totalFetched = data?.pages?.reduce((sum, page) => sum + (page.items?.length || 0), 0) || 0;
                      const total = data?.pages?.[0]?.total;
                      const remaining = total && total > totalFetched ? total - totalFetched : null;

                      if (isFetchingNextPage) return 'Loading...';
                      if (remaining !== null && remaining > 0) return `Load More (${remaining} remaining)`;
                      return 'Load More';
                    })()}
                  </Button>
                </Box>
              )}
            </Stack>
          )}
      </PageShell>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Property Onboarding Wizard */}
      <PropertyOnboardingWizard
        open={dialogOpen && !editMode}
        onClose={() => {
          setDialogOpen(false);
          setSelectedProperty(null);
          setEditMode(false);
        }}
      />

      {/* Property Form Dialog */}
      <PropertyForm
        key={selectedProperty?.id || 'new-property'}
        open={dialogOpen && editMode}
        onClose={() => {
          setDialogOpen(false);
          setSelectedProperty(null);
          setEditMode(false);
        }}
        property={editMode ? selectedProperty : null}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Property</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{selectedProperty?.name}</strong>?
            This action cannot be undone.
          </Typography>
          {selectedProperty && Number(selectedProperty.totalUnits) > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This property has {selectedProperty.totalUnits} unit(s). Make sure to remove all units and tenants before deleting.
            </Alert>
          )}
          {/* Bug Fix: Show delete error inside dialog for better user feedback */}
          {deleteMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => deleteMutation.reset()}>
              {deleteMutation.error?.response?.data?.message || deleteMutation.error?.message || 'Failed to delete property. Please try again.'}
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
    </Container>
  );
}