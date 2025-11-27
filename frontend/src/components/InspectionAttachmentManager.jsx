import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Typography, Divider, Alert } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import { useImageUpload } from '../features/images/hooks';
import { ImageUploadZone } from '../features/images/components/ImageUploadZone';
import { ImageGallery } from '../features/images/components/ImageGallery';
import { UploadQueue } from '../features/images/components/UploadQueue';

/**
 * Modern inspection attachment manager with auto-upload
 *
 * Integrates:
 * - Auto-upload on file selection (no manual "Upload" button)
 * - Visual preview thumbnails before upload
 * - Upload progress tracking
 * - Optimistic UI
 * - Annotation support for uploaded attachments
 *
 * This component uses the useImageUpload hook for a consistent
 * upload experience matching PropertyImageManager.
 */
const InspectionAttachmentManager = ({ inspectionId, attachments = [], canEdit = false }) => {
  const queryClient = useQueryClient();

  // Bug Fix: Track initial mount to prevent spurious API calls
  const isInitialMount = useRef(true);
  const previousCompletedSnapshotRef = useRef('');

  // Filter existing attachments to only images
  const existingImages = useMemo(() => {
    return attachments
      .filter(att => att.mimeType?.startsWith('image/'))
      .map((att, index) => ({
        id: att.id,
        url: att.url,
        imageUrl: att.url,
        remoteUrl: att.url,
        caption: att.annotations?.note || '',
        isPrimary: false,
        order: index,
      }));
  }, [attachments]);

  // Use the useImageUpload hook for auto-upload functionality
  const {
    images,
    isUploading,
    error,
    uploadFiles,
    removeImage,
    updateCaption,
    retryUpload,
    getCompletedImages,
    completedCount,
    errorCount,
  } = useImageUpload({
    endpoint: '/upload/multiple',
    compressImages: true,
    maxConcurrent: 3,
    initialImages: existingImages,
    onSuccess: (completedImages) => {
      console.log('[InspectionAttachmentManager] All uploads complete:', completedImages.length);
    },
    onError: (err) => {
      console.error('[InspectionAttachmentManager] Upload error:', err);
    },
  });

  // Mutation to save uploaded attachments to the inspection
  const saveAttachmentsMutation = useMutation({
    mutationFn: async (attachmentsToSave) => {
      const payload = attachmentsToSave.map(img => ({
        url: img.imageUrl,
        name: img.file?.name || 'image.jpg',
        mimeType: img.file?.type || 'image/jpeg',
        size: img.file?.size || 0,
        annotations: { note: img.caption || '' },
      }));

      await apiClient.post(`/inspections/${inspectionId}/attachments`, { attachments: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(inspectionId) });
    },
  });

  // Mutation to update attachment annotations
  const updateAnnotationMutation = useMutation({
    mutationFn: async ({ attachmentId, note }) => {
      await apiClient.patch(`/inspections/${inspectionId}/attachments/${attachmentId}`, {
        annotations: { note },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(inspectionId) });
    },
  });

  // Mutation to delete attachments
  const deleteMutation = useMutation({
    mutationFn: async (attachmentId) => {
      await apiClient.delete(`/inspections/${inspectionId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(inspectionId) });
    },
  });

  /**
   * Memoize completed images to prevent unnecessary re-renders
   */
  const completedImages = useMemo(() => {
    return getCompletedImages();
  }, [getCompletedImages]);

  /**
   * Serialize completed images for comparison
   */
  const serializedCompleted = useMemo(() => {
    return JSON.stringify(
      completedImages.map((img) => ({
        imageUrl: img.imageUrl ?? '',
        caption: img.caption ?? '',
      }))
    );
  }, [completedImages]);

  /**
   * Auto-save newly completed uploads to the inspection
   * Only save new uploads, not existing attachments
   */
  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousCompletedSnapshotRef.current = serializedCompleted;
      return;
    }

    // Only save if completed images actually changed
    if (serializedCompleted === previousCompletedSnapshotRef.current) {
      return;
    }

    previousCompletedSnapshotRef.current = serializedCompleted;

    // Find newly uploaded images (ones that don't exist in attachments yet)
    const newImages = completedImages.filter(img => {
      // If it has a file object, it's a new upload
      return img.file !== null && img.file !== undefined;
    });

    // Only save if there are new images to save
    if (newImages.length > 0 && !isUploading) {
      console.log('[InspectionAttachmentManager] Auto-saving', newImages.length, 'new uploads');
      saveAttachmentsMutation.mutate(newImages);
    }
  }, [serializedCompleted, completedImages, isUploading, saveAttachmentsMutation]);

  /**
   * Handle file selection - auto-upload immediately
   */
  const handleFilesSelected = useCallback((files) => {
    if (!canEdit) return;

    // Filter to only image files
    const imageFiles = Array.from(files).filter(file =>
      file.type.startsWith('image/')
    );

    if (imageFiles.length > 0) {
      uploadFiles(imageFiles);
    }

    // Show warning if non-image files were selected
    if (imageFiles.length < files.length) {
      console.warn('[InspectionAttachmentManager] Only image files are supported with auto-upload');
    }
  }, [uploadFiles, canEdit]);

  /**
   * Handle delete - for existing attachments, call API; for new uploads, just remove from state
   */
  const handleDelete = useCallback((imageId) => {
    if (!canEdit) return;

    // Check if this is an existing attachment (has string ID from backend)
    const existingAttachment = attachments.find(att => att.id === imageId);

    if (existingAttachment) {
      // Delete from backend
      deleteMutation.mutate(imageId);
    } else {
      // Just remove from local state (not saved yet)
      removeImage(imageId);
    }
  }, [removeImage, deleteMutation, canEdit, attachments]);

  /**
   * Handle caption update
   */
  const handleUpdateCaption = useCallback((imageId, caption) => {
    if (!canEdit) return;

    // Update local state
    updateCaption(imageId, caption);

    // Check if this is an existing attachment
    const existingAttachment = attachments.find(att => att.id === imageId);

    if (existingAttachment) {
      // Update on backend
      updateAnnotationMutation.mutate({ attachmentId: imageId, note: caption });
    }
  }, [updateCaption, updateAnnotationMutation, canEdit, attachments]);

  /**
   * Handle retry
   */
  const handleRetry = useCallback((imageId) => {
    if (!canEdit) return;
    retryUpload(imageId);
  }, [retryUpload, canEdit]);

  return (
    <Box>
      {/* Upload Zone - Only show if user can edit */}
      {canEdit && (
        <>
          <ImageUploadZone
            onFilesSelected={handleFilesSelected}
            accept="image/*"
            multiple={true}
            maxFiles={50}
            disabled={false}
          />
          <Divider sx={{ my: 3 }} />
        </>
      )}

      {/* Upload Queue - Compact View */}
      <UploadQueue
        images={images}
        isUploading={isUploading}
        compact={true}
      />

      {/* Error Alert */}
      {error && !isUploading && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Success Summary */}
      {completedCount > 0 && !isUploading && errorCount === 0 && saveAttachmentsMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Successfully uploaded {completedCount} image{completedCount !== 1 ? 's' : ''}
        </Alert>
      )}

      {/* Image Gallery */}
      {images.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No images uploaded yet.
        </Typography>
      ) : (
        <ImageGallery
          images={images}
          onDelete={handleDelete}
          onSetCover={null} // Inspections don't have cover images
          onRetry={handleRetry}
          onUpdateCaption={handleUpdateCaption}
          onReorder={null} // Disable reordering for now
          onClearAll={null} // Disable clear all for now
          allowCaptions={true}
          allowReordering={false}
        />
      )}
    </Box>
  );
};

export default InspectionAttachmentManager;
