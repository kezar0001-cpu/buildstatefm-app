import React, { useState } from 'react';
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
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayArrowIcon,
  FilterList as FilterListIcon,
  MoreVert as MoreVertIcon,
  Cancel as CancelIcon,
  ViewModule as ViewModuleIcon,
  ViewKanban as ViewKanbanIcon,
  ViewList as ViewListIcon,
  Search as SearchIcon,
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
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [statusMenuInspection, setStatusMenuInspection] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('card');

  // Build query params
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.propertyId) queryParams.append('propertyId', filters.propertyId);
  if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);

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

  const handleStatusChange = (newStatus) => {
    if (statusMenuInspection) {
      setStatusMenuAnchor(null);
      updateStatusMutation.mutate({
        id: statusMenuInspection.id,
        status: newStatus,
      });
    }
  };

  const handleQuickStatusChange = (inspection, status) => {
    setStatusMenuInspection(inspection);
    updateStatusMutation.mutate({ id: inspection.id, status });
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

  const filteredInspections = inspections.filter((inspection) => {
    const matchesSearch = !searchTerm.trim()
      ? true
      : [inspection.title, inspection.property?.name, inspection.type, inspection.status]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = !filters.status || inspection.status === filters.status;
    const matchesProperty =
      !filters.propertyId || inspection.property?.id?.toString() === filters.propertyId.toString();

    const inspectionDate = inspection.scheduledAt ? new Date(inspection.scheduledAt) : null;
    const matchesFrom = !filters.dateFrom || (inspectionDate && inspectionDate >= new Date(filters.dateFrom));
    const matchesTo =
      !filters.dateTo || (inspectionDate && inspectionDate <= new Date(`${filters.dateTo}T23:59:59`));

    return matchesSearch && matchesStatus && matchesProperty && matchesFrom && matchesTo;
  });

  const hasFiltersApplied = Boolean(
    filters.status || filters.propertyId || filters.dateFrom || filters.dateTo || searchTerm.trim(),
  );
  const hasAnyInspections = Array.isArray(inspections) && inspections.length > 0;
  const statusColumns = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

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

      {/* Search & View Controls */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <TextField
          fullWidth
          placeholder="Search inspections by title or property..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          size="small"
          sx={{ maxWidth: { xs: '100%', md: 420 } }}
        />

        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, nextView) => nextView && setView(nextView)}
          aria-label="inspections view toggle"
          size="small"
          sx={{
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
            width: { xs: '100%', md: 'auto' },
            backgroundColor: 'background.paper',
            borderRadius: 999,
            boxShadow: 1,
            p: 0.5,
            '& .MuiToggleButton-root': {
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              minWidth: { xs: 'auto', sm: 110 },
              minHeight: { xs: 42, md: 40 },
              border: 'none',
              borderRadius: '999px !important',
              textTransform: 'none',
              fontWeight: 600,
              px: { xs: 1.5, sm: 2 },
              py: { xs: 1, sm: 0.75 },
            },
            '& .Mui-selected': {
              color: 'primary.main',
              backgroundColor: 'rgba(185, 28, 28, 0.08)',
            },
          }}
        >
          <ToggleButton value="card" aria-label="card view">
            <ViewModuleIcon fontSize="small" />
            <Typography variant="button" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              Card
            </Typography>
          </ToggleButton>
          <ToggleButton value="kanban" aria-label="kanban view">
            <ViewKanbanIcon fontSize="small" />
            <Typography variant="button" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              Kanban
            </Typography>
          </ToggleButton>
          <ToggleButton value="list" aria-label="list view">
            <ViewListIcon fontSize="small" />
            <Typography variant="button" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              List
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
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
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
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
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="From Date"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="To Date"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Inspections List */}
      {!hasAnyInspections ? (
        <EmptyState
          icon={CheckCircleIcon}
          title={hasFiltersApplied ? 'No inspections match your filters' : 'No inspections yet'}
          description={
            hasFiltersApplied
              ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
              : 'Get started by scheduling your first property inspection. Stay on top of maintenance, document findings, and ensure compliance with ease.'
          }
          actionLabel={hasFiltersApplied ? undefined : 'Schedule First Inspection'}
          onAction={hasFiltersApplied ? undefined : handleCreate}
        />
      ) : filteredInspections.length === 0 ? (
        <EmptyState
          icon={FilterListIcon}
          title="No inspections match your filters"
          description="Try adjusting your filters, search, or view to see more inspections."
          actionLabel="Clear Filters"
          onAction={() => {
            setFilters({ status: '', propertyId: '', dateFrom: '', dateTo: '' });
            setSearchTerm('');
          }}
        />
      ) : (
        <Stack spacing={3}>
          {view === 'card' && (
            <>
              <Grid container spacing={{ xs: 2, md: 3 }}>
                {filteredInspections.map((inspection) => (
                  <Grid item xs={12} md={6} lg={4} key={inspection.id}>
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
                      }}
                    >
                      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                              sx={{ mb: 1, textTransform: 'capitalize' }}
                            />
                          </Box>
                          <Chip
                            label={inspection.type}
                            size="small"
                            variant="outlined"
                            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                          />
                        </Box>

                        <Stack spacing={1}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Property
                            </Typography>
                            <Typography variant="body2">
                              {inspection.property?.name || 'N/A'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Scheduled Date
                            </Typography>
                            <Typography variant="body2">
                              {inspection.scheduledAt ? formatDateTime(inspection.scheduledAt) : 'Not set'}
                            </Typography>
                          </Box>
                          {inspection.assignee && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Assigned To
                              </Typography>
                              <Typography variant="body2">
                                {inspection.assignee?.name || inspection.assignee?.email || 'Unassigned'}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </CardContent>

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
                        {inspection.status !== 'CANCELLED' && inspection.status !== 'COMPLETED' && (
                          <Tooltip title="Cancel Inspection">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleQuickStatusChange(inspection, 'CANCELLED')}
                              disabled={updateStatusMutation.isPending}
                            >
                              <CancelIcon />
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
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>

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
            </>
          )}

          {view === 'kanban' && (
            <Grid container spacing={{ xs: 2, md: 3 }}>
              {statusColumns.map((status) => (
                <Grid item xs={12} md={3} key={status}>
                  <Paper sx={{ p: { xs: 2, md: 3 }, backgroundColor: '#f5f5f5', borderRadius: 3 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <Chip
                        icon={getStatusIcon(status)}
                        label={status.replace('_', ' ')}
                        color={getStatusColor(status)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {filteredInspections.filter((inspection) => inspection.status === status).length} items
                      </Typography>
                    </Stack>
                    <Stack spacing={2}>
                      {filteredInspections
                        .filter((inspection) => inspection.status === status)
                        .map((inspection) => (
                          <Card key={inspection.id} variant="outlined" sx={{ borderRadius: 2 }}>
                            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {inspection.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {inspection.property?.name || 'N/A'}
                              </Typography>
                              <Typography variant="body2">
                                {inspection.scheduledAt ? formatDateTime(inspection.scheduledAt) : 'Not set'}
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                                <Tooltip title="View">
                                  <IconButton size="small" onClick={() => handleView(inspection.id)}>
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {inspection.status !== 'COMPLETED' && (
                                  <Tooltip title="Edit">
                                    <IconButton size="small" onClick={() => handleEdit(inspection)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {inspection.status !== 'CANCELLED' && inspection.status !== 'COMPLETED' && (
                                  <Tooltip title="Cancel">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleQuickStatusChange(inspection, 'CANCELLED')}
                                      disabled={updateStatusMutation.isPending}
                                    >
                                      <CancelIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="Status">
                                  <IconButton size="small" onClick={(e) => handleStatusMenuOpen(e, inspection)}>
                                    <MoreVertIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {view === 'list' && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
              <Table size="small" aria-label="inspections list view">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Property</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Scheduled</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInspections.map((inspection) => (
                    <TableRow key={inspection.id} hover>
                      <TableCell>{inspection.title}</TableCell>
                      <TableCell>{inspection.property?.name || 'N/A'}</TableCell>
                      <TableCell>{inspection.type || '—'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={inspection.status.replace('_', ' ')}
                          color={getStatusColor(inspection.status)}
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>{inspection.scheduledAt ? formatDateTime(inspection.scheduledAt) : 'Not set'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="View">
                            <IconButton size="small" onClick={() => handleView(inspection.id)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {inspection.status !== 'COMPLETED' && (
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleEdit(inspection)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {inspection.status !== 'CANCELLED' && inspection.status !== 'COMPLETED' && (
                            <Tooltip title="Cancel">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleQuickStatusChange(inspection, 'CANCELLED')}
                                disabled={updateStatusMutation.isPending}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Status">
                            <IconButton size="small" onClick={(e) => handleStatusMenuOpen(e, inspection)}>
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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