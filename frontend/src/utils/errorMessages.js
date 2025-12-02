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
    'AUTH_NO_TOKEN': 'Please sign in to continue.',
    'AUTH_INVALID_TOKEN': 'Your session is invalid. Please sign in again.',
    'AUTH_TOKEN_EXPIRED': 'Your session has expired. Please sign in again.',
    'AUTH_UNAUTHORIZED': 'You are not authorized to perform this action.',
    'AUTH_INVALID_CREDENTIALS': 'Invalid email or password. Please try again.',
    'AUTH_EMAIL_NOT_VERIFIED': 'Please verify your email address before signing in.',
    'AUTH_ACCOUNT_INACTIVE': 'Your account has been deactivated. Please contact support.',
    'AUTH_INSUFFICIENT_PERMISSIONS': 'You do not have permission to perform this action.',
    
    // Subscription errors
    'SUB_TRIAL_EXPIRED': 'Your trial period has expired. Please upgrade your plan to continue.',
    'SUB_SUBSCRIPTION_REQUIRED': 'This feature requires an active subscription. Please upgrade your plan.',
    'SUB_MANAGER_SUBSCRIPTION_REQUIRED': 'This property\'s subscription has expired. Please contact your property manager.',
    'SUB_SUBSCRIPTION_INACTIVE': 'Your subscription is inactive. Please renew to continue.',
    'SUB_SUBSCRIPTION_CANCELLED': 'Your subscription has been cancelled. Please renew to continue.',
    'SUB_PLAN_NOT_FOUND': 'The selected subscription plan was not found.',
    
    // Validation errors
    'VAL_VALIDATION_ERROR': 'Please check your input and try again.',
    'VAL_INVALID_REQUEST': 'The request is invalid. Please check your input.',
    'VAL_MISSING_FIELD': 'Required fields are missing. Please fill in all required fields.',
    'VAL_INVALID_FORMAT': 'The format is invalid. Please check your input.',
    'VAL_INVALID_EMAIL': 'Please enter a valid email address.',
    'VAL_INVALID_PASSWORD': 'Please enter a valid password.',
    'VAL_PASSWORD_WEAK': 'Password is too weak. Please choose a stronger password.',
    'VAL_INVALID_ID': 'The provided ID is invalid.',
    'VAL_INVALID_DATE': 'Please enter a valid date.',
    
    // Resource errors
    'RES_NOT_FOUND': 'The requested item was not found.',
    'RES_ALREADY_EXISTS': 'This item already exists.',
    'RES_USER_NOT_FOUND': 'User not found.',
    'RES_PROPERTY_NOT_FOUND': 'Property not found.',
    'RES_UNIT_NOT_FOUND': 'Unit not found.',
    'RES_TENANT_NOT_FOUND': 'Tenant not found.',
    'RES_REPORT_NOT_FOUND': 'Report not found.',
    'RES_SERVICE_REQUEST_NOT_FOUND': 'Service request not found.',
    'RES_JOB_NOT_FOUND': 'Job not found.',
    'RES_INVITE_NOT_FOUND': 'Invite not found.',
    'RES_MAINTENANCE_NOT_FOUND': 'Maintenance plan not found.',
    'RES_INSPECTION_NOT_FOUND': 'Inspection not found.',
    
    // Access control errors
    'ACC_ACCESS_DENIED': 'You do not have permission to access this resource.',
    'ACC_PROPERTY_ACCESS_DENIED': 'You do not have access to this property.',
    'ACC_UNIT_ACCESS_DENIED': 'You do not have access to this unit.',
    'ACC_ROLE_REQUIRED': 'This action requires a specific role.',
    'ACC_CSRF_TOKEN_INVALID': 'Security token is invalid. Please refresh the page and try again.',
    
    // Database errors
    'DB_OPERATION_FAILED': 'Database operation failed. Please try again.',
    'DB_UNIQUE_CONSTRAINT': 'This record already exists. Please use a different value.',
    'DB_FOREIGN_KEY_CONSTRAINT': 'Invalid reference. The related record does not exist.',
    'DB_RELATION_VIOLATION': 'Cannot delete this record because it is in use.',
    'DB_RECORD_NOT_FOUND': 'Record not found.',
    
    // File upload errors
    'FILE_NO_FILE_UPLOADED': 'No file was uploaded. Please select a file.',
    'FILE_INVALID_TYPE': 'This file type is not allowed. Please choose a different file.',
    'FILE_TOO_LARGE': 'The file is too large. Please choose a smaller file.',
    'FILE_UPLOAD_FAILED': 'Failed to upload file. Please try again.',
    'FILE_DELETE_FAILED': 'Failed to delete file. Please try again.',
    
    // External service errors
    'EXT_STRIPE_ERROR': 'Payment processing error. Please try again or contact support.',
    'EXT_STRIPE_NOT_CONFIGURED': 'Payment processing is not configured. Please contact support.',
    'EXT_EMAIL_SEND_FAILED': 'Failed to send email. Please try again.',
    'EXT_SERVICE_UNAVAILABLE': 'External service is unavailable. Please try again later.',
    
    // Business logic errors
    'BIZ_INVITE_EXPIRED': 'This invite has expired. Please request a new invite.',
    'BIZ_INVITE_ALREADY_ACCEPTED': 'This invite has already been accepted.',
    'BIZ_EMAIL_ALREADY_REGISTERED': 'This email is already registered. Please sign in instead.',
    'BIZ_CANNOT_DELETE_SELF': 'You cannot delete your own account.',
    'BIZ_INVALID_STATUS_TRANSITION': 'This status change is not allowed. Please check the current status.',
    'BIZ_OPERATION_NOT_ALLOWED': 'This operation is not allowed in the current state.',
    
    // General errors
    'ERR_INTERNAL_SERVER': 'An internal error occurred. Please try again later or contact support.',
    'ERR_BAD_REQUEST': 'Invalid request. Please check your input and try again.',
    'ERR_CONFLICT': 'This action conflicts with existing data. Please resolve the conflict and try again.',
    'ERR_UNKNOWN': 'An unexpected error occurred. Please try again or contact support.',
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
    if (code.startsWith('SUB_')) return 'Subscription Required';
    if (code.startsWith('VAL_')) return 'Validation Error';
    if (code.startsWith('RES_')) return 'Resource Not Found';
    if (code.startsWith('ACC_')) return 'Access Denied';
    if (code.startsWith('DB_')) return 'Database Error';
    if (code.startsWith('FILE_')) return 'File Upload Error';
    if (code.startsWith('EXT_')) return 'Service Error';
    if (code.startsWith('BIZ_')) return 'Operation Not Allowed';
    if (code.startsWith('ERR_')) return 'Error';
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
  if (error?.response?.data?.errorCode?.startsWith('SUB_')) {
    return 'Please upgrade your subscription to access this feature.';
  }

  // Validation errors
  if (error?.response?.data?.errorCode?.startsWith('VAL_')) {
    return 'Please check your input and try again.';
  }
  
  // Access control errors
  if (error?.response?.data?.errorCode?.startsWith('ACC_')) {
    return 'You do not have permission to perform this action.';
  }
  
  // Resource errors
  if (error?.response?.data?.errorCode?.startsWith('RES_')) {
    return 'The requested resource was not found.';
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

