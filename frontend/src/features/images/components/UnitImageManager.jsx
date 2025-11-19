import React, { useEffect, useCallback, useRef } from 'react';
import { Box, Divider, Alert } from '@mui/material';
import { useImageUpload } from '../hooks';
import { ImageUploadZone } from './ImageUploadZone';
import { ImageGallery } from './ImageGallery';
import { UploadQueue } from './UploadQueue';

/**
 * Complete unit image management component
 *
 * Integrates:
 * - Image upload zone
 * - Image gallery with reordering
 * - Upload queue
 * - Optimistic UI
 *
 * This is the same component as PropertyImageManager but for units
 */
export function UnitImageManager({
  images: initialImages = [],
  coverImageUrl = '',
  onChange,
  onUploadingChange,
  allowCaptions = true,
  disabled = false,
  unitName = '',
}) {
  // Prepare initial images with cover image info
  const preparedInitialImages = React.useMemo(() => {
    if (!initialImages || initialImages.length === 0) return [];

    return initialImages.map((img, index) => {
      const imageUrl = img.url || img.imageUrl;
      return {
        ...img,
        isPrimary: imageUrl === coverImageUrl,
      };
    });
  }, [initialImages, coverImageUrl]);

  const {
    images,
    isUploading,
    error,
    uploadFiles,
    removeImage,
    setCoverImage,
    retryUpload,
    reorderImages,
    updateCaption,
    clearAll,
    getCompletedImages,
    completedCount,
    errorCount,
    pendingCount,
  } = useImageUpload({
    endpoint: '/upload/multiple',
    compressImages: true,
    maxConcurrent: 3,
    initialImages: preparedInitialImages,
    onSuccess: (completedImages) => {
      console.log('[UnitImageManager] All uploads complete:', completedImages.length);
    },
    onError: (err) => {
      console.error('[UnitImageManager] Upload error:', err);
    },
  });

  // Bug Fix: Track initial mount and previous images to prevent spurious onChange calls
  const isInitialMount = useRef(true);
  const previousCompletedSnapshotRef = useRef('');

  /**
   * Notify parent of upload state changes
   * Bug Fix: Track uploading and pending state to prevent navigation during uploads
   */
  useEffect(() => {
    if (!onUploadingChange) return;

    const hasActiveUploads = isUploading || pendingCount > 0;
    onUploadingChange(hasActiveUploads);
  }, [isUploading, pendingCount, onUploadingChange]);

  /**
   * Notify parent of changes
   * Bug Fix: Only notify when images actually complete, not on every state change
   * This prevents file dialog interruption and preserves pending uploads
   */
  useEffect(() => {
    if (!onChange) return;

    // Bug Fix: Always skip the very first render to avoid interrupting file selection
    const completedImages = getCompletedImages();

    const serializeCompletedImages = (list) =>
      JSON.stringify(
        list.map((img) => ({
          id: img.id ?? img.imageId ?? null,
          imageId: img.imageId ?? null,
          imageUrl: img.imageUrl ?? '',
          caption: img.caption ?? '',
          isPrimary: Boolean(img.isPrimary),
          position: img.position ?? null,
        }))
      );

    const serializedCompleted = serializeCompletedImages(completedImages);

    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousCompletedSnapshotRef.current = serializedCompleted;
      console.log('[UnitImageManager] Initial mount - not calling onChange yet');
      return;
    }

    if (serializedCompleted === previousCompletedSnapshotRef.current) {
      return;
    }

    previousCompletedSnapshotRef.current = serializedCompleted;

    // Get cover image URL
    const coverImage = completedImages.find(img => img.isPrimary);
    const coverUrl = coverImage?.imageUrl || '';

    console.log('[UnitImageManager] Notifying parent of completed images:', {
      imageCount: completedImages.length,
      coverUrl: coverUrl ? coverUrl.substring(0, 60) + '...' : 'none',
    });

    // Call onChange with completed images and cover URL
    onChange(completedImages, coverUrl);
  }, [images, onChange, getCompletedImages]);

  /**
   * Handle file selection
   */
  const handleFilesSelected = useCallback((files) => {
    if (disabled) return;
    uploadFiles(files);
  }, [uploadFiles, disabled]);

  /**
   * Handle delete
   */
  const handleDelete = useCallback((imageId) => {
    if (disabled) return;
    removeImage(imageId);
  }, [removeImage, disabled]);

  /**
   * Handle set cover
   */
  const handleSetCover = useCallback((imageId) => {
    if (disabled) return;
    setCoverImage(imageId);
  }, [setCoverImage, disabled]);

  /**
   * Handle retry
   */
  const handleRetry = useCallback((imageId) => {
    if (disabled) return;
    retryUpload(imageId);
  }, [retryUpload, disabled]);

  /**
   * Handle caption update
   */
  const handleUpdateCaption = useCallback((imageId, caption) => {
    if (disabled) return;
    updateCaption(imageId, caption);
  }, [updateCaption, disabled]);

  /**
   * Handle clear all
   */
  const handleClearAll = useCallback(() => {
    if (disabled) return;
    if (window.confirm('Are you sure you want to remove all images?')) {
      clearAll();
    }
  }, [clearAll, disabled]);

  return (
    <Box>
      {/* Upload Zone */}
      <ImageUploadZone
        onFilesSelected={handleFilesSelected}
        accept="image/*"
        multiple={true}
        maxFiles={50}
        disabled={disabled}
      />

      <Divider sx={{ my: 3 }} />

      {/* Upload Queue - Compact View */}
      <UploadQueue
        images={images}
        isUploading={isUploading}
        compact={true}
      />

      {/* Error Alert */}
      {error && !isUploading && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      {/* Success Summary */}
      {completedCount > 0 && !isUploading && errorCount === 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Successfully uploaded {completedCount} image{completedCount !== 1 ? 's' : ''}
        </Alert>
      )}

      {/* Image Gallery */}
      <ImageGallery
        images={images}
        onDelete={handleDelete}
        onSetCover={handleSetCover}
        onRetry={handleRetry}
        onUpdateCaption={handleUpdateCaption}
        onReorder={reorderImages}
        onClearAll={images.length > 0 ? handleClearAll : null}
        allowCaptions={allowCaptions}
        allowReordering={true}
      />
    </Box>
  );
}
