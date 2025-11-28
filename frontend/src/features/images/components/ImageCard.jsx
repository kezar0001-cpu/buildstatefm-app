import React, { useState, memo, useEffect } from 'react';
import {
  Card,
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
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { LazyImage } from './LazyImage';

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
  onUpdateCategory,
  allowCaptions = false,
  draggable = true,
  onDragStart,
  onDragEnd,
  onClick,
  isSelected = false,
  onToggleSelect,
  selectionMode = false,
}) {
  const [captionValue, setCaptionValue] = useState(image.caption || '');
  const [categoryValue, setCategoryValue] = useState(image.category || 'OTHER');
  const [isCaptionFocused, setIsCaptionFocused] = useState(false);

  // Sync local state when image prop changes
  useEffect(() => {
    setCaptionValue(image.caption || '');
    setCategoryValue(image.category || 'OTHER');
  }, [image.caption, image.category]);

  const {
    id,
    localPreview,
    remoteUrl,
    variants,
    status,
    progress,
    error,
    isPrimary,
    file,
  } = image;

  // Bug Fix: Always prefer localPreview to prevent flicker when switching to remoteUrl
  // The localPreview is a blob URL that's already loaded, so using it prevents
  // the browser from having to load a new image when upload completes
  // remoteUrl is still stored and used for form submission, just not displayed
  const imageUrl = localPreview || remoteUrl;

  // Check if responsive image variants are available
  const hasResponsiveVariants = variants && typeof variants === 'object' && Object.keys(variants).length > 0;

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
   * Handle category change
   */
  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setCategoryValue(newCategory);
    if (onUpdateCategory) {
      onUpdateCategory(id, newCategory);
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

  /**
   * Handle card click for selection
   */
  const handleCardClick = (e) => {
    if (selectionMode && onToggleSelect) {
      // Prevent clicks on interactive elements from triggering selection
      if (
        e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('textarea')
      ) {
        return;
      }
      onToggleSelect(id);
    } else if (onClick) {
      onClick(e);
    }
  };

  return (
    <Card
      className="image-card-drag-target"
      draggable={draggable && !isUploading && !selectionMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={handleCardClick}
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid',
        borderColor: isSelected ? 'primary.main' : isPrimary ? 'primary.main' : 'transparent',
        cursor: selectionMode ? 'pointer' : onClick && !selectionMode ? 'pointer' : draggable && !isUploading ? 'move' : 'default',
        transition: 'all 0.2s',
        backgroundColor: isSelected ? alpha('#1976d2', 0.08) : 'background.paper',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-4px)',
        },
      }}
    >
      {/* Selection Checkbox */}
      {selectionMode && (
        <Checkbox
          checked={isSelected}
          onChange={() => onToggleSelect && onToggleSelect(id)}
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            '&:hover': {
              backgroundColor: 'background.paper',
            },
          }}
          onClick={(e) => e.stopPropagation()}
          inputProps={{
            'aria-label': `Select ${file?.name || 'image'}`,
          }}
        />
      )}

      {/* Image Preview with Lazy Loading and Responsive Variants */}
      <Box
        sx={{
          position: 'relative',
          cursor: selectionMode ? 'pointer' : onClick ? 'pointer' : 'default',
        }}
      >
        {imageUrl || hasResponsiveVariants ? (
          hasResponsiveVariants && !localPreview ? (
            // Use responsive picture element with srcset when variants are available
            <Box
              sx={{
                position: 'relative',
                paddingTop: '75%', // 4:3 aspect ratio
                overflow: 'hidden',
                backgroundColor: 'grey.100',
              }}
            >
              <picture
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                }}
              >
                {/* WebP sources for modern browsers */}
                {variants['thumbnail-webp'] && (
                  <source
                    type="image/webp"
                    srcSet={`${variants['thumbnail-webp']} 200w${variants['medium-webp'] ? `, ${variants['medium-webp']} 800w` : ''}${variants['original-webp'] ? `, ${variants['original-webp']} 1920w` : ''}`}
                    sizes="(max-width: 600px) 200px, (max-width: 1200px) 800px, 1920px"
                  />
                )}
                {/* JPEG fallback */}
                {variants['thumbnail-jpg'] && (
                  <source
                    type="image/jpeg"
                    srcSet={`${variants['thumbnail-jpg']} 200w${variants['medium-jpg'] ? `, ${variants['medium-jpg']} 800w` : ''}${variants['original-jpg'] ? `, ${variants['original-jpg']} 1920w` : ''}`}
                    sizes="(max-width: 600px) 200px, (max-width: 1200px) 800px, 1920px"
                  />
                )}
                {/* Fallback img tag */}
                <img
                  src={variants['medium-jpg'] || variants['original-jpg'] || variants['thumbnail-jpg']}
                  alt={file?.name || 'Image preview'}
                  loading={isUploading || isPending ? 'eager' : 'lazy'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: isUploading ? 0.6 : 1,
                    transition: 'opacity 0.3s ease-in-out',
                  }}
                />
              </picture>
            </Box>
          ) : (
            // Use standard lazy image for non-responsive images or local previews
            <LazyImage
              src={imageUrl}
              alt={file?.name || 'Image preview'}
              aspectRatio="4/3"
              eager={isUploading || isPending} // Load immediately if still uploading
              sx={{
                opacity: isUploading ? 0.6 : 1,
                transition: 'opacity 0.3s ease-in-out',
              }}
            />
          )
        ) : (
          <Box
            sx={{
              position: 'relative',
              paddingTop: '75%', // 4:3 aspect ratio
              overflow: 'hidden',
              backgroundColor: 'grey.100',
            }}
          >
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

      {/* Caption Input and Category Selector */}
      {allowCaptions && (
        <CardContent sx={{ flexGrow: 1, pt: 1, pb: 1 }}>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel id={`category-label-${id}`}>Category</InputLabel>
            <Select
              labelId={`category-label-${id}`}
              id={`category-select-${id}`}
              value={categoryValue}
              label="Category"
              onChange={handleCategoryChange}
              disabled={isUploading}
              size="small"
              inputProps={{
                'aria-label': `Category for ${file?.name || 'this image'}`,
              }}
            >
              <MenuItem value="EXTERIOR">Exterior</MenuItem>
              <MenuItem value="INTERIOR">Interior</MenuItem>
              <MenuItem value="KITCHEN">Kitchen</MenuItem>
              <MenuItem value="BATHROOM">Bathroom</MenuItem>
              <MenuItem value="BEDROOM">Bedroom</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
            </Select>
          </FormControl>
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
            inputProps={{
              'aria-label': `Caption for ${file?.name || 'this image'}`,
            }}
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
                aria-label={isPrimary ? `${file?.name || 'This image'} is the cover photo` : `Set ${file?.name || 'this image'} as cover photo`}
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
                aria-label={`Retry upload for ${file?.name || 'this image'}`}
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
            aria-label={`Remove ${file?.name || 'this image'}`}
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
