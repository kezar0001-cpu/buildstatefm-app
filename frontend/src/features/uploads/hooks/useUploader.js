/**
 * useUploader - Simplified File Upload Hook
 * =========================================
 *
 * A clean, simple upload hook that replaces the complex useImageUpload.
 *
 * FEATURES:
 * - Single file uploads (caller can loop for multiple files)
 * - Automatic image compression for files > 1MB
 * - Max 2 concurrent uploads (rest queued)
 * - Graceful rate limit handling with automatic retry
 * - Simple, predictable state management
 *
 * USAGE:
 * ```jsx
 * const {
 *   files,
 *   isUploading,
 *   isPaused,
 *   pauseReason,
 *   addFiles,
 *   removeFile,
 *   retryFile,
 *   clearCompleted,
 *   reset
 * } = useUploader({
 *   entityType: 'property',
 *   entityId: propertyId,
 *   category: 'gallery',
 *   onSuccess: (file) => console.log('Uploaded:', file),
 *   onError: (file, error) => console.error('Failed:', error),
 * });
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import apiClient from '../../../api/client';
import { compressImage } from '../../images/utils/imageCompression';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_CONCURRENT_UPLOADS = 2;
const COMPRESSION_THRESHOLD_MB = 1;
const API_ENDPOINT = '/v2/uploads';

// File status enum
export const FileStatus = {
  PENDING: 'pending',
  COMPRESSING: 'compressing',
  UPLOADING: 'uploading',
  SUCCESS: 'success',
  ERROR: 'error',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for a file
 */
function generateFileId() {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a file is an image
 */
function isImage(file) {
  return file.type?.startsWith('image/') || false;
}

/**
 * Create a preview URL for an image file
 */
function createPreviewUrl(file) {
  if (!isImage(file)) return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

/**
 * Check if a file needs compression (simple size check)
 */
function needsCompression(file, maxSizeMB) {
  return file.size > maxSizeMB * 1024 * 1024;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * @typedef {Object} UploaderOptions
 * @property {string} entityType - Entity type (property, unit, inspection, etc.)
 * @property {string} entityId - Entity ID (UUID)
 * @property {string} [category] - Optional category (gallery, hero, etc.)
 * @property {string} [fileType='image'] - 'image' or 'document'
 * @property {boolean} [compress=true] - Whether to compress images
 * @property {function} [onSuccess] - Callback when file uploads successfully
 * @property {function} [onError] - Callback when file upload fails
 * @property {function} [onChange] - Callback when files array changes
 */

/**
 * @typedef {Object} UploadedFile
 * @property {string} id - Unique file ID
 * @property {File} file - Original file object
 * @property {string} name - File name
 * @property {number} size - File size in bytes
 * @property {string} type - MIME type
 * @property {string} status - Current status (pending, compressing, uploading, success, error)
 * @property {number} progress - Upload progress (0-100)
 * @property {string|null} previewUrl - Preview URL for images
 * @property {string|null} uploadedUrl - URL after successful upload
 * @property {string|null} uploadedKey - S3 key after successful upload
 * @property {string|null} error - Error message if failed
 * @property {number} retryCount - Number of retry attempts
 */

export default function useUploader({
  entityType,
  entityId,
  category,
  fileType = 'image',
  compress = true,
  onSuccess,
  onError,
  onChange,
} = {}) {
  // ============================================================================
  // STATE
  // ============================================================================

  const [files, setFiles] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState(null);
  const [pauseUntil, setPauseUntil] = useState(null);

  // Refs to track upload state without causing re-renders
  const uploadQueueRef = useRef([]);
  const activeUploadsRef = useRef(0);
  const isProcessingRef = useRef(false);

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  const isUploading = files.some(
    (f) => f.status === FileStatus.UPLOADING || f.status === FileStatus.COMPRESSING
  );

  const pendingCount = files.filter((f) => f.status === FileStatus.PENDING).length;
  const successCount = files.filter((f) => f.status === FileStatus.SUCCESS).length;
  const errorCount = files.filter((f) => f.status === FileStatus.ERROR).length;

  // ============================================================================
  // FILE STATE UPDATES
  // ============================================================================

  const updateFile = useCallback((id, updates) => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, ...updates } : f));
      return updated;
    });
  }, []);

  // Call onChange when files change
  useEffect(() => {
    onChange?.(files);
  }, [files, onChange]);

  // ============================================================================
  // PAUSE HANDLING
  // ============================================================================

  // Resume uploads when pause period ends
  useEffect(() => {
    if (!pauseUntil) return;

    const now = Date.now();
    const delay = pauseUntil - now;

    if (delay <= 0) {
      setIsPaused(false);
      setPauseReason(null);
      setPauseUntil(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsPaused(false);
      setPauseReason(null);
      setPauseUntil(null);
    }, delay);

    return () => clearTimeout(timer);
  }, [pauseUntil]);

  // ============================================================================
  // UPLOAD LOGIC
  // ============================================================================

  /**
   * Upload a single file
   */
  const uploadSingleFile = useCallback(
    async (fileEntry) => {
      const { id, file } = fileEntry;

      try {
        // Compress image if needed
        let fileToUpload = file;
        if (compress && isImage(file) && needsCompression(file, COMPRESSION_THRESHOLD_MB)) {
          updateFile(id, { status: FileStatus.COMPRESSING });
          try {
            const compressed = await compressImage(file, {
              maxSizeMB: COMPRESSION_THRESHOLD_MB,
              maxWidthOrHeight: 2000,
              useWebWorker: true,
            });
            fileToUpload = compressed;
          } catch (compressError) {
            console.warn('[useUploader] Compression failed, using original:', compressError.message);
          }
        }

        // Update status to uploading
        updateFile(id, { status: FileStatus.UPLOADING, progress: 0 });

        // Create form data
        const formData = new FormData();
        formData.append('file', fileToUpload, file.name);
        formData.append('entityType', entityType);
        formData.append('entityId', entityId);
        if (category) {
          formData.append('category', category);
        }
        if (fileType === 'document') {
          formData.append('fileType', 'document');
        }

        // Upload
        const response = await apiClient.post(API_ENDPOINT, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            updateFile(id, { progress });
          },
        });

        // Success
        const uploadedFile = response.data.file;
        updateFile(id, {
          status: FileStatus.SUCCESS,
          progress: 100,
          uploadedUrl: uploadedFile.url,
          uploadedKey: uploadedFile.key,
          error: null,
        });

        onSuccess?.({ id, ...uploadedFile });
        return { success: true };
      } catch (error) {
        const status = error.response?.status;
        const data = error.response?.data;

        // Handle rate limiting
        if (status === 429) {
          // Get retry delay from headers or response
          const retryAfter =
            error.response?.headers?.['retry-after'] ||
            data?.retryAfterSeconds ||
            30;
          const retryAfterSeconds = parseInt(retryAfter, 10) || 30;

          // Pause all uploads
          const pauseUntilTime = Date.now() + retryAfterSeconds * 1000;
          setIsPaused(true);
          setPauseReason(`Rate limited. Resuming in ${retryAfterSeconds} seconds...`);
          setPauseUntil(pauseUntilTime);

          // Put file back in queue
          updateFile(id, {
            status: FileStatus.PENDING,
            progress: 0,
            retryCount: (fileEntry.retryCount || 0) + 1,
          });

          return { success: false, rateLimited: true, retryAfterSeconds };
        }

        // Other errors
        const errorMessage = data?.message || error.message || 'Upload failed';
        updateFile(id, {
          status: FileStatus.ERROR,
          progress: 0,
          error: errorMessage,
        });

        onError?.({ id, name: file.name }, errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    [entityType, entityId, category, fileType, compress, updateFile, onSuccess, onError]
  );

  /**
   * Process the upload queue
   */
  const processQueue = useCallback(async () => {
    // Don't process if paused or already at max concurrency
    if (isPaused || isProcessingRef.current) return;

    isProcessingRef.current = true;

    try {
      while (true) {
        // Check if we can start more uploads
        if (isPaused || activeUploadsRef.current >= MAX_CONCURRENT_UPLOADS) {
          break;
        }

        // Find next pending file
        const pendingFile = files.find((f) => f.status === FileStatus.PENDING);
        if (!pendingFile) break;

        // Increment active count
        activeUploadsRef.current++;

        // Start upload (don't await - allow parallel uploads)
        uploadSingleFile(pendingFile).finally(() => {
          activeUploadsRef.current--;
          // Recursively process queue after upload completes
          processQueue();
        });
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [files, isPaused, uploadSingleFile]);

  // Process queue when files change or pause ends
  useEffect(() => {
    if (!isPaused && files.some((f) => f.status === FileStatus.PENDING)) {
      processQueue();
    }
  }, [files, isPaused, processQueue]);

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Add files to the upload queue
   * @param {FileList|File[]} newFiles - Files to add
   */
  const addFiles = useCallback((newFiles) => {
    const fileArray = Array.from(newFiles);

    const newEntries = fileArray.map((file) => ({
      id: generateFileId(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: FileStatus.PENDING,
      progress: 0,
      previewUrl: createPreviewUrl(file),
      uploadedUrl: null,
      uploadedKey: null,
      error: null,
      retryCount: 0,
    }));

    setFiles((prev) => [...prev, ...newEntries]);
  }, []);

  /**
   * Remove a file from the queue
   * @param {string} id - File ID to remove
   */
  const removeFile = useCallback((id) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  /**
   * Retry a failed file
   * @param {string} id - File ID to retry
   */
  const retryFile = useCallback((id) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, status: FileStatus.PENDING, progress: 0, error: null }
          : f
      )
    );
  }, []);

  /**
   * Clear all completed files
   */
  const clearCompleted = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((f) => {
        if (f.status === FileStatus.SUCCESS && f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
      return prev.filter((f) => f.status !== FileStatus.SUCCESS);
    });
  }, []);

  /**
   * Reset the uploader (clear all files)
   */
  const reset = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((f) => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
      return [];
    });
    setIsPaused(false);
    setPauseReason(null);
    setPauseUntil(null);
    activeUploadsRef.current = 0;
  }, []);

  /**
   * Get completed files with their uploaded URLs
   */
  const getCompletedFiles = useCallback(() => {
    return files
      .filter((f) => f.status === FileStatus.SUCCESS)
      .map((f) => ({
        id: f.id,
        name: f.name,
        url: f.uploadedUrl,
        key: f.uploadedKey,
        size: f.size,
        type: f.type,
      }));
  }, [files]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    files,
    isUploading,
    isPaused,
    pauseReason,

    // Counts
    pendingCount,
    successCount,
    errorCount,

    // Actions
    addFiles,
    removeFile,
    retryFile,
    clearCompleted,
    reset,
    getCompletedFiles,
  };
}

// Export constants
export { FileStatus as UploadStatus };
