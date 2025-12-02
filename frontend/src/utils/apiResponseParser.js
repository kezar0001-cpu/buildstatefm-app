/**
 * Standardized API response parser
 * Handles various response formats consistently across the application
 */

/**
 * Parse API response to extract data
 * @param {Object} response - Axios response object
 * @param {Object} options - Parsing options
 * @param {string|string[]} options.dataPath - Path to data (e.g., 'items', 'data.items', ['data', 'items'])
 * @param {boolean} options.returnFullResponse - Return full response object instead of just data
 * @returns {*} Parsed data
 */
export function parseApiResponse(response, options = {}) {
  const { dataPath = 'data', returnFullResponse = false } = options;

  if (!response) {
    return returnFullResponse ? { data: null, success: false } : null;
  }

  // Handle Axios response structure
  const responseData = response.data || response;

  // If returnFullResponse is true, return structured object
  if (returnFullResponse) {
    return {
      data: extractData(responseData, dataPath),
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      message: responseData?.message || null,
      meta: responseData?.meta || null,
      pagination: responseData?.pagination || responseData?.data?.pagination || null,
    };
  }

  // Otherwise, return just the extracted data
  return extractData(responseData, dataPath);
}

/**
 * Extract data from response using path
 * @param {Object} data - Response data object
 * @param {string|string[]} path - Path to data
 * @returns {*} Extracted data
 */
function extractData(data, path) {
  if (!data) return null;

  // If path is array, join with dots
  if (Array.isArray(path)) {
    path = path.join('.');
  }

  // If path is empty or 'data', return data directly
  if (!path || path === 'data') {
    return data;
  }

  // Handle nested paths (e.g., 'data.items')
  if (path.includes('.')) {
    const parts = path.split('.');
    let value = data;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined || value === null) break;
    }
    return value;
  }

  // Handle single key path
  return data[path] || data;
}

/**
 * Parse paginated API response
 * @param {Object} response - Axios response object
 * @returns {Object} Parsed paginated response
 */
export function parsePaginatedResponse(response) {
  const parsed = parseApiResponse(response, { returnFullResponse: true });

  return {
    items: parsed.data?.items || parsed.data || [],
    pagination: parsed.pagination || {
      page: parsed.data?.page || 1,
      pageSize: parsed.data?.pageSize || parsed.data?.limit || 20,
      total: parsed.data?.total || 0,
      totalPages: parsed.data?.totalPages || Math.ceil((parsed.data?.total || 0) / (parsed.data?.pageSize || 20)),
      hasMore: parsed.data?.hasMore || false,
    },
    meta: parsed.meta || null,
  };
}

/**
 * Parse list API response (handles both paginated and non-paginated)
 * @param {Object} response - Axios response object
 * @param {string|string[]} dataPath - Path to items array
 * @returns {Array} Array of items
 */
export function parseListResponse(response, dataPath = ['items', 'data.items', 'data', 'results']) {
  if (!response) return [];

  const responseData = response.data || response;

  // If already an array, return it
  if (Array.isArray(responseData)) {
    return responseData;
  }

  // Try each path in order
  const paths = Array.isArray(dataPath) ? dataPath : [dataPath];
  for (const path of paths) {
    const extracted = extractData(responseData, path);
    if (Array.isArray(extracted)) {
      return extracted;
    }
  }

  // If no array found, return empty array
  return [];
}

/**
 * Parse single item API response
 * @param {Object} response - Axios response object
 * @param {string|string[]} dataPath - Path to item
 * @returns {Object|null} Item object or null
 */
export function parseItemResponse(response, dataPath = ['data', 'item']) {
  if (!response) return null;

  const responseData = response.data || response;

  // If already an object (not array), return it
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    // Check if it's a direct item or wrapped
    if (responseData.id || responseData._id) {
      return responseData;
    }
  }

  // Try each path in order
  const paths = Array.isArray(dataPath) ? dataPath : [dataPath];
  for (const path of paths) {
    const extracted = extractData(responseData, path);
    if (extracted && typeof extracted === 'object' && !Array.isArray(extracted)) {
      return extracted;
    }
  }

  return null;
}

/**
 * Parse error response
 * @param {Error} error - Error object
 * @returns {Object} Parsed error object
 */
export function parseErrorResponse(error) {
  if (!error) {
    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      status: 500,
    };
  }

  // Handle Axios error
  if (error.response) {
    return {
      message: error.response.data?.message || error.message || 'An error occurred',
      code: error.response.data?.errorCode || `HTTP_${error.response.status}`,
      status: error.response.status,
      data: error.response.data,
    };
  }

  // Handle network error
  if (error.request) {
    return {
      message: 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
      status: 0,
    };
  }

  // Handle other errors
  return {
    message: error.message || 'An unexpected error occurred',
    code: error.code || 'UNKNOWN_ERROR',
    status: 500,
  };
}

export default {
  parseApiResponse,
  parsePaginatedResponse,
  parseListResponse,
  parseItemResponse,
  parseErrorResponse,
};

