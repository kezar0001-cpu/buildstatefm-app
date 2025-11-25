
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
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { formatDistanceToNow } from 'date-fns';
import { queryKeys } from '../utils/queryKeys.js';
import { formatDate } from '../utils/date';
import ensureArray from '../utils/ensureArray';
import { canTransition, formatStatusLabel, getAllowedStatuses, getStatusHelperText } from '../constants/jobStatuses.js';
import JobStatusConfirmDialog from './JobStatusConfirmDialog.jsx';
import {
  applyJobUpdateToQueries,
  restoreJobQueries,
  snapshotJobQueries,
} from '../utils/jobCache.js';
import { useCurrentUser } from '../context/UserContext.jsx';

const JobDetailModal = ({ job, open, onClose }) => {
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
  const { user } = useCurrentUser();
  const isTechnician = user?.role === 'TECHNICIAN';

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
    },
    onError: (errorResponse, _variables, context) => {
      setActionError(errorResponse?.response?.data?.message || 'Failed to update status');
      restoreJobQueries(queryClient, context?.previousJobs);
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
    },
    onError: (errorResponse, _variables, context) => {
      const errorMessage =
        errorResponse?.response?.status === 403
          ? 'You do not have permission to update job assignments.'
          : errorResponse?.response?.data?.message || 'Failed to update assignment';
      setActionError(errorMessage);
      restoreJobQueries(queryClient, context?.previousJobs);
      setAssignmentConfirmOpen(false);
    },
  });

  const modalJob = jobData || job;
  const allowedStatuses = modalJob?.status ? getAllowedStatuses(modalJob.status) : [];
  const statusHelperText = modalJob?.status
    ? getStatusHelperText(modalJob.status)
    : 'Status not available for this job.';
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

    setPendingStatus(selectedStatus);
    setStatusConfirmOpen(true);
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

  const handlePostComment = () => {
    if (commentText.trim()) {
      postCommentMutation.mutate(commentText.trim());
    }
  };

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

  return (
    <>
      <Dialog open={open && !!job} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h5" component="span">
            {modalJob?.title}
          </Typography>
          <Chip
            label={formatStatusLabel(modalJob?.status)}
            color="primary"
            size="small"
            sx={{ ml: 2 }}
          />
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
        {jobLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        <Grid container spacing={3}>
          {/* Left Column: Core Details */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Job Controls
              </Typography>
              {isTechnician && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Assignment changes are disabled for technician accounts.
                </Alert>
              )}
              <Stack spacing={2}>
                <Box>
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
                </Box>

                <Divider />

                <Box>
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
                </Box>
              </Stack>
            </Paper>

            <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Job Details
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PlaceIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body1">
                  {modalJob?.property?.name || 'N/A'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CalendarTodayIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body1">
                  {modalJob?.scheduledDate ? formatDate(modalJob.scheduledDate) : 'Not Scheduled'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body1">
                  {modalJob?.assignedTo
                    ? `${modalJob.assignedTo.firstName} ${modalJob.assignedTo.lastName}`
                    : 'Unassigned'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 2 }}>
                <NotesIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {modalJob?.description}
                </Typography>
              </Box>
            </Paper>

            {/* Subtasks */}
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                <CheckCircleOutlineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Subtasks
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
            </Paper>
          </Grid>

          {/* Right Column: Activity & Attachments */}
          <Grid item xs={12} md={6}>
            {/* Activity Feed */}
            <Paper elevation={2} sx={{ p: 2, mb: 2, maxHeight: 400, overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                <CommentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Comments ({comments.length})
              </Typography>
              
              {commentsLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              
              {commentsError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Failed to load comments
                </Alert>
              )}
              
              {!commentsLoading && comments.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No comments yet. Be the first to comment!
                </Typography>
              )}
              
              <Stack spacing={2}>
                {comments.map((comment) => (
                  <Box key={comment.id} sx={{ display: 'flex' }}>
                    <Avatar 
                      sx={{ 
                        width: 32, 
                        height: 32, 
                        mr: 1.5, 
                        bgcolor: getRoleBadgeColor(comment.user.role) + '.main' 
                      }}
                    >
                      {comment.user.firstName.charAt(0)}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {comment.user.firstName} {comment.user.lastName}
                        </Typography>
                        <Chip 
                          label={comment.user.role.replace('_', ' ')} 
                          size="small" 
                          color={getRoleBadgeColor(comment.user.role)}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {comment.content}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
              
              <Divider sx={{ my: 2 }} />
              
              {/* Comment Input */}
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

            {/* Attachments */}
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                <AttachFileIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                File Attachments
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
            </Paper>
          </Grid>
        </Grid>
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
    </>
  );
};

export default JobDetailModal;
