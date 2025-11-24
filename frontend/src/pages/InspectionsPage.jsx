import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayArrowIcon,
  MoreVert as MoreVertIcon,
  Cancel as CancelIcon,
  Search as SearchIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  ViewKanban as ViewKanbanIcon,
} from '@mui/icons-material';
import { useQuery, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import EmptyState from '../components/EmptyState';
import InspectionForm from '../components/InspectionForm';
import { CircularProgress } from '@mui/material';
import { queryKeys } from '../utils/queryKeys.js';
import { formatDateTime } from '../utils/date';

const InspectionsPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    status: '',
    propertyId: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [statusMenuInspection, setStatusMenuInspection] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try {
      const stored = localStorage.getItem('inspections-view-mode');
      return stored && ['grid', 'list', 'kanban'].includes(stored) ? stored : 'grid';
    } catch {
      return 'grid';
    }
  });

  // Build query params
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.propertyId) queryParams.append('propertyId', filters.propertyId);
  if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
  if (filters.search?.trim()) queryParams.append('search', filters.search.trim());

  // Fetch inspections with infinite query
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.inspections.list(filters),
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams(queryParams);
      params.append('limit', '50');
      params.append('offset', pageParam.toString());
      const response = await apiClient.get(`/inspections?${params.toString()}`);
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page * 50 : undefined;
    },
    initialPageParam: 0,
  });

  // Flatten all pages into a single array
  const inspections = data?.pages?.flatMap(page => page.items) || [];

  // Fetch properties for filter
  const { data: propertiesData } = useQuery({
    queryKey: queryKeys.properties.all(),
    queryFn: async () => {
      const response = await apiClient.get('/properties?limit=100&offset=0');
      return response.data;
    },
  });

  const properties = propertiesData?.items || [];

  // Mutation for updating inspection status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await apiClient.patch(`/inspections/${id}`, { status });
      return response.data;
    },
    onSuccess: () => {
      refetch();
      setStatusMenuAnchor(null);
      setStatusMenuInspection(null);
    },
  });

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

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

  const handleStatusChange = (newStatus, inspectionOverride) => {
    const targetInspection = inspectionOverride || statusMenuInspection;
    if (targetInspection) {
      updateStatusMutation.mutate({
        id: targetInspection.id,
        status: newStatus,
      });
    }
  };

  const handleViewModeChange = (_, newValue) => {
    if (!newValue) return;
    setViewMode(newValue);
    localStorage.setItem('inspections-view-mode', newValue);
  };

  const getStatusColor = (status) => {
    const colors = {
      SCHEDULED: 'default',
      IN_PROGRESS: 'info',
      COMPLETED: 'success',
      CANCELLED: 'error',
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      SCHEDULED: <ScheduleIcon fontSize="small" />,
      IN_PROGRESS: <PlayArrowIcon fontSize="small" />,
      COMPLETED: <CheckCircleIcon fontSize="small" />,
      CANCELLED: <CancelIcon fontSize="small" />,
    };
    return icons[status];
  };

  const filteredInspections = useMemo(() => {
    if (!Array.isArray(inspections)) return [];

    return inspections.filter((inspection) => {
      const matchesSearch = filters.search
        ? `${inspection.title} ${inspection.property?.name ?? ''} ${inspection.type ?? ''}`
            .toLowerCase()
            .includes(filters.search.toLowerCase())
        : true;

      return matchesSearch;
    });
  }, [filters.search, inspections]);

  const hasActiveFilters = Boolean(
    filters.status || filters.propertyId || filters.dateFrom || filters.dateTo || filters.search
  );

  const renderActions = (inspection) => (
    <Box
      sx={{
        p: 2,
        pt: 0,
        display: 'flex',
        gap: 1,
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
      }}
    >
      <Tooltip title="View Details">
        <IconButton
          size="small"
          color="primary"
          onClick={() => handleView(inspection.id)}
        >
          <VisibilityIcon />
        </IconButton>
      </Tooltip>
      {inspection.status !== 'COMPLETED' && (
        <Tooltip title="Edit">
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleEdit(inspection)}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Change Status">
        <IconButton
          size="small"
          color="primary"
          onClick={(e) => handleStatusMenuOpen(e, inspection)}
        >
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
      {inspection.status !== 'CANCELLED' && (
        <Tooltip title="Cancel Inspection">
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              handleStatusChange('CANCELLED', inspection);
            }}
          >
            <CancelIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  const renderInspectionCard = (inspection, variant = 'grid') => {
    const isList = variant === 'list';

    return (
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
          ...(isList && {
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'stretch' },
          }),
        }}
      >
        <CardContent
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            ...(isList && {
              minWidth: 0,
              flexBasis: { sm: '75%' },
            }),
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'flex-start' },
              gap: { xs: 1, sm: 2 },
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                {inspection.title}
              </Typography>
              <Chip
                icon={getStatusIcon(inspection.status)}
                label={inspection.status.replace('_', ' ')}
                color={getStatusColor(inspection.status)}
                size="small"
                sx={{ mb: 1 }}
              />
            </Box>
            <Chip
              label={inspection.type}
              size="small"
              variant="outlined"
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            />
          </Box>

          <Stack spacing={1} direction={isList ? { xs: 'column', sm: 'row' } : 'column'} flexWrap={isList ? 'wrap' : 'nowrap'}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Property
              </Typography>
              <Typography variant="body2">
                {inspection.property?.name || 'N/A'}
              </Typography>
            </Box>

            {inspection.unit && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Unit
                </Typography>
                <Typography variant="body2">
                  Unit {inspection.unit.unitNumber}
                </Typography>
              </Box>
            )}

            <Box>
              <Typography variant="caption" color="text.secondary">
                Scheduled Date
              </Typography>
              <Typography variant="body2">
                {formatDateTime(inspection.scheduledDate)}
              </Typography>
            </Box>

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

            {inspection.completedDate && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Completed Date
                </Typography>
                <Typography variant="body2">
                  {formatDateTime(inspection.completedDate)}
                </Typography>
              </Box>
            )}
          </Stack>
        </CardContent>

        {renderActions(inspection)}
      </Card>
    );
  };

  const renderGridView = () => (
    <Grid container spacing={{ xs: 2, md: 3 }}>
      {filteredInspections.map((inspection) => (
        <Grid item xs={12} md={6} lg={4} key={inspection.id}>
          {renderInspectionCard(inspection, 'grid')}
        </Grid>
      ))}
    </Grid>
  );

  const renderListView = () => (
    <Grid container spacing={{ xs: 2, md: 3 }}>
      {filteredInspections.map((inspection) => (
        <Grid item xs={12} key={inspection.id}>
          {renderInspectionCard(inspection, 'list')}
        </Grid>
      ))}
    </Grid>
  );

  const renderKanbanView = () => {
    const columns = [
      { key: 'SCHEDULED', label: 'Scheduled' },
      { key: 'IN_PROGRESS', label: 'In Progress' },
      { key: 'COMPLETED', label: 'Completed' },
      { key: 'CANCELLED', label: 'Cancelled' },
    ];

    return (
      <Grid container spacing={{ xs: 2, md: 3 }}>
        {columns.map((column) => {
          const columnInspections = filteredInspections.filter(
            (inspection) => inspection.status === column.key
          );

          return (
            <Grid item xs={12} md={6} lg={3} key={column.key}>
              <Card sx={{ height: '100%', borderRadius: 3 }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {column.label}
                    </Typography>
                    <Chip label={columnInspections.length} size="small" />
                  </Stack>

                  <Stack spacing={2}>
                    {columnInspections.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No inspections in this stage.
                      </Typography>
                    ) : (
                      columnInspections.map((inspection) => (
                        <Box key={inspection.id}>{renderInspectionCard(inspection, 'grid')}</Box>
                      ))
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <DataState type="loading" message="Loading inspections..." />
      </Container>
    );
  }

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
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', width: { xs: '100%', md: 'auto' } }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            size="large"
            fullWidth
            sx={{
              maxWidth: { xs: '100%', md: 'none' },
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
        </Box>
      </Stack>

      {/* Filters */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)' }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12} lg={8}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ height: '100%' }}>
                <TextField
                  fullWidth
                  label="Search"
                  placeholder="Search inspections or properties..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  select
                  fullWidth
                  label="Status"
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  size="small"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="SCHEDULED">Scheduled</MenuItem>
                  <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="CANCELLED">Cancelled</MenuItem>
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="Property"
                  value={filters.propertyId}
                  onChange={(e) => handleFilterChange('propertyId', e.target.value)}
                  size="small"
                >
                  <MenuItem value="">All Properties</MenuItem>
                  {Array.isArray(properties) && properties.map((property) => (
                    <MenuItem key={property.id} value={property.id}>
                      {property.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Stack
                direction={{ xs: 'column', sm: 'row', lg: 'row' }}
                spacing={2}
                justifyContent="flex-end"
                alignItems={{ xs: 'stretch', sm: 'center' }}
                sx={{ height: '100%' }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flex={1}>
                  <TextField
                    fullWidth
                    label="From Date"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    fullWidth
                    label="To Date"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Stack>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    minWidth: { xs: '100%', sm: 140 },
                  }}
                >
                  <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={handleViewModeChange}
                    aria-label="View mode toggle"
                    size="small"
                    sx={{
                      display: 'inline-flex',
                      backgroundColor: 'background.paper',
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
                      '& .MuiToggleButtonGroup-grouped': {
                        minWidth: 0,
                        px: 1.5,
                        py: 0.75,
                        border: 'none',
                      },
                      '& .MuiToggleButton-root': {
                        borderRadius: '10px !important',
                        color: 'text.secondary',
                      },
                      '& .Mui-selected': {
                        color: 'primary.main',
                        backgroundColor: 'action.selected',
                        boxShadow: '0 6px 16px rgba(15, 23, 42, 0.12)',
                      },
                    }}
                  >
                    <ToggleButton value="grid" aria-label="grid view">
                      <ViewModuleIcon fontSize="small" />
                    </ToggleButton>
                    <ToggleButton value="list" aria-label="list view">
                      <ViewListIcon fontSize="small" />
                    </ToggleButton>
                    <ToggleButton value="kanban" aria-label="kanban view">
                      <ViewKanbanIcon fontSize="small" />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Inspections List */}
      {!Array.isArray(filteredInspections) || filteredInspections.length === 0 ? (
        <EmptyState
          icon={CheckCircleIcon}
          title={hasActiveFilters ? 'No inspections match your filters' : 'No inspections yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
              : 'Get started by scheduling your first property inspection. Stay on top of maintenance, document findings, and ensure compliance with ease.'
          }
          actionLabel={hasActiveFilters ? undefined : 'Schedule First Inspection'}
          onAction={hasActiveFilters ? undefined : handleCreate}
        />
      ) : (
        <Stack spacing={3}>
          {viewMode === 'grid' && renderGridView()}
          {viewMode === 'list' && renderListView()}
          {viewMode === 'kanban' && renderKanbanView()}

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

      {/* Status Change Menu */}
      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={handleStatusMenuClose}
      >
        <MenuItem
          onClick={() => handleStatusChange('SCHEDULED')}
          disabled={statusMenuInspection?.status === 'SCHEDULED'}
        >
          <ListItemIcon>
            <ScheduleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Scheduled</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange('IN_PROGRESS')}
          disabled={statusMenuInspection?.status === 'IN_PROGRESS'}
        >
          <ListItemIcon>
            <PlayArrowIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>In Progress</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange('COMPLETED')}
          disabled={statusMenuInspection?.status === 'COMPLETED'}
        >
          <ListItemIcon>
            <CheckCircleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Completed</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange('CANCELLED')}
          disabled={statusMenuInspection?.status === 'CANCELLED'}
        >
          <ListItemIcon>
            <CancelIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Cancelled</ListItemText>
        </MenuItem>
      </Menu>
    </Container>
  );
};

export default InspectionsPage;