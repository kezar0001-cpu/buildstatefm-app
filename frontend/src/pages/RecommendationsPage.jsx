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
  DialogContentText,
  DialogActions,
  Skeleton,
  CircularProgress,
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
  ViewKanban as ViewKanbanIcon,
  TableChart as TableChartIcon,
  Home as HomeIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
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
import ConvertToJobDialog from '../components/ConvertToJobDialog';
import RecommendationDetailModal from '../components/RecommendationDetailModal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
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
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [respondingRecommendationId, setRespondingRecommendationId] = useState(null);
  const [managerResponse, setManagerResponse] = useState('');
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertingRecommendation, setConvertingRecommendation] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [modalEditMode, setModalEditMode] = useState(false);
  const [modalDeleteDialog, setModalDeleteDialog] = useState(false);
  const [selectedRecommendationIds, setSelectedRecommendationIds] = useState([]);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [recommendationToDelete, setRecommendationToDelete] = useState(null);

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

  const respondMutation = useApiMutation({
    url: '/recommendations/:id/respond',
    method: 'post',
    invalidateKeys: [queryKeys.recommendations.all()],
  });

  const deleteMutation = useApiMutation({
    url: '/recommendations/:id',
    method: 'delete',
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

  // Note: Archiving is handled by backend cron job, not frontend
  // The backend automatically archives rejected recommendations after 24 hours

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

  // Helper function to determine if current user can approve/reject a recommendation
  const canApproveOrReject = (recommendation) => {
    if (!recommendation || !user) return false;

    // Only allow for SUBMITTED or UNDER_REVIEW status
    if (recommendation.status !== 'SUBMITTED' && recommendation.status !== 'UNDER_REVIEW') {
      return false;
    }

    const property = recommendation.property;
    if (!property) return false;

    // Check if property has active owners
    const activeOwners = property.owners?.filter(po =>
      !po.endDate || new Date(po.endDate) > new Date()
    ) || [];
    const hasActiveOwners = activeOwners.length > 0;

    // Owners can approve/reject if they own the property
    if (user.role === 'OWNER') {
      return activeOwners.some(o => o.ownerId === user.id);
    }

    // Property managers can approve/reject ONLY if property has no active owners
    if (user.role === 'PROPERTY_MANAGER') {
      return !hasActiveOwners && property.managerId === user.id;
    }

    return false;
  };

  const handleConvert = (recommendation) => {
    setConvertingRecommendation(recommendation);
    setConvertDialogOpen(true);
  };

  const handleConvertDialogClose = () => {
    setConvertDialogOpen(false);
    setConvertingRecommendation(null);
  };

  const handleConvertSuccess = () => {
    handleConvertDialogClose();
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

  const handleRespond = (recommendationId) => {
    setRespondingRecommendationId(recommendationId);
    setManagerResponse('');
    setRespondDialogOpen(true);
  };

  const handleRespondDialogClose = () => {
    setRespondDialogOpen(false);
    setRespondingRecommendationId(null);
    setManagerResponse('');
  };

  const handleRespondSubmit = async () => {
    if (!managerResponse || !managerResponse.trim()) {
      toast.error('Response is required');
      return;
    }
    try {
      await respondMutation.mutateAsync({
        url: `/recommendations/${respondingRecommendationId}/respond`,
        method: 'post',
        data: { managerResponse: managerResponse.trim() },
      });
      toast.success('Response sent successfully');
      handleRespondDialogClose();
    } catch (error) {
      const errorMessage = error?.response?.data?.message || 'Failed to send response';
      toast.error(errorMessage);
    }
  };

  const handleCreate = () => {
    setWizardOpen(true);
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
  };

  const handleViewDetails = (recommendation) => {
    setSelectedRecommendation(recommendation);
    setModalEditMode(false);
    setModalDeleteDialog(false);
    setDetailModalOpen(true);
  };

  const handleEditRecommendation = (recommendation) => {
    setSelectedRecommendation(recommendation);
    setModalEditMode(true);
    setModalDeleteDialog(false);
    setDetailModalOpen(true);
  };

  const handleDeleteRecommendation = (recommendation) => {
    setRecommendationToDelete(recommendation);
    setDeleteConfirmDialogOpen(true);
  };

  const handleDeleteConfirmClose = () => {
    setDeleteConfirmDialogOpen(false);
    setRecommendationToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!recommendationToDelete) return;

    try {
      await deleteMutation.mutateAsync({
        url: `/recommendations/${recommendationToDelete.id}`,
        method: 'delete',
      });
      toast.success('Recommendation deleted successfully');
      handleDeleteConfirmClose();
      query.refetch();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to delete recommendation');
    }
  };

  const handleDetailModalClose = () => {
    setDetailModalOpen(false);
    setSelectedRecommendation(null);
    setModalEditMode(false);
    setModalDeleteDialog(false);
  };

  const handleRecommendationUpdate = () => {
    query.refetch();
  };

  const handleRecommendationDelete = () => {
    query.refetch();
    handleDetailModalClose();
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

  const handleToggleRecommendationSelection = (recommendationId) => {
    setSelectedRecommendationIds((prev) => {
      if (prev.includes(recommendationId)) {
        return prev.filter((id) => id !== recommendationId);
      }
      return [...prev, recommendationId];
    });
  };

  const handleToggleSelectAllVisible = (event) => {
    const { checked } = event.target;
    if (checked) {
      setSelectedRecommendationIds(filteredRecommendations.map((rec) => rec.id));
    } else {
      setSelectedRecommendationIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecommendationIds.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedRecommendationIds.length} recommendation(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      // Delete all selected recommendations in parallel
      const deletePromises = selectedRecommendationIds.map((id) =>
        deleteMutation.mutateAsync({
          url: `/recommendations/${id}`,
          method: 'delete',
        })
      );

      await Promise.all(deletePromises);
      toast.success(`Successfully deleted ${selectedRecommendationIds.length} recommendation(s)`);
      setSelectedRecommendationIds([]);
      query.refetch();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to delete some recommendations');
      // Still clear selection even if some failed
      setSelectedRecommendationIds([]);
    }
  };

  const hasFilters = debouncedSearch || priorityFilter || statusFilter;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <PageShell
        title={t('recommendations.title', 'Recommendations')}
        subtitle="Create job recommendations for property owners to review and approve."
        actions={
          (user?.role === 'PROPERTY_MANAGER' || user?.role === 'TECHNICIAN') ? (
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
                <ToggleButton value="list" aria-label="kanban view">
                  <Tooltip title="Kanban View">
                    <ViewKanbanIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="table" aria-label="table view">
                  <Tooltip title="Table View">
                    <TableChartIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            )}

            {/* Clear Filters Button */}
            {hasFilters && (
              <Button
                variant="text"
                color="inherit"
                size="small"
                onClick={() => {
                  setSearchInput('');
                  setPriorityFilter('');
                  setStatusFilter('');
                }}
                sx={{ textTransform: 'none', minWidth: 'auto' }}
                startIcon={<CloseIcon />}
              >
                Clear filters
              </Button>
            )}
          </Stack>
        </Paper>

        {(convertMutation.isError || approveMutation.isError || rejectMutation.isError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {convertMutation.error?.message || approveMutation.error?.message || rejectMutation.error?.message}
          </Alert>
        )}

        {/* Loading State */}
        {query.isLoading ? (
          <Box sx={{ mt: 3 }}>
            {viewMode === 'grid' && <LoadingSkeleton variant="card" count={6} height={300} />}
            {viewMode === 'list' && (
              <Grid container spacing={2}>
                {['Submitted', 'Under Review', 'Approved', 'Rejected'].map((column, idx) => (
                  <Grid item xs={12} sm={6} md={3} key={idx}>
                    <Box sx={{ mb: 2 }}>
                      <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
                      <Stack spacing={2}>
                        {Array.from({ length: 2 }).map((_, i) => (
                          <Card key={i} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Skeleton variant="text" width="80%" height={24} />
                            <Skeleton variant="text" width="60%" height={20} sx={{ mt: 1 }} />
                            <Skeleton variant="rectangular" width="100%" height={60} sx={{ mt: 1, borderRadius: 1 }} />
                          </Card>
                        ))}
                      </Stack>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}
            {viewMode === 'table' && <LoadingSkeleton variant="table" count={5} />}
          </Box>
        ) : query.isError ? (
          <DataState
            isError={true}
            error={query.error}
            onRetry={query.refetch}
          />
        ) : filteredRecommendations.length === 0 ? (
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
              {/* Bulk Actions Bar */}
              {selectedRecommendationIds.length > 0 && (
                <Paper
                  elevation={2}
                  sx={{
                    mb: 3,
                    px: { xs: 2, md: 3 },
                    py: { xs: 2, md: 2.5 },
                    borderRadius: { xs: 2, md: 2 },
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={{ xs: 2, md: 3 }}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Checkbox
                        color="primary"
                        checked={filteredRecommendations.length > 0 && selectedRecommendationIds.length === filteredRecommendations.length}
                        indeterminate={selectedRecommendationIds.length > 0 && selectedRecommendationIds.length < filteredRecommendations.length}
                        onChange={handleToggleSelectAllVisible}
                        inputProps={{ 'aria-label': 'Select all visible recommendations' }}
                      />
                      <Box>
                        <Typography variant="subtitle1">{selectedRecommendationIds.length} selected</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Delete selected recommendations
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={handleBulkDelete}
                        disabled={deleteMutation.isPending}
                        startIcon={deleteMutation.isPending ? <CircularProgress size={20} /> : <DeleteIcon />}
                      >
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete Selected'}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}

              {/* Grid View */}
              {viewMode === 'grid' && !isMobile && (
                <Grid container spacing={{ xs: 2, md: 3 }}>
                  {filteredRecommendations.map((recommendation) => {
                    const property = recommendation.property || propertiesMap.get(recommendation.propertyId);
                    const propertyName = property?.name || 'N/A';
                    const isSelected = selectedRecommendationIds.includes(recommendation.id);
                    return (
                      <Grid item xs={12} sm={6} md={4} key={recommendation.id}>
                        <Card
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            boxShadow: isSelected ? 4 : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '4px',
                              background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
                              opacity: isSelected ? 1 : 0,
                              transition: 'opacity 0.3s ease-in-out',
                            },
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 6,
                              borderColor: 'primary.main',
                              '&::before': {
                                opacity: 1,
                              },
                            },
                          }}
                          onClick={(e) => {
                            // Don't open modal if clicking on checkbox or its container
                            if (e.target.closest('input[type="checkbox"]') || e.target.closest('.MuiCheckbox-root')) {
                              return;
                            }
                            handleViewDetails(recommendation);
                          }}
                        >
                          <CardContent 
                            sx={{ 
                              flexGrow: 1, 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: 1.5,
                              cursor: 'pointer'
                            }}
                            onClick={() => handleViewDetails(recommendation)}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                                <Checkbox
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleRecommendationSelection(recommendation.id);
                                  }}
                                  color="primary"
                                  sx={{ p: 0.5 }}
                                  inputProps={{ 'aria-label': `Select recommendation ${recommendation.title}` }}
                                />
                                <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
                                  {recommendation.title}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                                {user?.role === 'PROPERTY_MANAGER' && (
                                  <>
                                    <Tooltip title="Edit">
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditRecommendation(recommendation);
                                        }}
                                        sx={{ color: 'text.secondary' }}
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteRecommendation(recommendation);
                                        }}
                                        sx={{ color: 'error.main' }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </Stack>
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

                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: 'action.hover',
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              <Stack spacing={1}>
                                <Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                    Property
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                    <HomeIcon fontSize="small" color="action" />
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {propertyName}
                                    </Typography>
                                  </Box>
                                </Box>

                                {recommendation.estimatedCost && (
                                  <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                      Estimated Cost
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', mt: 0.5 }}>
                                      ${recommendation.estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                  </Box>
                                )}
                              </Stack>
                            </Box>

                            {recommendation.status === 'REJECTED' && recommendation.rejectionReason && (
                              <Box sx={{ mt: 1 }}>
                                <Alert severity="error">
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>Rejection Reason:</Typography>
                                  <Typography variant="body2">{recommendation.rejectionReason}</Typography>
                                </Alert>
                                {recommendation.managerResponse && (
                                  <Alert severity="info" sx={{ mt: 1 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>Manager Response:</Typography>
                                    <Typography variant="body2">{recommendation.managerResponse}</Typography>
                                  </Alert>
                                )}
                              </Box>
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
                              {canApproveOrReject(recommendation) && (
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
                                  onClick={() => handleConvert(recommendation)}
                                  disabled={convertMutation.isPending}
                                  fullWidth
                                >
                                  Convert to job
                                </GradientButton>
                              )}

                              {user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'REJECTED' && !recommendation.managerResponse && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  onClick={() => handleRespond(recommendation.id)}
                                  disabled={respondMutation.isPending}
                                  fullWidth
                                >
                                  Respond to Rejection
                                </Button>
                              )}
                            </Stack>
                          </CardActions>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}

              {/* Kanban View */}
              {viewMode === 'list' && !isMobile && (
                <RecommendationKanban
                  recommendations={filteredRecommendations}
                  propertiesMap={propertiesMap}
                  onView={handleViewDetails}
                  onEdit={handleEditRecommendation}
                  onDelete={handleDeleteRecommendation}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onConvert={handleConvert}
                  onRespond={handleRespond}
                  canApproveOrReject={canApproveOrReject}
                  user={user}
                  getPriorityColor={getPriorityColor}
                  getStatusColor={getStatusColor}
                  approveMutation={approveMutation}
                  rejectMutation={rejectMutation}
                  convertMutation={convertMutation}
                  respondMutation={respondMutation}
                />
              )}

              {/* Legacy List View - Removed, replaced with Kanban */}
              {false && viewMode === 'list' && !isMobile && (
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
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                  <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
                                    {recommendation.title}
                                  </Typography>
                                  <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                                    {user?.role === 'PROPERTY_MANAGER' && (
                                      <>
                                        <Tooltip title="Edit">
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditRecommendation(recommendation);
                                            }}
                                            sx={{ color: 'text.secondary' }}
                                          >
                                            <EditIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteRecommendation(recommendation);
                                            }}
                                            sx={{ color: 'error.main' }}
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      </>
                                    )}
                                  </Stack>
                                </Box>
                                <Box
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 2,
                                    bgcolor: 'action.hover',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    display: 'inline-block',
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <HomeIcon fontSize="small" color="action" />
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                        Property
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {propertyName}
                                      </Typography>
                                    </Box>
                                  </Box>
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
                              <Box sx={{ mt: 1 }}>
                                <Alert severity="error">
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>Rejection Reason:</Typography>
                                  <Typography variant="body2">{recommendation.rejectionReason}</Typography>
                                </Alert>
                                {recommendation.managerResponse && (
                                  <Alert severity="info" sx={{ mt: 1 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>Manager Response:</Typography>
                                    <Typography variant="body2">{recommendation.managerResponse}</Typography>
                                  </Alert>
                                )}
                              </Box>
                            )}

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              {recommendation.estimatedCost && (
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                  ${recommendation.estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Typography>
                              )}
                              <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                                {canApproveOrReject(recommendation) && (
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
                                    onClick={() => handleConvert(recommendation)}
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
                    const isSelected = selectedRecommendationIds.includes(recommendation.id);
                    return (
                      <Card 
                        key={recommendation.id} 
                        sx={{ 
                          boxShadow: isSelected ? 4 : 2, 
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          overflow: 'hidden',
                          position: 'relative',
                          transition: 'all 0.3s ease-in-out',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '4px',
                            background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
                            opacity: isSelected ? 1 : 0,
                            transition: 'opacity 0.3s ease-in-out',
                          },
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 6,
                            borderColor: 'primary.main',
                            '&::before': {
                              opacity: 1,
                            },
                          },
                        }}
                        onClick={(e) => {
                          // Don't open modal if clicking on checkbox or its container
                          if (e.target.closest('input[type="checkbox"]') || e.target.closest('.MuiCheckbox-root')) {
                            return;
                          }
                          handleViewDetails(recommendation);
                        }}
                      >
                        <CardContent sx={{ p: 2.5 }}>
                          <Stack spacing={2}>
                            {/* Header Row */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Checkbox
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleToggleRecommendationSelection(recommendation.id);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    color="primary"
                                    sx={{ p: 0.5 }}
                                    inputProps={{ 'aria-label': `Select recommendation ${recommendation.title}` }}
                                  />
                                  <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                    Title
                                  </Typography>
                                </Box>
                                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5, wordBreak: 'break-word' }}>
                                  {recommendation.title}
                                </Typography>
                                {recommendation.status && (
                                  <Chip
                                    label={recommendation.status.replace(/_/g, ' ')}
                                    color={getStatusColor(recommendation.status)}
                                    size="small"
                                    sx={{ mt: 1 }}
                                  />
                                )}
                              </Box>
                              <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                                {user?.role === 'PROPERTY_MANAGER' && (
                                  <>
                                    <Tooltip title="Edit">
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditRecommendation(recommendation);
                                        }}
                                        sx={{ color: 'text.secondary' }}
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteRecommendation(recommendation);
                                        }}
                                        sx={{ color: 'error.main' }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </Stack>
                            </Box>
                            <Divider />

                            {/* Property */}
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: 'action.hover',
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                Property
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <HomeIcon fontSize="small" color="action" />
                                <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
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

                            {/* Actions */}
                            {(canApproveOrReject(recommendation) ||
                              (user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'APPROVED') ||
                              (user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'REJECTED' && !recommendation.managerResponse)) && (
                              <>
                                <Divider />
                                <Stack direction="column" spacing={1} sx={{ width: '100%' }}>
                                  {canApproveOrReject(recommendation) && (
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
                                      onClick={() => handleConvert(recommendation)}
                                      disabled={convertMutation.isPending}
                                      fullWidth
                                    >
                                      Convert to job
                                    </GradientButton>
                                  )}

                                  {user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'REJECTED' && !recommendation.managerResponse && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="primary"
                                      onClick={() => handleRespond(recommendation.id)}
                                      disabled={respondMutation.isPending}
                                      fullWidth
                                    >
                                      Respond to Rejection
                                    </Button>
                                  )}
                                </Stack>
                              </>
                            )}
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
                          <TableCell padding="checkbox">
                            <Checkbox
                              color="primary"
                              checked={filteredRecommendations.length > 0 && selectedRecommendationIds.length === filteredRecommendations.length}
                              indeterminate={selectedRecommendationIds.length > 0 && selectedRecommendationIds.length < filteredRecommendations.length}
                              onChange={handleToggleSelectAllVisible}
                              inputProps={{ 'aria-label': 'Select all visible recommendations' }}
                            />
                          </TableCell>
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
                          const isSelected = selectedRecommendationIds.includes(recommendation.id);
                          return (
                            <TableRow 
                              key={recommendation.id}
                              hover
                              sx={{ cursor: 'pointer' }}
                              onClick={() => handleViewDetails(recommendation)}
                            >
                              <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleRecommendationSelection(recommendation.id);
                                  }}
                                  color="primary"
                                  inputProps={{ 'aria-label': `Select recommendation ${recommendation.title}` }}
                                />
                              </TableCell>
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
                                    <Box>
                                      <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Rejection Reason:</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{recommendation.rejectionReason}</Typography>
                                      </Alert>
                                      {recommendation.managerResponse && (
                                        <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
                                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Manager Response:</Typography>
                                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{recommendation.managerResponse}</Typography>
                                        </Alert>
                                      )}
                                    </Box>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                  {user?.role === 'PROPERTY_MANAGER' && (
                                    <>
                                      <Tooltip title="Edit">
                                        <IconButton
                                          size="small"
                                          onClick={() => handleViewDetails(recommendation)}
                                          sx={{ color: 'text.secondary' }}
                                        >
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Delete">
                                        <IconButton
                                          size="small"
                                          onClick={() => handleViewDetails(recommendation)}
                                          sx={{ color: 'error.main' }}
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  )}
                                  {canApproveOrReject(recommendation) && (
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
                                      onClick={() => handleConvert(recommendation)}
                                      disabled={convertMutation.isPending}
                                    >
                                      Convert to job
                                    </GradientButton>
                                  )}

                                  {user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'REJECTED' && !recommendation.managerResponse && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="primary"
                                      onClick={() => handleRespond(recommendation.id)}
                                      disabled={respondMutation.isPending}
                                    >
                                      Respond
                                    </Button>
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
      </PageShell>

      {/* Recommendation Wizard */}
      {(user?.role === 'PROPERTY_MANAGER' || user?.role === 'TECHNICIAN') && (
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

      {/* Manager Response Dialog */}
      <Dialog
        open={respondDialogOpen}
        onClose={handleRespondDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Respond to Rejection</Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleRespondDialogClose}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Provide a response to the owner's rejection. This could include clarifications, modifications you plan to make, or additional information that addresses their concerns.
          </Typography>
          <TextField
            autoFocus
            multiline
            rows={4}
            fullWidth
            label="Your Response"
            placeholder="Enter your response to the rejection..."
            value={managerResponse}
            onChange={(e) => setManagerResponse(e.target.value)}
            required
            error={!managerResponse.trim() && managerResponse.length > 0}
            helperText={
              !managerResponse.trim() && managerResponse.length > 0
                ? 'Response is required'
                : 'Required field'
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleRespondDialogClose} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleRespondSubmit}
            variant="contained"
            color="primary"
            disabled={!managerResponse.trim() || respondMutation.isPending}
          >
            {respondMutation.isPending ? 'Sending...' : 'Send Response'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Convert to Job Dialog */}
      <ConvertToJobDialog
        open={convertDialogOpen}
        onClose={handleConvertDialogClose}
        recommendation={convertingRecommendation}
        onConvert={handleConvertSuccess}
      />

      {/* Standalone Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialogOpen}
        onClose={deleteMutation.isPending ? undefined : handleDeleteConfirmClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Delete Recommendation</Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleDeleteConfirmClose}
              aria-label="close"
              disabled={deleteMutation.isPending}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the recommendation &quot;{recommendationToDelete?.title}&quot;? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDeleteConfirmClose} variant="outlined" disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recommendation Detail Modal */}
      {selectedRecommendation && (
        <RecommendationDetailModal
          recommendation={selectedRecommendation}
          open={detailModalOpen}
          onClose={handleDetailModalClose}
          onUpdate={handleRecommendationUpdate}
          onDelete={handleRecommendationDelete}
          initialEditMode={modalEditMode}
          initialDeleteDialog={modalDeleteDialog}
        />
      )}
    </Container>
  );
}

// ============================================================================
// Recommendation Kanban Board Component
// ============================================================================

const RecommendationKanban = ({
  recommendations,
  propertiesMap,
  onView,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onConvert,
  onRespond,
  canApproveOrReject,
  user,
  getPriorityColor,
  getStatusColor,
  approveMutation,
  rejectMutation,
  convertMutation,
  respondMutation,
}) => {
  // Group recommendations by status (excluding DRAFT)
  const columns = useMemo(() => {
    const grouped = {
      SUBMITTED: [],
      UNDER_REVIEW: [],
      APPROVED: [],
      REJECTED: [],
      IMPLEMENTED: [],
      ARCHIVED: [],
    };

    recommendations.forEach(recommendation => {
      const status = recommendation.status || 'DRAFT';
      // Skip DRAFT status
      if (status !== 'DRAFT' && grouped[status]) {
        grouped[status].push(recommendation);
      }
    });

    return [
      { id: 'SUBMITTED', title: 'Submitted', recommendations: grouped.SUBMITTED, color: 'info' },
      { id: 'UNDER_REVIEW', title: 'Under Review', recommendations: grouped.UNDER_REVIEW, color: 'warning' },
      { id: 'APPROVED', title: 'Approved', recommendations: grouped.APPROVED, color: 'success' },
      { id: 'REJECTED', title: 'Rejected', recommendations: grouped.REJECTED, color: 'error' },
      { id: 'IMPLEMENTED', title: 'Implemented', recommendations: grouped.IMPLEMENTED, color: 'success' },
      { id: 'ARCHIVED', title: 'Archived', recommendations: grouped.ARCHIVED, color: 'default' },
    ];
  }, [recommendations]);

  return (
    <Grid container spacing={2}>
      {columns.map(column => (
        <Grid item xs={12} sm={6} md={4} lg={4} key={column.id}>
          <Paper
            sx={{
              p: 2,
              height: '100%',
              minHeight: 400,
              bgcolor: 'background.default',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            {/* Column Header */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                {column.title}
              </Typography>
              <Chip
                label={column.recommendations.length}
                size="small"
                color={column.color}
              />
            </Box>

            {/* Column Cards */}
            <Stack
              spacing={2}
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                pr: 0.5,
              }}
            >
              {column.recommendations.map(recommendation => {
                const property = recommendation.property || propertiesMap.get(recommendation.propertyId);
                const propertyName = property?.name || 'N/A';
                return (
                  <Card
                    key={recommendation.id}
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.3s ease-in-out',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      position: 'relative',
                      overflow: 'hidden',
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
                      '@media (hover: hover)': {
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 6,
                          borderColor: 'primary.main',
                          '&::before': {
                            opacity: 1,
                          },
                        },
                      },
                    }}
                    onClick={() => onView(recommendation)}
                  >
                    <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, '&:last-child': { pb: 2 } }}>
                      {/* Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            flex: 1,
                            pr: 1,
                            minWidth: 0,
                            wordBreak: 'break-word',
                            lineHeight: 1.25,
                          }}
                        >
                          {recommendation.title}
                        </Typography>
                        <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0 }}>
                          {user?.role === 'PROPERTY_MANAGER' && (
                            <>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(recommendation);
                                  }}
                                  sx={{ color: 'text.secondary' }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(recommendation);
                                  }}
                                  sx={{ color: 'error.main' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                      </Box>

                      {/* Priority and Status Chips */}
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

                      {/* Details - Grouped in subtle box */}
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: 'action.hover',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Stack spacing={1}>
                          {/* Property */}
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                              Property
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <HomeIcon fontSize="small" color="action" />
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {propertyName}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Estimated Cost */}
                          {recommendation.estimatedCost && (
                            <Box>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                                Estimated Cost
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', mt: 0.5 }}>
                                ${recommendation.estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Box>

                      {/* Description */}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontSize: '0.875rem',
                        }}
                      >
                        {recommendation.description}
                      </Typography>

                      {/* Rejection Reason */}
                      {recommendation.status === 'REJECTED' && recommendation.rejectionReason && (
                        <Alert severity="error" sx={{ py: 0.5, mt: 'auto' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Rejection Reason:</Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                            {recommendation.rejectionReason}
                          </Typography>
                        </Alert>
                      )}

                      {/* Actions */}
                      <Stack direction="column" spacing={1} sx={{ mt: 'auto', pt: 1 }}>
                        {canApproveOrReject(recommendation) && (
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                onReject(recommendation.id);
                              }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                onApprove(recommendation.id);
                              }}
                              disabled={rejectMutation.isPending || approveMutation.isPending}
                              fullWidth
                            >
                              Approve
                            </Button>
                          </Stack>
                        )}

                        {user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'APPROVED' && (
                          <GradientButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onConvert(recommendation);
                            }}
                            disabled={convertMutation.isPending}
                            fullWidth
                          >
                            Convert to job
                          </GradientButton>
                        )}

                        {user?.role === 'PROPERTY_MANAGER' && recommendation.status === 'REJECTED' && !recommendation.managerResponse && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRespond(recommendation.id);
                            }}
                            disabled={respondMutation.isPending}
                            fullWidth
                          >
                            Respond to Rejection
                          </Button>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};
