import React, { useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import pLimit from 'p-limit';
import { compressImage, createPreview } from '../utils/imageCompression';
import { validateFiles } from '../utils/imageValidation';
import { computeFileHashes, findDuplicates } from '../utils/fileHashing';
import apiClient from '../../../api/client';

// LocalStorage keys
const STORAGE_KEY_PREFIX = 'image_upload_state_';
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds

/**
 * Save upload state to localStorage
 */
const saveUploadState = (key, images, queue) => {
  try {
    const state = {
      images: images.map(img => ({
        id: img.id,
        fileName: img.file?.name,
        fileSize: img.file?.size,
        fileType: img.file?.type,
        localPreview: img.localPreview,
        remoteUrl: img.remoteUrl,
        status: img.status,
        progress: img.progress,
        error: img.error,
        isPrimary: img.isPrimary,
        caption: img.caption,
        category: img.category,
        order: img.order,
        dimensions: img.dimensions,
        retryCount: img.retryCount || 0,
        hash: img.hash,
      })),
      queue,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(state));
    console.log('[useImageUpload] Saved state to localStorage');
  } catch (error) {
    console.error('[useImageUpload] Failed to save state:', error);
  }
};

/**
 * Load upload state from localStorage
 */
const loadUploadState = (key) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return null;

    const state = JSON.parse(saved);

    // Check if state is too old (more than 24 hours)
    const age = Date.now() - state.timestamp;
    if (age > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }

    return state;
  } catch (error) {
    console.error('[useImageUpload] Failed to load state:', error);
    return null;
  }
};

/**
 * Clear upload state from localStorage
 */
const clearUploadState = (key) => {
  try {
    localStorage.removeItem(key);
    console.log('[useImageUpload] Cleared state from localStorage');
  } catch (error) {
    console.error('[useImageUpload] Failed to clear state:', error);
  }
};

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
 * @param {string} options.storageKey - Unique key for localStorage persistence (optional)
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
    storageKey,
  } = options;

  // Generate storage key if persistence is enabled
  const persistenceKey = storageKey ? `${STORAGE_KEY_PREFIX}${storageKey}` : null;

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
        category: img.category || 'OTHER',
        order: img.order !== undefined ? img.order : index,
        dimensions: img.dimensions || null,
        retryCount: 0,
      }));
    }
    return [];
  });
  const [queue, setQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [interruptedUploads, setInterruptedUploads] = useState(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [duplicateData, setDuplicateData] = useState(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  // Refs
  const uploadCounterRef = useRef(0);
  const abortControllersRef = useRef(new Map());
  const initialImagesProcessedRef = useRef(false);
  const lastProgressRefs = useRef({}); // Track last progress update per image
  const mountedRef = useRef(false);

  /**
   * Detect interrupted uploads on component mount
   */
  useEffect(() => {
    if (!persistenceKey || mountedRef.current) return;
    mountedRef.current = true;

    const savedState = loadUploadState(persistenceKey);
    if (!savedState) return;

    // Check if there are interrupted uploads (pending or uploading status)
    const interrupted = savedState.images.filter(
      img => img.status === 'pending' || img.status === 'uploading'
    );

    if (interrupted.length > 0) {
      console.log(`[useImageUpload] Found ${interrupted.length} interrupted uploads`);
      setInterruptedUploads(savedState);
      setShowResumeDialog(true);
    } else {
      // No interrupted uploads, clear old state
      clearUploadState(persistenceKey);
    }
  }, [persistenceKey]);

  /**
   * Sync initialImages to state when they change (for edit mode)
   * This handles the case where initialImages prop updates after initial mount
   * Bug Fix: Prevent infinite loops by comparing content, not just signature
   */
  useEffect(() => {
    // Skip if no initial images or if we've already processed them
    if (!initialImages || initialImages.length === 0) {
      // If we have images and initialImages becomes empty, clear them
      if (images.length > 0 && !images.some(img => img.status === 'pending' || img.status === 'uploading')) {
        console.log('[useImageUpload] InitialImages is now empty, clearing state');
        setImages([]);
        initialImagesProcessedRef.current = '';
      }
      return;
    }

    // If we already have active uploads, don't overwrite local state with incoming props
    // This prevents losing pending uploads when parents update the images prop mid-upload
    const hasActiveLocalUploads = images.some((img) => img.status === 'pending' || img.status === 'uploading');
    if (hasActiveLocalUploads) {
      console.log('[useImageUpload] Skipping sync - active uploads in progress');
      return;
    }

    // Create a unique signature for the current initialImages
    const signature = initialImages.map(img => img.id || img.url || img.imageUrl).join(',');

    // Only update if the signature has changed
    if (initialImagesProcessedRef.current === signature) {
      return;
    }

    // Additional check: Compare current completed images with initialImages
    // to prevent syncing if they're essentially the same
    const currentCompletedUrls = images
      .filter(img => img.status === 'complete')
      .map(img => img.remoteUrl)
      .sort()
      .join(',');

    const incomingUrls = initialImages
      .map(img => img.url || img.imageUrl || img.remoteUrl)
      .sort()
      .join(',');

    if (currentCompletedUrls === incomingUrls && images.length === initialImages.length) {
      console.log('[useImageUpload] Skipping sync - images are already in sync');
      initialImagesProcessedRef.current = signature;
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
   * Add files to upload queue with duplicate detection
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

    // Compute hashes for all valid files
    console.log('[useImageUpload] Computing file hashes...');
    const fileHashMap = await computeFileHashes(valid);

    // Get existing hashes from current images
    const existingHashes = images
      .filter(img => img.hash)
      .map(img => img.hash);

    // Find duplicates
    const { duplicates, unique } = findDuplicates(fileHashMap, existingHashes);

    // If duplicates found, show dialog
    if (duplicates.length > 0) {
      console.log(`[useImageUpload] Found ${duplicates.length} duplicate files`);

      // Find matching image info for duplicates
      const duplicateInfo = duplicates.map(({ file, hash }) => {
        const existingImage = images.find(img => img.hash === hash);
        return {
          file,
          hash,
          existingFileName: existingImage?.file?.name || 'uploaded file',
          existingImage,
        };
      });

      // Store data for dialog
      setDuplicateData({
        duplicates: duplicateInfo,
        uniqueFiles: unique,
        allFiles: valid,
      });
      setShowDuplicateDialog(true);

      return; // Wait for user decision
    }

    // No duplicates, proceed with adding files
    await addFilesWithHashes(unique);
  }, [generateId, onError, images]);

  /**
   * Add files with their computed hashes (internal helper)
   */
  const addFilesWithHashes = useCallback(async (filesWithHashes) => {
    if (!filesWithHashes || filesWithHashes.length === 0) return;

    console.log(`[useImageUpload] Adding ${filesWithHashes.length} files with hashes`);

    // Create image objects with previews and hashes
    const newImages = await Promise.all(
      filesWithHashes.map(async ({ file, hash }) => {
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
          category: 'OTHER',
          order: 0,
          dimensions: null,
          retryCount: 0,
          hash,
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

    // Show toast notification
    const fileWord = newImages.length === 1 ? 'file' : 'files';
    toast.info(`Uploading ${newImages.length} ${fileWord}...`, {
      icon: '📤',
      duration: 3000,
    });

    console.log(`[useImageUpload] Added ${newImages.length} images to queue`);
  }, [generateId]);

  /**
   * Upload single image with retry logic
   */
  const uploadSingleImage = useCallback(async (image) => {
    const retryCount = image.retryCount || 0;

    try {
      // Update status to uploading
      setImages(prev => prev.map(img =>
        img.id === image.id ? { ...img, status: 'uploading', progress: 0 } : img
      ));

      // Save state to localStorage before upload
      if (persistenceKey) {
        setImages(prev => {
          saveUploadState(persistenceKey, prev, queue);
          return prev;
        });
      }

      // Compress if enabled
      let fileToUpload = image.file;
      if (compressImages && image.file) {
        console.log(`[useImageUpload] Compressing ${image.file.name}...`);
        fileToUpload = await compressImage(image.file);
      }

      // Upload to server
      const formData = new FormData();
      formData.append('files', fileToUpload);

      const abortController = new AbortController();
      abortControllersRef.current.set(image.id, abortController);

      // Initialize per-image progress tracking
      if (!lastProgressRefs.current[image.id]) {
        lastProgressRefs.current[image.id] = 0;
      }

      const response = await apiClient.post(endpoint, formData, {
        signal: abortController.signal,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );

          // Get last progress for this specific image
          const lastProgressUpdate = lastProgressRefs.current[image.id] || 0;

          // Guard: Skip if already complete (prevents post-100% updates)
          if (lastProgressUpdate >= 100) {
            return;
          }

          // Bug Fix: Don't update to 100% here - let the completion handler do it
          // This prevents race condition where progress=100 but status='uploading'
          // which causes flickering when transitioning to status='complete'
          if (progress >= 100) {
            return;
          }

          // Throttle progress updates to every 5% to reduce re-renders
          // Always update at 0%
          if (progress === 0 || progress - lastProgressUpdate >= 5) {
            lastProgressRefs.current[image.id] = progress;
            setImages(prev => prev.map(img =>
              img.id === image.id ? { ...img, progress } : img
            ));
          }
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
              retryCount: 0,
            }
          : img
      ));

      // Clean up progress tracking for completed upload
      delete lastProgressRefs.current[image.id];

      // Remove from queue
      setQueue(prev => prev.filter(id => id !== image.id));

      return true;
    } catch (err) {
      console.error(`[useImageUpload] Upload failed for ${image.file?.name}:`, err);

      abortControllersRef.current.delete(image.id);
      delete lastProgressRefs.current[image.id];

      // Check if cancelled
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        setImages(prev => prev.filter(img => img.id !== image.id));
        setQueue(prev => prev.filter(id => id !== image.id));
        return false;
      }

      // Check if this is a network error that should be retried
      const isNetworkError =
        err.code === 'ERR_NETWORK' ||
        err.code === 'ECONNABORTED' ||
        err.message?.includes('Network Error') ||
        err.message?.includes('timeout');

      if (isNetworkError && retryCount < MAX_RETRY_ATTEMPTS) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`[useImageUpload] Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);

        // Update retry count
        setImages(prev => prev.map(img =>
          img.id === image.id
            ? { ...img, retryCount: retryCount + 1, status: 'pending', error: `Retrying... (attempt ${retryCount + 1})` }
            : img
        ));

        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the upload
        const updatedImage = { ...image, retryCount: retryCount + 1 };
        return await uploadSingleImage(updatedImage);
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

      const errorMessage = err.response?.data?.message || err.message || 'Upload failed';

      setError(errorMessage);

      // Show error toast with "View Details" button
      toast.error(
        (t) => React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
          React.createElement(
            'span',
            { style: { flex: 1 } },
            `Failed to upload ${image.file?.name || 'file'}: ${errorMessage}`
          ),
          React.createElement(
            'button',
            {
              onClick: () => {
                expandUploadQueue();
                toast.dismiss(t.id);
              },
              style: {
                background: '#fff',
                color: '#f44336',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
              },
            },
            'View Details'
          )
        ),
        {
          duration: 6000,
          icon: '❌',
        }
      );

      if (onError) {
        onError(err);
      }

      return false;
    }
  }, [compressImages, endpoint, onError, persistenceKey, queue]);

  /**
   * Process upload queue with concurrent uploads
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

    // Upload files concurrently with rate limiting
    console.log(`[useImageUpload] Uploading ${imagesToUpload.length} files with maxConcurrent=${maxConcurrent}`);
    const limit = pLimit(maxConcurrent);

    // Create array of limited upload promises
    const uploadPromises = imagesToUpload.map(image =>
      limit(() => uploadSingleImage(image))
    );

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);

    setIsUploading(false);
    console.log('[useImageUpload] Queue processing complete');

    // Clear localStorage when all uploads are complete
    if (persistenceKey) {
      const allComplete = images.every(img =>
        img.status === 'complete' || !queue.includes(img.id)
      );
      if (allComplete) {
        clearUploadState(persistenceKey);
      }
    }

    // Call onSuccess if all uploads completed
    const allComplete = images.every(img =>
      img.status === 'complete' || !queue.includes(img.id)
    );

    if (allComplete) {
      const completedImages = images.filter(img => img.status === 'complete');
      const newlyCompleted = completedImages.filter(img =>
        imagesToUpload.some(upload => upload.id === img.id)
      );

      // Show success toast for newly completed uploads
      if (newlyCompleted.length > 0) {
        const imageWord = newlyCompleted.length === 1 ? 'image' : 'images';
        toast.success(`Successfully uploaded ${newlyCompleted.length} ${imageWord}`, {
          icon: '✅',
          duration: 3000,
        });
      }

      // Call parent onSuccess callback
      if (onSuccess) {
        onSuccess(completedImages);
      }
    }

  }, [isUploading, images, queue, uploadSingleImage, persistenceKey, onSuccess, maxConcurrent]);

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
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cancel all active uploads
      abortControllersRef.current.forEach((controller) => {
        controller.abort();
      });
      abortControllersRef.current.clear();

      // Clear progress tracking
      lastProgressRefs.current = {};

      console.log('[useImageUpload] Cleanup complete');
    };
  }, []);

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

    // Clean up progress tracking
    delete lastProgressRefs.current[imageId];

    setImages(prev => prev.filter(img => img.id !== imageId));
    setQueue(prev => prev.filter(id => id !== imageId));
  }, []);

  /**
   * Retry failed upload
   */
  const retryUpload = useCallback((imageId) => {
    console.log(`[useImageUpload] Retrying upload: ${imageId}`);

    // Reset progress tracking for retry
    lastProgressRefs.current[imageId] = 0;

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
   * Update image category
   */
  const updateCategory = useCallback((imageId, category) => {
    setImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, category } : img
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

  /**
   * Bulk delete multiple images
   */
  const bulkDelete = useCallback((imageIds) => {
    console.log(`[useImageUpload] Bulk deleting ${imageIds.length} images`);

    // Cancel any active uploads for these images
    imageIds.forEach(id => {
      const controller = abortControllersRef.current.get(id);
      if (controller) {
        controller.abort();
      }
      delete lastProgressRefs.current[id];
    });

    setImages(prev => {
      const updated = prev.filter(img => !imageIds.includes(img.id));
      // Reassign order
      return updated.map((img, index) => ({ ...img, order: index }));
    });

    setQueue(prev => prev.filter(id => !imageIds.includes(id)));
  }, []);

  /**
   * Bulk reorder images to specific positions
   * @param {Array<{id: string, newOrder: number}>} reorderMap - Array of {id, newOrder}
   */
  const bulkReorder = useCallback((reorderMap) => {
    console.log(`[useImageUpload] Bulk reordering ${reorderMap.length} images`);

    setImages(prev => {
      // Create a copy of the images array
      const result = [...prev];

      // Sort reorderMap by newOrder to process in sequence
      const sortedMap = [...reorderMap].sort((a, b) => a.newOrder - b.newOrder);

      // Apply reordering for each image
      sortedMap.forEach(({ id, newOrder }) => {
        const currentIndex = result.findIndex(img => img.id === id);
        if (currentIndex !== -1 && newOrder >= 0 && newOrder < result.length) {
          const [removed] = result.splice(currentIndex, 1);
          result.splice(newOrder, 0, removed);
        }
      });

      // Update order property
      return result.map((img, index) => ({ ...img, order: index }));
    });
  }, []);

  /**
   * Bulk update captions for multiple images
   * @param {Array<{id: string, caption: string}>} captionUpdates - Array of {id, caption}
   */
  const bulkUpdateCaptions = useCallback((captionUpdates) => {
    console.log(`[useImageUpload] Bulk updating captions for ${captionUpdates.length} images`);

    const updateMap = new Map(captionUpdates.map(({ id, caption }) => [id, caption]));

    setImages(prev => prev.map(img => {
      if (updateMap.has(img.id)) {
        return { ...img, caption: updateMap.get(img.id) };
      }
      return img;
    }));
  }, []);

  /**
   * Resume interrupted uploads
   */
  const resumeInterruptedUploads = useCallback(() => {
    if (!interruptedUploads) return;

    console.log('[useImageUpload] Resuming interrupted uploads');

    // Note: We can't restore File objects from localStorage
    // So we convert interrupted uploads to error state with a helpful message
    const restoredImages = interruptedUploads.images.map(img => ({
      ...img,
      file: null,
      status: img.status === 'complete' ? 'complete' : 'error',
      error: img.status !== 'complete'
        ? 'Upload interrupted. Please re-add the file to upload.'
        : null,
    }));

    setImages(prev => {
      // Merge with existing images, avoiding duplicates
      const existingIds = new Set(prev.map(img => img.id));
      const newImages = restoredImages.filter(img => !existingIds.has(img.id));
      return [...prev, ...newImages];
    });

    setQueue(prev => {
      const newQueue = interruptedUploads.queue.filter(id =>
        !prev.includes(id) &&
        restoredImages.find(img => img.id === id)?.status === 'pending'
      );
      return [...prev, ...newQueue];
    });

    setShowResumeDialog(false);
    setInterruptedUploads(null);

    if (persistenceKey) {
      clearUploadState(persistenceKey);
    }
  }, [interruptedUploads, persistenceKey]);

  /**
   * Dismiss interrupted uploads dialog
   */
  const dismissInterruptedUploads = useCallback(() => {
    console.log('[useImageUpload] Dismissing interrupted uploads');
    setShowResumeDialog(false);
    setInterruptedUploads(null);

    if (persistenceKey) {
      clearUploadState(persistenceKey);
    }
  }, [persistenceKey]);

  /**
   * Handle duplicate dialog - Skip duplicates
   */
  const skipDuplicates = useCallback(async () => {
    if (!duplicateData) return;

    console.log('[useImageUpload] Skipping duplicates, adding unique files only');
    setShowDuplicateDialog(false);

    // Add only unique files
    await addFilesWithHashes(duplicateData.uniqueFiles);

    setDuplicateData(null);
  }, [duplicateData, addFilesWithHashes]);

  /**
   * Handle duplicate dialog - Replace duplicates
   */
  const replaceDuplicates = useCallback(async () => {
    if (!duplicateData) return;

    console.log('[useImageUpload] Replacing duplicates with new files');
    setShowDuplicateDialog(false);

    // Remove existing images that have duplicate hashes
    const hashesToReplace = new Set(duplicateData.duplicates.map(d => d.hash));
    const idsToRemove = images
      .filter(img => img.hash && hashesToReplace.has(img.hash))
      .map(img => img.id);

    if (idsToRemove.length > 0) {
      // Cancel any active uploads for these images
      idsToRemove.forEach(id => {
        const controller = abortControllersRef.current.get(id);
        if (controller) {
          controller.abort();
        }
        delete lastProgressRefs.current[id];
      });

      // Remove from state
      setImages(prev => prev.filter(img => !idsToRemove.includes(img.id)));
      setQueue(prev => prev.filter(id => !idsToRemove.includes(id)));
    }

    // Re-compute hashes for all files (both duplicates and unique)
    const allFilesWithHashes = await computeFileHashes(duplicateData.allFiles);
    const filesArray = Array.from(allFilesWithHashes.entries()).map(([file, hash]) => ({
      file,
      hash,
    }));

    // Add all files
    await addFilesWithHashes(filesArray);

    setDuplicateData(null);
  }, [duplicateData, images, addFilesWithHashes]);

  /**
   * Handle duplicate dialog - Cancel
   */
  const cancelDuplicateDialog = useCallback(() => {
    console.log('[useImageUpload] Cancelling duplicate dialog');
    setShowDuplicateDialog(false);
    setDuplicateData(null);
  }, []);

  return {
    // State
    images,
    queue,
    isUploading,
    error,
    interruptedUploads,
    showResumeDialog,
    duplicateData,
    showDuplicateDialog,

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
    updateCategory,
    clearAll,
    getCompletedImages,
    resumeInterruptedUploads,
    dismissInterruptedUploads,
    skipDuplicates,
    replaceDuplicates,
    cancelDuplicateDialog,

    // Bulk operations
    bulkDelete,
    bulkReorder,
    bulkUpdateCaptions,

    // Computed
    hasImages: images.length > 0,
    completedCount: images.filter(img => img.status === 'complete').length,
    uploadingCount: images.filter(img => img.status === 'uploading').length,
    errorCount: images.filter(img => img.status === 'error').length,
    pendingCount: queue.length,
  };
}
