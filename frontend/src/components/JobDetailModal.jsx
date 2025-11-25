
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
  ListItemIcon,
  Checkbox,
  TextField,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  IconButton,
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
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { formatDistanceToNow } from 'date-fns';
import { queryKeys } from '../utils/queryKeys.js';
import { formatDate } from '../utils/date';

const JobDetailModal = ({ job, open, onClose }) => {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  // Fetch comments for this job
  const {
    data: commentsData,
    isLoading: commentsLoading,
    error: commentsError,
  } = useQuery({
    queryKey: queryKeys.jobs.comments(job?.id),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.comments(job.id) });
      setCommentText('');
    },
  });

  const handlePostComment = () => {
    if (commentText.trim()) {
      postCommentMutation.mutate(commentText.trim());
    }
  };

  if (!job) {
    return null;
  }

  // Placeholder data for subtasks and attachments (to be implemented later)
  const subtasks = [
    { id: 1, text: 'Purchase materials', completed: true },
    { id: 2, text: 'Schedule with tenant', completed: false },
    { id: 3, text: 'Complete post-job cleanup', completed: false },
  ];

  const attachments = [
    { id: 1, name: 'Invoice.pdf', url: '#' },
    { id: 2, name: 'Damage_Photo.jpg', url: '#' },
  ];

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
    <Dialog open={open && !!job} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h5" component="span">
          {job.title}
        </Typography>
        <Chip
          label={job.status.replace('_', ' ')}
          color="primary"
          size="small"
          sx={{ ml: 2 }}
        />
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Left Column: Core Details */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Job Details
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PlaceIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body1">
                  {job.property?.name || 'N/A'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CalendarTodayIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body1">
                  {job.scheduledDate ? formatDate(job.scheduledDate) : 'Not Scheduled'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body1">
                  {job.assignedTo ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}` : 'Unassigned'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 2 }}>
                <NotesIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {job.description}
                </Typography>
              </Box>
            </Paper>

            {/* Subtasks */}
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                <CheckCircleOutlineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Subtasks
              </Typography>
              <List dense>
                {subtasks.map((task) => (
                  <ListItem key={task.id} disablePadding>
                    <ListItemIcon>
                      <Checkbox edge="start" checked={task.completed} tabIndex={-1} disableRipple />
                    </ListItemIcon>
                    <ListItemText primary={task.text} />
                  </ListItem>
                ))}
              </List>
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
              <List dense>
                {attachments.map((file) => (
                  <ListItem key={file.id} component="a" href={file.url} target="_blank" button>
                    <ListItemIcon>
                      <AttachFileIcon />
                    </ListItemIcon>
                    <ListItemText primary={file.name} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default JobDetailModal;
