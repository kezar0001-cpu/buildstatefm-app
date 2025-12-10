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

  // If it's already an absolute URL (S3, etc.), return as-is
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

export function resolveApiPath(pathValue) {
  if (!pathValue || typeof pathValue !== 'string') {
    return '';
  }

  const trimmed = pathValue.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const normalisedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return normalisedPath;

  return `${baseUrl.replace(/\/$/, '')}${normalisedPath}`;
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

export function buildDocumentPreviewUrl(document) {
  if (!document) return '';

  // Prioritize backend API endpoint (previewUrl) to maintain authentication
  const previewCandidates = [
    document.previewUrl,
    document.rawPreviewUrl,
    document.fileUrl,
  ].filter(Boolean);

  for (const candidate of previewCandidates) {
    const resolved = resolveFileUrl(candidate);
    if (resolved) return resolved;
  }

  return '';
}

export function buildDocumentDownloadUrl(document) {
  if (!document) return '';

  const downloadPath = document.downloadUrl
    || (document.propertyId && document.id
      ? `/properties/${document.propertyId}/documents/${document.id}/download`
      : null);

  if (downloadPath) {
    return resolveApiPath(downloadPath);
  }

  if (document.fileUrl) {
    return resolveFileUrl(document.fileUrl);
  }

  return '';
}


/**
 * Download a file by creating a temporary anchor element and clicking it
 * This works better than window.open() for actual downloads
 *
 * For API endpoints requiring authentication, fetches the file with credentials
 * and creates a blob URL to download. For public URLs (S3, etc.),
 * uses direct anchor element download.
 *
 * @param {string} fileUrl - The URL of the file to download
 * @param {string} fileName - The suggested filename for the download
 */
export async function downloadFile(fileUrl, fileName, options = {}) {
  const { skipResolution = false, skipDownloadTransform = false } = options;

  const resolvedUrl = skipResolution ? fileUrl : resolveFileUrl(fileUrl);

  const downloadUrl = resolvedUrl;

  // Check if this is an API endpoint that requires authentication
  const isApiEndpoint = downloadUrl.includes('/api/') ||
                       (downloadUrl.startsWith('/') && !downloadUrl.startsWith('http'));

  if (isApiEndpoint) {
    // For authenticated API endpoints, fetch with credentials and create blob URL
    try {
      // Import apiClient dynamically to avoid circular dependencies
      const { apiClient } = await import('../api/client.js');

      const response = await apiClient.get(downloadUrl, {
        responseType: 'blob',
      });

      // Create a blob URL from the response
      const blob = response.data;
      const blobUrl = window.URL.createObjectURL(blob);

      // Create a temporary anchor element with the blob URL
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'download';

      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL after a short delay
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('[FileUtils] Error downloading file:', error);
      throw error;
    }
  } else {
    // For public URLs (S3, etc.), use direct download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
