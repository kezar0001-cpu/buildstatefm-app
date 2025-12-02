/**
 * File upload validation utilities.
 * Validates files before upload to prevent wasted bandwidth and improve UX.
 */

// Default configuration - can be overridden
const DEFAULT_CONFIG = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB default
  maxFilesPerUpload: 10,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedDocumentTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
  allowedAllTypes: null, // When set, overrides image and document types
};

/**
 * Format bytes to human readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validate a single file
 * @param {File} file - The file to validate
 * @param {object} options - Validation options
 * @returns {object} Validation result { valid: boolean, error: string | null }
 */
export function validateFile(file, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const errors = [];

  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file size
  if (file.size > config.maxSizeBytes) {
    errors.push(
      `File "${file.name}" is too large (${formatFileSize(file.size)}). ` +
      `Maximum size is ${formatFileSize(config.maxSizeBytes)}.`
    );
  }

  // Check file type
  const allowedTypes = config.allowedAllTypes || [
    ...(config.allowedImageTypes || []),
    ...(config.allowedDocumentTypes || []),
  ];

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    // Get file extension for clearer error message
    const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
    errors.push(
      `File type ".${extension}" is not supported. ` +
      `Please upload a supported file type.`
    );
  }

  // Check for empty files
  if (file.size === 0) {
    errors.push(`File "${file.name}" is empty.`);
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join(' ') : null,
    errors,
  };
}

/**
 * Validate multiple files
 * @param {FileList | File[]} files - The files to validate
 * @param {object} options - Validation options
 * @returns {object} Validation result with valid files and errors
 */
export function validateFiles(files, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const fileArray = Array.from(files);
  
  const results = {
    valid: true,
    validFiles: [],
    invalidFiles: [],
    errors: [],
    totalSize: 0,
  };

  // Check total file count
  if (fileArray.length > config.maxFilesPerUpload) {
    results.valid = false;
    results.errors.push(
      `Too many files selected (${fileArray.length}). ` +
      `Maximum is ${config.maxFilesPerUpload} files per upload.`
    );
    return results;
  }

  // Validate each file
  fileArray.forEach((file) => {
    const validation = validateFile(file, config);
    results.totalSize += file.size;
    
    if (validation.valid) {
      results.validFiles.push(file);
    } else {
      results.valid = false;
      results.invalidFiles.push({ file, error: validation.error });
      results.errors.push(validation.error);
    }
  });

  return results;
}

/**
 * Validate image file specifically
 * @param {File} file - The file to validate
 * @param {object} options - Additional options
 * @returns {object} Validation result
 */
export function validateImageFile(file, options = {}) {
  return validateFile(file, {
    ...options,
    allowedAllTypes: options.allowedImageTypes || DEFAULT_CONFIG.allowedImageTypes,
    maxSizeBytes: options.maxSizeBytes || 5 * 1024 * 1024, // 5MB default for images
  });
}

/**
 * Validate document file specifically
 * @param {File} file - The file to validate
 * @param {object} options - Additional options
 * @returns {object} Validation result
 */
export function validateDocumentFile(file, options = {}) {
  return validateFile(file, {
    ...options,
    allowedAllTypes: options.allowedDocumentTypes || DEFAULT_CONFIG.allowedDocumentTypes,
    maxSizeBytes: options.maxSizeBytes || 25 * 1024 * 1024, // 25MB default for documents
  });
}

/**
 * Check if a file is an image based on MIME type
 * @param {File} file - The file to check
 * @returns {boolean}
 */
export function isImageFile(file) {
  return file?.type?.startsWith('image/') || false;
}

/**
 * Check if a file is a document based on MIME type
 * @param {File} file - The file to check
 * @returns {boolean}
 */
export function isDocumentFile(file) {
  return DEFAULT_CONFIG.allowedDocumentTypes.includes(file?.type) || false;
}

/**
 * Get file extension from filename
 * @param {string} filename - The filename
 * @returns {string} The extension (lowercase, without dot)
 */
export function getFileExtension(filename) {
  return filename?.split('.').pop()?.toLowerCase() || '';
}

/**
 * Get MIME type from file extension
 * @param {string} extension - The file extension
 * @returns {string | null} The MIME type or null
 */
export function getMimeType(extension) {
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    csv: 'text/csv',
  };
  
  return mimeTypes[extension?.toLowerCase()] || null;
}

/**
 * Create a file input accept string from allowed types
 * @param {string[]} allowedTypes - Array of MIME types
 * @returns {string} Accept attribute string
 */
export function createAcceptString(allowedTypes) {
  if (!allowedTypes || allowedTypes.length === 0) return '*/*';
  return allowedTypes.join(',');
}

// Pre-built accept strings for common use cases
export const ACCEPT_IMAGES = createAcceptString(DEFAULT_CONFIG.allowedImageTypes);
export const ACCEPT_DOCUMENTS = createAcceptString(DEFAULT_CONFIG.allowedDocumentTypes);
export const ACCEPT_ALL = createAcceptString([
  ...DEFAULT_CONFIG.allowedImageTypes,
  ...DEFAULT_CONFIG.allowedDocumentTypes,
]);

export default {
  formatFileSize,
  validateFile,
  validateFiles,
  validateImageFile,
  validateDocumentFile,
  isImageFile,
  isDocumentFile,
  getFileExtension,
  getMimeType,
  createAcceptString,
  ACCEPT_IMAGES,
  ACCEPT_DOCUMENTS,
  ACCEPT_ALL,
  DEFAULT_CONFIG,
};

