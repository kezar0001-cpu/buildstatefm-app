import { useState, useCallback, useRef, useEffect } from 'react';
import { compressImage, createPreview } from '../utils/imageCompression';
import { validateFiles } from '../utils/imageValidation';
import apiClient from '../../../api/client';

/**
 * Image upload hook with queue management and optimistic UI
 *
 * @param {Object} options
 * @param {Function} options.onSuccess - Called when all uploads complete
 * @param {Function} options.onError - Called when an upload fails
 * @param {string} options.endpoint - Upload endpoint URL
 * @param {boolean} options.compressImages - Enable client-side compression
 * @param {number} options.maxConcurrent - Max concurrent uploads
 * @param {Array} options.initialImages - Initial images to display (for edit mode)
 * @returns {Object} Upload state and methods
 */
export function useImageUpload(options = {}) {
  const {
    onSuccess,
    onError,
    endpoint = '/upload/multiple',
    compressImages = true,
    maxConcurrent = 3,
    initialImages = [],
  } = options;

  // State - Initialize with existing images if provided
  const [images, setImages] = useState(() => {
    // Convert initialImages to internal format
    if (initialImages && initialImages.length > 0) {
      return initialImages.map((img, index) => ({
        id: img.id || `existing-${Date.now()}-${index}`,
        file: null,
        localPreview: null,
        remoteUrl: img.url || img.imageUrl || img.remoteUrl,
        status: 'complete',
        progress: 100,
        error: null,
        isPrimary: img.isPrimary || false,
        caption: img.altText || img.caption || '',
        order: img.order !== undefined ? img.order : index,
        dimensions: img.dimensions || null,
      }));
    }
    return [];
  });
  const [queue, setQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  // Refs
  const uploadCounterRef = useRef(0);
  const abortControllersRef = useRef(new Map());
  const initialImagesProcessedRef = useRef(false);

  /**
   * Sync initialImages to state when they change (for edit mode)
   * This handles the case where initialImages prop updates after initial mount
   */
  useEffect(() => {
    // Skip if no initial images or if we've already processed them
    if (!initialImages || initialImages.length === 0) {
      return;
    }

    // If we already have active uploads, don't overwrite local state with incoming props
    // This prevents losing pending uploads when parents update the images prop mid-upload
    const hasActiveLocalUploads = images.some((img) => img.status === 'pending' || img.status === 'uploading');
    if (hasActiveLocalUploads) {
      return;
    }

    // Create a unique signature for the current initialImages
    const signature = initialImages.map(img => img.id || img.url || img.imageUrl).join(',');

    // Only update if the signature has changed
    if (initialImagesProcessedRef.current === signature) {
      return;
    }

    console.log('[useImageUpload] Syncing initialImages to state:', initialImages.length, 'images');
    initialImagesProcessedRef.current = signature;

    // Convert initialImages to internal format
    const formattedImages = initialImages.map((img, index) => ({
      id: img.id || `existing-${Date.now()}-${index}`,
      file: null,
      localPreview: null,
      remoteUrl: img.url || img.imageUrl || img.remoteUrl,
      status: 'complete',
      progress: 100,
      error: null,
      isPrimary: img.isPrimary || false,
      caption: img.altText || img.caption || '',
      order: img.order !== undefined ? img.order : index,
      dimensions: img.dimensions || null,
    }));

    setImages(formattedImages);
  }, [initialImages, images]);

  /**
   * Generate unique ID for image
   */
  const generateId = useCallback(() => {
    return `img-${Date.now()}-${uploadCounterRef.current++}`;
  }, []);

  /**
   * Add files to upload queue
   */
  const addFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    console.log(`[useImageUpload] Adding ${files.length} files to queue`);
    setError(null);

    // Validate files
    const { valid, invalid } = await validateFiles(Array.from(files));

    // Show errors for invalid files
    if (invalid.length > 0) {
      const errorMessages = invalid.map(({ file, error }) =>
        `${file.name}: ${error.message}`
      ).join('\n');

      setError(`${invalid.length} file(s) failed validation:\n${errorMessages}`);
      console.warn('[useImageUpload] Invalid files:', invalid);

      if (onError) {
        onError(new Error(errorMessages));
      }
    }

    if (valid.length === 0) return;

    // Create image objects with previews
    const newImages = await Promise.all(
      valid.map(async (file) => {
        const id = generateId();
        const preview = await createPreview(file);

        return {
          id,
          file,
          localPreview: preview,
          remoteUrl: null,
          status: 'pending',
          progress: 0,
          error: null,
          isPrimary: false,
          caption: '',
          order: 0,
          dimensions: null,
        };
      })
    );

    // Update state - show optimistic UI immediately
    setImages(prev => {
      const updated = [...prev, ...newImages];
      // Set first image as primary if no primary exists
      if (!prev.some(img => img.isPrimary) && updated.length > 0) {
        updated[0].isPrimary = true;
      }
      // Update order
      return updated.map((img, index) => ({ ...img, order: index }));
    });

    // Add to upload queue
    setQueue(prev => [...prev, ...newImages.map(img => img.id)]);

    console.log(`[useImageUpload] Added ${newImages.length} images to queue`);
  }, [generateId, onError]);

  /**
   * Process upload queue
   */
  const processQueue = useCallback(async () => {
    if (isUploading) return;

    setIsUploading(true);
    console.log('[useImageUpload] Starting queue processing');

    const imagesToUpload = images.filter(img =>
      queue.includes(img.id) && img.status === 'pending'
    );

    if (imagesToUpload.length === 0) {
      setIsUploading(false);
      setQueue([]);
      return;
    }

    // Upload files (sequential for now, can be made concurrent)
    for (const image of imagesToUpload) {
      try {
        // Update status to uploading
        setImages(prev => prev.map(img =>
          img.id === image.id ? { ...img, status: 'uploading', progress: 0 } : img
        ));

        // Compress if enabled
        let fileToUpload = image.file;
        if (compressImages) {
          console.log(`[useImageUpload] Compressing ${image.file.name}...`);
          fileToUpload = await compressImage(image.file);
        }

        // Upload to server
        const formData = new FormData();
        formData.append('files', fileToUpload);

        const abortController = new AbortController();
        abortControllersRef.current.set(image.id, abortController);

        const response = await apiClient.post(endpoint, formData, {
          signal: abortController.signal,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setImages(prev => prev.map(img =>
              img.id === image.id ? { ...img, progress } : img
            ));
          },
        });

        abortControllersRef.current.delete(image.id);

        // Extract URL from response
        const uploadedUrl = response.data?.urls?.[0] || response.data?.url;

        if (!uploadedUrl) {
          throw new Error('No URL returned from server');
        }

        console.log(`[useImageUpload] Upload complete: ${uploadedUrl.substring(0, 80)}...`);

        // Update image with remote URL
        setImages(prev => prev.map(img =>
          img.id === image.id
            ? {
                ...img,
                remoteUrl: uploadedUrl,
                status: 'complete',
                progress: 100,
                error: null,
              }
            : img
        ));

        // Remove from queue
        setQueue(prev => prev.filter(id => id !== image.id));

      } catch (err) {
        console.error(`[useImageUpload] Upload failed for ${image.file.name}:`, err);

        abortControllersRef.current.delete(image.id);

        // Check if cancelled
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          setImages(prev => prev.filter(img => img.id !== image.id));
          setQueue(prev => prev.filter(id => id !== image.id));
          continue;
        }

        // Update image with error
        setImages(prev => prev.map(img =>
          img.id === image.id
            ? {
                ...img,
                status: 'error',
                error: err.response?.data?.message || err.message || 'Upload failed',
                progress: 0,
              }
            : img
        ));

        setError(err.message);

        if (onError) {
          onError(err);
        }
      }
    }

    setIsUploading(false);
    console.log('[useImageUpload] Queue processing complete');

    // Call onSuccess if all uploads completed
    const allComplete = images.every(img =>
      img.status === 'complete' || !queue.includes(img.id)
    );

    if (allComplete && onSuccess) {
      const completedImages = images.filter(img => img.status === 'complete');
      onSuccess(completedImages);
    }

  }, [isUploading, images, queue, compressImages, endpoint, onSuccess, onError]);

  /**
   * Auto-process queue when items are added
   * Bug Fix: Use useEffect instead of setTimeout to avoid stale closure issues
   */
  useEffect(() => {
    // Only process if there are pending items and not already uploading
    if (queue.length > 0 && !isUploading) {
      const hasPendingImages = images.some(img =>
        queue.includes(img.id) && img.status === 'pending'
      );

      if (hasPendingImages) {
        console.log('[useImageUpload] Auto-processing queue with', queue.length, 'items');
        processQueue();
      }
    }
  }, [queue, isUploading, images, processQueue]);

  /**
   * Upload files immediately (adds to queue, then auto-processes via useEffect)
   */
  const uploadFiles = useCallback(async (files) => {
    await addFiles(files);
    // Queue will auto-process via useEffect above
  }, [addFiles]);

  /**
   * Cancel upload
   */
  const cancelUpload = useCallback((imageId) => {
    console.log(`[useImageUpload] Cancelling upload: ${imageId}`);

    const controller = abortControllersRef.current.get(imageId);
    if (controller) {
      controller.abort();
    }

    setImages(prev => prev.filter(img => img.id !== imageId));
    setQueue(prev => prev.filter(id => id !== imageId));
  }, []);

  /**
   * Retry failed upload
   */
  const retryUpload = useCallback((imageId) => {
    console.log(`[useImageUpload] Retrying upload: ${imageId}`);

    setImages(prev => prev.map(img =>
      img.id === imageId
        ? { ...img, status: 'pending', error: null, progress: 0 }
        : img
    ));

    setQueue(prev => [...prev, imageId]);
    processQueue();
  }, [processQueue]);

  /**
   * Remove image from gallery
   */
  const removeImage = useCallback((imageId) => {
    console.log(`[useImageUpload] Removing image: ${imageId}`);

    cancelUpload(imageId);
    setImages(prev => {
      const updated = prev.filter(img => img.id !== imageId);
      // Reassign order
      return updated.map((img, index) => ({ ...img, order: index }));
    });
  }, [cancelUpload]);

  /**
   * Set cover/primary image
   */
  const setCoverImage = useCallback((imageId) => {
    console.log(`[useImageUpload] Setting cover image: ${imageId}`);

    setImages(prev => prev.map(img => ({
      ...img,
      isPrimary: img.id === imageId,
    })));
  }, []);

  /**
   * Reorder images
   */
  const reorderImages = useCallback((startIndex, endIndex) => {
    console.log(`[useImageUpload] Reordering: ${startIndex} -> ${endIndex}`);

    setImages(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      // Update order
      return result.map((img, index) => ({ ...img, order: index }));
    });
  }, []);

  /**
   * Update image caption
   */
  const updateCaption = useCallback((imageId, caption) => {
    setImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, caption } : img
    ));
  }, []);

  /**
   * Clear all images
   */
  const clearAll = useCallback(() => {
    console.log('[useImageUpload] Clearing all images');

    // Cancel all pending uploads
    images.forEach(img => {
      if (img.status === 'uploading' || img.status === 'pending') {
        cancelUpload(img.id);
      }
    });

    setImages([]);
    setQueue([]);
    setError(null);
  }, [images, cancelUpload]);

  /**
   * Get completed images (for form submission)
   */
  const getCompletedImages = useCallback(() => {
    return images
      .filter(img => img.status === 'complete' && img.remoteUrl)
      .map(img => ({
        imageUrl: img.remoteUrl,
        caption: img.caption || null,
        isPrimary: img.isPrimary,
        order: img.order,
      }));
  }, [images]);

  return {
    // State
    images,
    queue,
    isUploading,
    error,

    // Methods
    uploadFiles,
    addFiles,
    processQueue,
    cancelUpload,
    retryUpload,
    removeImage,
    setCoverImage,
    reorderImages,
    updateCaption,
    clearAll,
    getCompletedImages,

    // Computed
    hasImages: images.length > 0,
    completedCount: images.filter(img => img.status === 'complete').length,
    uploadingCount: images.filter(img => img.status === 'uploading').length,
    errorCount: images.filter(img => img.status === 'error').length,
    pendingCount: queue.length,
  };
}
