/**
 * Request deduplication utility.
 * Prevents duplicate concurrent requests from being sent.
 * Useful for preventing race conditions and reducing server load.
 */

// Map to store pending requests
const pendingRequests = new Map();

/**
 * Generate a unique key for a request
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {object} data - Request data (optional)
 * @returns {string} Unique request key
 */
function generateRequestKey(method, url, data = null) {
  const dataString = data ? JSON.stringify(data) : '';
  return `${method}:${url}:${dataString}`;
}

/**
 * Deduplicate a request - if the same request is already in flight, return the existing promise.
 * 
 * @param {function} requestFn - Function that returns a promise (the actual request)
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} url - Request URL
 * @param {object} data - Request data (optional)
 * @param {number} ttl - Time to live in milliseconds (default: 5000 = 5 seconds)
 * @returns {Promise} The request promise (deduplicated if duplicate)
 * 
 * @example
 * const result = await deduplicateRequest(
 *   () => apiClient.get('/users'),
 *   'GET',
 *   '/users'
 * );
 */
export async function deduplicateRequest(requestFn, method, url, data = null, ttl = 5000) {
  const key = generateRequestKey(method, url, data);
  
  // Check if request is already pending
  if (pendingRequests.has(key)) {
    const existingRequest = pendingRequests.get(key);
    
    // Check if request is still valid (not expired)
    if (Date.now() - existingRequest.timestamp < ttl) {
      return existingRequest.promise;
    } else {
      // Request expired, remove it
      pendingRequests.delete(key);
    }
  }
  
  // Create new request
  const promise = requestFn()
    .then((result) => {
      // Remove from pending after completion
      pendingRequests.delete(key);
      return result;
    })
    .catch((error) => {
      // Remove from pending on error
      pendingRequests.delete(key);
      throw error;
    });
  
  // Store pending request
  pendingRequests.set(key, {
    promise,
    timestamp: Date.now(),
  });
  
  return promise;
}

/**
 * Clear all pending requests (useful for cleanup)
 */
export function clearPendingRequests() {
  pendingRequests.clear();
}

/**
 * Clear expired pending requests (cleanup utility)
 * @param {number} ttl - Time to live in milliseconds
 */
export function clearExpiredRequests(ttl = 5000) {
  const now = Date.now();
  for (const [key, request] of pendingRequests.entries()) {
    if (now - request.timestamp >= ttl) {
      pendingRequests.delete(key);
    }
  }
}

/**
 * Get count of pending requests
 * @returns {number} Number of pending requests
 */
export function getPendingRequestCount() {
  return pendingRequests.size;
}

export default {
  deduplicateRequest,
  clearPendingRequests,
  clearExpiredRequests,
  getPendingRequestCount,
};

