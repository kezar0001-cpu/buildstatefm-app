import React, { useState, useEffect, useCallback } from 'react';
import { Grid, Box, Typography, Button, Alert, Paper, Toolbar, IconButton, Tooltip } from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteIcon from '@mui/icons-material/Delete';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import ReorderIcon from '@mui/icons-material/Reorder';
import { ImageCard } from './ImageCard';

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
  onReorder,
  onClearAll,
  onBulkDelete,
  onBulkReorder,
  allowCaptions = false,
  allowReordering = true,
  enableBulkOperations = true,
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

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
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl+A - Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && enableBulkOperations) {
        e.preventDefault();
        selectAll();
      }

      // Delete/Backspace - Delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection && enableBulkOperations) {
        // Only trigger if not focused on an input element
        if (!['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
          e.preventDefault();
          handleBulkDelete();
        }
      }

      // Escape - Deselect all
      if (e.key === 'Escape' && hasSelection) {
        e.preventDefault();
        deselectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, deselectAll, handleBulkDelete, hasSelection, enableBulkOperations]);

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
   * Handle drag start
   */
  const handleDragStart = (index) => (event) => {
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.currentTarget);

    // Add drag image styling
    event.currentTarget.style.opacity = '0.4';
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
   * Empty state
   */
  if (!hasImages) {
    return (
      <Box
        sx={{
          p: 6,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          backgroundColor: 'background.default',
        }}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No images yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload images using the upload zone above
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
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
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {images.length} image{images.length !== 1 ? 's' : ''}
          {allowReordering && !selectionMode && ' (drag to reorder)'}
          {selectionMode && ' (selection mode)'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
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

      {/* Image Grid */}
      <Grid container spacing={2}>
        {images.map((image, index) => (
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
              transition: 'all 0.2s',
              ...(dragOverIndex === index && {
                transform: 'scale(1.05)',
              }),
            }}
          >
            <ImageCard
              image={image}
              onDelete={onDelete}
              onSetCover={onSetCover}
              onRetry={onRetry}
              onUpdateCaption={onUpdateCaption}
              allowCaptions={allowCaptions}
              draggable={allowReordering && !selectionMode}
              onDragStart={allowReordering && !selectionMode ? handleDragStart(index) : undefined}
              onDragEnd={allowReordering && !selectionMode ? handleDragEnd : undefined}
              isSelected={selectedIds.has(image.id)}
              onToggleSelect={enableBulkOperations ? toggleSelect : undefined}
              selectionMode={selectionMode}
            />
          </Grid>
        ))}
      </Grid>

      {/* Upload Summary */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Completed: {images.filter(img => img.status === 'complete').length} |{' '}
          Uploading: {images.filter(img => img.status === 'uploading').length} |{' '}
          Failed: {images.filter(img => img.status === 'error').length} |{' '}
          Pending: {images.filter(img => img.status === 'pending').length}
        </Typography>
      </Box>
    </Box>
  );
}
