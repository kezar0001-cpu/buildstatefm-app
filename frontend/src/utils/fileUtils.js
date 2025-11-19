/**
 * Utility functions for handling file URLs
 */

/**
 * Get the API base URL for the current environment
 * @returns {string} The base URL for API requests
 */
export function getApiBaseUrl() {
  // Check for environment variable first
  const envCandidates = [
    import.meta?.env?.VITE_API_BASE_URL,
    import.meta?.env?.VITE_API_BASE,
  ];
  const envBase = envCandidates.find((value) => typeof value === 'string' && value.trim().length > 0);

  if (envBase) {
    return envBase.trim().replace(/\/$/, '');
  }

  // Fallback to window origin in development
  // In production, files should be served from the same origin
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }

  return '';
}

/**
 * Resolve a file URL to ensure it points to the correct server
 * Handles both relative paths (/uploads/..., /api/uploads/...) and absolute URLs
 *
 * @param {string} fileUrl - The file URL from the database
 * @returns {string} The resolved URL that can be used in iframes, downloads, etc.
 */
export function resolveFileUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') {
    return '';
  }

  const trimmedUrl = fileUrl.trim();

  // If it's already an absolute URL (Cloudinary, etc.), return as-is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }

  // If it's a relative path, we need to determine if we should make it absolute
  // In development with Vite, the proxy will handle /uploads and /api paths
  // In production, we may need to prepend the API base URL if frontend and backend are separate

  // Check if we're in a scenario where we need absolute URLs
  const apiBaseUrl = getApiBaseUrl();
  const needsAbsoluteUrl = apiBaseUrl && !apiBaseUrl.includes(window?.location?.origin || '');

  if (needsAbsoluteUrl) {
    // Frontend and backend are on different origins - make URL absolute
    const cleanPath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
    return `${apiBaseUrl}${cleanPath}`;
  }

  // Same origin or development with proxy - use relative URL
  return trimmedUrl;
}

/**
 * Normalize a document URL to use the preferred /api/uploads path
 * This helps with consistency across old and new documents
 *
 * @param {string} fileUrl - The file URL to normalize
 * @returns {string} The normalized URL
 */
export function normalizeDocumentUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') {
    return '';
  }

  const resolved = resolveFileUrl(fileUrl);

  // If it's a local upload URL with the legacy /uploads prefix, convert to /api/uploads
  if (resolved.startsWith('/uploads/')) {
    return resolved.replace(/^\/uploads\//, '/api/uploads/');
  }

  return resolved;
}

/**
 * Download a file by creating a temporary anchor element and clicking it
 * This works better than window.open() for actual downloads
 *
 * @param {string} fileUrl - The URL of the file to download
 * @param {string} fileName - The suggested filename for the download
 */
export function downloadFile(fileUrl, fileName) {
  const resolvedUrl = resolveFileUrl(fileUrl);

  // Create a temporary anchor element
  const link = document.createElement('a');
  link.href = resolvedUrl;
  link.download = fileName || 'download';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
