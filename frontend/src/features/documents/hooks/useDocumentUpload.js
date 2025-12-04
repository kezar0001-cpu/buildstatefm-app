import { useState, useCallback, useRef, useEffect } from 'react';
import { validateFiles } from '../utils/documentValidation';
import apiClient from '../../../api/client';
import logger from '../../../utils/logger';

/**
 * Document upload hook with queue management and optimistic UI
 *
 * @param {Object} options
 * @param {Function} options.onSuccess - Called when all uploads complete
 * @param {Function} options.onError - Called when an upload fails
 * @param {string} options.endpoint - Upload endpoint URL
 * @param {number} options.maxConcurrent - Max concurrent uploads
 * @param {Array} options.initialDocuments - Initial documents to display (for edit mode)
 * @returns {Object} Upload state and methods
 */
export function useDocumentUpload(options = {}) {
  const {
    onSuccess,
    onError,
    endpoint = '/uploads/documents',
    maxConcurrent = 3,
    initialDocuments = [],
  } = options;

  // State - Initialize with existing documents if provided
  const [documents, setDocuments] = useState(() => {
    if (initialDocuments && initialDocuments.length > 0) {
      return initialDocuments.map((doc, index) => ({
        id: doc.id || `existing-${Date.now()}-${index}`,
        file: null,
        fileName: doc.fileName || doc.name || 'Unknown',
        fileUrl: doc.fileUrl || doc.url,
        fileSize: doc.fileSize || 0,
        mimeType: doc.mimeType || 'application/octet-stream',
        status: 'complete',
        progress: 100,
        error: null,
        category: doc.category || 'OTHER',
        description: doc.description || '',
        accessLevel: doc.accessLevel || 'PUBLIC',
        unitId: doc.unitId || null,
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
  const initialDocumentsProcessedRef = useRef(false);

  /**
   * Sync initialDocuments to state when they change (for edit mode)
   */
  useEffect(() => {
    if (!initialDocuments || initialDocuments.length === 0) {
      return;
    }

    const signature = initialDocuments
      .map((doc) => doc.id || doc.fileUrl)
      .join(',');

    if (initialDocumentsProcessedRef.current === signature) {
      return;
    }

    logger.log(
      '[useDocumentUpload] Syncing initialDocuments to state:',
      initialDocuments.length,
      'documents'
    );
    initialDocumentsProcessedRef.current = signature;

    const formattedDocuments = initialDocuments.map((doc, index) => ({
      id: doc.id || `existing-${Date.now()}-${index}`,
      file: null,
      fileName: doc.fileName || doc.name || 'Unknown',
      fileUrl: doc.fileUrl || doc.url,
      fileSize: doc.fileSize || 0,
      mimeType: doc.mimeType || 'application/octet-stream',
      status: 'complete',
      progress: 100,
      error: null,
      category: doc.category || 'OTHER',
      description: doc.description || '',
      accessLevel: doc.accessLevel || 'PUBLIC',
      unitId: doc.unitId || null,
    }));

    setDocuments(formattedDocuments);
  }, [initialDocuments]);

  /**
   * Generate unique ID for document
   */
  const generateId = useCallback(() => {
    return `doc-${Date.now()}-${uploadCounterRef.current++}`;
  }, []);

  /**
   * Add files to upload queue
   */
  const addFiles = useCallback(
    async (files, metadata = {}) => {
      if (!files || files.length === 0) return;

      logger.log(`[useDocumentUpload] Adding ${files.length} files to queue`);
      setError(null);

      // Validate files
      const { valid, invalid } = await validateFiles(Array.from(files));

      // Show errors for invalid files
      if (invalid.length > 0) {
        const errorMessages = invalid
          .map(({ file, error }) => `${file.name}: ${error.message}`)
          .join('\n');

        setError(
          `${invalid.length} file(s) failed validation:\n${errorMessages}`
        );
        logger.warn('[useDocumentUpload] Invalid files:', invalid);

        if (onError) {
          onError(new Error(errorMessages));
        }
      }

      if (valid.length === 0) return;

      // Create document objects
      const newDocuments = valid.map((file) => {
        const id = generateId();

        return {
          id,
          file,
          fileName: file.name,
          fileUrl: null,
          fileSize: file.size,
          mimeType: file.type,
          status: 'pending',
          progress: 0,
          error: null,
          category: metadata.category || 'OTHER',
          description: metadata.description || '',
          accessLevel: metadata.accessLevel || 'PUBLIC',
          unitId: metadata.unitId || null,
        };
      });

      // Update state - show optimistic UI immediately
      setDocuments((prev) => [...prev, ...newDocuments]);

      // Add to upload queue
      setQueue((prev) => [...prev, ...newDocuments.map((doc) => doc.id)]);

      logger.log(
        `[useDocumentUpload] Added ${newDocuments.length} documents to queue`
      );
    },
    [generateId, onError]
  );

  /**
   * Process upload queue
   */
  const processQueue = useCallback(async () => {
    if (isUploading) return;

    setIsUploading(true);
    logger.log('[useDocumentUpload] Starting queue processing');

    const documentsToUpload = documents.filter(
      (doc) => queue.includes(doc.id) && doc.status === 'pending'
    );

    if (documentsToUpload.length === 0) {
      setIsUploading(false);
      setQueue([]);
      return;
    }

    // Upload files (sequential for now)
    for (const document of documentsToUpload) {
      try {
        // Update status to uploading
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === document.id
              ? { ...doc, status: 'uploading', progress: 0 }
              : doc
          )
        );

        // Upload to server
        const formData = new FormData();
        formData.append('files', document.file);

        const abortController = new AbortController();
        abortControllersRef.current.set(document.id, abortController);

        const response = await apiClient.post(endpoint, formData, {
          signal: abortController.signal,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setDocuments((prev) =>
              prev.map((doc) =>
                doc.id === document.id ? { ...doc, progress } : doc
              )
            );
          },
        });

        abortControllersRef.current.delete(document.id);

        // Extract URL from response
        const uploadedUrl = response.data?.urls?.[0] || response.data?.url;

        if (!uploadedUrl) {
          throw new Error('No URL returned from server');
        }

        logger.log(
          `[useDocumentUpload] Upload complete: ${uploadedUrl.substring(
            0,
            80
          )}...`
        );

        // Update document with remote URL
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === document.id
              ? {
                  ...doc,
                  fileUrl: uploadedUrl,
                  status: 'complete',
                  progress: 100,
                  error: null,
                }
              : doc
          )
        );

        // Remove from queue
        setQueue((prev) => prev.filter((id) => id !== document.id));
      } catch (err) {
        logger.error(
          `[useDocumentUpload] Upload failed for ${document.fileName}:`,
          err
        );

        abortControllersRef.current.delete(document.id);

        // Check if cancelled
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          setDocuments((prev) => prev.filter((doc) => doc.id !== document.id));
          setQueue((prev) => prev.filter((id) => id !== document.id));
          continue;
        }

        // Update document with error
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === document.id
              ? {
                  ...doc,
                  status: 'error',
                  error:
                    err.response?.data?.message ||
                    err.message ||
                    'Upload failed',
                  progress: 0,
                }
              : doc
          )
        );

        setError(err.message);

        if (onError) {
          onError(err);
        }
      }
    }

    setIsUploading(false);
    logger.log('[useDocumentUpload] Queue processing complete');

    // Call onSuccess if all uploads completed
    const allComplete = documents.every(
      (doc) => doc.status === 'complete' || !queue.includes(doc.id)
    );

    if (allComplete && onSuccess) {
      const completedDocuments = documents.filter(
        (doc) => doc.status === 'complete'
      );
      onSuccess(completedDocuments);
    }
  }, [isUploading, documents, queue, endpoint, onSuccess, onError]);

  /**
   * Auto-process queue when items are added
   */
  useEffect(() => {
    if (queue.length > 0 && !isUploading) {
      const hasPendingDocuments = documents.some(
        (doc) => queue.includes(doc.id) && doc.status === 'pending'
      );

      if (hasPendingDocuments) {
        logger.log(
          '[useDocumentUpload] Auto-processing queue with',
          queue.length,
          'items'
        );
        processQueue();
      }
    }
  }, [queue, isUploading, documents, processQueue]);

  /**
   * Upload files immediately
   */
  const uploadFiles = useCallback(
    async (files, metadata = {}) => {
      await addFiles(files, metadata);
    },
    [addFiles]
  );

  /**
   * Cancel upload
   */
  const cancelUpload = useCallback((documentId) => {
    logger.log(`[useDocumentUpload] Cancelling upload: ${documentId}`);

    const controller = abortControllersRef.current.get(documentId);
    if (controller) {
      controller.abort();
    }

    setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    setQueue((prev) => prev.filter((id) => id !== documentId));
  }, []);

  /**
   * Retry failed upload
   */
  const retryUpload = useCallback(
    (documentId) => {
      logger.log(`[useDocumentUpload] Retrying upload: ${documentId}`);

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId
            ? { ...doc, status: 'pending', error: null, progress: 0 }
            : doc
        )
      );

      setQueue((prev) => [...prev, documentId]);
      processQueue();
    },
    [processQueue]
  );

  /**
   * Remove document from gallery
   */
  const removeDocument = useCallback(
    (documentId) => {
      logger.log(`[useDocumentUpload] Removing document: ${documentId}`);
      cancelUpload(documentId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    },
    [cancelUpload]
  );

  /**
   * Update document metadata
   */
  const updateMetadata = useCallback((documentId, metadata) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId ? { ...doc, ...metadata } : doc
      )
    );
  }, []);

  /**
   * Clear all documents
   */
  const clearAll = useCallback(() => {
    logger.log('[useDocumentUpload] Clearing all documents');

    documents.forEach((doc) => {
      if (doc.status === 'uploading' || doc.status === 'pending') {
        cancelUpload(doc.id);
      }
    });

    setDocuments([]);
    setQueue([]);
    setError(null);
  }, [documents, cancelUpload]);

  /**
   * Get completed documents (for form submission)
   */
  const getCompletedDocuments = useCallback(() => {
    return documents
      .filter((doc) => doc.status === 'complete' && doc.fileUrl)
      .map((doc) => ({
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        category: doc.category,
        description: doc.description || null,
        accessLevel: doc.accessLevel,
        unitId: doc.unitId || null,
      }));
  }, [documents]);

  return {
    // State
    documents,
    queue,
    isUploading,
    error,

    // Methods
    uploadFiles,
    addFiles,
    processQueue,
    cancelUpload,
    retryUpload,
    removeDocument,
    updateMetadata,
    clearAll,
    getCompletedDocuments,

    // Computed
    hasDocuments: documents.length > 0,
    completedCount: documents.filter((doc) => doc.status === 'complete')
      .length,
    uploadingCount: documents.filter((doc) => doc.status === 'uploading')
      .length,
    errorCount: documents.filter((doc) => doc.status === 'error').length,
    pendingCount: queue.length,
  };
}
