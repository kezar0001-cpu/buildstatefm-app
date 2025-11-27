import React from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Paper,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import UploadingIcon from '@mui/icons-material/CloudUpload';
import RestoreIcon from '@mui/icons-material/Restore';

/**
 * Upload queue progress indicator
 *
 * Shows:
 * - Overall upload progress
 * - Individual file status
 * - Completion/error summary
 * - Resume button for failed uploads
 */
export function UploadQueue({
  images = [],
  isUploading = false,
  onClose,
  onResumeUploads,
  compact = false,
}) {
  const total = images.length;
  const completed = images.filter(img => img.status === 'complete').length;
  const uploading = images.filter(img => img.status === 'uploading').length;
  const failed = images.filter(img => img.status === 'error').length;
  const pending = images.filter(img => img.status === 'pending').length;

  const overallProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const show = isUploading || uploading > 0 || failed > 0;

  if (!show) return null;

  /**
   * Get status icon
   */
  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'error':
        return <ErrorIcon fontSize="small" color="error" />;
      case 'uploading':
        return <UploadingIcon fontSize="small" color="primary" />;
      default:
        return null;
    }
  };

  /**
   * Compact view - just progress bar
   */
  if (compact) {
    return (
      <Collapse in={show}>
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" gutterBottom>
                Uploading {completed}/{total} images...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={overallProgress}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
            {onClose && !isUploading && (
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Paper>
      </Collapse>
    );
  }

  /**
   * Detailed view - list of files
   */
  return (
    <Collapse in={show}>
      <Paper elevation={2} sx={{ mb: 2 }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box>
            <Typography variant="subtitle2">
              Upload Progress
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {completed}/{total} completed
              {failed > 0 && ` • ${failed} failed`}
              {pending > 0 && ` • ${pending} pending`}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {failed > 0 && onResumeUploads && !isUploading && (
              <Button
                size="small"
                startIcon={<RestoreIcon />}
                onClick={onResumeUploads}
                color="primary"
                variant="outlined"
              >
                Resume uploads
              </Button>
            )}
            <Chip
              size="small"
              label={`${overallProgress}%`}
              color={failed > 0 ? 'error' : 'primary'}
            />
            {onClose && !isUploading && (
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Overall Progress */}
        <Box sx={{ px: 2, pt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={overallProgress}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        {/* File List */}
        <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
          {images.map((image) => (
            <ListItem
              key={image.id}
              secondaryAction={getStatusIcon(image.status)}
            >
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ maxWidth: '80%' }}
                  >
                    {image.file?.name || 'Unknown file'}
                  </Typography>
                }
                secondary={
                  image.status === 'uploading'
                    ? `${image.progress}%`
                    : image.status === 'error'
                    ? image.error || 'Failed'
                    : image.status === 'complete'
                    ? 'Uploaded'
                    : 'Pending'
                }
              />
              {image.status === 'uploading' && (
                <LinearProgress
                  variant="determinate"
                  value={image.progress}
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                  }}
                />
              )}
            </ListItem>
          ))}
        </List>
      </Paper>
    </Collapse>
  );
}
