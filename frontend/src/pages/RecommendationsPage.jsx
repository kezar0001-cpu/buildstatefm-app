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
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Lightbulb as LightbulbIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
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
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);

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
    return params.toString();
  }, [debouncedSearch, priorityFilter, statusFilter]);

  const query = useApiQuery({
    queryKey: queryKeys.recommendations.list({ search: debouncedSearch, priority: priorityFilter, status: statusFilter }),
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
      const property = propertiesMap.get(rec.report?.inspection?.propertyId);
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

  const handleReject = async (recommendationId) => {
    const rejectionReason = window.prompt('Please provide a reason for rejection:');
    if (!rejectionReason || !rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        url: `/recommendations/${recommendationId}/reject`,
        method: 'post',
        data: { rejectionReason: rejectionReason.trim() },
      });
      toast.success('Recommendation rejected');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to reject recommendation');
    }
  };

  const handleCreate = () => {
    setWizardOpen(true);
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
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
              title={hasFilters ? 'No recommendations match your filters' : 'No recommendations yet'}
              description={
                hasFilters
                  ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                  : user?.role === 'PROPERTY_MANAGER'
                    ? 'Get started by creating your first job recommendation. Share maintenance suggestions with property owners for their review and approval.'
                    : 'No recommendations have been created yet. Property managers can create recommendations for you to review.'
              }
              actionLabel={hasFilters || user?.role !== 'PROPERTY_MANAGER' ? undefined : 'Create First Recommendation'}
              onAction={hasFilters || user?.role !== 'PROPERTY_MANAGER' ? undefined : handleCreate}
            />
          ) : (
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
                      const property = propertiesMap.get(recommendation.report?.inspection?.propertyId);
                      const propertyName = property?.name || recommendation.report?.inspection?.propertyId || 'N/A';
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
                            <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {recommendation.description}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              {/* Owner actions: Approve/Reject */}
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

                              {/* Property Manager actions: Convert to job */}
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
        </DataState>
      </PageShell>

      {/* Recommendation Wizard */}
      {user?.role === 'PROPERTY_MANAGER' && (
        <RecommendationWizard open={wizardOpen} onClose={handleWizardClose} />
      )}
    </Container>
  );
}
