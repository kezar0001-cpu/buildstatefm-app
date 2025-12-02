import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  Chip,
  Paper,
  IconButton,
  ImageList,
  ImageListItem,
  List,
  ListItem,
  ListItemText,
  TextField,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Build as BuildIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from './DataState';
import { formatDateTime } from '../utils/date';
import toast from 'react-hot-toast';
import { queryKeys } from '../utils/queryKeys.js';
import { useCurrentUser } from '../context/UserContext.jsx';

const getStatusColor = (status) => {
  const colors = {
    SUBMITTED: 'warning',
    UNDER_REVIEW: 'info',
    PENDING_MANAGER_REVIEW: 'info',
    PENDING_OWNER_APPROVAL: 'warning',
    APPROVED: 'success',
    APPROVED_BY_OWNER: 'success',
    REJECTED: 'error',
    REJECTED_BY_OWNER: 'error',
    CONVERTED_TO_JOB: 'primary',
    COMPLETED: 'success',
  };
  return colors[status] || 'default';
};

const getCategoryColor = (category) => {
  const colors = {
    PLUMBING: 'info',
    ELECTRICAL: 'warning',
    HVAC: 'primary',
    APPLIANCE: 'secondary',
    STRUCTURAL: 'error',
    PEST_CONTROL: 'default',
    LANDSCAPING: 'success',
    GENERAL: 'default',
    OTHER: 'default',
  };
  return colors[category] || 'default';
};

export default function ServiceRequestDetailModal({ requestId, open, onClose }) {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const userRole = user?.role || 'TENANT';
  const [reviewNotes, setReviewNotes] = useState('');
  const [showReviewInput, setShowReviewInput] = useState(false);
  const [reviewAction, setReviewAction] = useState(null); // 'approve' or 'reject' or 'owner-approve' or 'owner-reject'
  const [approvedBudget, setApprovedBudget] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [managerEstimatedCost, setManagerEstimatedCost] = useState('');
  const [costBreakdownNotes, setCostBreakdownNotes] = useState('');

  // Fetch request details
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.serviceRequests.detail(requestId),
    queryFn: async () => {
      const response = await apiClient.get(`/service-requests/${requestId}`);
      return response.data?.request || response.data;
    },
    enabled: open && !!requestId,
  });

  // Update request mutation
  const updateMutation = useMutation({
    mutationFn: async ({ status, reviewNotes }) => {
      const response = await apiClient.patch(`/service-requests/${requestId}`, {
        status,
        reviewNotes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.detail(requestId) });
      toast.success(reviewAction === 'approve' ? 'Request approved' : 'Request rejected');
      setShowReviewInput(false);
      setReviewNotes('');
      setReviewAction(null);
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update request');
    },
  });

  // Convert to job mutation
  const convertMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/service-requests/${requestId}/convert-to-job`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.detail(requestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      toast.success('Converted to job successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to convert to job');
    },
  });

  // Manager adds cost estimate mutation
  const addEstimateMutation = useMutation({
    mutationFn: async ({ managerEstimatedCost, costBreakdownNotes }) => {
      const response = await apiClient.post(`/service-requests/${requestId}/estimate`, {
        managerEstimatedCost: parseFloat(managerEstimatedCost),
        costBreakdownNotes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.detail(requestId) });
      toast.success('Cost estimate added - awaiting owner approval');
      handleCancelReview();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add cost estimate');
    },
  });

  // Owner approval mutation
  const ownerApproveMutation = useMutation({
    mutationFn: async ({ approvedBudget }) => {
      const response = await apiClient.post(`/service-requests/${requestId}/approve`, {
        approvedBudget: approvedBudget ? parseFloat(approvedBudget) : undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.detail(requestId) });
      toast.success('Service request approved');
      handleCancelReview();
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to approve request');
    },
  });

  // Owner rejection mutation
  const ownerRejectMutation = useMutation({
    mutationFn: async ({ rejectionReason }) => {
      const response = await apiClient.post(`/service-requests/${requestId}/reject`, {
        rejectionReason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.detail(requestId) });
      toast.success('Service request rejected');
      handleCancelReview();
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to reject request');
    },
  });

  const handleApprove = () => {
    setReviewAction('approve');
    setShowReviewInput(true);
  };

  const handleReject = () => {
    setReviewAction('reject');
    setShowReviewInput(true);
  };

  const handleAddEstimate = () => {
    setReviewAction('add-estimate');
    setShowReviewInput(true);
  };

  const handleOwnerApprove = () => {
    setReviewAction('owner-approve');
    setApprovedBudget(data?.managerEstimatedCost?.toString() || '');
    setShowReviewInput(true);
  };

  const handleOwnerReject = () => {
    setReviewAction('owner-reject');
    setRejectionReason('');
    setShowReviewInput(true);
  };

  const handleSubmitReview = () => {
    if (reviewAction === 'approve' || reviewAction === 'reject') {
      if (!reviewNotes.trim()) {
        toast.error('Please enter review notes');
        return;
      }
      updateMutation.mutate({
        status: reviewAction === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewNotes: reviewNotes.trim(),
      });
    } else if (reviewAction === 'add-estimate') {
      if (!managerEstimatedCost || parseFloat(managerEstimatedCost) <= 0) {
        toast.error('Please enter a valid cost estimate');
        return;
      }
      addEstimateMutation.mutate({
        managerEstimatedCost,
        costBreakdownNotes: costBreakdownNotes.trim(),
      });
    } else if (reviewAction === 'owner-approve') {
      ownerApproveMutation.mutate({
        approvedBudget: approvedBudget || undefined,
      });
    } else if (reviewAction === 'owner-reject') {
      if (!rejectionReason.trim()) {
        toast.error('Please enter a rejection reason');
        return;
      }
      ownerRejectMutation.mutate({
        rejectionReason: rejectionReason.trim(),
      });
    }
  };

  const handleCancelReview = () => {
    setShowReviewInput(false);
    setReviewNotes('');
    setReviewAction(null);
    setApprovedBudget('');
    setRejectionReason('');
    setManagerEstimatedCost('');
    setCostBreakdownNotes('');
  };

  const handleConvert = () => {
    convertMutation.mutate();
  };

  const handleClose = () => {
    const pending = updateMutation.isPending || convertMutation.isPending || 
      addEstimateMutation.isPending || ownerApproveMutation.isPending || ownerRejectMutation.isPending;
    if (!pending) {
      handleCancelReview();
      onClose();
    }
  };

  // Determine which status steps to show based on the workflow
  const isOwnerWorkflow = data?.ownerEstimatedBudget || 
    ['PENDING_MANAGER_REVIEW', 'PENDING_OWNER_APPROVAL', 'APPROVED_BY_OWNER', 'REJECTED_BY_OWNER'].includes(data?.status);

  const standardStatusSteps = [
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'UNDER_REVIEW', label: 'Under Review' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'CONVERTED_TO_JOB', label: 'Converted to Job' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  const ownerWorkflowSteps = [
    { key: 'PENDING_MANAGER_REVIEW', label: 'Pending Review' },
    { key: 'PENDING_OWNER_APPROVAL', label: 'Owner Approval' },
    { key: 'APPROVED_BY_OWNER', label: 'Owner Approved' },
    { key: 'CONVERTED_TO_JOB', label: 'Converted to Job' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  const statusSteps = isOwnerWorkflow ? ownerWorkflowSteps : standardStatusSteps;

  const statusIndex = data ? statusSteps.findIndex((step) => step.key === data.status) : 0;
  const activeStep = statusIndex >= 0 ? statusIndex : 0;
  const isRejectedStatus = data?.status === 'REJECTED' || data?.status === 'REJECTED_BY_OWNER';
  const linkedJobs = data?.jobs || [];
  const linkedJob = linkedJobs[0]; // Assuming only one job can be linked for simplicity

  const isPendingMutation = updateMutation.isPending || convertMutation.isPending || 
    addEstimateMutation.isPending || ownerApproveMutation.isPending || ownerRejectMutation.isPending;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Service Request Details</Typography>
          <IconButton onClick={handleClose} disabled={updateMutation.isLoading || convertMutation.isLoading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <DataState isLoading={isLoading} error={error} isEmpty={!data}>
          {data && (
            <Stack spacing={3}>
              {/* Title and Status */}
              <Box>
                <Typography variant="h5" gutterBottom>
                  {data.title}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    label={data.status?.replace(/_/g, ' ')}
                    color={getStatusColor(data.status)}
                    size="small"
                  />
                  <Chip
                    label={data.category?.replace(/_/g, ' ')}
                    color={getCategoryColor(data.category)}
                    size="small"
                  />
                  {data.priority && (
                    <Chip
                      label={data.priority}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Stack>
                <Box sx={{ mt: 2 }}>
                  <Stepper activeStep={activeStep} alternativeLabel>
                    {statusSteps.map((step, index) => {
                      const isStepFailed = isRejectedStatus && step.key === 'UNDER_REVIEW';
                      const isStepCompleted = activeStep > index || (activeStep === index && !isRejectedStatus);
                      return (
                        <Step key={step.key} completed={isStepCompleted}>
                          <StepLabel error={isStepFailed}>
                            {step.label}
                          </StepLabel>
                        </Step>
                      );
                    })}
                  </Stepper>
                  {isRejectedStatus && (data.status === 'REJECTED') && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      This request was rejected. Review notes are available below.
                    </Alert>
                  )}
                </Box>
              </Box>

              {/* Description */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Description
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {data.description}
                </Typography>
              </Paper>

              {/* Photos */}
              {data.photos && data.photos.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Photos ({data.photos.length})
                  </Typography>
                  <ImageList cols={3} gap={8} sx={{ mt: 1 }}>
                    {data.photos.map((photo, index) => (
                      <ImageListItem key={index}>
                        <img
                          src={photo}
                          alt={`Photo ${index + 1}`}
                          loading="lazy"
                          style={{
                            borderRadius: 4,
                            objectFit: 'cover',
                            height: 150,
                          }}
                        />
                      </ImageListItem>
                    ))}
                  </ImageList>
                </Paper>
              )}

              {/* Details */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Details
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Property
                    </Typography>
                    <Typography variant="body2">
                      {data.property?.name}
                      {data.property?.address && ` • ${data.property.address}`}
                    </Typography>
                  </Box>

                  {data.unit && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Unit
                      </Typography>
                      <Typography variant="body2">
                        Unit {data.unit.unitNumber}
                      </Typography>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Requested by
                    </Typography>
                    <Typography variant="body2">
                      {data.requestedBy?.firstName} {data.requestedBy?.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {data.requestedBy?.email}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Submitted
                    </Typography>
                    <Typography variant="body2">
                      {formatDateTime(data.createdAt)}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Budget Information - for owner-initiated requests */}
              {(data.ownerEstimatedBudget || data.managerEstimatedCost || data.approvedBudget) && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Budget Information
                  </Typography>
                  <Stack spacing={1.5} sx={{ mt: 1 }}>
                    {data.ownerEstimatedBudget && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Owner's Estimated Budget
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          ${data.ownerEstimatedBudget.toLocaleString()}
                        </Typography>
                      </Box>
                    )}
                    {data.managerEstimatedCost && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Manager's Cost Estimate
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          ${data.managerEstimatedCost.toLocaleString()}
                        </Typography>
                        {data.costBreakdownNotes && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {data.costBreakdownNotes}
                          </Typography>
                        )}
                      </Box>
                    )}
                    {data.approvedBudget && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Approved Budget
                        </Typography>
                        <Typography variant="body2" fontWeight={500} color="success.main">
                          ${data.approvedBudget.toLocaleString()}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              )}

              {/* Review History */}
              {data.reviewNotes && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Review History
                  </Typography>
                  {data.reviewedAt && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Reviewed at: {formatDateTime(data.reviewedAt)}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {data.reviewNotes}
                  </Typography>
                </Paper>
              )}

              {/* Linked Job */}
              {linkedJob && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Linked Job
                  </Typography>
                  <List dense disablePadding>
                    <ListItem key={linkedJob.id} disableGutters>
                      <ListItemText
                        primary={linkedJob.title}
                        secondary={
                          <>
                            <Chip
                              label={linkedJob.status?.replace(/_/g, ' ')}
                              size="small"
                              sx={{ mr: 1, mt: 0.5 }}
                            />
                            {linkedJob.priority && (
                              <Chip
                                label={linkedJob.priority}
                                size="small"
                                sx={{ mr: 1, mt: 0.5 }}
                              />
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Created: {formatDateTime(linkedJob.createdAt)}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  </List>
                </Paper>
              )}

              {/* Review Input */}
              {showReviewInput && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    {reviewAction === 'approve' && 'Approve Request'}
                    {reviewAction === 'reject' && 'Reject Request'}
                    {reviewAction === 'add-estimate' && 'Add Cost Estimate'}
                    {reviewAction === 'owner-approve' && 'Approve Service Request'}
                    {reviewAction === 'owner-reject' && 'Reject Service Request'}
                  </Typography>

                  {/* Standard approve/reject flow */}
                  {(reviewAction === 'approve' || reviewAction === 'reject') && (
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Review Notes"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder={
                        reviewAction === 'approve'
                          ? 'Enter approval notes (e.g., "Approved - urgent repair needed")'
                          : 'Enter rejection reason (e.g., "Duplicate request - already addressed")'
                      }
                      disabled={isPendingMutation}
                      sx={{ mt: 1 }}
                    />
                  )}

                  {/* Manager adds cost estimate */}
                  {reviewAction === 'add-estimate' && (
                    <Stack spacing={2} sx={{ mt: 1 }}>
                      <TextField
                        fullWidth
                        label="Estimated Cost"
                        type="number"
                        value={managerEstimatedCost}
                        onChange={(e) => setManagerEstimatedCost(e.target.value)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                        disabled={isPendingMutation}
                        required
                      />
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Cost Breakdown Notes (Optional)"
                        value={costBreakdownNotes}
                        onChange={(e) => setCostBreakdownNotes(e.target.value)}
                        placeholder="Explain the cost breakdown..."
                        disabled={isPendingMutation}
                      />
                    </Stack>
                  )}

                  {/* Owner approval */}
                  {reviewAction === 'owner-approve' && (
                    <Stack spacing={2} sx={{ mt: 1 }}>
                      <Alert severity="info">
                        The manager has estimated the cost at ${data?.managerEstimatedCost?.toLocaleString() || 0}. 
                        You can approve with this amount or specify a different budget.
                      </Alert>
                      <TextField
                        fullWidth
                        label="Approved Budget"
                        type="number"
                        value={approvedBudget}
                        onChange={(e) => setApprovedBudget(e.target.value)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                        disabled={isPendingMutation}
                        helperText="Leave blank to use the manager's estimate"
                      />
                    </Stack>
                  )}

                  {/* Owner rejection */}
                  {reviewAction === 'owner-reject' && (
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Rejection Reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please explain why you are rejecting this request..."
                      disabled={isPendingMutation}
                      required
                      sx={{ mt: 1 }}
                    />
                  )}

                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button
                      onClick={handleCancelReview}
                      disabled={isPendingMutation}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitReview}
                      variant="contained"
                      color={
                        reviewAction === 'approve' || reviewAction === 'owner-approve' || reviewAction === 'add-estimate'
                          ? 'success'
                          : 'error'
                      }
                      disabled={isPendingMutation}
                      startIcon={
                        reviewAction === 'add-estimate' ? <MoneyIcon /> :
                        (reviewAction === 'approve' || reviewAction === 'owner-approve') ? <CheckCircleIcon /> : <CancelIcon />
                      }
                    >
                      {isPendingMutation
                        ? 'Submitting...'
                        : reviewAction === 'approve' || reviewAction === 'owner-approve'
                        ? 'Approve'
                        : reviewAction === 'add-estimate'
                        ? 'Submit Estimate'
                        : 'Reject'}
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}
        </DataState>
      </DialogContent>

      <DialogActions>
        {data && !showReviewInput && (
          <>
            {/* Property Manager actions for SUBMITTED requests */}
            {data.status === 'SUBMITTED' && userRole === 'PROPERTY_MANAGER' && (
              <>
                <Button
                  onClick={handleReject}
                  color="error"
                  startIcon={<CancelIcon />}
                  disabled={isPendingMutation}
                >
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  disabled={isPendingMutation}
                >
                  Approve
                </Button>
              </>
            )}

            {/* Property Manager adds cost estimate for PENDING_MANAGER_REVIEW */}
            {data.status === 'PENDING_MANAGER_REVIEW' && userRole === 'PROPERTY_MANAGER' && (
              <Button
                onClick={handleAddEstimate}
                variant="contained"
                color="primary"
                startIcon={<MoneyIcon />}
                disabled={isPendingMutation}
              >
                Add Cost Estimate
              </Button>
            )}

            {/* Owner approval/rejection for PENDING_OWNER_APPROVAL */}
            {data.status === 'PENDING_OWNER_APPROVAL' && userRole === 'OWNER' && (
              <>
                <Button
                  onClick={handleOwnerReject}
                  color="error"
                  startIcon={<CancelIcon />}
                  disabled={isPendingMutation}
                >
                  Reject
                </Button>
                <Button
                  onClick={handleOwnerApprove}
                  color="success"
                  variant="contained"
                  startIcon={<CheckCircleIcon />}
                  disabled={isPendingMutation}
                >
                  Approve
                </Button>
              </>
            )}

            {/* Convert to job for APPROVED or APPROVED_BY_OWNER status */}
            {(data.status === 'APPROVED' || data.status === 'APPROVED_BY_OWNER') && userRole === 'PROPERTY_MANAGER' && (
              <Button
                onClick={handleConvert}
                variant="contained"
                startIcon={<BuildIcon />}
                disabled={isPendingMutation}
              >
                {convertMutation.isPending ? 'Converting...' : 'Convert to Job'}
              </Button>
            )}
          </>
        )}
        <Button onClick={handleClose} disabled={isPendingMutation}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
