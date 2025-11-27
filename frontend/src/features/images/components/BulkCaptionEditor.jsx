import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Box,
  TextField,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Chip,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckIcon from '@mui/icons-material/Check';

/**
 * Bulk Caption Editor Modal
 *
 * Features:
 * - Grid display of all images with caption inputs
 * - Tab navigation between caption fields
 * - "Apply to All" functionality
 * - Contextual actions per image
 * - Save all changes at once
 */
export function BulkCaptionEditor({ open, onClose, images = [], onSave }) {
  const [captions, setCaptions] = useState({});
  const [copyMenuAnchor, setCopyMenuAnchor] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const inputRefs = useRef({});

  // Initialize captions when dialog opens
  useEffect(() => {
    if (open && images.length > 0) {
      const initialCaptions = {};
      images.forEach(image => {
        initialCaptions[image.id] = image.caption || '';
      });
      setCaptions(initialCaptions);
      setHasChanges(false);
    }
  }, [open, images]);

  /**
   * Handle caption change
   */
  const handleCaptionChange = (imageId, value) => {
    setCaptions(prev => ({
      ...prev,
      [imageId]: value,
    }));
    setHasChanges(true);
  };

  /**
   * Handle key down for tab navigation
   */
  const handleKeyDown = (imageId, event) => {
    if (event.key === 'Tab') {
      event.preventDefault();

      const imageIds = images.map(img => img.id);
      const currentIndex = imageIds.indexOf(imageId);

      let nextIndex;
      if (event.shiftKey) {
        // Shift+Tab - go to previous
        nextIndex = currentIndex > 0 ? currentIndex - 1 : imageIds.length - 1;
      } else {
        // Tab - go to next
        nextIndex = currentIndex < imageIds.length - 1 ? currentIndex + 1 : 0;
      }

      const nextImageId = imageIds[nextIndex];
      if (inputRefs.current[nextImageId]) {
        inputRefs.current[nextImageId].focus();
      }
    }
  };

  /**
   * Open copy menu
   */
  const handleOpenCopyMenu = (event, imageId) => {
    event.stopPropagation();
    setCopyMenuAnchor(event.currentTarget);
    setSelectedImageId(imageId);
  };

  /**
   * Close copy menu
   */
  const handleCloseCopyMenu = () => {
    setCopyMenuAnchor(null);
    setSelectedImageId(null);
  };

  /**
   * Apply caption to all images
   */
  const handleApplyToAll = () => {
    const caption = captions[selectedImageId];
    const newCaptions = {};
    images.forEach(image => {
      newCaptions[image.id] = caption;
    });
    setCaptions(newCaptions);
    setHasChanges(true);
    handleCloseCopyMenu();
  };

  /**
   * Apply caption to all images without a caption
   */
  const handleApplyToEmpty = () => {
    const caption = captions[selectedImageId];
    setCaptions(prev => {
      const newCaptions = { ...prev };
      images.forEach(image => {
        if (!newCaptions[image.id] || newCaptions[image.id].trim() === '') {
          newCaptions[image.id] = caption;
        }
      });
      return newCaptions;
    });
    setHasChanges(true);
    handleCloseCopyMenu();
  };

  /**
   * Clear all captions
   */
  const handleClearAll = () => {
    const newCaptions = {};
    images.forEach(image => {
      newCaptions[image.id] = '';
    });
    setCaptions(newCaptions);
    setHasChanges(true);
  };

  /**
   * Handle save
   */
  const handleSave = () => {
    // Build array of changes
    const changes = images.map(image => ({
      id: image.id,
      caption: captions[image.id] || '',
    }));

    onSave(changes);
    setHasChanges(false);
  };

  /**
   * Handle close with confirmation if there are unsaved changes
   */
  const handleClose = () => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  };

  // Calculate statistics
  const totalImages = images.length;
  const captionedImages = Object.values(captions).filter(c => c && c.trim() !== '').length;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" component="div">
              Edit All Captions
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {captionedImages} of {totalImages} images have captions
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={hasChanges ? 'Unsaved Changes' : 'No Changes'}
              color={hasChanges ? 'warning' : 'default'}
              size="small"
            />
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Use Tab to navigate between caption fields
          </Typography>
          <Button
            size="small"
            color="error"
            onClick={handleClearAll}
            disabled={captionedImages === 0}
          >
            Clear All Captions
          </Button>
        </Box>

        <Grid container spacing={3}>
          {images.map((image, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={image.id}>
              <Paper
                elevation={2}
                sx={{
                  p: 1.5,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  '&:hover .copy-button': {
                    opacity: 1,
                  },
                }}
              >
                {/* Image Number Badge */}
                <Chip
                  label={`#${index + 1}`}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    fontWeight: 'bold',
                  }}
                />

                {/* Copy Button */}
                <IconButton
                  className="copy-button"
                  size="small"
                  onClick={(e) => handleOpenCopyMenu(e, image.id)}
                  disabled={!captions[image.id] || captions[image.id].trim() === ''}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 1)',
                    },
                    '&.Mui-disabled': {
                      opacity: 0,
                    },
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>

                {/* Image Thumbnail */}
                <Box
                  sx={{
                    width: '100%',
                    height: 150,
                    borderRadius: 1,
                    overflow: 'hidden',
                    mb: 1.5,
                    backgroundColor: 'grey.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={image.remoteUrl || image.localPreview}
                    alt={image.file?.name || 'Image'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </Box>

                {/* Filename */}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mb: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={image.file?.name}
                >
                  {image.file?.name || 'Unknown'}
                </Typography>

                {/* Caption Input */}
                <TextField
                  inputRef={(el) => {
                    if (el) {
                      inputRefs.current[image.id] = el;
                    }
                  }}
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Enter caption..."
                  value={captions[image.id] || ''}
                  onChange={(e) => handleCaptionChange(image.id, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(image.id, e)}
                  variant="outlined"
                  size="small"
                  InputProps={{
                    endAdornment: captions[image.id] && captions[image.id].trim() !== '' ? (
                      <CheckIcon fontSize="small" color="success" />
                    ) : null,
                  }}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.875rem',
                    },
                  }}
                />

                {/* Category Badge */}
                {image.category && (
                  <Chip
                    label={image.category}
                    size="small"
                    sx={{ mt: 1, alignSelf: 'flex-start' }}
                  />
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Copy Menu */}
        <Menu
          anchorEl={copyMenuAnchor}
          open={Boolean(copyMenuAnchor)}
          onClose={handleCloseCopyMenu}
        >
          <MenuItem onClick={handleApplyToAll}>
            <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
            Apply to All Images
          </MenuItem>
          <MenuItem onClick={handleApplyToEmpty}>
            <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
            Apply to Empty Captions Only
          </MenuItem>
        </Menu>
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', p: 2, gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {hasChanges && 'Don\'t forget to save your changes!'}
        </Typography>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!hasChanges}
          startIcon={<CheckIcon />}
        >
          Save Captions
        </Button>
      </DialogActions>
    </Dialog>
  );
}
