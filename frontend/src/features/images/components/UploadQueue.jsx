import React, { useState, useEffect, useRef } from 'react';
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const COLLAPSE_PREFERENCE_KEY = 'upload_queue_collapsed';

/**
 * Expand the upload queue by updating localStorage preference
 * This can be called from anywhere to force the queue to expand
 */
export function expandUploadQueue() {
  try {
    localStorage.setItem(COLLAPSE_PREFERENCE_KEY, JSON.stringify(false));
    // Dispatch a storage event to notify the UploadQueue component
    window.dispatchEvent(new StorageEvent('storage', {
      key: COLLAPSE_PREFERENCE_KEY,
      newValue: JSON.stringify(false),
    }));
  } catch (err) {
    console.error('[UploadQueue] Failed to expand queue:', err);
  }
}

/**
 * Upload queue progress indicator
 *
 * Shows:
 * - Overall upload progress
 * - Individual file status
 * - Completion/error summary
 * - Resume button for failed uploads
 * - Auto-collapse after completion
 * - Expand/collapse toggle with localStorage persistence
 */
export function UploadQueue({
  images = [],
  isUploading = false,
  onClose,
  onResumeUploads,
  compact: initialCompact = false,
}) {
  // Load collapse preference from localStorage or use prop
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_PREFERENCE_KEY);
      return saved !== null ? JSON.parse(saved) : initialCompact;
    } catch {
      return initialCompact;
    }
  });

  const autoCollapseTimerRef = useRef(null);
  const previousUploadingRef = useRef(isUploading);

  const total = images.length;
  const completed = images.filter(img => img.status === 'complete').length;
  const uploading = images.filter(img => img.status === 'uploading').length;
  const failed = images.filter(img => img.status === 'error').length;
  const pending = images.filter(img => img.status === 'pending').length;

  const overallProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const show = isUploading || uploading > 0 || failed > 0;

  // Listen for external expand requests via storage events
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === COLLAPSE_PREFERENCE_KEY && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          setIsCollapsed(newValue);
        } catch (err) {
          console.error('[UploadQueue] Failed to parse storage event:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Auto-collapse 3 seconds after all uploads complete
  useEffect(() => {
    // Clear any existing timer
    if (autoCollapseTimerRef.current) {
      clearTimeout(autoCollapseTimerRef.current);
      autoCollapseTimerRef.current = null;
    }

    // Check if we just finished uploading (was uploading, now not)
    const justFinished = previousUploadingRef.current && !isUploading;
    previousUploadingRef.current = isUploading;

    // Only auto-collapse if:
    // 1. Just finished uploading
    // 2. All uploads succeeded (no failures)
    // 3. Queue is currently expanded
    if (justFinished && failed === 0 && total > 0 && !isCollapsed) {
      console.log('[UploadQueue] All uploads complete, auto-collapsing in 3 seconds...');
      autoCollapseTimerRef.current = setTimeout(() => {
        setIsCollapsed(true);
        // Save preference
        try {
          localStorage.setItem(COLLAPSE_PREFERENCE_KEY, JSON.stringify(true));
        } catch (err) {
          console.error('[UploadQueue] Failed to save collapse preference:', err);
        }
      }, 3000);
    }

    return () => {
      if (autoCollapseTimerRef.current) {
        clearTimeout(autoCollapseTimerRef.current);
      }
    };
  }, [isUploading, failed, total, isCollapsed]);

  // Toggle collapse state
  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const newValue = !prev;
      // Save preference to localStorage
      try {
        localStorage.setItem(COLLAPSE_PREFERENCE_KEY, JSON.stringify(newValue));
      } catch (err) {
        console.error('[UploadQueue] Failed to save collapse preference:', err);
      }
      return newValue;
    });
  };

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
   * Compact view - just progress bar with expand button
   */
  if (isCollapsed) {
    return (
      <Collapse in={show}>
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" gutterBottom>
                {isUploading ? 'Uploading' : 'Upload complete'} {completed}/{total} images
                {failed > 0 && ` • ${failed} failed`}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={overallProgress}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
            <IconButton
              size="small"
              onClick={handleToggleCollapse}
              title="Expand upload details"
            >
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
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
            <IconButton
              size="small"
              onClick={handleToggleCollapse}
              title="Collapse upload details"
            >
              <ExpandLessIcon fontSize="small" />
            </IconButton>
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
