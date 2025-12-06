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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  ViewModule as ViewModuleIcon,
  TableChart as TableChartIcon,
  CalendarMonth as CalendarMonthIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys.js';
import DataState from '../components/DataState.jsx';
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
  });
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
            size="medium"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
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
      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search plans..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
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
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
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
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
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
          </Grid>
          <Grid item xs={12} md={2}>
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={handleViewChange}
              fullWidth
              size="small"
              aria-label="maintenance plan view toggle"
              sx={{
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
                  minHeight: { xs: 42, md: 40 },
                  border: 'none',
                  borderRadius: '999px !important',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: { xs: 1.5, md: 1.75 },
                  py: { xs: 1, md: 0.75 },
                },
                '& .Mui-selected': {
                  color: 'primary.main',
                  backgroundColor: 'rgba(185, 28, 28, 0.08)',
                },
              }}
            >
              <ToggleButton value="card">
                <ViewModuleIcon fontSize="small" />
                <Typography variant="button" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Card
                </Typography>
              </ToggleButton>
              <ToggleButton value="table">
                <TableChartIcon fontSize="small" />
                <Typography variant="button" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Table
                </Typography>
              </ToggleButton>
              <ToggleButton value="calendar">
                <CalendarMonthIcon fontSize="small" />
                <Typography variant="button" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Calendar
                </Typography>
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* Content */}
      <DataState
        isLoading={isLoading}
        isError={error}
        error={error}
        isEmpty={!isLoading && !error && plans.length === 0}
        onRetry={refetch}
        emptyMessage="No maintenance plans found. Create your first plan to get started."
      >
        {view === 'card' && (
          <Grid container spacing={3} sx={{ animation: 'fade-in 0.5s ease-out' }}>
            {plans.map((plan) => (
              <Grid item xs={12} sm={6} md={4} key={plan.id}>
                <PlanCard
                  plan={plan}
                  onClick={() => handleCardClick(plan)}
                  onEdit={() => handleEditClick(plan)}
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
                          <IconButton size="small" onClick={() => handleEditClick(plan)}>
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
      </DataState>

      </PageShell>

      {/* Create Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
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
