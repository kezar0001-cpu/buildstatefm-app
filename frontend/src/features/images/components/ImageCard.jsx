import React, { useState, memo } from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  CardActions,
  IconButton,
  TextField,
  Chip,
  Box,
  CircularProgress,
  Tooltip,
  LinearProgress,
  Typography,
  alpha,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/**
 * Individual image card with actions and status
 *
 * Features:
 * - Preview display (optimistic local preview, then remote URL)
 * - Upload progress indicator
 * - Error state with retry
 * - Cover photo selection
 * - Caption editing
 * - Delete action
 * - Drag handle for reordering
 *
 * Memoized to prevent unnecessary re-renders
 */
const ImageCard = memo(function ImageCard({
  image,
  onDelete,
  onSetCover,
  onRetry,
  onUpdateCaption,
  allowCaptions = false,
  draggable = true,
  onDragStart,
  onDragEnd,
  onClick,
}) {
  const [captionValue, setCaptionValue] = useState(image.caption || '');
  const [isCaptionFocused, setIsCaptionFocused] = useState(false);

  const {
    id,
    localPreview,
    remoteUrl,
    status,
    progress,
    error,
    isPrimary,
    file,
  } = image;

  // Use remote URL if available, otherwise use local preview
  const imageUrl = remoteUrl || localPreview;

  const isUploading = status === 'uploading';
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const isPending = status === 'pending';

  /**
   * Handle caption blur
   */
  const handleCaptionBlur = () => {
    setIsCaptionFocused(false);
    if (onUpdateCaption && captionValue !== image.caption) {
      onUpdateCaption(id, captionValue);
    }
  };

  /**
   * Handle caption key press
   */
  const handleCaptionKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  /**
   * Get status indicator with smooth transitions
   */
  const renderStatusIndicator = () => {
    const chipStyles = {
      position: 'absolute',
      top: 8,
      right: 8,
      transition: 'all 0.3s ease-in-out',
    };

    if (isUploading) {
      return (
        <Chip
          size="small"
          icon={<CircularProgress size={14} sx={{ color: 'white' }} />}
          label={`${progress}%`}
          color="primary"
          sx={chipStyles}
        />
      );
    }

    if (isComplete) {
      return (
        <Chip
          size="small"
          icon={<CheckCircleIcon />}
          label="Uploaded"
          color="success"
          sx={chipStyles}
        />
      );
    }

    if (isError) {
      return (
        <Chip
          size="small"
          icon={<ErrorOutlineIcon />}
          label="Failed"
          color="error"
          sx={chipStyles}
        />
      );
    }

    if (isPending) {
      return (
        <Chip
          size="small"
          label="Pending"
          sx={chipStyles}
        />
      );
    }

    return null;
  };

  return (
    <Card
      draggable={draggable && !isUploading}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid',
        borderColor: isPrimary ? 'primary.main' : 'transparent',
        cursor: draggable && !isUploading ? 'move' : 'default',
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-4px)',
        },
      }}
    >
      {/* Image Preview */}
      <Box
        sx={{
          position: 'relative',
          paddingTop: '75%', // 4:3 aspect ratio
          overflow: 'hidden',
          backgroundColor: 'grey.100',
          cursor: onClick ? 'pointer' : 'default',
        }}
        onClick={onClick}
      >
        {imageUrl ? (
          <CardMedia
            component="img"
            image={imageUrl}
            alt={file?.name || 'Image preview'}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isUploading ? 0.6 : 1,
              transition: 'opacity 0.3s ease-in-out',
              // Bug Fix: Remove dynamic willChange to prevent layer switching during transition
              // The browser will optimize opacity transitions automatically
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {/* Upload Progress Bar */}
        {isUploading && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              transition: 'opacity 0.3s ease-in-out',
              '& .MuiLinearProgress-bar': {
                transition: 'transform 0.3s ease-in-out',
              },
            }}
          />
        )}

        {/* Status Indicator */}
        {renderStatusIndicator()}

        {/* Cover Photo Badge */}
        {isPrimary && (
          <Chip
            size="small"
            label="Cover Photo"
            color="primary"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              fontWeight: 'bold',
            }}
          />
        )}

        {/* Error Overlay */}
        {isError && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: alpha('#000', 0.7),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              padding: 2,
            }}
          >
            <ErrorOutlineIcon sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="caption" align="center">
              {error || 'Upload failed'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Caption Input */}
      {allowCaptions && (
        <CardContent sx={{ flexGrow: 1, pt: 1, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Add caption (optional)"
            value={captionValue}
            onChange={(e) => setCaptionValue(e.target.value)}
            onFocus={() => setIsCaptionFocused(true)}
            onBlur={handleCaptionBlur}
            onKeyPress={handleCaptionKeyPress}
            disabled={isUploading}
            variant="standard"
            sx={{ fontSize: '0.875rem' }}
          />
        </CardContent>
      )}

      {/* Actions */}
      <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
        <Box>
          {/* Set as Cover Button */}
          <Tooltip title={isPrimary ? 'Cover photo' : 'Set as cover photo'}>
            <span>
              <IconButton
                size="small"
                onClick={() => onSetCover && onSetCover(id)}
                disabled={isUploading || isPrimary}
                color={isPrimary ? 'primary' : 'default'}
              >
                {isPrimary ? <StarIcon /> : <StarBorderIcon />}
              </IconButton>
            </span>
          </Tooltip>

          {/* Retry Button (only for errors) */}
          {isError && onRetry && (
            <Tooltip title="Retry upload">
              <IconButton
                size="small"
                onClick={() => onRetry(id)}
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Delete Button */}
        <Tooltip title="Remove image">
          <IconButton
            size="small"
            onClick={() => onDelete && onDelete(id)}
            disabled={isUploading}
            color="error"
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </CardActions>

      {/* File Info */}
      {file && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            px: 2,
            pb: 1,
            fontSize: '0.7rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </Typography>
      )}
    </Card>
  );
});

export { ImageCard };
