import apiClient from '../api/client.js';

/**
 * Upload a single property document to the backend uploads endpoint.
 * Returns metadata required to create the document record.
 *
 * @param {File} file
 * @returns {Promise<{ url: string, name: string, size: number, mimeType: string }>}
 */
export async function uploadPropertyDocument(file) {
  if (!file || !(file instanceof File)) {
    throw new Error('A valid document file is required.');
  }

  const formData = new FormData();
  formData.append('files', file);

  try {
    const response = await apiClient.post('/uploads/documents', formData);

    if (!response || !response.data) {
      throw new Error('Invalid response from upload endpoint');
    }

    const urls = Array.isArray(response.data.urls) ? response.data.urls : [];
    const url = urls[0];

    if (!url) {
      throw new Error('Document upload failed - no URL returned from server');
    }

    return {
      url,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    };
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Document upload endpoint not available. Please contact support.');
    }
    if (error.response?.status === 413) {
      throw new Error('Files are too large. Maximum size is 50MB per file.');
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('You do not have permission to upload documents. Please log in again.');
    }
    if (error.response?.status === 415) {
      throw new Error('Invalid file type. Supported: PDF, Word, Excel, CSV, TXT, and images.');
    }
    if (error.response?.status === 429) {
      throw new Error('Too many uploads. Please wait before uploading more documents.');
    }
    if (error.response?.status === 400) {
      const serverMsg = error.response?.data?.message || '';
      if (serverMsg.toLowerCase().includes('limit')) {
        throw new Error('File size or count limit exceeded. Maximum 50MB per file, up to 20 files.');
      }
      throw new Error(serverMsg || 'Invalid document upload request. Please check your file.');
    }
    if (error.response?.status === 500 || error.response?.status === 503) {
      throw new Error('Server error during document upload. Please try again later.');
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error('Upload timeout. Your connection may be slow or the file is too large.');
    }
    if (error.code === 'ERR_NETWORK' || (typeof navigator !== 'undefined' && navigator && navigator.onLine === false)) {
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error(error.message || 'Failed to upload document. Please try again.');
  }
}

