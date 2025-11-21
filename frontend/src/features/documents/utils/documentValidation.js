/**
 * Document validation utilities
 */

const ALLOWED_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  // Images (for photos category)
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.csv',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
];

export const VALIDATION_RULES = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_FILES: 20, // Allow up to 20 documents at once
};

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, code, file = null) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.file = file;
  }
}

/**
 * Validate file type
 * @param {File} file
 * @throws {ValidationError}
 */
export function validateFileType(file) {
  if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
    throw new ValidationError(
      `Invalid file type: ${file.type}. Only PDF, Word, Excel, text, and image files are allowed.`,
      'INVALID_FILE_TYPE',
      file
    );
  }

  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (extension && !ALLOWED_EXTENSIONS.includes(extension)) {
    throw new ValidationError(
      `Invalid file extension: ${extension}`,
      'INVALID_FILE_EXTENSION',
      file
    );
  }
}

/**
 * Validate file size
 * @param {File} file
 * @throws {ValidationError}
 */
export function validateFileSize(file) {
  if (file.size > VALIDATION_RULES.MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    const maxMB = (VALIDATION_RULES.MAX_FILE_SIZE / 1024 / 1024).toFixed(0);
    throw new ValidationError(
      `File too large: ${sizeMB}MB. Maximum size is ${maxMB}MB.`,
      'FILE_TOO_LARGE',
      file
    );
  }

  if (file.size === 0) {
    throw new ValidationError('File is empty', 'FILE_EMPTY', file);
  }
}

/**
 * Validate a single file
 * @param {File} file
 * @returns {Promise<{valid: boolean, error: ValidationError | null}>}
 */
export async function validateFile(file) {
  try {
    validateFileType(file);
    validateFileSize(file);

    return {
      valid: true,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof ValidationError
          ? error
          : new ValidationError(error.message, 'UNKNOWN_ERROR', file),
    };
  }
}

/**
 * Validate multiple files
 * @param {File[]} files
 * @returns {Promise<{valid: File[], invalid: Array<{file: File, error: ValidationError}>}>}
 */
export async function validateFiles(files) {
  if (files.length > VALIDATION_RULES.MAX_FILES) {
    throw new ValidationError(
      `Too many files: ${files.length}. Maximum is ${VALIDATION_RULES.MAX_FILES}.`,
      'TOO_MANY_FILES'
    );
  }

  const results = await Promise.all(
    files.map(async (file) => {
      const result = await validateFile(file);
      return { file, ...result };
    })
  );

  return {
    valid: results.filter((r) => r.valid).map((r) => r.file),
    invalid: results
      .filter((r) => !r.valid)
      .map((r) => ({ file: r.file, error: r.error })),
  };
}

/**
 * Get user-friendly error message
 * @param {ValidationError} error
 * @returns {string}
 */
export function getErrorMessage(error) {
  const messages = {
    INVALID_FILE_TYPE:
      'This file type is not supported. Please use PDF, Word, Excel, text, or image files.',
    INVALID_FILE_EXTENSION: 'Invalid file extension. Please check your file.',
    FILE_TOO_LARGE: `File is too large. Maximum size is ${
      VALIDATION_RULES.MAX_FILE_SIZE / 1024 / 1024
    }MB.`,
    FILE_EMPTY: 'File is empty. Please select a valid document.',
    TOO_MANY_FILES: `Too many files. Maximum is ${VALIDATION_RULES.MAX_FILES} files.`,
    UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
  };

  if (error instanceof ValidationError) {
    return error.message || messages[error.code] || messages.UNKNOWN_ERROR;
  }

  return messages.UNKNOWN_ERROR;
}

/**
 * Get file icon based on MIME type
 * @param {string} mimeType
 * @returns {string} Icon name or emoji
 */
export function getFileIcon(mimeType) {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (
    mimeType === 'application/msword' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return '📝';
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
    return '📊';
  if (mimeType === 'text/plain') return '📋';
  if (mimeType === 'text/csv') return '📊';
  return '📎';
}

/**
 * Format file size for display
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
