/**
 * PropertyImageManagerV2
 * ======================
 *
 * A simplified property image manager using the new upload system.
 * Drop-in replacement for PropertyImageManager with cleaner implementation.
 *
 * USAGE:
 * ```jsx
 * <PropertyImageManagerV2
 *   propertyId="prop_123"
 *   images={existingImages}
 *   coverImageUrl={coverUrl}
 *   onChange={(images, coverUrl) => {}}
 *   onUploadingChange={(isUploading) => {}}
 * />
 * ```
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import useUploader, { FileStatus } from '../hooks/useUploader';
import UploadProgress from './UploadProgress';
import UploadDropzone from './UploadDropzone';
import apiClient from '../../../api/client';

// ============================================================================
// STYLES
// ============================================================================

const containerClass = 'space-y-4';
const galleryClass = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4';
const imageCardClass = 'relative group rounded-lg overflow-hidden bg-gray-100 aspect-square';
const imageClass = 'w-full h-full object-cover';
const overlayClass = 'absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2';
const primaryBadgeClass = 'absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded';
const buttonClass = 'p-2 bg-white rounded-full shadow hover:bg-gray-100 transition-colors';
const emptyStateClass = 'text-center py-8 text-gray-500';
const pauseBannerClass = 'bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm flex items-center gap-2';

// ============================================================================
// ICONS
// ============================================================================

const TrashIcon = () => (
  <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const StarIcon = ({ filled = false }) => (
  <svg className={`h-5 w-5 ${filled ? 'text-yellow-400 fill-current' : 'text-white'}`} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const PauseIcon = () => (
  <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ============================================================================
// IMAGE CARD COMPONENT
// ============================================================================

function ImageCard({ image, isPrimary, onDelete, onSetPrimary }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;

    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(image);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={imageCardClass}>
      <img
        src={image.url || image.imageUrl}
        alt={image.caption || 'Property image'}
        className={imageClass}
        loading="lazy"
      />

      {/* Primary badge */}
      {isPrimary && <div className={primaryBadgeClass}>Cover</div>}

      {/* Hover overlay */}
      <div className={overlayClass}>
        <button
          onClick={() => onSetPrimary(image)}
          className={buttonClass}
          title={isPrimary ? 'Current cover' : 'Set as cover'}
          disabled={isPrimary}
        >
          <StarIcon filled={isPrimary} />
        </button>

        <button
          onClick={handleDelete}
          className={buttonClass}
          title="Delete"
          disabled={isDeleting}
        >
          {isDeleting ? (
            <svg className="animate-spin h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <TrashIcon />
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PropertyImageManagerV2({
  propertyId,
  images: initialImages = [],
  coverImageUrl = '',
  onChange,
  onUploadingChange,
  disabled = false,
  category = 'gallery',
}) {
  // Track managed images (existing + newly uploaded)
  const [managedImages, setManagedImages] = useState([]);
  const [primaryImageUrl, setPrimaryImageUrl] = useState(coverImageUrl);

  // Track initial mount to prevent unnecessary onChange calls
  const isInitialMount = useRef(true);
  const previousSnapshot = useRef('');

  // Initialize managed images from props
  useEffect(() => {
    const normalized = (initialImages || []).map((img, index) => ({
      id: img.id || `existing_${index}`,
      url: img.url || img.imageUrl,
      key: img.key || null,
      caption: img.caption || '',
      displayOrder: img.displayOrder ?? index,
    }));
    setManagedImages(normalized);
    setPrimaryImageUrl(coverImageUrl);
  }, [initialImages, coverImageUrl]);

  // Setup uploader
  const {
    files,
    isUploading,
    isPaused,
    pauseReason,
    addFiles,
    removeFile,
    retryFile,
    getCompletedFiles,
  } = useUploader({
    entityType: 'property',
    entityId: propertyId,
    category,
    onSuccess: (uploadedFile) => {
      // Add newly uploaded file to managed images
      setManagedImages((prev) => [
        ...prev,
        {
          id: uploadedFile.id || uploadedFile.key,
          url: uploadedFile.url,
          key: uploadedFile.key,
          caption: '',
          displayOrder: prev.length,
          isNew: true,
        },
      ]);
    },
    onError: (file, error) => {
      console.error(`[PropertyImageManagerV2] Upload failed for ${file.name}:`, error);
    },
  });

  // Notify parent of uploading state
  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  // Notify parent of changes (debounced to prevent too many calls)
  useEffect(() => {
    if (!onChange) return;

    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousSnapshot.current = JSON.stringify(managedImages);
      return;
    }

    // Check if images actually changed
    const currentSnapshot = JSON.stringify(managedImages);
    if (currentSnapshot === previousSnapshot.current) {
      return;
    }
    previousSnapshot.current = currentSnapshot;

    // Convert to format expected by parent
    const imagesForParent = managedImages.map((img, index) => ({
      id: img.id,
      url: img.url,
      imageUrl: img.url,
      key: img.key,
      caption: img.caption,
      displayOrder: index,
      isPrimary: img.url === primaryImageUrl,
    }));

    onChange(imagesForParent, primaryImageUrl);
  }, [managedImages, primaryImageUrl, onChange]);

  // Handle delete image
  const handleDeleteImage = useCallback(async (image) => {
    // If it has a key, try to delete from S3
    if (image.key) {
      try {
        await apiClient.delete(`/v2/uploads/${encodeURIComponent(image.key)}`);
      } catch (error) {
        console.error('[PropertyImageManagerV2] Failed to delete from storage:', error);
        // Continue with local removal even if S3 delete fails
      }
    }

    // Remove from managed images
    setManagedImages((prev) => prev.filter((img) => img.id !== image.id));

    // If this was the primary image, clear it
    if (image.url === primaryImageUrl) {
      setPrimaryImageUrl('');
    }
  }, [primaryImageUrl]);

  // Handle set primary
  const handleSetPrimary = useCallback((image) => {
    setPrimaryImageUrl(image.url);
  }, []);

  // Handle files selected from dropzone
  const handleFilesSelected = useCallback((selectedFiles) => {
    if (disabled) return;
    addFiles(selectedFiles);
  }, [disabled, addFiles]);

  // Files that are currently uploading (not yet completed)
  const uploadingFiles = files.filter(
    (f) => f.status !== FileStatus.SUCCESS
  );

  // Check if there are any images to display
  const hasImages = managedImages.length > 0 || uploadingFiles.length > 0;

  return (
    <div className={containerClass}>
      {/* Pause Banner */}
      {isPaused && pauseReason && (
        <div className={pauseBannerClass}>
          <PauseIcon />
          <span>{pauseReason}</span>
        </div>
      )}

      {/* Upload Dropzone - Always show for adding more images */}
      <UploadDropzone
        onFilesSelected={handleFilesSelected}
        accept="image/*"
        multiple
        disabled={disabled || isPaused}
        title={hasImages ? 'Add more images' : 'Drop images here or click to browse'}
        subtitle="PNG, JPG, WebP up to 10MB"
      />

      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <UploadProgress
          files={uploadingFiles}
          isPaused={isPaused}
          pauseReason={pauseReason}
          onRemove={removeFile}
          onRetry={retryFile}
          showCompleted={false}
        />
      )}

      {/* Image Gallery */}
      {managedImages.length > 0 ? (
        <div className={galleryClass}>
          {managedImages.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              isPrimary={image.url === primaryImageUrl}
              onDelete={handleDeleteImage}
              onSetPrimary={handleSetPrimary}
            />
          ))}
        </div>
      ) : (
        !isUploading && (
          <div className={emptyStateClass}>
            <p>No images yet. Upload some images to get started.</p>
          </div>
        )
      )}
    </div>
  );
}
