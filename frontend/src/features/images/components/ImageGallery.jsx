import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, Box, Typography, Button, Alert, Paper, Toolbar, IconButton, Tooltip, FormControl, Select, MenuItem, InputLabel, MobileStepper } from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteIcon from '@mui/icons-material/Delete';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import ReorderIcon from '@mui/icons-material/Reorder';
import FilterListIcon from '@mui/icons-material/FilterList';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import { ImageCard } from './ImageCard';
import { BulkCaptionEditor } from './BulkCaptionEditor';
import { motion, AnimatePresence } from 'framer-motion';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { Virtuoso } from 'react-virtuoso';

/**
 * Image gallery with grid layout and drag-and-drop reordering
 *
 * Features:
 * - Responsive grid layout (1-4 columns)
 * - Drag-and-drop reordering
 * - Empty state
 * - Bulk actions
 * - Lightbox support (future)
 */
export function ImageGallery({
  images = [],
  onDelete,
  onSetCover,
  onRetry,
  onUpdateCaption,
  onUpdateCategory,
  onReorder,
  onClearAll,
  onBulkDelete,
  onBulkReorder,
  onFilesSelected,
  allowCaptions = false,
  allowReordering = true,
  enableBulkOperations = true,
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [moveMode, setMoveMode] = useState(false);
  const [moveSourceIndex, setMoveSourceIndex] = useState(null);
  const [moveTargetIndex, setMoveTargetIndex] = useState(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Bulk caption editor state
  const [bulkCaptionEditorOpen, setBulkCaptionEditorOpen] = useState(false);

  // Empty state carousel
  const [emptyStateStep, setEmptyStateStep] = useState(0);

  // Ref for drag ghost image
  const dragGhostRef = useRef(null);

  // Ref for file input in empty state
  const fileInputRef = useRef(null);

  // Empty state drag and drop
  const [emptyStateDragging, setEmptyStateDragging] = useState(false);
  const [emptyStateDragCounter, setEmptyStateDragCounter] = useState(0);

  // Filter images by category
  const filteredImages = categoryFilter === 'ALL'
    ? images
    : images.filter(img => img.category === categoryFilter);

  const hasImages = images.length > 0;
  const hasErrors = images.some(img => img.status === 'error');
  const hasSelection = selectedIds.size > 0;
  const allSelected = images.length > 0 && selectedIds.size === images.length;

  /**
   * Toggle selection for a single image
   */
  const toggleSelect = useCallback((imageId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      // Auto-enable selection mode if items are selected
      if (newSet.size > 0) {
        setSelectionMode(true);
      } else {
        setSelectionMode(false);
      }
      return newSet;
    });
  }, []);

  /**
   * Select all images
   */
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(images.map(img => img.id)));
    setSelectionMode(true);
  }, [images]);

  /**
   * Deselect all images
   */
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  /**
   * Handle bulk delete
   */
  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;

    const idsToDelete = Array.from(selectedIds);

    if (onBulkDelete) {
      onBulkDelete(idsToDelete);
    } else if (onDelete) {
      // Fallback to individual deletes
      idsToDelete.forEach(id => onDelete(id));
    }

    deselectAll();
  }, [selectedIds, onBulkDelete, onDelete, deselectAll]);

  /**
   * Handle bulk reorder - set order based on current selection
   */
  const handleBulkSetOrder = useCallback(() => {
    if (selectedIds.size === 0) return;

    const selectedImages = images.filter(img => selectedIds.has(img.id));

    // Move selected images to the front
    const reorderMap = selectedImages.map((img, index) => ({
      id: img.id,
      newOrder: index,
    }));

    if (onBulkReorder) {
      onBulkReorder(reorderMap);
    }

    deselectAll();
  }, [selectedIds, images, onBulkReorder, deselectAll]);

  /**
   * Handle bulk caption save
   */
  const handleBulkCaptionSave = useCallback((changes) => {
    if (!onUpdateCaption) return;

    // Apply all caption changes
    changes.forEach(({ id, caption }) => {
      onUpdateCaption(id, caption);
    });

    setBulkCaptionEditorOpen(false);
  }, [onUpdateCaption]);

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if focused on an input element
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

      // Cmd/Ctrl+A - Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && enableBulkOperations && !isInputFocused) {
        e.preventDefault();
        selectAll();
      }

      // Delete/Backspace - Delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection && enableBulkOperations && !isInputFocused) {
        e.preventDefault();
        handleBulkDelete();
      }

      // Escape - Cancel move mode or deselect all
      if (e.key === 'Escape') {
        if (moveMode) {
          e.preventDefault();
          setMoveMode(false);
          setMoveSourceIndex(null);
          setMoveTargetIndex(null);
        } else if (hasSelection) {
          e.preventDefault();
          deselectAll();
        }
      }

      // Arrow keys - Navigate through images or move target in move mode
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && !isInputFocused) {
        e.preventDefault();

        if (filteredImages.length === 0) return;

        if (moveMode) {
          // In move mode, arrow keys adjust the target position
          const currentTarget = moveTargetIndex !== null ? moveTargetIndex : moveSourceIndex;
          let newTarget = currentTarget;

          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            newTarget = Math.min(currentTarget + 1, filteredImages.length - 1);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            newTarget = Math.max(currentTarget - 1, 0);
          }

          setMoveTargetIndex(newTarget);
        } else {
          // Normal navigation mode
          let currentIndex = focusedIndex !== null ? focusedIndex : 0;
          let newIndex = currentIndex;

          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            newIndex = Math.min(currentIndex + 1, filteredImages.length - 1);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            newIndex = Math.max(currentIndex - 1, 0);
          }

          setFocusedIndex(newIndex);

          // Focus the image card
          const imageCards = document.querySelectorAll('.image-card-keyboard-target');
          if (imageCards[newIndex]) {
            imageCards[newIndex].focus();
          }
        }
      }

      // Enter - Toggle move mode or confirm move
      if (e.key === 'Enter' && allowReordering && !isInputFocused && focusedIndex !== null) {
        e.preventDefault();

        if (moveMode) {
          // Confirm move
          const targetIndex = moveTargetIndex !== null ? moveTargetIndex : moveSourceIndex;
          if (moveSourceIndex !== null && targetIndex !== moveSourceIndex && onReorder) {
            onReorder(moveSourceIndex, targetIndex);
          }
          setMoveMode(false);
          setMoveSourceIndex(null);
          setMoveTargetIndex(null);
        } else {
          // Enter move mode
          setMoveMode(true);
          setMoveSourceIndex(focusedIndex);
          setMoveTargetIndex(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, deselectAll, handleBulkDelete, hasSelection, enableBulkOperations, moveMode, focusedIndex, moveSourceIndex, moveTargetIndex, filteredImages, allowReordering, onReorder]);

  /**
   * Clear selection when images change significantly
   */
  useEffect(() => {
    // Clear selection if selected images no longer exist
    if (selectedIds.size > 0) {
      const imageIds = new Set(images.map(img => img.id));
      const stillValid = Array.from(selectedIds).filter(id => imageIds.has(id));
      if (stillValid.length !== selectedIds.size) {
        setSelectedIds(new Set(stillValid));
        if (stillValid.length === 0) {
          setSelectionMode(false);
        }
      }
    }
  }, [images, selectedIds]);

  /**
   * Handle drag start with custom drag ghost image
   */
  const handleDragStart = (index) => (event) => {
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.currentTarget);

    // Create custom drag ghost image
    const dragElement = event.currentTarget.querySelector('.image-card-drag-target');
    if (dragElement) {
      const clone = dragElement.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.top = '-1000px';
      clone.style.width = dragElement.offsetWidth + 'px';
      clone.style.transform = 'rotate(5deg)';
      clone.style.opacity = '0.8';
      clone.style.border = '3px solid #1976d2';
      clone.style.borderRadius = '8px';
      clone.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
      document.body.appendChild(clone);

      try {
        event.dataTransfer.setDragImage(clone, dragElement.offsetWidth / 2, dragElement.offsetHeight / 2);
      } catch (e) {
        console.warn('Failed to set drag image:', e);
      }

      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(clone);
      }, 0);
    }

    // Reduce opacity of original element
    event.currentTarget.style.opacity = '0.3';
  };

  /**
   * Handle drag end
   */
  const handleDragEnd = (event) => {
    event.currentTarget.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  /**
   * Handle drag over
   */
  const handleDragOver = (index) => (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (draggedIndex === null || draggedIndex === index) {
      return;
    }

    setDragOverIndex(index);
  };

  /**
   * Handle drop
   */
  const handleDrop = (index) => (event) => {
    event.preventDefault();

    if (draggedIndex === null || draggedIndex === index) {
      return;
    }

    console.log(`[ImageGallery] Reordering: ${draggedIndex} -> ${index}`);

    if (onReorder) {
      onReorder(draggedIndex, index);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  /**
   * Handle image click to open lightbox
   */
  const handleImageClick = useCallback((imageId) => {
    if (selectionMode) return; // Don't open lightbox in selection mode

    const imageIndex = filteredImages.findIndex(img => img.id === imageId);
    if (imageIndex !== -1) {
      setLightboxIndex(imageIndex);
      setLightboxOpen(true);
    }
  }, [filteredImages, selectionMode]);

  /**
   * Empty state file input handlers
   */
  const handleEmptyStateClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleEmptyStateFileChange = useCallback((event) => {
    const files = event.target.files;
    if (files && files.length > 0 && onFilesSelected) {
      onFilesSelected(Array.from(files));
      event.target.value = ''; // Reset input
    }
  }, [onFilesSelected]);

  /**
   * Empty state drag and drop handlers
   */
  const handleEmptyStateDragEnter = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setEmptyStateDragCounter(prev => prev + 1);
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      setEmptyStateDragging(true);
    }
  }, []);

  const handleEmptyStateDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setEmptyStateDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setEmptyStateDragging(false);
      }
      return newCounter;
    });
  }, []);

  const handleEmptyStateDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleEmptyStateDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setEmptyStateDragging(false);
    setEmptyStateDragCounter(0);

    const files = event.dataTransfer.files;
    if (files && files.length > 0 && onFilesSelected) {
      onFilesSelected(Array.from(files));
    }
  }, [onFilesSelected]);

  /**
   * Empty state carousel navigation
   */
  const handleEmptyStateNext = () => {
    setEmptyStateStep((prevStep) => (prevStep + 1) % onboardingTips.length);
  };

  const handleEmptyStateBack = () => {
    setEmptyStateStep((prevStep) => (prevStep - 1 + onboardingTips.length) % onboardingTips.length);
  };

  // Onboarding tips for carousel
  const onboardingTips = [
    { title: 'Tip 1: Drag to Reorder', description: 'Click and drag images to rearrange their order' },
    { title: 'Tip 2: Star Icon Sets Cover Photo', description: 'Click the star icon on any image to set it as the cover photo' },
    { title: 'Tip 3: Bulk Operations', description: 'Select multiple images and perform actions like delete or reorder' },
    { title: 'Tip 4: Add Captions', description: 'Enhance your images with descriptive captions for better context' },
    { title: 'Tip 5: Categorize Images', description: 'Organize your images by room type for easy filtering' },
  ];

  /**
   * Prepare slides for lightbox with metadata
   */
  const lightboxSlides = filteredImages.map(image => ({
    src: image.remoteUrl || image.localPreview,
    alt: image.file?.name || 'Image',
    width: 1920,
    height: 1080,
    // Custom metadata for footer
    caption: image.caption,
    filename: image.file?.name,
    size: image.file?.size,
    date: image.uploadedAt || new Date().toISOString(),
    category: image.category,
  }));

  /**
   * Empty state with illustration and onboarding carousel
   */
  if (!hasImages) {
    const currentTip = onboardingTips[emptyStateStep];

    return (
      <Paper
        elevation={emptyStateDragging ? 4 : 1}
        onDragEnter={handleEmptyStateDragEnter}
        onDragLeave={handleEmptyStateDragLeave}
        onDragOver={handleEmptyStateDragOver}
        onDrop={handleEmptyStateDrop}
        onClick={handleEmptyStateClick}
        sx={{
          p: 6,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: emptyStateDragging ? 'primary.main' : 'divider',
          borderRadius: 2,
          backgroundColor: emptyStateDragging ? 'action.hover' : 'background.default',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'action.hover',
          },
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleEmptyStateFileChange}
          style={{ display: 'none' }}
        />

        {/* Illustration - Property Image Examples */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            mb: 4,
            flexWrap: 'wrap',
          }}
        >
          {/* Placeholder image cards to illustrate property photos */}
          {[1, 2, 3, 4].map((num) => (
            <Box
              key={num}
              sx={{
                width: 100,
                height: 100,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${
                  num === 1 ? '#667eea 0%, #764ba2 100%' :
                  num === 2 ? '#f093fb 0%, #f5576c 100%' :
                  num === 3 ? '#4facfe 0%, #00f2fe 100%' :
                  '#43e97b 0%, #38f9d7 100%'
                })`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2rem',
                boxShadow: 2,
                opacity: 0.8,
                animation: `float${num} 3s ease-in-out infinite`,
                '@keyframes float1': {
                  '0%, 100%': { transform: 'translateY(0px)' },
                  '50%': { transform: 'translateY(-10px)' },
                },
                '@keyframes float2': {
                  '0%, 100%': { transform: 'translateY(0px)' },
                  '50%': { transform: 'translateY(-15px)' },
                },
                '@keyframes float3': {
                  '0%, 100%': { transform: 'translateY(0px)' },
                  '50%': { transform: 'translateY(-8px)' },
                },
                '@keyframes float4': {
                  '0%, 100%': { transform: 'translateY(0px)' },
                  '50%': { transform: 'translateY(-12px)' },
                },
              }}
            >
              🏠
            </Box>
          ))}
        </Box>

        {/* Main Heading */}
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          {emptyStateDragging ? 'Drop your images here!' : 'Add Your Property Photos'}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Showcase your property with stunning images
        </Typography>

        {/* Large Choose Files Button */}
        <Button
          variant="contained"
          size="large"
          startIcon={<CloudUploadIcon />}
          onClick={(e) => {
            e.stopPropagation();
            handleEmptyStateClick();
          }}
          sx={{
            mb: 4,
            py: 1.5,
            px: 4,
            fontSize: '1.1rem',
            fontWeight: 600,
            boxShadow: 3,
          }}
        >
          Choose Files
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          or drag and drop your images anywhere in this area
        </Typography>

        {/* Onboarding Tips Carousel */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            backgroundColor: 'background.paper',
            borderRadius: 2,
            maxWidth: 500,
            mx: 'auto',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            {currentTip.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {currentTip.description}
          </Typography>

          <MobileStepper
            variant="dots"
            steps={onboardingTips.length}
            position="static"
            activeStep={emptyStateStep}
            sx={{
              backgroundColor: 'transparent',
              justifyContent: 'center',
            }}
            nextButton={
              <Button size="small" onClick={handleEmptyStateNext}>
                Next
                <KeyboardArrowRight />
              </Button>
            }
            backButton={
              <Button size="small" onClick={handleEmptyStateBack}>
                <KeyboardArrowLeft />
                Back
              </Button>
            }
          />
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
          Supports: JPEG, PNG, GIF, WebP • Max 50 files • 10MB each
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* ARIA live region for keyboard navigation announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {moveMode && moveSourceIndex !== null && (
          <>
            {moveTargetIndex !== null && moveTargetIndex !== moveSourceIndex
              ? `Moving image ${moveSourceIndex + 1} to position ${moveTargetIndex + 1}. Press Enter to confirm, Escape to cancel.`
              : `Move mode active for image ${moveSourceIndex + 1}. Use arrow keys to select target position.`}
          </>
        )}
      </div>

      {/* Error Alert */}
      {hasErrors && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Some images failed to upload. Click the retry button on each failed image to try again.
        </Alert>
      )}

      {/* Bulk Actions Toolbar */}
      {enableBulkOperations && hasSelection && (
        <Paper
          elevation={3}
          sx={{
            mb: 2,
            p: 1,
            backgroundColor: 'primary.light',
            color: 'primary.contrastText',
          }}
        >
          <Toolbar variant="dense" sx={{ minHeight: 48 }}>
            <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 'bold' }}>
              {selectedIds.size} selected
            </Typography>

            <Tooltip title="Move to front">
              <IconButton
                color="inherit"
                onClick={handleBulkSetOrder}
                size="small"
              >
                <ReorderIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Delete selected">
              <IconButton
                color="inherit"
                onClick={handleBulkDelete}
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>

            <Button
              color="inherit"
              onClick={deselectAll}
              startIcon={<DeselectIcon />}
              size="small"
              sx={{ ml: 1 }}
            >
              Deselect All
            </Button>
          </Toolbar>
        </Paper>
      )}

      {/* Actions Bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          gap: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {filteredImages.length} of {images.length} image{images.length !== 1 ? 's' : ''}
          {allowReordering && !selectionMode && ' (drag to reorder)'}
          {selectionMode && ' (selection mode)'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Category Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="category-filter-label">Category</InputLabel>
            <Select
              labelId="category-filter-label"
              id="category-filter"
              value={categoryFilter}
              label="Category"
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="ALL">All Categories</MenuItem>
              <MenuItem value="EXTERIOR">Exterior</MenuItem>
              <MenuItem value="INTERIOR">Interior</MenuItem>
              <MenuItem value="KITCHEN">Kitchen</MenuItem>
              <MenuItem value="BATHROOM">Bathroom</MenuItem>
              <MenuItem value="BEDROOM">Bedroom</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
            </Select>
          </FormControl>

          {/* Edit All Captions Button */}
          {allowCaptions && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditNoteIcon />}
              onClick={() => setBulkCaptionEditorOpen(true)}
              disabled={images.length === 0}
            >
              Edit All Captions
            </Button>
          )}

          {enableBulkOperations && !selectionMode && (
            <Button
              size="small"
              startIcon={<SelectAllIcon />}
              onClick={selectAll}
              disabled={images.length === 0}
            >
              Select All
            </Button>
          )}

          {onClearAll && (
            <Button
              size="small"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={onClearAll}
            >
              Clear All
            </Button>
          )}
        </Box>
      </Box>

      {/* Image Grid with Virtualization for >20 images */}
      {filteredImages.length > 20 ? (
        // Virtualized grid for large galleries
        <Virtuoso
          style={{ height: '600px' }}
          totalCount={filteredImages.length}
          itemContent={(index) => {
            const image = filteredImages[index];
            return (
              <Box
                sx={{ p: 1 }}
                onDragOver={allowReordering ? handleDragOver(index) : undefined}
                onDrop={allowReordering ? handleDrop(index) : undefined}
              >
                <Box sx={{ position: 'relative' }}>
                  {/* Drop Zone Indicator */}
                  {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        right: -8,
                        bottom: -8,
                        border: '3px dashed',
                        borderColor: 'primary.main',
                        borderRadius: 2,
                        backgroundColor: 'rgba(25, 118, 210, 0.05)',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        zIndex: 1,
                        pointerEvents: 'none',
                        '@keyframes pulse': {
                          '0%, 100%': {
                            opacity: 0.5,
                            transform: 'scale(1)',
                          },
                          '50%': {
                            opacity: 1,
                            transform: 'scale(1.02)',
                          },
                        },
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'primary.main',
                          color: 'white',
                          padding: '12px 24px',
                          borderRadius: 2,
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          boxShadow: 3,
                          whiteSpace: 'nowrap',
                          zIndex: 2,
                        }}
                      >
                        Drop here to place as image #{index + 1}
                      </Box>
                    </Box>
                  )}

                  {/* Animated Placeholder for Dragged Item */}
                  {draggedIndex === index && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        border: '3px dashed',
                        borderColor: 'grey.400',
                        borderRadius: 2,
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 0,
                        animation: 'fadeInOut 1s ease-in-out infinite',
                        '@keyframes fadeInOut': {
                          '0%, 100%': { opacity: 0.3 },
                          '50%': { opacity: 0.6 },
                        },
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Moving...
                      </Typography>
                    </Box>
                  )}

                  <ImageCard
                    image={image}
                    onDelete={onDelete}
                    onSetCover={onSetCover}
                    onRetry={onRetry}
                    onUpdateCaption={onUpdateCaption}
                    onUpdateCategory={onUpdateCategory}
                    allowCaptions={allowCaptions}
                    draggable={allowReordering && !selectionMode}
                    onDragStart={allowReordering && !selectionMode ? handleDragStart(index) : undefined}
                    onDragEnd={allowReordering && !selectionMode ? handleDragEnd : undefined}
                    onClick={() => handleImageClick(image.id)}
                    isSelected={selectedIds.has(image.id)}
                    onToggleSelect={enableBulkOperations ? toggleSelect : undefined}
                    selectionMode={selectionMode}
                  />
                </Box>
              </Box>
            );
          }}
        />
      ) : (
        // Regular grid with animations for smaller galleries
        <Grid container spacing={2}>
          <AnimatePresence mode="popLayout">
            {filteredImages.map((image, index) => {
              const isMoving = moveMode && moveSourceIndex === index;
              const isMoveTarget = moveMode && moveTargetIndex === index;
              const isFocused = focusedIndex === index;

              return (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                lg={3}
                key={image.id}
                onDragOver={allowReordering ? handleDragOver(index) : undefined}
                onDrop={allowReordering ? handleDrop(index) : undefined}
                sx={{
                  position: 'relative',
                }}
              >
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    layout: { duration: 0.3, ease: 'easeInOut' },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.2 },
                  }}
                  style={{ position: 'relative', height: '100%' }}
                  tabIndex={0}
                  className="image-card-keyboard-target"
                  onFocus={() => setFocusedIndex(index)}
                  aria-label={`${image.file?.name || 'Image'} ${index + 1} of ${filteredImages.length}. ${allowReordering ? 'Press Enter to move, arrow keys to navigate.' : ''}`}
                >
                  {/* Keyboard Move Mode Indicators */}
                  {isMoving && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        right: -8,
                        bottom: -8,
                        border: '4px solid',
                        borderColor: 'warning.main',
                        borderRadius: 2,
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'warning.main',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: 1,
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          boxShadow: 3,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Moving... Use arrow keys to select position
                      </Box>
                    </Box>
                  )}
                  {isMoveTarget && moveSourceIndex !== index && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        right: -8,
                        bottom: -8,
                        border: '4px dashed',
                        borderColor: 'success.main',
                        borderRadius: 2,
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        zIndex: 10,
                        pointerEvents: 'none',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        '@keyframes pulse': {
                          '0%, 100%': {
                            opacity: 0.7,
                            transform: 'scale(1)',
                          },
                          '50%': {
                            opacity: 1,
                            transform: 'scale(1.02)',
                          },
                        },
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'success.main',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: 1,
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          boxShadow: 3,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Move here (Press Enter to confirm)
                      </Box>
                    </Box>
                  )}
                  {isFocused && !moveMode && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -4,
                        left: -4,
                        right: -4,
                        bottom: -4,
                        border: '3px solid',
                        borderColor: 'primary.main',
                        borderRadius: 2,
                        zIndex: 5,
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Drop Zone Indicator */}
                  {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        right: -8,
                        bottom: -8,
                        border: '3px dashed',
                        borderColor: 'primary.main',
                        borderRadius: 2,
                        backgroundColor: 'rgba(25, 118, 210, 0.05)',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        zIndex: 1,
                        pointerEvents: 'none',
                        '@keyframes pulse': {
                          '0%, 100%': {
                            opacity: 0.5,
                            transform: 'scale(1)',
                          },
                          '50%': {
                            opacity: 1,
                            transform: 'scale(1.02)',
                          },
                        },
                      }}
                    >
                      {/* Position Indicator Overlay */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'primary.main',
                          color: 'white',
                          padding: '12px 24px',
                          borderRadius: 2,
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          boxShadow: 3,
                          whiteSpace: 'nowrap',
                          zIndex: 2,
                        }}
                      >
                        Drop here to place as image #{index + 1}
                      </Box>
                    </Box>
                  )}

                  {/* Animated Placeholder for Dragged Item */}
                  {draggedIndex === index && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        border: '3px dashed',
                        borderColor: 'grey.400',
                        borderRadius: 2,
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 0,
                        animation: 'fadeInOut 1s ease-in-out infinite',
                        '@keyframes fadeInOut': {
                          '0%, 100%': { opacity: 0.3 },
                          '50%': { opacity: 0.6 },
                        },
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Moving...
                      </Typography>
                    </Box>
                  )}

                  <ImageCard
                    image={image}
                    onDelete={onDelete}
                    onSetCover={onSetCover}
                    onRetry={onRetry}
                    onUpdateCaption={onUpdateCaption}
                    onUpdateCategory={onUpdateCategory}
                    allowCaptions={allowCaptions}
                    draggable={allowReordering && !selectionMode}
                    onDragStart={allowReordering && !selectionMode ? handleDragStart(index) : undefined}
                    onDragEnd={allowReordering && !selectionMode ? handleDragEnd : undefined}
                    onClick={() => handleImageClick(image.id)}
                    isSelected={selectedIds.has(image.id)}
                    onToggleSelect={enableBulkOperations ? toggleSelect : undefined}
                    selectionMode={selectionMode}
                  />
                </motion.div>
              </Grid>
              );
            })}
          </AnimatePresence>
        </Grid>
      )}

      {/* Upload Summary */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Completed: {images.filter(img => img.status === 'complete').length} |{' '}
          Uploading: {images.filter(img => img.status === 'uploading').length} |{' '}
          Failed: {images.filter(img => img.status === 'error').length} |{' '}
          Pending: {images.filter(img => img.status === 'pending').length}
        </Typography>
      </Box>

      {/* Lightbox Modal with Custom Footer */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxSlides}
        plugins={[Zoom]}
        zoom={{
          maxZoomPixelRatio: 3,
          zoomInMultiplier: 2,
          doubleTapDelay: 300,
          doubleClickDelay: 300,
          doubleClickMaxStops: 2,
          keyboardMoveDistance: 50,
          wheelZoomDistanceFactor: 100,
          pinchZoomDistanceFactor: 100,
          scrollToZoom: true,
        }}
        on={{
          view: ({ index }) => setLightboxIndex(index),
        }}
        carousel={{
          finite: false,
          preload: 2,
        }}
        render={{
          buttonPrev: lightboxSlides.length <= 1 ? () => null : undefined,
          buttonNext: lightboxSlides.length <= 1 ? () => null : undefined,
          slide: ({ slide }) => {
            const currentSlide = lightboxSlides[lightboxIndex];
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
                {/* Custom Footer with Metadata */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    {currentSlide?.caption && (
                      <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        {currentSlide.caption}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      {currentSlide?.filename || 'Unknown filename'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {currentSlide?.category && (
                      <Box>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          Category
                        </Typography>
                        <Typography variant="body2">{currentSlide.category}</Typography>
                      </Box>
                    )}
                    {currentSlide?.size && (
                      <Box>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          Size
                        </Typography>
                        <Typography variant="body2">
                          {(currentSlide.size / 1024 / 1024).toFixed(2)} MB
                        </Typography>
                      </Box>
                    )}
                    {currentSlide?.date && (
                      <Box>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          Date
                        </Typography>
                        <Typography variant="body2">
                          {new Date(currentSlide.date).toLocaleDateString()}
                        </Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        Image
                      </Typography>
                      <Typography variant="body2">
                        {lightboxIndex + 1} / {lightboxSlides.length}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </div>
            );
          },
        }}
        styles={{
          container: { backgroundColor: 'rgba(0, 0, 0, 0.95)' },
        }}
      />

      {/* Bulk Caption Editor Modal */}
      <BulkCaptionEditor
        open={bulkCaptionEditorOpen}
        onClose={() => setBulkCaptionEditorOpen(false)}
        images={images}
        onSave={handleBulkCaptionSave}
      />
    </Box>
  );
}
