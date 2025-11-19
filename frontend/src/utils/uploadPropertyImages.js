import apiClient from '../api/client.js';

/**
 * Uploads one or more property image files to the backend uploads endpoint.
 * Returns an array of objects describing the uploaded files.
 *
 * @param {File[]} files
 * @returns {Promise<Array<{ url: string, name: string }>>}
 */
export async function uploadPropertyImages(files) {
  const candidates = Array.from(files || []).filter((file) => file instanceof File);
  if (!candidates.length) return [];

  const formData = new FormData();
  candidates.forEach((file) => {
    formData.append('files', file);
  });

  // Bug Fix: Add comprehensive error handling for upload endpoint
  try {
    const response = await apiClient.post('/upload/multiple', formData);

    // Bug Fix: Validate response structure before accessing nested properties
    if (!response || !response.data) {
      throw new Error('Invalid response from upload endpoint');
    }

    const urls = Array.isArray(response.data.urls) ? response.data.urls : [];
    if (!urls.length) {
      throw new Error('Upload failed - no URLs returned from server');
    }

    return urls.map((url, index) => ({
      url,
      name: candidates[index]?.name || `Image ${index + 1}`,
    }));
  } catch (error) {
    // Bug Fix: Provide more specific error messages based on error type
    if (error.response?.status === 404) {
      throw new Error('Image upload endpoint not available. Please contact support.');
    }
    if (error.response?.status === 413) {
      throw new Error('Files are too large. Maximum size is 10MB per file.');
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('You do not have permission to upload images. Please log in again.');
    }
    if (error.response?.status === 415) {
      throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
    }
    // Bug Fix #11: Handle rate limiting errors gracefully
    if (error.response?.status === 429) {
      throw new Error('Too many uploads. Please wait a minute before uploading more images.');
    }
    if (error.response?.status === 400) {
      const serverMsg = error.response?.data?.message || '';
      if (serverMsg.toLowerCase().includes('limit')) {
        throw new Error('File size or count limit exceeded. Maximum 10MB per file, up to 50 files.');
      }
      if (serverMsg.toLowerCase().includes('image')) {
        throw new Error('Only image files are allowed (JPEG, PNG, GIF, WebP).');
      }
      throw new Error(serverMsg || 'Invalid upload request. Please check your files.');
    }
    if (error.response?.status === 500 || error.response?.status === 503) {
      throw new Error('Server error. Please try again later or contact support.');
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error('Upload timeout. Your connection may be slow or files are too large.');
    }
    if (error.code === 'ERR_NETWORK' || !navigator.onLine) {
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    // Re-throw with original message if available, or generic message
    throw new Error(error.message || 'Failed to upload images. Please try again.');
  }
}

/**
 * Normalises existing image data into the shape used by the uploader component.
 *
 * @param {Array<{ imageUrl?: string, url?: string, caption?: string, altText?: string, name?: string }>} images
 */
export function normaliseUploadedImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((image, index) => {
      if (!image) return null;
      const url = typeof image.url === 'string' && image.url.trim()
        ? image.url.trim()
        : typeof image.imageUrl === 'string' && image.imageUrl.trim()
          ? image.imageUrl.trim()
          : null;

      if (!url) return null;

      const altText = typeof image.altText === 'string' ? image.altText : image.caption;

      return {
        id: image.id || `image-${index}`,
        url,
        name: image.name || image.originalName || `Image ${index + 1}`,
        altText: altText ?? '',
      };
    })
    .filter(Boolean);
}

