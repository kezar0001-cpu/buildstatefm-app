import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Container,
  Paper,
  Stack,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Button,
  Chip,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  Grid,
  Card,
  CardContent,
  CardActions,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Divider,
  useMediaQuery,
  useTheme,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Lightbulb as LightbulbIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  TableChart as TableChartIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import useApiQuery from '../hooks/useApiQuery.js';
import useApiMutation from '../hooks/useApiMutation.js';
import DataState from '../components/DataState.jsx';
import EmptyState from '../components/EmptyState';
import GradientButton from '../components/GradientButton';
import PageShell from '../components/PageShell';
import RecommendationWizard from '../components/RecommendationWizard';
import { normaliseArray } from '../utils/error.js';
import { queryKeys } from '../utils/queryKeys.js';
import { useCurrentUser } from '../context/UserContext.jsx';

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'IMPLEMENTED', label: 'Implemented' },
];

const getPriorityColor = (priority) => {
  const colors = {
    LOW: 'default',
    MEDIUM: 'primary',
    HIGH: 'warning',
    URGENT: 'error',
  };
  return colors[priority] || 'default';
};

const getStatusColor = (status) => {
  const colors = {
    DRAFT: 'default',
    SUBMITTED: 'info',
    UNDER_REVIEW: 'warning',
    APPROVED: 'success',
    REJECTED: 'error',
    IMPLEMENTED: 'success',
  };
  return colors[status] || 'default';
};

export default function RecommendationsPage() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRecommendationId, setRejectingRecommendationId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // View mode state - persist in localStorage
  const [viewMode, setViewMode] = useState(() => {
    try {
      const stored = localStorage.getItem('recommendations-view-mode');
      return stored && ['grid', 'list', 'table'].includes(stored) ? stored : 'list';
    } catch {
      return 'list';
    }
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (priorityFilter) params.append('priority', priorityFilter);
    if (statusFilter) params.append('status', statusFilter);
    if (includeArchived) params.append('includeArchived', 'true');
    return params.toString();
  }, [debouncedSearch, priorityFilter, statusFilter, includeArchived]);

  const query = useApiQuery({
    queryKey: queryKeys.recommendations.list({ search: debouncedSearch, priority: priorityFilter, status: statusFilter, includeArchived }),
    url: `/recommendations${queryParams ? `?${queryParams}` : ''}`,
  });

  const convertMutation = useApiMutation({
    url: '/recommendations/:id/convert',
    method: 'post',
    invalidateKeys: [queryKeys.recommendations.all(), queryKeys.jobs.all()],
  });

  const approveMutation = useApiMutation({
    url: '/recommendations/:id/approve',
    method: 'post',
    invalidateKeys: [queryKeys.recommendations.all()],
  });

  const rejectMutation = useApiMutation({
    url: '/recommendations/:id/reject',
    method: 'post',
    invalidateKeys: [queryKeys.recommendations.all()],
  });

  // Fetch properties for display
  const { data: propertiesData } = useQuery({
    queryKey: queryKeys.properties.all(),
    queryFn: async () => {
      const response = await apiClient.get('/properties?limit=100&offset=0');
      return response.data;
    },
  });

  const properties = propertiesData?.items || [];
  const propertiesMap = useMemo(() => {
    const map = new Map();
    properties.forEach((prop) => {
      map.set(prop.id, prop);
    });
    return map;
  }, [properties]);

  const recommendations = normaliseArray(query.data);

  // Filter recommendations client-side for search
  const filteredRecommendations = useMemo(() => {
    if (!debouncedSearch) return recommendations;
    const searchLower = debouncedSearch.toLowerCase();
    return recommendations.filter((rec) => {
      const property = rec.property || propertiesMap.get(rec.propertyId);
      const propertyName = property?.name || '';
      return (
        rec.title?.toLowerCase().includes(searchLower) ||
        rec.description?.toLowerCase().includes(searchLower) ||
        propertyName.toLowerCase().includes(searchLower)
      );
    });
  }, [recommendations, debouncedSearch, propertiesMap]);

  const handleConvert = async (recommendationId) => {
    try {
      await convertMutation.mutateAsync({ url: `/recommendations/${recommendationId}/convert`, method: 'post' });
      toast.success('Recommendation converted to job successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to convert recommendation');
    }
  };

  const handleApprove = async (recommendationId) => {
    try {
      await approveMutation.mutateAsync({ url: `/recommendations/${recommendationId}/approve`, method: 'post' });
      toast.success('Recommendation approved successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to approve recommendation');
    }
  };

  const handleReject = (recommendationId) => {
    setRejectingRecommendationId(recommendationId);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectDialogClose = () => {
    setRejectDialogOpen(false);
    setRejectingRecommendationId(null);
    setRejectionReason('');
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason || !rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        url: `/recommendations/${rejectingRecommendationId}/reject`,
        method: 'post',
        data: { rejectionReason: rejectionReason.trim() },
      });
      toast.success('Recommendation rejected');
      handleRejectDialogClose();
    } catch (error) {
      const errorMessage = error?.response?.data?.message || 'Failed to reject recommendation';
      toast.error(errorMessage);
    }
  };

  const handleCreate = () => {
    setWizardOpen(true);
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
  };

  const handleViewModeChange = (event, newViewMode) => {
    if (newViewMode !== null) {
      setViewMode(newViewMode);
      try {
        localStorage.setItem('recommendations-view-mode', newViewMode);
      } catch (err) {
        // Ignore localStorage errors
      }
    }
  };

  const hasFilters = debouncedSearch || priorityFilter || statusFilter;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <PageShell
        title={t('recommendations.title', 'Recommendations')}
        subtitle="Create job recommendations for property owners to review and approve."
        actions={
          user?.role === 'PROPERTY_MANAGER' ? (
            <GradientButton
              startIcon={<AddIcon />}
              onClick={handleCreate}
              size="large"
              sx={{ width: { xs: '100%', md: 'auto' } }}
            >
              Create Recommendation
            </GradientButton>
          ) : null
        }
        contentSpacing={{ xs: 3, md: 3 }}
      >
        {/* Filters */}
        <Paper
          sx={{
            p: { xs: 2, md: 3.5 },
            mb: 3,
            borderRadius: 3,
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
              placeholder="Search recommendations..."
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

            {/* Priority Filter */}
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priorityFilter}
                label="Priority"
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Status Filter */}
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Include Archived Checkbox */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" sx={{ userSelect: 'none' }}>
                  Show Archived
                </Typography>
              }
              sx={{ ml: { xs: 0, lg: 1 } }}
            />

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

        {(convertMutation.isError || approveMutation.isError || rejectMutation.isError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {convertMutation.error?.message || approveMutation.error?.message || rejectMutation.error?.message}
          </Alert>
        )}

        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={!query.isLoading && !query.isError && filteredRecommendations.length === 0}
          onRetry={query.refetch}
        >
          {filteredRecommendations.length === 0 ? (
            <EmptyState
              icon={LightbulbIcon}
              iconColor="#dc2626"
              iconBackground="linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)"
              iconBorderColor="rgba(220, 38, 38, 0.2)"
              iconShadow="0 4px 14px 0 rgb(220 38 38 / 0.15)"
              title={hasFilters ? 'No recommendations match your filters' : 'No recommendations yet'}
              description={
                hasFilters
                  ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                  : user?.role === 'PROPERTY_MANAGER'
                    ? 'Start managing job recommendations for your properties. Share maintenance suggestions with property owners for their review and approval.'
                    : 'No recommendations have been created yet. Property managers can create recommendations for you to review.'
              }
              actionLabel={hasFilters || user?.role !== 'PROPERTY_MANAGER' ? undefined : 'Create Recommendation'}
              onAction={hasFilters || user?.role !== 'PROPERTY_MANAGER' ? undefined : handleCreate}
            />
          ) : (
            <Stack spacing={3}>
              {/* Grid View */}
              {viewMode === 'grid' && (
                <Grid container spacing={{ xs: 2, md: 3 }}>
                  {filteredRecommendations.map((recommendation) => {
                    const property = recommendation.property || propertiesMap.get(recommendation.propertyId);
                    const propertyName = property?.name || 'N/A';
                    return (
                      <Grid item xs={12} sm={6} md={4} key={recommendation.id}>
                        <Card
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
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
                        >
                          <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
                                {recommendation.title}
                              </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <HomeIcon fontSize="small" color="action" />
                              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
                                {propertyName}
                              </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {recommendation.priority && (
                                <Chip
                                  size="small"
                                  label={recommendation.priority}
                                  color={getPriorityColor(recommendation.priority)}
                                />
                              )}
                              {recommendation.status && (
                                <Chip
                                  size="small"
                                  label={recommendation.status.replace(/_/g, ' ')}
                                  color={getStatusColor(recommendation.status)}
                                />
                              )}
                            </Box>

                            {recommendation.estimatedCost && (
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                ${recommendation.estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            )}

                            {recommendation.status === 'REJECTED' && recommendation.rejectionReason && (
                              <Alert severity="error" sx={{ mt: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>Rejection Reason:</Typography>
                                <Typography variant="body2">{recommendation.rejectionReason}</Typography>
                              </Alert>
                            )}

                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                flexGrow: 1,
                              }}
                            >
                              {recommendation.description}
                            </Typography>
                          </CardContent>

                          <CardActions sx={{ px: 2, pb: 2, pt: 0, flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
                            <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                              {user?.role === 'OWNER' &&
                                (recommendation.status === 'SUBMITTED' || recommendation.status === 'UNDER_REVIEW') && (
                                  <>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      startIcon={<CancelIcon />}
                                      onClick={() => handleReject(recommendation.id)}
                                      disabled={rejectMutation.isPending || approveMutation.isPending}
                                      fullWidth
                                    >
                                      Reject
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="success"
                                      startIcon={<CheckCircleIcon />}
                                      onClick={() => handleApprove(recommendation.id)}
                                      disabled={rejectMutation.isPending || approveMutation.isPending}
                                      fullWidth
                                    >
                                      Approve
                                    </Button>
                                  </>
                                )}

                              {user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'APPROVED' && (
                                <GradientButton
                                  size="small"
                                  onClick={() => handleConvert(recommendation.id)}
                                  disabled={convertMutation.isPending}
                                  fullWidth
                                >
                                  Convert to job
                                </GradientButton>
                              )}
                            </Stack>
                          </CardActions>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}

              {/* List View */}
              {viewMode === 'list' && !isMobile && (
                <Stack spacing={2}>
                  {filteredRecommendations.map((recommendation) => {
                    const property = recommendation.property || propertiesMap.get(recommendation.propertyId);
                    const propertyName = property?.name || 'N/A';
                    return (
                      <Card
                        key={recommendation.id}
                        sx={{
                          display: 'flex',
                          flexDirection: { xs: 'column', md: 'row' },
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: 'divider',
                          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                          overflow: 'hidden',
                          '&:hover': {
                            boxShadow: 3,
                          },
                        }}
                      >
                        <CardContent sx={{ flex: 1, p: 3 }}>
                          <Stack spacing={2}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                  {recommendation.title}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                  <HomeIcon fontSize="small" color="action" />
                                  <Typography variant="body2" color="text.secondary">
                                    {propertyName}
                                  </Typography>
                                </Box>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {recommendation.priority && (
                                  <Chip
                                    size="small"
                                    label={recommendation.priority}
                                    color={getPriorityColor(recommendation.priority)}
                                  />
                                )}
                                {recommendation.status && (
                                  <Chip
                                    size="small"
                                    label={recommendation.status.replace(/_/g, ' ')}
                                    color={getStatusColor(recommendation.status)}
                                  />
                                )}
                              </Box>
                            </Box>

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
                              {recommendation.description}
                            </Typography>

                            {recommendation.status === 'REJECTED' && recommendation.rejectionReason && (
                              <Alert severity="error" sx={{ mt: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>Rejection Reason:</Typography>
                                <Typography variant="body2">{recommendation.rejectionReason}</Typography>
                              </Alert>
                            )}

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              {recommendation.estimatedCost && (
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                  ${recommendation.estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Typography>
                              )}
                              <Stack direction="row" spacing={1}>
                                {user?.role === 'OWNER' &&
                                  (recommendation.status === 'SUBMITTED' || recommendation.status === 'UNDER_REVIEW') && (
                                    <>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        startIcon={<CancelIcon />}
                                        onClick={() => handleReject(recommendation.id)}
                                        disabled={rejectMutation.isPending || approveMutation.isPending}
                                      >
                                        Reject
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="success"
                                        startIcon={<CheckCircleIcon />}
                                        onClick={() => handleApprove(recommendation.id)}
                                        disabled={rejectMutation.isPending || approveMutation.isPending}
                                      >
                                        Approve
                                      </Button>
                                    </>
                                  )}

                                {user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'APPROVED' && (
                                  <GradientButton
                                    size="small"
                                    onClick={() => handleConvert(recommendation.id)}
                                    disabled={convertMutation.isPending}
                                  >
                                    Convert to job
                                  </GradientButton>
                                )}
                              </Stack>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              )}

              {/* Mobile Card View */}
              {isMobile && (
                <Stack spacing={2}>
                  {filteredRecommendations.map((recommendation) => {
                    const property = recommendation.property || propertiesMap.get(recommendation.propertyId);
                    const propertyName = property?.name || 'N/A';
                    return (
                      <Card key={recommendation.id} sx={{ boxShadow: 2 }}>
                        <CardContent sx={{ p: 2.5 }}>
                          <Stack spacing={2}>
                            {/* Header Row */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                  Title
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5, wordBreak: 'break-word' }}>
                                  {recommendation.title}
                                </Typography>
                              </Box>
                              {recommendation.status && (
                                <Chip
                                  label={recommendation.status.replace(/_/g, ' ')}
                                  color={getStatusColor(recommendation.status)}
                                  size="small"
                                  sx={{ flexShrink: 0 }}
                                />
                              )}
                            </Box>
                            <Divider />

                            {/* Property */}
                            <Box>
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                Property
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <HomeIcon fontSize="small" color="action" />
                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                  {propertyName}
                                </Typography>
                              </Box>
                            </Box>

                            {/* Priority */}
                            {recommendation.priority && (
                              <Box>
                                <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                  Priority
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  <Chip
                                    label={recommendation.priority}
                                    color={getPriorityColor(recommendation.priority)}
                                    size="small"
                                  />
                                </Box>
                              </Box>
                            )}

                            {/* Estimated Cost */}
                            {recommendation.estimatedCost && (
                              <Box>
                                <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                  Estimated Cost
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', mt: 0.5 }}>
                                  ${recommendation.estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Typography>
                              </Box>
                            )}

                            {/* Description */}
                            <Box>
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                Description
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
                                {recommendation.description}
                              </Typography>
                            </Box>

                            {/* Rejection Reason */}
                            {recommendation.status === 'REJECTED' && recommendation.rejectionReason && (
                              <Alert severity="error">
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>Rejection Reason:</Typography>
                                <Typography variant="body2">{recommendation.rejectionReason}</Typography>
                              </Alert>
                            )}

                            <Divider />

                            {/* Actions */}
                            <Stack direction="column" spacing={1} sx={{ width: '100%' }}>
                              {user?.role === 'OWNER' &&
                                (recommendation.status === 'SUBMITTED' || recommendation.status === 'UNDER_REVIEW') && (
                                  <>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="success"
                                      startIcon={<CheckCircleIcon />}
                                      onClick={() => handleApprove(recommendation.id)}
                                      disabled={rejectMutation.isPending || approveMutation.isPending}
                                      fullWidth
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      startIcon={<CancelIcon />}
                                      onClick={() => handleReject(recommendation.id)}
                                      disabled={rejectMutation.isPending || approveMutation.isPending}
                                      fullWidth
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}

                              {user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'APPROVED' && (
                                <GradientButton
                                  size="small"
                                  onClick={() => handleConvert(recommendation.id)}
                                  disabled={convertMutation.isPending}
                                  fullWidth
                                >
                                  Convert to job
                                </GradientButton>
                              )}
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              )}

              {/* Table View - Desktop only */}
              {viewMode === 'table' && !isMobile && (
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
                          <TableCell>Title</TableCell>
                          <TableCell>Property</TableCell>
                          <TableCell>Priority</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Estimated Cost</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredRecommendations.map((recommendation) => {
                          const property = recommendation.property || propertiesMap.get(recommendation.propertyId);
                          const propertyName = property?.name || 'N/A';
                          return (
                            <TableRow key={recommendation.id}>
                              <TableCell>{recommendation.title}</TableCell>
                              <TableCell>{propertyName}</TableCell>
                              <TableCell>
                                {recommendation.priority && (
                                  <Chip
                                    size="small"
                                    label={recommendation.priority}
                                    color={getPriorityColor(recommendation.priority)}
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {recommendation.status && (
                                  <Chip
                                    size="small"
                                    label={recommendation.status.replace(/_/g, ' ')}
                                    color={getStatusColor(recommendation.status)}
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {recommendation.estimatedCost
                                  ? `$${recommendation.estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ maxWidth: 300 }}>
                                  <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {recommendation.description}
                                  </Typography>
                                  {recommendation.status === 'REJECTED' && recommendation.rejectionReason && (
                                    <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Rejection Reason:</Typography>
                                      <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{recommendation.rejectionReason}</Typography>
                                    </Alert>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                  {user?.role === 'OWNER' &&
                                    (recommendation.status === 'SUBMITTED' || recommendation.status === 'UNDER_REVIEW') && (
                                      <>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          color="error"
                                          startIcon={<CancelIcon />}
                                          onClick={() => handleReject(recommendation.id)}
                                          disabled={rejectMutation.isPending || approveMutation.isPending}
                                        >
                                          Reject
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="contained"
                                          color="success"
                                          startIcon={<CheckCircleIcon />}
                                          onClick={() => handleApprove(recommendation.id)}
                                          disabled={rejectMutation.isPending || approveMutation.isPending}
                                        >
                                          Approve
                                        </Button>
                                      </>
                                    )}

                                  {user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'APPROVED' && (
                                    <GradientButton
                                      size="small"
                                      onClick={() => handleConvert(recommendation.id)}
                                      disabled={convertMutation.isPending}
                                    >
                                      Convert to job
                                    </GradientButton>
                                  )}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}
            </Stack>
          )}
        </DataState>
      </PageShell>

      {/* Recommendation Wizard */}
      {user?.role === 'PROPERTY_MANAGER' && (
        <RecommendationWizard open={wizardOpen} onClose={handleWizardClose} />
      )}

      {/* Rejection Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={handleRejectDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Reject Recommendation</Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleRejectDialogClose}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide a detailed reason for rejecting this recommendation. This will help the property manager understand your decision.
          </Typography>
          <TextField
            autoFocus
            multiline
            rows={4}
            fullWidth
            label="Rejection Reason"
            placeholder="Enter your reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            required
            error={!rejectionReason.trim() && rejectionReason.length > 0}
            helperText={
              !rejectionReason.trim() && rejectionReason.length > 0
                ? 'Rejection reason is required'
                : 'Required field'
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleRejectDialogClose} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleRejectSubmit}
            variant="contained"
            color="error"
            disabled={!rejectionReason.trim() || rejectMutation.isPending}
          >
            {rejectMutation.isPending ? 'Rejecting...' : 'Reject Recommendation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
