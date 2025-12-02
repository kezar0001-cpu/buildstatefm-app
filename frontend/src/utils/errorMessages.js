/**
 * Error message utility for user-friendly error handling
 * Converts technical error messages into clear, actionable user messages
 */

/**
 * Get user-friendly error message from error object
 * @param {Error|Object|string} error - Error object, response object, or error string
 * @param {string} defaultMessage - Default message if error cannot be parsed
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyErrorMessage(error, defaultMessage = 'An unexpected error occurred') {
  if (!error) return defaultMessage;

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle Axios error responses
  if (error?.response?.data) {
    const data = error.response.data;
    
    // Check for custom error message
    if (data.message) {
      return data.message;
    }
    
    // Check for error code and map to user-friendly message
    if (data.errorCode) {
      return getErrorMessageByCode(data.errorCode, data.message);
    }
    
    // Handle validation errors
    if (data.errors && Array.isArray(data.errors)) {
      return data.errors.map(err => err.message || err).join(', ');
    }
    
    // Handle Zod validation errors
    if (data.issues && Array.isArray(data.issues)) {
      return data.issues.map(issue => issue.message || issue).join(', ');
    }
  }

  // Handle Error objects
  if (error?.message) {
    // Map common technical errors to user-friendly messages
    const message = error.message;
    
    if (message.includes('Network Error') || message.includes('Failed to fetch')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }
    
    if (message.includes('timeout')) {
      return 'The request took too long. Please try again.';
    }
    
    if (message.includes('401') || message.includes('Unauthorized')) {
      return 'Your session has expired. Please sign in again.';
    }
    
    if (message.includes('403') || message.includes('Forbidden')) {
      return 'You do not have permission to perform this action.';
    }
    
    if (message.includes('404') || message.includes('Not Found')) {
      return 'The requested resource was not found.';
    }
    
    if (message.includes('500') || message.includes('Internal Server Error')) {
      return 'A server error occurred. Please try again later or contact support if the problem persists.';
    }
    
    // Return original message if no mapping found
    return message;
  }

  return defaultMessage;
}

/**
 * Get error message by error code
 * @param {string} errorCode - Error code from backend
 * @param {string} fallbackMessage - Fallback message if code not found
 * @returns {string} User-friendly error message
 */
function getErrorMessageByCode(errorCode, fallbackMessage) {
  const errorMessages = {
    // Authentication errors
    'AUTH_INVALID_CREDENTIALS': 'Invalid email or password. Please try again.',
    'AUTH_TOKEN_EXPIRED': 'Your session has expired. Please sign in again.',
    'AUTH_TOKEN_INVALID': 'Your session is invalid. Please sign in again.',
    'AUTH_UNAUTHORIZED': 'You are not authorized to perform this action.',
    
    // Subscription errors
    'SUBSCRIPTION_REQUIRED': 'This feature requires an active subscription. Please upgrade your plan.',
    'SUBSCRIPTION_EXPIRED': 'Your subscription has expired. Please renew to continue using this feature.',
    'TRIAL_EXPIRED': 'Your trial period has ended. Please subscribe to continue.',
    
    // Validation errors
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'INVALID_INPUT': 'The provided information is invalid. Please check and try again.',
    
    // Resource errors
    'RESOURCE_NOT_FOUND': 'The requested item was not found.',
    'RESOURCE_ALREADY_EXISTS': 'This item already exists.',
    'RESOURCE_CONFLICT': 'This action conflicts with existing data.',
    
    // Business logic errors
    'BIZ_INVALID_STATUS_TRANSITION': 'This status change is not allowed.',
    'BIZ_OPERATION_NOT_ALLOWED': 'This operation is not allowed in the current state.',
    'BIZ_INSUFFICIENT_PERMISSIONS': 'You do not have permission to perform this action.',
    
    // File upload errors
    'FILE_TOO_LARGE': 'The file is too large. Please choose a smaller file.',
    'FILE_TYPE_NOT_ALLOWED': 'This file type is not allowed. Please choose a different file.',
    'FILE_UPLOAD_FAILED': 'Failed to upload file. Please try again.',
    
    // Rate limiting
    'RATE_LIMIT_EXCEEDED': 'Too many requests. Please wait a moment and try again.',
    
    // Generic errors
    'INTERNAL_ERROR': 'An internal error occurred. Please try again later or contact support.',
    'SERVICE_UNAVAILABLE': 'The service is temporarily unavailable. Please try again later.',
  };

  return errorMessages[errorCode] || fallbackMessage || 'An unexpected error occurred';
}

/**
 * Get error title based on error type
 * @param {Error|Object|string} error - Error object
 * @returns {string} Error title
 */
export function getErrorTitle(error) {
  if (!error) return 'Error';

  // Check HTTP status code
  if (error?.response?.status) {
    const status = error.response.status;
    if (status === 401) return 'Session Expired';
    if (status === 403) return 'Access Denied';
    if (status === 404) return 'Not Found';
    if (status === 500) return 'Server Error';
    if (status >= 500) return 'Server Error';
    if (status >= 400) return 'Request Error';
  }

  // Check error code
  if (error?.response?.data?.errorCode) {
    const code = error.response.data.errorCode;
    if (code.startsWith('AUTH_')) return 'Authentication Error';
    if (code.startsWith('SUBSCRIPTION_')) return 'Subscription Required';
    if (code.startsWith('VALIDATION_')) return 'Validation Error';
    if (code.startsWith('BIZ_')) return 'Operation Not Allowed';
  }

  return 'Error';
}

/**
 * Check if error is retryable
 * @param {Error|Object} error - Error object
 * @returns {boolean} Whether the error is retryable
 */
export function isRetryableError(error) {
  if (!error) return false;

  // Network errors are retryable
  if (error?.message?.includes('Network Error') || error?.message?.includes('Failed to fetch')) {
    return true;
  }

  // 5xx errors are retryable (except 501, 505)
  if (error?.response?.status) {
    const status = error.response.status;
    if (status >= 500 && status !== 501 && status !== 505) {
      return true;
    }
    // 429 (rate limit) is retryable after delay
    if (status === 429) {
      return true;
    }
  }

  // Timeout errors are retryable
  if (error?.message?.includes('timeout')) {
    return true;
  }

  return false;
}

/**
 * Get suggested action for error
 * @param {Error|Object} error - Error object
 * @returns {string|null} Suggested action or null
 */
export function getSuggestedAction(error) {
  if (!error) return null;

  // Authentication errors
  if (error?.response?.status === 401) {
    return 'Please sign in again to continue.';
  }

  // Subscription errors
  if (error?.response?.data?.errorCode?.startsWith('SUBSCRIPTION_')) {
    return 'Please upgrade your subscription to access this feature.';
  }

  // Validation errors
  if (error?.response?.data?.errorCode?.startsWith('VALIDATION_')) {
    return 'Please check your input and try again.';
  }

  // Network errors
  if (error?.message?.includes('Network Error') || error?.message?.includes('Failed to fetch')) {
    return 'Please check your internet connection and try again.';
  }

  // Rate limiting
  if (error?.response?.status === 429) {
    return 'Please wait a moment before trying again.';
  }

  return null;
}

export default {
  getUserFriendlyErrorMessage,
  getErrorTitle,
  isRetryableError,
  getSuggestedAction,
};

