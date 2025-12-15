import { useEffect, useState } from 'react';
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
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Build as BuildIcon,
  AttachMoney as MoneyIcon,
  CalendarMonth as CalendarIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from './DataState';
import LoadingButton from './LoadingButton';
import { formatDateTime } from '../utils/date';
import toast from 'react-hot-toast';
import { queryKeys } from '../utils/queryKeys.js';
import { useCurrentUser } from '../context/UserContext.jsx';
import ConvertServiceRequestToJobDialog from './ConvertServiceRequestToJobDialog';
import { ServiceRequestImageManager } from '../features/images';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

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
    ARCHIVED: 'default',
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
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);
  const [photoLightboxIndex, setPhotoLightboxIndex] = useState(0);

  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editPhotos, setEditPhotos] = useState([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Fetch request details
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.serviceRequests.detail(requestId),
    queryFn: async () => {
      const response = await apiClient.get(`/service-requests/${requestId}`);
      if (!response?.data) return null;

      if (Object.prototype.hasOwnProperty.call(response.data, 'request')) {
        return response.data.request;
      }

      return response.data;
    },
    enabled: open && !!requestId,
  });

  const submitterUpdateMutation = useMutation({
    mutationFn: async ({ title, description, priority, photos }) => {
      const response = await apiClient.patch(`/service-requests/${requestId}`, {
        title,
        description,
        priority,
        photos,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.detail(requestId) });
      toast.success('Service request updated');
      setEditMode(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update service request');
    },
  });

  const canEditSubmission = Boolean(
    (userRole === 'TENANT' || userRole === 'OWNER') &&
      data &&
      user?.id &&
      data.requestedById === user.id &&
      data.status === 'SUBMITTED'
  );

  // Sync edit form state when data loads, but do not clobber while editing.
  useEffect(() => {
    if (!open) return;
    if (!data) return;
    if (editMode) return;

    setEditTitle(data.title || '');
    setEditDescription(data.description || '');
    setEditPriority(data.priority || 'MEDIUM');
    setEditPhotos((data.photos || []).map((url, idx) => ({ id: `existing-${idx}`, imageUrl: url })));
  }, [open, data, editMode]);

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

  // Handle successful conversion
  const handleConversionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.detail(requestId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    onClose();
  };

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

  // Manager direct rejection mutation
  const managerRejectMutation = useMutation({
    mutationFn: async ({ rejectionReason, reviewNotes }) => {
      const response = await apiClient.post(`/service-requests/${requestId}/manager-reject`, {
        rejectionReason,
        reviewNotes,
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

  const handleManagerReject = () => {
    setReviewAction('manager-reject');
    setRejectionReason('');
    setReviewNotes('');
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
    } else if (reviewAction === 'manager-reject') {
      if (!rejectionReason.trim()) {
        toast.error('Please enter a rejection reason');
        return;
      }
      managerRejectMutation.mutate({
        rejectionReason: rejectionReason.trim(),
        reviewNotes: reviewNotes.trim() || undefined,
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

  const handleClose = () => {
    const pending = updateMutation.isPending ||
      addEstimateMutation.isPending || ownerApproveMutation.isPending || ownerRejectMutation.isPending;
    if (!pending && !submitterUpdateMutation.isPending && !isUploadingImages) {
      handleCancelReview();
      onClose();
    }
  };

  const handleStartEdit = () => {
    if (!canEditSubmission) {
      toast.error('You can only edit your own submitted requests');
      return;
    }
    setEditTitle(data.title || '');
    setEditDescription(data.description || '');
    setEditPriority(data.priority || 'MEDIUM');
    setEditPhotos((data.photos || []).map((url, idx) => ({ id: `existing-${idx}`, imageUrl: url })));
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!editDescription.trim()) {
      toast.error('Description is required');
      return;
    }
    if (isUploadingImages) {
      toast.error('Please wait for images to finish uploading');
      return;
    }

    const photoUrls = editPhotos
      .map((img) => img.imageUrl || img.url)
      .filter(Boolean);

    submitterUpdateMutation.mutate({
      title: editTitle.trim(),
      description: editDescription.trim(),
      priority: editPriority,
      photos: photoUrls,
    });
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
  const isArchived = data?.status === 'ARCHIVED';
  const linkedJobs = data?.jobs || [];
  const linkedJob = linkedJobs[0]; // Assuming only one job can be linked for simplicity

  const isPendingMutation = updateMutation.isPending ||
    addEstimateMutation.isPending || ownerApproveMutation.isPending || ownerRejectMutation.isPending ||
    managerRejectMutation.isPending;

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Service Request Details</Typography>
            <IconButton onClick={handleClose} disabled={isPendingMutation}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <DataState isLoading={isLoading} isError={!!error} error={error} isEmpty={!data}>
            {data && (
              <Stack spacing={3}>
                {editMode && canEditSubmission && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Edit Service Request
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        fullWidth
                        label="Title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={submitterUpdateMutation.isPending}
                      />
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        disabled={submitterUpdateMutation.isPending}
                      />
                      <TextField
                        fullWidth
                        select
                        label="Priority"
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                        disabled={submitterUpdateMutation.isPending}
                      >
                        <MenuItem value="LOW">Low</MenuItem>
                        <MenuItem value="MEDIUM">Medium</MenuItem>
                        <MenuItem value="HIGH">High</MenuItem>
                        <MenuItem value="URGENT">Urgent</MenuItem>
                      </TextField>

                      <ServiceRequestImageManager
                        images={editPhotos}
                        onChange={(nextImages) => setEditPhotos(nextImages)}
                        onUploadingChange={setIsUploadingImages}
                        requestKey={requestId}
                        disabled={submitterUpdateMutation.isPending}
                      />
                    </Stack>
                  </Paper>
                )}

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
                    {/* Show simplified status for tenants, full workflow for managers/owners */}
                    {userRole === 'TENANT' ? (
                      <Alert
                        severity={
                          isRejectedStatus ? 'error' :
                            data.status === 'COMPLETED' ? 'success' :
                              ['APPROVED', 'APPROVED_BY_OWNER', 'CONVERTED_TO_JOB'].includes(data.status) ? 'success' :
                                'info'
                        }
                        sx={{ mt: 1 }}
                      >
                        {isRejectedStatus ? 'Your request was not approved. Please see details below.' :
                          data.status === 'COMPLETED' ? 'Your request has been completed!' :
                            ['APPROVED', 'APPROVED_BY_OWNER'].includes(data.status) ? 'Your request has been approved and will be addressed soon.' :
                              data.status === 'CONVERTED_TO_JOB' ? 'Your request is being worked on.' :
                                'Your request is being reviewed by the property manager.'}
                      </Alert>
                    ) : (
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
                    )}
                    {isArchived && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        This service request has been archived and is read-only.
                      </Alert>
                    )}
                    {isRejectedStatus && (data.status === 'REJECTED') && userRole !== 'TENANT' && (
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
                            onClick={() => {
                              setPhotoLightboxIndex(index);
                              setPhotoLightboxOpen(true);
                            }}
                            style={{
                              borderRadius: 4,
                              objectFit: 'cover',
                              height: 150,
                              width: '100%',
                              cursor: 'pointer',
                            }}
                          />
                        </ImageListItem>
                      ))}
                    </ImageList>

                    <Lightbox
                      open={photoLightboxOpen}
                      close={() => setPhotoLightboxOpen(false)}
                      index={photoLightboxIndex}
                      slides={(data.photos || []).map((url, idx) => ({
                        src: url,
                        alt: `Photo ${idx + 1}`,
                      }))}
                      plugins={[Zoom]}
                      zoom={{
                        maxZoomPixelRatio: 8,
                        zoomInMultiplier: 2,
                        doubleTapDelay: 300,
                        doubleClickDelay: 300,
                        doubleClickMaxStops: 2,
                        keyboardMoveDistance: 60,
                        wheelZoomDistanceFactor: 100,
                        pinchZoomDistanceFactor: 100,
                        scrollToZoom: true,
                      }}
                      render={{
                        slide: ({ slide }) => {
                          const locationParts = [
                            data.property?.name,
                            data.unit?.unitNumber ? `Unit ${data.unit.unitNumber}` : null,
                            data.property?.address,
                          ].filter(Boolean);
                          const locationLabel = locationParts.join(' • ');
                          return (
                            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                              <img
                                src={slide.src}
                                alt={slide.alt}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '100%',
                                  objectFit: 'contain',
                                  margin: 'auto',
                                }}
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                  color: 'white',
                                  px: 2,
                                  py: 1.5,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 1,
                                }}
                              >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                    {locationLabel || 'Location unavailable'}
                                  </Typography>
                                  <Typography variant="caption" sx={{ opacity: 0.9 }} noWrap>
                                    Submitted: {formatDateTime(data.createdAt)}
                                  </Typography>
                                </Box>
                                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                                  {photoLightboxIndex + 1} / {data.photos.length}
                                </Typography>
                              </Box>
                            </div>
                          );
                        },
                      }}
                      on={{
                        view: ({ index }) => setPhotoLightboxIndex(index),
                      }}
                      carousel={{
                        finite: false,
                        preload: 2,
                      }}
                      styles={{
                        container: { backgroundColor: 'rgba(0, 0, 0, 0.95)' },
                      }}
                    />
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

                {/* Budget Information - for owner-initiated requests (hidden from tenants) */}
                {userRole !== 'TENANT' && (data.ownerEstimatedBudget || data.managerEstimatedCost || data.approvedBudget) && (
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

                {/* Review History (hidden from tenants) */}
                {userRole !== 'TENANT' && data.reviewNotes && (
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
                      {reviewAction === 'manager-reject' && 'Reject Service Request'}
                      {reviewAction === 'add-estimate' && 'Add Cost Estimate'}
                      {reviewAction === 'owner-approve' && 'Approve Service Request (Owner)'}
                      {reviewAction === 'owner-reject' && 'Reject Service Request (Owner)'}
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

                    {/* Manager direct reject */}
                    {reviewAction === 'manager-reject' && (
                      <Stack spacing={2} sx={{ mt: 1 }}>
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
                        />
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          label="Review Notes (Optional)"
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Add any additional notes..."
                          disabled={isPendingMutation}
                        />
                      </Stack>
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
                        color={reviewAction === 'add-estimate' ? 'primary' : reviewAction === 'owner-reject' || reviewAction === 'reject' ? 'error' : 'success'}
                        variant={reviewAction === 'add-estimate' ? 'contained' : 'contained'}
                        disabled={isPendingMutation}
                        startIcon={
                          reviewAction === 'add-estimate' ? <MoneyIcon /> :
                            ['approve', 'owner-approve'].includes(reviewAction) ? <CheckCircleIcon /> : <CancelIcon />
                        }
                      >
                        {isPendingMutation
                          ? 'Submitting...'
                          : ['approve', 'owner-approve'].includes(reviewAction)
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
          {data && !showReviewInput && !isArchived && (
            <>
              {canEditSubmission && (
                <>
                  {editMode ? (
                    <>
                      <Button
                        onClick={() => setEditMode(false)}
                        disabled={submitterUpdateMutation.isPending || isUploadingImages}
                      >
                        Cancel Edit
                      </Button>
                      <LoadingButton
                        onClick={handleSaveEdit}
                        loading={submitterUpdateMutation.isPending}
                        variant="contained"
                        startIcon={<CheckCircleIcon />}
                        disabled={isUploadingImages}
                      >
                        Save
                      </LoadingButton>
                    </>
                  ) : (
                    <Button
                      onClick={handleStartEdit}
                      startIcon={<EditIcon />}
                      disabled={isPendingMutation}
                    >
                      Edit
                    </Button>
                  )}
                </>
              )}

              {/* Property Manager actions for pending requests */}
              {['SUBMITTED', 'PENDING_MANAGER_REVIEW', 'UNDER_REVIEW'].includes(data.status) && userRole === 'PROPERTY_MANAGER' && (
                <>
                  <Button
                    onClick={handleManagerReject}
                    color="error"
                    startIcon={<CancelIcon />}
                    disabled={isPendingMutation}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={handleAddEstimate}
                    color="primary"
                    startIcon={<MoneyIcon />}
                    disabled={isPendingMutation}
                    sx={{ ml: 1 }}
                  >
                    Add Cost Estimate
                  </Button>
                </>
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

              {/* Schedule Inspection or Convert to Job for APPROVED status (or fallback when no owners) */}
              {userRole === 'PROPERTY_MANAGER' && (
                data.status === 'APPROVED_BY_OWNER' ||
                (Array.isArray(data?.property?.owners) && data.property.owners.length === 0)
              ) && (
                <>
                  <Button
                    onClick={() => {
                      // Navigate to inspections page with pre-filled data
                      window.location.href = `/inspections?propertyId=${data.propertyId}&fromServiceRequest=${data.id}`;
                    }}
                    variant="outlined"
                    startIcon={<CalendarIcon />}
                    disabled={isPendingMutation}
                  >
                    Schedule Inspection
                  </Button>
                  <Button
                    onClick={() => setShowConvertDialog(true)}
                    variant="contained"
                    startIcon={<BuildIcon />}
                    disabled={isPendingMutation}
                  >
                    Convert to Job
                  </Button>
                </>
              )}
            </>
          )}
          <Button onClick={handleClose} disabled={isPendingMutation}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Convert to Job Dialog */}
      {data && (
        <ConvertServiceRequestToJobDialog
          open={showConvertDialog}
          onClose={() => setShowConvertDialog(false)}
          serviceRequest={data}
          onConvert={handleConversionSuccess}
        />
      )}
    </>
  );
}
