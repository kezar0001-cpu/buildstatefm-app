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
  // Direct Cloudinary URLs (cloudinarySecureUrl) bypass auth and cause 401 errors
  const previewCandidates = [
    document.previewUrl,
    document.rawPreviewUrl,
    document.cloudinarySecureUrl,
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
    const resolved = resolveFileUrl(document.fileUrl);
    return resolved.includes('cloudinary.com')
      ? addCloudinaryDownloadFlags(resolved, document.fileName)
      : resolved;
  }

  return '';
}

/**
 * Transform a cloud storage URL to add download flags if needed
 * For S3: Uses Content-Disposition via query params or relies on backend
 * For legacy Cloudinary: Adds fl_attachment flag (backwards compatibility)
 *
 * @param {string} fileUrl - The cloud storage URL
 * @param {string} fileName - The filename to use for download
 * @returns {string} The transformed URL with download flags
 */
export function addCloudinaryDownloadFlags(fileUrl, fileName) {
  if (!fileUrl) {
    return fileUrl;
  }

  // S3 URLs - rely on backend to set Content-Disposition headers
  // We don't need to transform S3 URLs as the backend handles this
  if (fileUrl.includes('.amazonaws.com') || fileUrl.includes('cloudfront.net')) {
    return fileUrl;
  }

  // Legacy Cloudinary support (for backwards compatibility)
  if (fileUrl.includes('cloudinary.com')) {
    try {
      // Sanitize filename for URL (remove special characters)
      const sanitizedFileName = fileName?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'download';

      // Check if URL already has flags
      if (fileUrl.includes('/upload/fl_')) {
        return fileUrl;
      }

      // Insert fl_attachment flag after /upload/
      const transformedUrl = fileUrl.replace(
        /\/upload\//,
        `/upload/fl_attachment:${encodeURIComponent(sanitizedFileName)}/`
      );

      console.log('[FileUtils] Transformed Cloudinary URL for download:', {
        original: fileUrl,
        transformed: transformedUrl,
        fileName: sanitizedFileName,
      });

      return transformedUrl;
    } catch (error) {
      console.error('[FileUtils] Error transforming Cloudinary URL:', error);
      return fileUrl;
    }
  }

  return fileUrl;
}

/**
 * Download a file by creating a temporary anchor element and clicking it
 * This works better than window.open() for actual downloads
 *
 * @param {string} fileUrl - The URL of the file to download
 * @param {string} fileName - The suggested filename for the download
 */
export function downloadFile(fileUrl, fileName, options = {}) {
  const { skipResolution = false, skipDownloadTransform = false } = options;

  const resolvedUrl = skipResolution ? fileUrl : resolveFileUrl(fileUrl);

  // For Cloudinary URLs, add download flags to ensure proper filename unless caller opts out
  const downloadUrl = !skipDownloadTransform && resolvedUrl.includes('cloudinary.com')
    ? addCloudinaryDownloadFlags(resolvedUrl, fileName)
    : resolvedUrl;

  // Create a temporary anchor element
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
