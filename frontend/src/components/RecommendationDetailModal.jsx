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
  TextField,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  IconButton,
  MenuItem,
  DialogContentText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CalendarToday as CalendarTodayIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
  Notes as NotesIcon,
  Comment as CommentIcon,
  Send as SendIcon,
  AttachMoney as AttachMoneyIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DeleteOutline as DeleteOutlineIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { formatDistanceToNow } from 'date-fns';
import { queryKeys } from '../utils/queryKeys.js';
import { formatDate } from '../utils/date';
import ensureArray from '../utils/ensureArray';
import { useCurrentUser } from '../context/UserContext.jsx';
import toast from 'react-hot-toast';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
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
    ARCHIVED: 'default',
  };
  return colors[status] || 'default';
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

const RecommendationDetailModal = ({ recommendation, open, onClose, onUpdate, onDelete, initialEditMode = false, initialDeleteDialog = false }) => {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [commentText, setCommentText] = useState('');
  const [editMode, setEditMode] = useState(initialEditMode);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(initialDeleteDialog);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [deleteCommentId, setDeleteCommentId] = useState(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editEstimatedCost, setEditEstimatedCost] = useState('');

  const isPropertyManager = user?.role === 'PROPERTY_MANAGER';
  const canEdit = isPropertyManager;
  const canDelete = isPropertyManager;

  const commentsQueryKey = queryKeys.recommendations.comments(recommendation?.id);

  const { data: recommendationData, isLoading: recommendationLoading } = useQuery({
    queryKey: queryKeys.recommendations.detail(recommendation?.id),
    queryFn: async () => {
      const response = await apiClient.get(`/recommendations/${recommendation.id}`);
      return response.data;
    },
    enabled: open && !!recommendation?.id,
    initialData: recommendation,
  });

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: commentsQueryKey,
    queryFn: async () => {
      const response = await apiClient.get(`/recommendations/${recommendation.id}/comments`);
      return response.data;
    },
    enabled: open && !!recommendation?.id,
  });

  const comments = commentsData?.comments || [];

  useEffect(() => {
    if (recommendationData) {
      setEditTitle(recommendationData.title || '');
      setEditDescription(recommendationData.description || '');
      setEditPriority(recommendationData.priority || '');
      setEditEstimatedCost(recommendationData.estimatedCost?.toString() || '');
    }
  }, [recommendationData]);

  // Handle initial edit mode or delete dialog when modal opens
  useEffect(() => {
    if (open) {
      if (initialEditMode) {
        setEditMode(true);
      }
      if (initialDeleteDialog) {
        setDeleteDialogOpen(true);
      }
    } else {
      // Reset when modal closes
      setEditMode(false);
      setDeleteDialogOpen(false);
    }
  }, [open, initialEditMode, initialDeleteDialog]);

  const postCommentMutation = useMutation({
    mutationFn: async (content) => {
      const response = await apiClient.post(`/recommendations/${recommendation.id}/comments`, { content });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      setCommentText('');
      toast.success('Comment posted successfully');
    },
    onError: () => {
      toast.error('Failed to post comment');
    },
  });

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }) => {
      const response = await apiClient.patch(`/recommendations/${recommendation.id}/comments/${commentId}`, { content });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      setEditingCommentId(null);
      setEditCommentText('');
      toast.success('Comment updated successfully');
    },
    onError: () => {
      toast.error('Failed to update comment');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      const response = await apiClient.delete(`/recommendations/${recommendation.id}/comments/${commentId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      setDeleteCommentId(null);
      toast.success('Comment deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete comment');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.patch(`/recommendations/${recommendation.id}`, data);
      return response.data;
    },
    onSuccess: (updatedRecommendation) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.detail(recommendation.id) });
      setEditMode(false);
      toast.success('Recommendation updated successfully');
      if (onUpdate) {
        onUpdate(updatedRecommendation);
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to update recommendation');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete(`/recommendations/${recommendation.id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all() });
      setDeleteDialogOpen(false);
      toast.success('Recommendation deleted successfully');
      if (onDelete) {
        onDelete(recommendation.id);
      }
      handleClose();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to delete recommendation');
    },
  });

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

  const handleEditToggle = () => {
    if (editMode) {
      // Reset to original values
      setEditTitle(recommendationData?.title || '');
      setEditDescription(recommendationData?.description || '');
      setEditPriority(recommendationData?.priority || '');
      setEditEstimatedCost(recommendationData?.estimatedCost?.toString() || '');
    }
    setEditMode(!editMode);
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

    const data = {
      title: editTitle.trim(),
      description: editDescription.trim(),
      priority: editPriority,
      estimatedCost: editEstimatedCost ? parseFloat(editEstimatedCost) : null,
    };

    updateMutation.mutate(data);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteMutation.mutate();
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
  };

  const handleClose = () => {
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    onClose?.();
  };

  if (!recommendation) {
    return null;
  }

  const modalRecommendation = recommendationData || recommendation;
  const property = modalRecommendation.property;

  return (
    <>
      <Dialog
        open={open && !!recommendation}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        disableEnforceFocus
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1}>
              {canEdit && !editMode && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={handleEditToggle}
                  disabled={updateMutation.isPending}
                >
                  Edit
                </Button>
              )}
              {canDelete && !editMode && (
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteClick}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              )}
              <IconButton aria-label="Close" onClick={handleClose} size="small">
                <CloseIcon />
              </IconButton>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <LightbulbIcon sx={{ color: 'error.main' }} />
              <Typography variant="h5" component="span">
                {editMode ? 'Edit Recommendation' : modalRecommendation?.title}
              </Typography>
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            {recommendationLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={28} />
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <Grid container spacing={3} sx={{ maxWidth: '100%', justifyContent: 'center' }}>
                <Grid item xs={12} md={6} order={{ xs: 1, md: 1 }}>
                  <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, width: '100%' }}>
                  <Stack spacing={2}>
                    <Typography variant="h6">Recommendation Details</Typography>

                    {editMode ? (
                      <>
                        <TextField
                          label="Title"
                          fullWidth
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          required
                          disabled={updateMutation.isPending}
                        />
                        <TextField
                          label="Description"
                          fullWidth
                          multiline
                          rows={4}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          required
                          disabled={updateMutation.isPending}
                        />
                        <TextField
                          select
                          label="Priority"
                          fullWidth
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value)}
                          disabled={updateMutation.isPending}
                        >
                          {PRIORITY_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Estimated Cost"
                          fullWidth
                          type="number"
                          value={editEstimatedCost}
                          onChange={(e) => setEditEstimatedCost(e.target.value)}
                          disabled={updateMutation.isPending}
                          InputProps={{
                            startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                          }}
                        />
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            variant="outlined"
                            onClick={handleEditToggle}
                            disabled={updateMutation.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="contained"
                            onClick={handleSaveEdit}
                            disabled={updateMutation.isPending}
                            startIcon={updateMutation.isPending ? <CircularProgress size={20} /> : null}
                          >
                            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </Stack>
                      </>
                    ) : (
                      <>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {modalRecommendation?.status && (
                            <Chip
                              label={modalRecommendation.status.replace(/_/g, ' ')}
                              color={getStatusColor(modalRecommendation.status)}
                              size="small"
                            />
                          )}
                          {modalRecommendation?.priority && (
                            <Chip
                              label={modalRecommendation.priority}
                              color={getPriorityColor(modalRecommendation.priority)}
                              size="small"
                            />
                          )}
                        </Stack>

                        <Box
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: 'action.hover',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Stack spacing={1.5}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PlaceIcon sx={{ color: 'text.secondary' }} fontSize="small" />
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                  Property
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {property?.name || 'N/A'}
                                </Typography>
                              </Box>
                            </Box>

                            {modalRecommendation?.estimatedCost && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <AttachMoneyIcon sx={{ color: 'text.secondary' }} fontSize="small" />
                                <Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                    Estimated Cost
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                    ${modalRecommendation.estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </Typography>
                                </Box>
                              </Box>
                            )}

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CalendarTodayIcon sx={{ color: 'text.secondary' }} fontSize="small" />
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                  Created
                                </Typography>
                                <Typography variant="body2">
                                  {modalRecommendation?.createdAt ? formatDate(modalRecommendation.createdAt) : 'N/A'}
                                </Typography>
                              </Box>
                            </Box>

                            {modalRecommendation?.createdBy && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PersonIcon sx={{ color: 'text.secondary' }} fontSize="small" />
                                <Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                    Created By
                                  </Typography>
                                  <Typography variant="body2">
                                    {modalRecommendation.createdBy.firstName} {modalRecommendation.createdBy.lastName}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          </Stack>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <NotesIcon sx={{ color: 'text.secondary', mt: 0.25 }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                              Description
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                              {modalRecommendation?.description}
                            </Typography>
                          </Box>
                        </Box>

                        {modalRecommendation?.status === 'REJECTED' && modalRecommendation?.rejectionReason && (
                          <Box>
                            <Alert severity="error" sx={{ mb: 1 }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Rejection Reason:</Typography>
                              <Typography variant="body2">{modalRecommendation.rejectionReason}</Typography>
                            </Alert>
                            {modalRecommendation?.managerResponse && (
                              <Alert severity="info">
                                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Manager Response:</Typography>
                                <Typography variant="body2">{modalRecommendation.managerResponse}</Typography>
                              </Alert>
                            )}
                          </Box>
                        )}
                      </>
                    )}
                  </Stack>
                </Paper>
              </Grid>

                <Grid item xs={12} md={6} order={{ xs: 2, md: 2 }}>
                  <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, width: '100%' }}>
                    <Typography variant="h6" gutterBottom>
                      <CommentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Comments
                    </Typography>
                    {commentsLoading && <Typography>Loading comments...</Typography>}
                    {comments.length === 0 && !commentsLoading ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        No comments yet. Be the first to add one.
                      </Typography>
                    ) : (
                      <Stack spacing={2} sx={{ maxHeight: { xs: 300, md: 400 }, overflowY: 'auto', mb: 2 }}>
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
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={deleteMutation.isPending ? undefined : handleCancelDelete}
      >
        <DialogTitle>Delete Recommendation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this recommendation? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={20} /> : null}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
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

export default RecommendationDetailModal;
