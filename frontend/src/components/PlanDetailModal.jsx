import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CalendarToday as CalendarTodayIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Work as WorkIcon,
  AutoMode as AutoModeIcon,
  Info as InfoIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { format } from 'date-fns';
import { queryKeys } from '../utils/queryKeys.js';
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import MaintenancePlanForm from './MaintenancePlanForm';

const PlanDetailModal = ({ planId, open, onClose }) => {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  // Fetch plan details
  const {
    data: plan,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.plans.detail(planId),
    queryFn: async () => {
      const response = await apiClient.get(`/plans/${planId}`);
      return response.data;
    },
    enabled: open && !!planId,
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.patch(`/plans/${planId}/archive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.detail(planId) });
      toast.success('Plan archived');
      setIsArchiveDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to archive plan');
      setIsArchiveDialogOpen(false);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.patch(`/plans/${planId}/unarchive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.detail(planId) });
      toast.success('Plan restored');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to restore plan');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() });
      toast.success('Maintenance plan deleted successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete plan');
    },
  });

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate();
    setIsDeleteDialogOpen(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const isArchived = !!plan?.archivedAt;

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.detail(planId) });
    toast.success('Maintenance plan updated successfully');
    setIsEditing(false);
  };

  const handleFormCancel = () => {
    setIsEditing(false);
  };

  const getStatusColor = (status) => {
    return status ? 'success' : 'default';
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

  const getJobStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'IN_PROGRESS':
        return 'info';
      case 'OPEN':
        return 'default';
      case 'ASSIGNED':
        return 'primary';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  if (!open) return null;

  if (isLoading) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
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
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
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
        <DialogContent>
          <Alert severity="error">
            {error.response?.data?.message || 'Failed to load plan details'}
          </Alert>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, md: 3 },
            pb: { xs: 2, md: 2 },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1, sm: 0 },
          }}
        >
          <Button onClick={onClose} fullWidth={isMobile} sx={{ minHeight: { xs: 48, md: 36 } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (isEditing) {
    return (
      <Dialog
        open={open}
        onClose={handleFormCancel}
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
          plan={plan}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </Dialog>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
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
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h5" component="span">
                {plan?.name}
              </Typography>
              <Chip
                label={isArchived ? 'Archived' : plan?.isActive ? 'Active' : 'Inactive'}
                color={isArchived ? 'default' : getStatusColor(plan?.isActive)}
                size="small"
              />
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {isArchived && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This maintenance plan has been archived and is read-only.
            </Alert>
          )}
          <Grid container spacing={3}>
            {/* Left Column: Core Details */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Plan Details
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PlaceIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Property
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {plan?.property?.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {plan?.property?.address}, {plan?.property?.city}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ScheduleIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Frequency
                    </Typography>
                    <Chip
                      label={getFrequencyLabel(plan?.frequency)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Assigned Technician
                    </Typography>
                    <Chip
                      label={
                        plan?.assignedTo
                          ? `${plan.assignedTo.firstName} ${plan.assignedTo.lastName}`
                          : 'Unassigned'
                      }
                      size="small"
                      color={plan?.assignedTo ? 'primary' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CalendarTodayIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Next Due Date
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {plan?.nextDueDate
                        ? format(new Date(plan.nextDueDate), 'PPP')
                        : 'Not scheduled'}
                    </Typography>
                  </Box>
                </Box>

                {plan?.lastCompletedDate && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Last Completed
                        </Typography>
                        <Typography variant="body1">
                          {format(new Date(plan.lastCompletedDate), 'PPP')}
                        </Typography>
                      </Box>
                    </Box>
                  </>
                )}

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AutoModeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Auto-create Jobs
                    </Typography>
                    <Chip
                      label={plan?.autoCreateJobs ? 'Enabled' : 'Disabled'}
                      size="small"
                      color={plan?.autoCreateJobs ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                </Box>

                {plan?.description && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                      <InfoIcon sx={{ mr: 1, color: 'text.secondary', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Description
                        </Typography>
                        <Typography variant="body2">{plan.description}</Typography>
                      </Box>
                    </Box>
                  </>
                )}
              </Paper>
            </Grid>

            {/* Right Column: Related Jobs */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    Related Jobs
                  </Typography>
                  <Chip
                    label={`${plan?.jobs?.length || 0} jobs`}
                    size="small"
                    color="primary"
                  />
                </Box>

                {plan?.jobs && plan.jobs.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {plan.jobs.map((job) => (
                          <TableRow key={job.id} hover>
                            <TableCell>
                              <Typography variant="body2" noWrap>
                                {job.title}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={job.status.replace('_', ' ')}
                                size="small"
                                color={getJobStatusColor(job.status)}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {job.scheduledDate
                                  ? format(new Date(job.scheduledDate), 'MMM d')
                                  : 'N/A'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info" variant="outlined">
                    No jobs have been created from this plan yet.
                  </Alert>
                )}
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, md: 3 },
            pb: { xs: 2, md: 2 },
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: { xs: 1, sm: 1 },
          }}
        >
          <Button
            onClick={handleDelete}
            color="error"
            startIcon={<DeleteIcon />}
            disabled={deleteMutation.isPending}
            fullWidth={isMobile}
            sx={{ minHeight: { xs: 48, md: 36 } }}
          >
            Delete Plan
          </Button>
          <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
          <Button onClick={onClose} fullWidth={isMobile} sx={{ minHeight: { xs: 48, md: 36 } }}>
            Close
          </Button>
          {!isArchived ? (
            <Button
              onClick={() => setIsArchiveDialogOpen(true)}
              variant="outlined"
              startIcon={<ArchiveIcon />}
              disabled={archiveMutation.isPending}
              fullWidth={isMobile}
              sx={{ minHeight: { xs: 48, md: 36 } }}
            >
              Archive
            </Button>
          ) : (
            <Button
              onClick={() => unarchiveMutation.mutate()}
              variant="outlined"
              startIcon={<UnarchiveIcon />}
              disabled={unarchiveMutation.isPending}
              fullWidth={isMobile}
              sx={{ minHeight: { xs: 48, md: 36 } }}
            >
              Restore
            </Button>
          )}
          <Button
            onClick={handleEdit}
            variant="contained"
            startIcon={<EditIcon />}
            disabled={isArchived}
            fullWidth={isMobile}
            sx={{ minHeight: { xs: 48, md: 36 } }}
          >
            Edit Plan
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Maintenance Plan"
        message={`Are you sure you want to delete "${plan?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        severity="error"
      />

      <ConfirmDialog
        open={isArchiveDialogOpen}
        onClose={() => setIsArchiveDialogOpen(false)}
        onConfirm={() => archiveMutation.mutate()}
        title="Archive Maintenance Plan"
        message={`Archive "${plan?.name}"? You can restore it later by enabling Show Archived.`}
        confirmText="Archive"
        severity="warning"
      />
    </>
  );
};

export default PlanDetailModal;
