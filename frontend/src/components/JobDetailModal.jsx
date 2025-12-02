
import React, { useEffect, useState } from 'react';
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
  ListItemIcon,
  Checkbox,
  TextField,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  IconButton,
  MenuItem,
  DialogContentText,
} from '@mui/material';
import {
  CalendarToday as CalendarTodayIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
  Notes as NotesIcon,
  AttachFile as AttachFileIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Comment as CommentIcon,
  Send as SendIcon,
  AddCircleOutline as AddCircleOutlineIcon,
  DeleteOutline as DeleteOutlineIcon,
  UploadFile as UploadFileIcon,
  ArrowBack as ArrowBackIcon,
  OpenInNew as OpenInNewIcon,
  Close as CloseIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { formatDistanceToNow } from 'date-fns';
import { queryKeys } from '../utils/queryKeys.js';
import { formatDate, formatDateTimeForInput, toISOString } from '../utils/date';
import ensureArray from '../utils/ensureArray';
import {
  canTransition,
  formatStatusLabel,
  getAllowedStatuses,
  getStatusHelperText,
  requiresStatusConfirmation,
} from '../constants/jobStatuses.js';
import JobStatusConfirmDialog from './JobStatusConfirmDialog.jsx';
import {
  applyJobUpdateToQueries,
  restoreJobQueries,
  snapshotJobQueries,
} from '../utils/jobCache.js';
import { useCurrentUser } from '../context/UserContext.jsx';

const JobDetailModal = ({ job, open, onClose, returnPath, onViewFullPage }) => {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [actionError, setActionError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(job?.status || '');
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [assigneeId, setAssigneeId] = useState(
    job?.assignedToId || job?.assignedTo?.id || '',
  );
  const [assignmentConfirmOpen, setAssignmentConfirmOpen] = useState(false);
  const [scheduledDateInput, setScheduledDateInput] = useState(
    formatDateTimeForInput(job?.scheduledDate)
  );
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [deleteCommentId, setDeleteCommentId] = useState(null);
  const { user } = useCurrentUser();
  const isTechnician = user?.role === 'TECHNICIAN';
  const isPropertyManager = user?.role === 'PROPERTY_MANAGER';

  const commentsQueryKey = queryKeys.jobs.comments(job?.id);

  const { data: jobData, isLoading: jobLoading, error: jobError } = useQuery({
    queryKey: queryKeys.jobs.detail(job?.id),
    queryFn: async () => {
      const response = await apiClient.get(`/jobs/${job.id}`);
      return response.data;
    },
    enabled: open && !!job?.id,
    initialData: job,
  });

  useEffect(() => {
    setSelectedStatus(jobData?.status || job?.status || '');
    setAssigneeId(jobData?.assignedToId || jobData?.assignedTo?.id || job?.assignedToId || job?.assignedTo?.id || '');
    setScheduledDateInput(formatDateTimeForInput(jobData?.scheduledDate || job?.scheduledDate));
  }, [jobData, job]);

  const { data: technicians = [], isLoading: techniciansLoading } = useQuery({
    queryKey: queryKeys.users.list({ role: 'TECHNICIAN' }),
    queryFn: async () => {
      const response = await apiClient.get('/users?role=TECHNICIAN');
      return ensureArray(response.data, ['users', 'data', 'items', 'results']);
    },
    enabled: open,
  });

  // Fetch comments for this job
  const {
    data: commentsData,
    isLoading: commentsLoading,
    error: commentsError,
  } = useQuery({
    queryKey: commentsQueryKey,
    queryFn: async () => {
      const response = await apiClient.get(`/jobs/${job.id}/comments`);
      return response.data;
    },
    enabled: open && !!job?.id,
  });

  const comments = commentsData?.comments || [];

  // Mutation to post a new comment
  const postCommentMutation = useMutation({
    mutationFn: async (content) => {
      const response = await apiClient.post(`/jobs/${job.id}/comments`, { content });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      setCommentText('');
    },
  });

  // Mutation to edit a comment
  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }) => {
      const response = await apiClient.patch(`/jobs/${job.id}/comments/${commentId}`, { content });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      setEditingCommentId(null);
      setEditCommentText('');
    },
  });

  // Mutation to delete a comment
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      const response = await apiClient.delete(`/jobs/${job.id}/comments/${commentId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      setDeleteCommentId(null);
    },
  });

  const updateEvidenceMutation = useMutation({
    mutationFn: async (evidence) => {
      const response = await apiClient.patch(`/jobs/${job.id}`, { evidence });
      return response.data;
    },
    onSuccess: () => {
      setActionError('');
      setAttachmentError('');
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(job.id) });
    },
    onError: (errorResponse) => {
      setActionError(errorResponse?.response?.data?.message || 'Failed to save changes');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status) => {
      const response = await apiClient.patch(`/jobs/${job.id}/status`, { status });
      return response.data;
    },
    onMutate: async (status) => {
      setActionError('');
      await queryClient.cancelQueries({ queryKey: ['jobs'] });

      const previousJobs = snapshotJobQueries(queryClient);
      const baseJob = jobData || job || {};
      const jobId = baseJob.id || job?.id;

      applyJobUpdateToQueries(queryClient, {
        ...baseJob,
        id: jobId,
        status,
        updatedAt: new Date().toISOString(),
      });

      return { previousJobs };
    },
    onSuccess: (updatedJob) => {
      const normalizedJob = updatedJob?.job || updatedJob;
      applyJobUpdateToQueries(queryClient, normalizedJob);
      setStatusConfirmOpen(false);
      setPendingStatus('');
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(job.id) });
    },
    onError: (errorResponse, _variables, context) => {
      const statusCode = errorResponse?.response?.status;
      const message =
        statusCode === 401 || statusCode === 403
          ? 'You do not have permission to update job statuses. Changes have been reverted.'
          : errorResponse?.response?.data?.message || 'Failed to update status';

      setActionError(message);
      restoreJobQueries(queryClient, context?.previousJobs);
      setSelectedStatus(jobData?.status || job?.status || '');
      setStatusConfirmOpen(false);
      setPendingStatus('');
    },
  });

  const assignmentMutation = useMutation({
    mutationFn: async (technicianId) => {
      const payload = { assignedToId: technicianId || null };
      const response = await apiClient.patch(`/jobs/${job.id}`, payload);
      return response.data;
    },
    onMutate: async (technicianId) => {
      setActionError('');
      await queryClient.cancelQueries({ queryKey: ['jobs'] });

      const previousJobs = snapshotJobQueries(queryClient);
      const baseJob = jobData || job || {};
      const jobId = baseJob.id || job?.id;
      const technician = technicians.find((tech) => tech.id === technicianId);

      applyJobUpdateToQueries(queryClient, {
        ...baseJob,
        id: jobId,
        assignedToId: technicianId || null,
        assignedTo: technicianId ? technician : null,
        updatedAt: new Date().toISOString(),
      });

      return { previousJobs };
    },
    onSuccess: (updatedJob) => {
      const normalizedJob = updatedJob?.job || updatedJob;
      applyJobUpdateToQueries(queryClient, normalizedJob);
      setAssignmentConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(job.id) });
    },
    onError: (errorResponse, _variables, context) => {
      const statusCode = errorResponse?.response?.status;
      const errorMessage =
        statusCode === 401 || statusCode === 403
          ? 'You do not have permission to update job assignments. Changes have been reverted.'
          : errorResponse?.response?.data?.message || 'Failed to update assignment';
      const resolvedAssigneeId =
        jobData?.assignedToId || jobData?.assignedTo?.id || job?.assignedToId || job?.assignedTo?.id || '';

      setActionError(errorMessage);
      restoreJobQueries(queryClient, context?.previousJobs);
      setAssigneeId(resolvedAssigneeId);
      setAssignmentConfirmOpen(false);
    },
  });

  const dueDateMutation = useMutation({
    mutationFn: async (scheduledDate) => {
      const response = await apiClient.patch(`/jobs/${job.id}`, { scheduledDate });
      return response.data;
    },
    onMutate: async (scheduledDate) => {
      setActionError('');
      await queryClient.cancelQueries({ queryKey: ['jobs'] });

      const previousJobs = snapshotJobQueries(queryClient);
      const baseJob = jobData || job || {};
      const jobId = baseJob.id || job?.id;

      applyJobUpdateToQueries(queryClient, {
        ...baseJob,
        id: jobId,
        scheduledDate: scheduledDate || null,
        updatedAt: new Date().toISOString(),
      });

      return { previousJobs };
    },
    onSuccess: (updatedJob) => {
      const normalizedJob = updatedJob?.job || updatedJob;
      applyJobUpdateToQueries(queryClient, normalizedJob);
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(job.id) });
    },
    onError: (errorResponse, _variables, context) => {
      const errorMessage = errorResponse?.response?.data?.message || 'Failed to update due date';
      setActionError(errorMessage);
      restoreJobQueries(queryClient, context?.previousJobs);
    },
  });

  const modalJob = jobData || job;
  const allowedStatuses = modalJob?.status ? getAllowedStatuses(modalJob.status) : [];
  const statusHelperText = modalJob?.status
    ? getStatusHelperText(modalJob.status)
    : 'Status not available for this job.';
  const currentScheduledInput = formatDateTimeForInput(modalJob?.scheduledDate);
  const isDueDateUnchanged = (currentScheduledInput || '') === (scheduledDateInput || '');
  const currentAssigneeId = modalJob?.assignedToId || modalJob?.assignedTo?.id || '';
  const technicianOptions = Array.isArray(technicians) ? technicians : [];
  const isStatusChangeDisabled =
    !modalJob?.status ||
    selectedStatus === modalJob.status ||
    !canTransition(modalJob.status, selectedStatus) ||
    statusMutation.isPending;
  const isAssignmentDisabled =
    isTechnician ||
    assigneeId === currentAssigneeId ||
    assignmentMutation.isPending ||
    techniciansLoading;
  const assignmentDisabledReason = isTechnician
    ? 'Technicians cannot change job assignments.'
    : techniciansLoading
      ? 'Loading technicians...'
      : '';
  const selectedTechnician = technicianOptions.find((tech) => tech.id === assigneeId);

  const handleRequestStatusChange = () => {
    if (!modalJob?.status || selectedStatus === modalJob.status) return;
    if (!canTransition(modalJob.status, selectedStatus)) return;

    if (requiresStatusConfirmation(modalJob.status, selectedStatus)) {
      setPendingStatus(selectedStatus);
      setStatusConfirmOpen(true);
      return;
    }

    statusMutation.mutate(selectedStatus);
  };

  const handleConfirmStatusChange = () => {
    if (pendingStatus) {
      statusMutation.mutate(pendingStatus);
    }
  };

  const handleCloseStatusConfirm = () => {
    setStatusConfirmOpen(false);
    setPendingStatus('');
  };

  const handleRequestAssignmentChange = () => {
    if (isTechnician) {
      setActionError('You do not have permission to update job assignments.');
      return;
    }
    if (assigneeId === currentAssigneeId) return;
    setAssignmentConfirmOpen(true);
  };

  const handleConfirmAssignment = () => {
    assignmentMutation.mutate(assigneeId || null);
  };

  const handleCancelAssignment = () => {
    setAssignmentConfirmOpen(false);
  };

  const handleSaveDueDate = () => {
    const isoDate = scheduledDateInput ? toISOString(scheduledDateInput) : null;

    if (scheduledDateInput && !isoDate) {
      setActionError('Please enter a valid due date.');
      return;
    }

    dueDateMutation.mutate(isoDate);
  };

  const handlePostComment = () => {
    if (commentText.trim()) {
      postCommentMutation.mutate(commentText.trim());
    }
  };

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleSaveEditComment = () => {
    if (editCommentText.trim() && editingCommentId) {
      editCommentMutation.mutate({ commentId: editingCommentId, content: editCommentText.trim() });
    }
  };

  const handleDeleteComment = (commentId) => {
    setDeleteCommentId(commentId);
  };

  const handleConfirmDeleteComment = () => {
    if (deleteCommentId) {
      deleteCommentMutation.mutate(deleteCommentId);
    }
  };

  const handleCancelDeleteComment = () => {
    setDeleteCommentId(null);
  };

  const canEditComment = (comment) => comment.userId === user?.id;
  const canDeleteComment = (comment) => comment.userId === user?.id || isPropertyManager;

  const createClientId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  if (!job) {
    return null;
  }

  const evidence = jobData?.evidence || {};
  const subtasks = Array.isArray(evidence.subtasks) ? evidence.subtasks : [];
  const attachments = Array.isArray(evidence.attachments) ? evidence.attachments : [];

  const persistEvidence = (updater) => {
    if (!job?.id) return;

    const updatedEvidence = updater({ ...evidence });
    updateEvidenceMutation.mutate(updatedEvidence);
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;

    const subtask = { id: createClientId(), text: newSubtask.trim(), completed: false };
    persistEvidence((current) => ({
      ...current,
      subtasks: [...subtasks, subtask],
    }));
    setNewSubtask('');
  };

  const handleToggleSubtask = (subtaskId) => {
    const updated = subtasks.map((task) =>
      task.id === subtaskId ? { ...task, completed: !task.completed } : task
    );

    persistEvidence((current) => ({
      ...current,
      subtasks: updated,
    }));
  };

  const handleDeleteSubtask = (subtaskId) => {
    const updated = subtasks.filter((task) => task.id !== subtaskId);

    persistEvidence((current) => ({
      ...current,
      subtasks: updated,
    }));
  };

  const handleUploadAttachment = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const formData = new FormData();
    formData.append('files', file);

    setAttachmentError('');
    setUploading(true);

    try {
      const uploadResponse = await apiClient.post('/uploads/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const [url] = uploadResponse.data?.urls || [];

      if (!url) {
        throw new Error('Upload failed');
      }

      const newAttachment = {
        id: createClientId(),
        name: file.name,
        url,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
      };

      persistEvidence((current) => ({
        ...current,
        attachments: [...attachments, newAttachment],
      }));
    } catch (uploadErr) {
      setAttachmentError(uploadErr?.response?.data?.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = (attachmentId) => {
    const updated = attachments.filter((file) => file.id !== attachmentId);

    persistEvidence((current) => ({
      ...current,
      attachments: updated,
    }));
  };

  const getPriorityColor = (priority) => {
    const colors = {
      LOW: 'default',
      MEDIUM: 'info',
      HIGH: 'warning',
      URGENT: 'error',
    };

    return colors[priority] || 'default';
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'PROPERTY_MANAGER':
        return 'primary';
      case 'TECHNICIAN':
        return 'success';
      case 'OWNER':
        return 'warning';
      default:
        return 'default';
    }
  };

  const handleClose = () => {
    onClose?.(returnPath);
  };

  return (
    <>
      <Dialog open={open && !!job} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              {returnPath && (
                <Button
                  onClick={handleClose}
                  startIcon={<ArrowBackIcon />}
                  size="small"
                  color="inherit"
                >
                  Back
                </Button>
              )}
              <Typography variant="h5" component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                {modalJob?.title}
              </Typography>
              <Chip
                label={formatStatusLabel(modalJob?.status)}
                color="primary"
                size="small"
              />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              {onViewFullPage && (
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<OpenInNewIcon />}
                  onClick={() => onViewFullPage(modalJob?.id)}
                >
                  Open Full Page
                </Button>
              )}
              <IconButton aria-label="Close job details" onClick={handleClose} size="small">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
        {jobError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load job details
          </Alert>
        )}
        {actionError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {actionError}
          </Alert>
        )}
        <Stack spacing={3}>
          {jobLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          )}

          <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6">Job Actions</Typography>
                <Typography variant="body2" color="text.secondary">
                  Update the status, assignment, and due date to keep everyone aligned.
                </Typography>
              </Box>
              {isTechnician && (
                <Alert severity="info">Assignment changes are disabled for technician accounts.</Alert>
              )}
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Status
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    helperText={statusHelperText}
                    disabled={statusMutation.isPending || !modalJob?.status}
                  >
                    {allowedStatuses.map((status) => (
                      <MenuItem
                        key={status}
                        value={status}
                        disabled={!canTransition(modalJob?.status, status)}
                      >
                        {formatStatusLabel(status)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    sx={{ mt: 1.5 }}
                    onClick={handleRequestStatusChange}
                    disabled={isStatusChangeDisabled}
                    startIcon={statusMutation.isPending ? <CircularProgress size={20} /> : null}
                  >
                    {statusMutation.isPending ? 'Updating...' : 'Update Status'}
                  </Button>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Assigned Technician
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    disabled={assignmentMutation.isPending || techniciansLoading || isTechnician}
                    helperText={assignmentDisabledReason || 'Select a technician or leave unassigned'}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {technicianOptions.map((tech) => (
                      <MenuItem key={tech.id} value={tech.id}>
                        {tech.firstName} {tech.lastName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="outlined"
                    sx={{ mt: 1.5 }}
                    onClick={handleRequestAssignmentChange}
                    disabled={isAssignmentDisabled}
                    startIcon={assignmentMutation.isPending ? <CircularProgress size={20} /> : null}
                  >
                    {assignmentMutation.isPending ? 'Saving...' : 'Save Assignment'}
                  </Button>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Due date
                  </Typography>
                  <TextField
                    type="datetime-local"
                    fullWidth
                    size="small"
                    value={scheduledDateInput || ''}
                    onChange={(e) => setScheduledDateInput(e.target.value)}
                    helperText="Set or clear the target completion date"
                    disabled={dueDateMutation.isPending}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => setScheduledDateInput('')}
                      disabled={dueDateMutation.isPending || (!scheduledDateInput && !modalJob?.scheduledDate)}
                    >
                      Clear
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSaveDueDate}
                      disabled={dueDateMutation.isPending || isDueDateUnchanged}
                      startIcon={dueDateMutation.isPending ? <CircularProgress size={20} /> : null}
                    >
                      {dueDateMutation.isPending ? 'Saving...' : 'Save Due Date'}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, mb: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="h6">Job Overview</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={formatStatusLabel(modalJob?.status)}
                      color="primary"
                      size="small"
                    />
                    {modalJob?.priority && (
                      <Chip
                        label={modalJob.priority}
                        color={getPriorityColor(modalJob.priority)}
                        size="small"
                      />
                    )}
                  </Stack>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PlaceIcon sx={{ color: 'text.secondary' }} />
                      <Typography variant="body1">{modalJob?.property?.name || 'N/A'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon sx={{ color: 'text.secondary' }} />
                      <Typography variant="body1">
                        {modalJob?.scheduledDate ? formatDate(modalJob.scheduledDate) : 'Not Scheduled'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon sx={{ color: 'text.secondary' }} />
                      <Typography variant="body1">
                        {modalJob?.assignedTo
                          ? `${modalJob.assignedTo.firstName} ${modalJob.assignedTo.lastName}`
                          : 'Unassigned'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <NotesIcon sx={{ color: 'text.secondary', mt: 0.25 }} />
                      <Typography variant="body2" color="text.secondary">
                        {modalJob?.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Paper>

              <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={2}>
                  <Typography variant="h6">Evidence & Attachments</Typography>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Checklist
                    </Typography>
                    {subtasks.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        No subtasks yet. Add steps to track work progress.
                      </Typography>
                    )}
                    <List dense>
                      {subtasks.map((task) => (
                        <ListItem key={task.id} secondaryAction={
                          <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteSubtask(task.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        }>
                          <ListItemIcon>
                            <Checkbox
                              edge="start"
                              checked={task.completed}
                              tabIndex={-1}
                              disableRipple
                              onChange={() => handleToggleSubtask(task.id)}
                            />
                          </ListItemIcon>
                          <ListItemText primary={task.text} />
                        </ListItem>
                      ))}
                    </List>
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Add a subtask"
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        disabled={updateEvidenceMutation.isPending}
                      />
                      <Button
                        variant="contained"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={handleAddSubtask}
                        disabled={!newSubtask.trim() || updateEvidenceMutation.isPending}
                      >
                        Add
                      </Button>
                    </Stack>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      File evidence
                    </Typography>
                    {attachmentError && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {attachmentError}
                      </Alert>
                    )}
                    {attachments.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        No files uploaded yet.
                      </Typography>
                    )}
                    <List dense>
                      {attachments.map((file) => (
                        <ListItem
                          key={file.id}
                          secondaryAction={
                            <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveAttachment(file.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          }
                          component="a"
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ListItemIcon>
                            <AttachFileIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={file.name}
                            secondary={file.uploadedAt ? formatDate(file.uploadedAt) : undefined}
                          />
                        </ListItem>
                      ))}
                    </List>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                        disabled={uploading || updateEvidenceMutation.isPending}
                      >
                        {uploading ? 'Uploading...' : 'Upload File'}
                        <input type="file" hidden onChange={handleUploadAttachment} />
                      </Button>
                      {updateEvidenceMutation.isPending && <CircularProgress size={20} />}
                    </Stack>
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
                <Typography variant="h6" gutterBottom>
                  <CommentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Comments
                </Typography>
                {commentsLoading && <Typography>Loading comments...</Typography>}
                {commentsError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load comments
                  </Alert>
                )}
                {comments.length === 0 && !commentsLoading ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No comments yet. Be the first to add an update.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {comments.map((comment) => (
                      <Box
                        key={comment.id}
                        sx={{
                          p: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          backgroundColor: 'background.default',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                            {(comment.user?.firstName?.[0] || '').toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {comment.user?.firstName} {comment.user?.lastName}
                              {comment.user?.role && (
                                <Chip
                                  size="small"
                                  label={comment.user.role.replace('_', ' ')}
                                  color={getRoleBadgeColor(comment.user.role)}
                                  sx={{ height: 20 }}
                                />
                              )}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            {canEditComment(comment) && (
                              <IconButton
                                size="small"
                                onClick={() => handleStartEditComment(comment)}
                                disabled={editCommentMutation.isPending || deleteCommentMutation.isPending}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            )}
                            {canDeleteComment(comment) && (
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={editCommentMutation.isPending || deleteCommentMutation.isPending}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </Box>
                        {editingCommentId === comment.id ? (
                          <Box>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              maxRows={4}
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              disabled={editCommentMutation.isPending}
                              sx={{ mb: 1 }}
                            />
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                onClick={handleCancelEditComment}
                                disabled={editCommentMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={handleSaveEditComment}
                                disabled={!editCommentText.trim() || editCommentMutation.isPending}
                              >
                                {editCommentMutation.isPending ? 'Saving...' : 'Save'}
                              </Button>
                            </Stack>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-line' }}>
                            {comment.content}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {comment.user?.email}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    label="Add a comment..."
                    size="small"
                    multiline
                    maxRows={4}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePostComment();
                      }
                    }}
                    disabled={postCommentMutation.isPending}
                    error={postCommentMutation.isError}
                    helperText={
                      postCommentMutation.isError
                        ? 'Failed to post comment'
                        : `${commentText.length}/2000`
                    }
                  />
                  <IconButton
                    color="primary"
                    onClick={handlePostComment}
                    disabled={!commentText.trim() || postCommentMutation.isPending}
                    size="small"
                  >
                    {postCommentMutation.isPending ? (
                      <CircularProgress size={20} />
                    ) : (
                      <SendIcon />
                    )}
                  </IconButton>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>

      <JobStatusConfirmDialog
        open={statusConfirmOpen}
        onClose={handleCloseStatusConfirm}
        onConfirm={handleConfirmStatusChange}
        currentStatus={modalJob?.status}
        newStatus={pendingStatus}
        jobTitle={modalJob?.title || ''}
        isLoading={statusMutation.isPending}
      />

      <Dialog
        open={assignmentConfirmOpen}
        onClose={assignmentMutation.isPending ? undefined : handleCancelAssignment}
      >
        <DialogTitle>Confirm Assignment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {assigneeId
              ? `Assign this job to ${
                  selectedTechnician
                    ? `${selectedTechnician.firstName} ${selectedTechnician.lastName}`
                    : 'the selected technician'
                }?`
              : 'Remove the current technician assignment from this job?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelAssignment} disabled={assignmentMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAssignment}
            variant="contained"
            disabled={assignmentMutation.isPending}
            startIcon={assignmentMutation.isPending ? <CircularProgress size={20} /> : null}
          >
            {assignmentMutation.isPending ? 'Saving...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Comment Confirmation Dialog */}
      <Dialog
        open={!!deleteCommentId}
        onClose={deleteCommentMutation.isPending ? undefined : handleCancelDeleteComment}
      >
        <DialogTitle>Delete Comment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this comment? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDeleteComment} disabled={deleteCommentMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteComment}
            variant="contained"
            color="error"
            disabled={deleteCommentMutation.isPending}
            startIcon={deleteCommentMutation.isPending ? <CircularProgress size={20} /> : null}
          >
            {deleteCommentMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default JobDetailModal;
