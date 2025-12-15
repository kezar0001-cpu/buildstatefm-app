import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Divider, Alert } from '@mui/material';
import { useImageUpload } from '../hooks';
import { ImageUploadZone } from './ImageUploadZone';
import { ImageGallery } from './ImageGallery';
import { UploadQueue } from './UploadQueue';
import { ResumeUploadsDialog } from './ResumeUploadsDialog';
import { DuplicateFilesDialog } from './DuplicateFilesDialog';

export function ServiceRequestImageManager({
  images: initialImages = [],
  onChange,
  onUploadingChange,
  disabled = false,
  requestKey = '',
}) {
  const preparedInitialImages = React.useMemo(() => {
    if (!initialImages || initialImages.length === 0) return [];

    return initialImages.map((img) => {
      const imageUrl = img.url || img.imageUrl;
      return {
        ...img,
        imageUrl,
        isPrimary: false,
      };
    });
  }, [initialImages]);

  const {
    images,
    isUploading,
    error,
    uploadFiles,
    removeImage,
    retryUpload,
    reorderImages,
    clearAll,
    getCompletedImages,
    completedCount,
    errorCount,
    pendingCount,
    interruptedUploads,
    showResumeDialog,
    resumeInterruptedUploads,
    dismissInterruptedUploads,
    duplicateData,
    showDuplicateDialog,
    skipDuplicates,
    replaceDuplicates,
    cancelDuplicateDialog,
  } = useImageUpload({
    endpoint: '/api/uploads/multiple',
    compressImages: true,
    maxConcurrent: 3,
    defaultImages: preparedInitialImages,
    storageKey: requestKey ? `service_request_${requestKey}` : 'service_request_default',
    onSuccess: (completedImages) => {
      console.log('[ServiceRequestImageManager] All uploads complete:', completedImages.length);
    },
    onError: (err) => {
      console.error('[ServiceRequestImageManager] Upload error:', err);
    },
  });

  const isInitialMount = useRef(true);
  const previousCompletedSnapshotRef = useRef('');

  const completedImages = useMemo(() => {
    return getCompletedImages();
  }, [getCompletedImages]);

  const serializedCompleted = useMemo(() => {
    return JSON.stringify(
      completedImages.map((img) => ({
        id: img.id ?? null,
        imageUrl: img.imageUrl ?? '',
        displayOrder: img.displayOrder ?? 0,
      }))
    );
  }, [completedImages]);

  useEffect(() => {
    if (!onUploadingChange) return;

    const hasActiveUploads = isUploading || pendingCount > 0;
    onUploadingChange(hasActiveUploads);
  }, [isUploading, pendingCount, onUploadingChange]);

  useEffect(() => {
    if (!onChange) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousCompletedSnapshotRef.current = serializedCompleted;
      return;
    }

    if (serializedCompleted === previousCompletedSnapshotRef.current) {
      return;
    }

    previousCompletedSnapshotRef.current = serializedCompleted;
    onChange(completedImages, '');
  }, [serializedCompleted, onChange, completedImages]);

  const handleFilesSelected = useCallback((files) => {
    if (disabled) return;
    uploadFiles(files);
  }, [uploadFiles, disabled]);

  const handleDelete = useCallback((imageId) => {
    if (disabled) return;
    removeImage(imageId);
  }, [removeImage, disabled]);

  const handleRetry = useCallback((imageId) => {
    if (disabled) return;
    retryUpload(imageId);
  }, [retryUpload, disabled]);

  const handleClearAll = useCallback(() => {
    if (disabled) return;
    if (window.confirm('Are you sure you want to remove all images?')) {
      clearAll();
    }
  }, [clearAll, disabled]);

  const handleResumeUploads = useCallback(() => {
    if (disabled) return;
    const failedImages = images.filter((img) => img.status === 'error');
    failedImages.forEach((img) => retryUpload(img.id));
  }, [images, retryUpload, disabled]);

  const interruptedCount = interruptedUploads
    ? interruptedUploads.images.filter(
        (img) => img.status === 'pending' || img.status === 'uploading'
      ).length
    : 0;

  return (
    <Box>
      <ResumeUploadsDialog
        open={showResumeDialog}
        interruptedCount={interruptedCount}
        onResume={resumeInterruptedUploads}
        onDismiss={dismissInterruptedUploads}
      />

      <DuplicateFilesDialog
        open={showDuplicateDialog}
        duplicates={duplicateData?.duplicates || []}
        onSkip={skipDuplicates}
        onReplace={replaceDuplicates}
        onCancel={cancelDuplicateDialog}
      />

      {images.length > 0 && (
        <>
          <ImageUploadZone
            onFilesSelected={handleFilesSelected}
            accept="image/*"
            multiple={true}
            maxFiles={50}
            disabled={disabled}
          />
          <Divider sx={{ my: 3 }} />
        </>
      )}

      <UploadQueue
        images={images}
        isUploading={isUploading}
        onResumeUploads={handleResumeUploads}
        compact={false}
      />

      {error && !isUploading && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      {completedCount > 0 && !isUploading && errorCount === 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Successfully uploaded {completedCount} image{completedCount !== 1 ? 's' : ''}
        </Alert>
      )}

      <ImageGallery
        images={images}
        onDelete={handleDelete}
        onSetCover={null}
        onRetry={handleRetry}
        onUpdateCaption={null}
        onUpdateCategory={null}
        onReorder={reorderImages}
        onClearAll={images.length > 0 ? handleClearAll : null}
        onFilesSelected={handleFilesSelected}
        allowCaptions={false}
        allowReordering={true}
        entityType="serviceRequest"
      />
    </Box>
  );
}
