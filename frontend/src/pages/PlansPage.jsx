import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  TextField,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  useTheme,
  useMediaQuery,
  Tooltip,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  ViewModule as ViewModuleIcon,
  TableChart as TableChartIcon,
  CalendarMonth as CalendarMonthIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  ViewList as ViewListIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys.js';
import DataState from '../components/DataState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PlanCard from '../components/PlanCard.jsx';
import PlanDetailModal from '../components/PlanDetailModal.jsx';
import MaintenancePlanForm from '../components/MaintenancePlanForm.jsx';
import StatCard from '../components/StatCard.jsx';
import GradientButton from '../components/GradientButton';
import PageShell from '../components/PageShell';
import ensureArray from '../utils/ensureArray';
import PageHeader from '../components/PageHeader';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import toast from 'react-hot-toast';
import { format, isPast, isToday, parseISO, addDays } from 'date-fns';
import { useCurrentUser } from '../context/UserContext';
import TableSkeleton from '../components/skeletons/TableSkeleton';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

const localizer = momentLocalizer(moment);

const FREQUENCY_OPTIONS = [
  { value: '', label: 'All Frequencies' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMIANNUALLY', label: 'Semi-annually' },
  { value: 'ANNUALLY', label: 'Annually' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'true', label: 'Active Only' },
  { value: 'false', label: 'Inactive Only' },
];

export default function PlansPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user: currentUser } = useCurrentUser();

  // Plans are only accessible to Property Managers
  useEffect(() => {
    if (currentUser && currentUser.role !== 'PROPERTY_MANAGER') {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  // Don't render if user doesn't have access
  if (currentUser && currentUser.role !== 'PROPERTY_MANAGER') {
    return null;
  }

  const [view, setView] = useState('card'); // 'card', 'table', 'calendar'
  const [filters, setFilters] = useState({
    propertyId: '',
    frequency: '',
    isActive: '',
    search: '',
    includeArchived: false,
  });
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [detailPlanId, setDetailPlanId] = useState(null);

  // Fetch plans
  const { data: plansData, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.plans.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.propertyId) params.append('propertyId', filters.propertyId);
      if (filters.frequency) params.append('frequency', filters.frequency);
      if (filters.isActive) params.append('isActive', filters.isActive);
      if (filters.search) params.append('search', filters.search);
      if (filters.includeArchived) params.append('includeArchived', 'true');

      const response = await apiClient.get(`/plans?${params.toString()}`);
      return ensureArray(response.data);
    },
  });

  const plans = plansData || [];

  // Fetch properties for filter
  const { data: propertiesData } = useQuery({
    queryKey: queryKeys.properties.all(),
    queryFn: async () => {
      const response = await apiClient.get('/properties');
      return ensureArray(response.data, ['properties', 'data', 'items', 'results']);
    },
  });

  const properties = ensureArray(propertiesData);

  // Calculate stats
  const stats = useMemo(() => {
    const activePlans = plans.filter((p) => p.isActive);
    const today = new Date();
    const nextWeek = addDays(today, 7);

    const dueThisWeek = activePlans.filter((p) => {
      const dueDate = p.nextDueDate ? parseISO(p.nextDueDate) : null;
      return dueDate && dueDate >= today && dueDate <= nextWeek;
    });

    const overdue = activePlans.filter((p) => {
      const dueDate = p.nextDueDate ? parseISO(p.nextDueDate) : null;
      return dueDate && isPast(dueDate) && !isToday(dueDate);
    });

    const totalJobs = plans.reduce((sum, plan) => sum + (plan._count?.jobs || 0), 0);

    return {
      totalActive: activePlans.length,
      dueThisWeek: dueThisWeek.length,
      overdue: overdue.length,
      totalJobs,
    };
  }, [plans]);

  const handleViewChange = (event, newView) => {
    if (newView !== null) {
      setView(newView);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.propertyId) count += 1;
    if (filters.frequency) count += 1;
    if (filters.isActive) count += 1;
    if (filters.includeArchived) count += 1;
    return count;
  }, [filters.propertyId, filters.frequency, filters.isActive, filters.includeArchived]);

  const hasAnyActiveFilters = !!filters.search || activeFilterCount > 0;

  const handleClearFilters = () => {
    setFilters({
      propertyId: '',
      frequency: '',
      isActive: '',
      search: '',
      includeArchived: false,
    });
  };

  const archivePlanMutation = useMutation({
    mutationFn: async (planId) => {
      const response = await apiClient.patch(`/plans/${planId}/archive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() });
      toast.success('Plan archived');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to archive plan');
    },
  });

  const unarchivePlanMutation = useMutation({
    mutationFn: async (planId) => {
      const response = await apiClient.patch(`/plans/${planId}/unarchive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() });
      toast.success('Plan restored');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to restore plan');
    },
  });

  const handleToggleArchive = (plan) => {
    if (plan?.archivedAt) {
      unarchivePlanMutation.mutate(plan.id);
    } else {
      archivePlanMutation.mutate(plan.id);
    }
  };

  const handleCreateClick = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() });
    toast.success('Maintenance plan created successfully');
    setIsCreateDialogOpen(false);
  };

  const handleEditClick = (plan) => {
    setSelectedPlanId(plan.id);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() });
    toast.success('Maintenance plan updated successfully');
    setIsEditDialogOpen(false);
    setSelectedPlanId(null);
  };

  const handleCardClick = (plan) => {
    setDetailPlanId(plan.id);
  };

  const handleDetailClose = () => {
    setDetailPlanId(null);
  };

  // Prepare calendar events
  const calendarEvents = useMemo(() => {
    return plans
      .filter((plan) => plan.isActive && plan.nextDueDate)
      .map((plan) => ({
        id: plan.id,
        title: plan.name,
        start: new Date(plan.nextDueDate),
        end: new Date(plan.nextDueDate),
        resource: plan,
      }));
  }, [plans]);

  const handleEventClick = (event) => {
    setDetailPlanId(event.id);
  };

  const getFrequencyLabel = (frequency) => {
    const labels = {
      DAILY: 'Daily',
      WEEKLY: 'Weekly',
      BIWEEKLY: 'Bi-weekly',
      MONTHLY: 'Monthly',
      QUARTERLY: 'Quarterly',
      SEMIANNUALLY: 'Semi-annually',
      ANNUALLY: 'Annually',
    };
    return labels[frequency] || frequency;
  };

  const selectedPlan = selectedPlanId ? plans.find((p) => p.id === selectedPlanId) : null;

  return (
    <Box sx={{ px: { xs: 2, sm: 3, md: 0 }, py: { xs: 2, md: 0 } }}>
      <PageShell
        title="Maintenance Plans"
        subtitle="Create and manage recurring maintenance schedules for your properties"
        actions={(
          <GradientButton
            startIcon={<AddIcon />}
            onClick={handleCreateClick}
            size="large"
            sx={{ width: { xs: '100%', md: 'auto' } }}
          >
            Create Plan
          </GradientButton>
        )}
        contentSpacing={{ xs: 4, md: 4 }}
      >
        {/* Stats Cards */}
      <Grid container spacing={3} sx={{ animation: 'fade-in 0.6s ease-out' }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Plans"
            value={stats.totalActive}
            icon={<CheckCircleIcon />}
            trend={null}
            color="#16a34a"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Due This Week"
            value={stats.dueThisWeek}
            icon={<ScheduleIcon />}
            trend={null}
            color="#f97316"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Overdue"
            value={stats.overdue}
            icon={<WarningIcon />}
            trend={null}
            color="#dc2626"
            alert={stats.overdue > 0 ? `${stats.overdue} plan${stats.overdue > 1 ? 's' : ''} need${stats.overdue === 1 ? 's' : ''} attention` : null}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Jobs Created"
            value={stats.totalJobs}
            icon={<TrendingUpIcon />}
            trend={null}
            color="#3b82f6"
          />
        </Grid>
      </Grid>

      {/* Filters and View Toggle */}
      <Paper
        sx={{
          p: { xs: 2, sm: 2.5, md: 3.5 },
          borderRadius: { xs: 2, md: 2 },
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
          mt: 3,
        }}
      >
        <Stack spacing={{ xs: 1.5, md: 0 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', md: 'center' }}
            sx={{ gap: { xs: 1.5, lg: 2 } }}
          >
            <TextField
              placeholder="Search plans..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    <SearchIcon />
                  </Box>
                ),
                endAdornment: filters.search && (
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                    <IconButton
                      aria-label="clear search"
                      onClick={() => handleFilterChange('search', '')}
                      edge="end"
                      size="small"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ),
              }}
              size="small"
              sx={{
                width: { xs: '100%', md: 'auto' },
                flex: { md: '1 0 260px' },
                minWidth: { md: 260 },
                maxWidth: { md: 420 },
              }}
            />

            {isMobile ? (
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FilterListIcon />}
                  onClick={() => setFiltersExpanded((prev) => !prev)}
                  sx={{ textTransform: 'none', flex: 1 }}
                >
                  Filters
                  {activeFilterCount > 0 && (
                    <Chip
                      label={activeFilterCount}
                      size="small"
                      color="primary"
                      sx={{ ml: 1, height: 20, minWidth: 20 }}
                    />
                  )}
                </Button>

                {hasAnyActiveFilters && (
                  <Button
                    variant="text"
                    color="inherit"
                    size="small"
                    onClick={handleClearFilters}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                    startIcon={<CloseIcon />}
                  >
                    Clear
                  </Button>
                )}
              </Stack>
            ) : (
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  flexWrap: 'nowrap',
                  gap: 1.5,
                  width: 'auto',
                  flexShrink: 0,
                  overflow: 'visible',
                  whiteSpace: 'nowrap',
                  alignItems: 'center',
                }}
              >
                <TextField
                  select
                  label="Property"
                  value={filters.propertyId}
                  onChange={(e) => handleFilterChange('propertyId', e.target.value)}
                  size="small"
                  sx={{ minWidth: 190, flexShrink: 0 }}
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
                  label="Frequency"
                  value={filters.frequency}
                  onChange={(e) => handleFilterChange('frequency', e.target.value)}
                  size="small"
                  sx={{ minWidth: 160, flexShrink: 0 }}
                >
                  {FREQUENCY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Status"
                  value={filters.isActive}
                  onChange={(e) => handleFilterChange('isActive', e.target.value)}
                  size="small"
                  sx={{ minWidth: 150, flexShrink: 0 }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
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

                {hasAnyActiveFilters && (
                  <Button
                    variant="text"
                    color="inherit"
                    size="small"
                    onClick={handleClearFilters}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                    startIcon={<CloseIcon />}
                  >
                    Clear
                  </Button>
                )}
              </Stack>
            )}

            {!isMobile && (
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={handleViewChange}
                aria-label="View mode toggle"
                size="small"
                sx={{
                  backgroundColor: 'background.paper',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  flexShrink: 0,
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
                <ToggleButton value="card" aria-label="card view">
                  <Tooltip title="Card View">
                    <ViewModuleIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="table" aria-label="table view">
                  <Tooltip title="Table View">
                    <TableChartIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="calendar" aria-label="calendar view">
                  <Tooltip title="Calendar View">
                    <CalendarMonthIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          </Stack>

          {isMobile && (
            <>
              <Collapse in={filtersExpanded} timeout="auto" unmountOnExit>
                <Stack spacing={1.5} sx={{ pt: 1 }}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Property"
                    value={filters.propertyId}
                    onChange={(e) => handleFilterChange('propertyId', e.target.value)}
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
                    size="small"
                    label="Frequency"
                    value={filters.frequency}
                    onChange={(e) => handleFilterChange('frequency', e.target.value)}
                  >
                    {FREQUENCY_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Status"
                    value={filters.isActive}
                    onChange={(e) => handleFilterChange('isActive', e.target.value)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
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
              </Collapse>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
                <ToggleButtonGroup
                  value={view}
                  exclusive
                  onChange={handleViewChange}
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
                  <ToggleButton value="card" aria-label="card view">
                    <Tooltip title="Card View">
                      <ViewModuleIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="table" aria-label="table view">
                    <Tooltip title="Table View">
                      <TableChartIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="calendar" aria-label="calendar view">
                    <Tooltip title="Calendar View">
                      <CalendarMonthIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </>
          )}
        </Stack>
      </Paper>

      {/* Content */}
      {isLoading ? (
        <Box sx={{ mt: 3 }}>
          {view === 'card' && (
            <LoadingSkeleton variant="card" count={6} height={300} />
          )}
          {view === 'table' && <LoadingSkeleton variant="table" count={5} />}
          {view === 'calendar' && (
            <Box sx={{ height: 600 }}>
              {/* Calendar skeleton */}
              <LoadingSkeleton variant="table" count={5} />
            </Box>
          )}
        </Box>
      ) : error ? (
        <DataState isError={true} error={error} onRetry={refetch} />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={CalendarMonthIcon}
          iconColor="#dc2626"
          title="No maintenance plans found. Create your first plan to get started."
          description="There's nothing here yet. Start by adding your first item."
          actionLabel="Create Plan"
          onAction={handleCreateClick}
        />
      ) : (
        <>
        {view === 'card' && (
          <Grid container spacing={3} sx={{ animation: 'fade-in 0.5s ease-out' }}>
            {plans.map((plan) => (
              <Grid item xs={12} sm={6} md={4} key={plan.id}>
                <PlanCard
                  plan={plan}
                  onClick={() => handleCardClick(plan)}
                  onEdit={() => handleEditClick(plan)}
                  onArchive={() => handleToggleArchive(plan)}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {view === 'table' && (
          <Paper sx={{ animation: 'fade-in 0.5s ease-out' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Plan Name</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell>Frequency</TableCell>
                    <TableCell>Next Due</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Jobs</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plans.map((plan) => {
                    const nextDueDate = plan.nextDueDate ? parseISO(plan.nextDueDate) : null;
                    const isOverdue = nextDueDate && isPast(nextDueDate) && !isToday(nextDueDate);
                    const isDueToday = nextDueDate && isToday(nextDueDate);

                    return (
                      <TableRow key={plan.id} hover>
                        <TableCell>
                          <Typography variant="body1" fontWeight={500}>
                            {plan.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {plan.property?.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getFrequencyLabel(plan.frequency)}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              color: isOverdue
                                ? 'error.main'
                                : isDueToday
                                ? 'warning.main'
                                : 'text.primary',
                              fontWeight: isOverdue || isDueToday ? 600 : 400,
                            }}
                          >
                            {nextDueDate ? format(nextDueDate, 'MMM d, yyyy') : 'Not scheduled'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={plan.isActive ? 'Active' : 'Inactive'}
                            size="small"
                            color={plan.isActive ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip label={plan._count?.jobs || 0} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleCardClick(plan)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleToggleArchive(plan)}>
                            {plan.archivedAt ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                          </IconButton>
                          <IconButton size="small" onClick={() => handleEditClick(plan)} disabled={!!plan.archivedAt}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {view === 'calendar' && (
          <Paper sx={{ p: 2, animation: 'fade-in 0.5s ease-out' }}>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              onSelectEvent={handleEventClick}
              views={['month', 'week', 'agenda']}
              defaultView="month"
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: event.resource.isActive ? '#f97316' : '#9ca3af',
                  borderColor: event.resource.isActive ? '#b91c1c' : '#6b7280',
                },
              })}
            />
          </Paper>
        )}
        </>
      )}

      </PageShell>

      {/* Create Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 3 },
            maxHeight: { xs: '100vh', sm: '90vh' },
          },
        }}
      >
        <MaintenancePlanForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setIsCreateDialogOpen(false)}
        />
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 3 },
            maxHeight: { xs: '100vh', sm: '90vh' },
          },
        }}
      >
        <MaintenancePlanForm
          plan={selectedPlan}
          onSuccess={handleEditSuccess}
          onCancel={() => setIsEditDialogOpen(false)}
        />
      </Dialog>

      {/* Detail Modal */}
      <PlanDetailModal planId={detailPlanId} open={!!detailPlanId} onClose={handleDetailClose} />
    </Box>
  );
}
