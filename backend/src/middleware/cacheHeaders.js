/**
 * Cache control middleware for API responses.
 * Provides different caching strategies for different types of data.
 */

/**
 * No cache - for dynamic data that changes frequently
 * Use for: user-specific data, real-time stats, etc.
 */
export function noCache(req, res, next) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  next();
}

/**
 * Private cache with short TTL - for user-specific data that doesn't change often
 * Use for: user profile, settings, etc.
 * @param {number} maxAge - Cache duration in seconds (default: 60)
 */
export function privateCache(maxAge = 60) {
  return (req, res, next) => {
    res.set({
      'Cache-Control': `private, max-age=${maxAge}`,
    });
    next();
  };
}

/**
 * Public cache with short TTL - for shared data that doesn't change often
 * Use for: dropdown options, static lists, etc.
 * @param {number} maxAge - Cache duration in seconds (default: 300)
 */
export function publicCache(maxAge = 300) {
  return (req, res, next) => {
    res.set({
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge * 2}`,
    });
    next();
  };
}

/**
 * Stale-while-revalidate cache - for data that can be slightly stale
 * Use for: analytics, reports, aggregated data
 * @param {number} maxAge - Fresh duration in seconds (default: 60)
 * @param {number} staleWhileRevalidate - Stale revalidation window in seconds (default: 300)
 */
export function staleWhileRevalidate(maxAge = 60, staleWhileRevalidate = 300) {
  return (req, res, next) => {
    res.set({
      'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    });
    next();
  };
}

/**
 * Immutable cache - for content that never changes (e.g., uploaded files by hash)
 * Use for: uploaded files with content-addressed names, versioned assets
 * @param {number} maxAge - Cache duration in seconds (default: 31536000 = 1 year)
 */
export function immutableCache(maxAge = 31536000) {
  return (req, res, next) => {
    res.set({
      'Cache-Control': `public, max-age=${maxAge}, immutable`,
    });
    next();
  };
}

/**
 * ETag support for conditional requests
 * Automatically adds ETag header based on response body hash
 */
export function withETag(req, res, next) {
  const originalJson = res.json.bind(res);
  
  res.json = function (body) {
    const crypto = require('crypto');
    const bodyString = JSON.stringify(body);
    const etag = crypto
      .createHash('md5')
      .update(bodyString)
      .digest('hex');
    
    res.set('ETag', `"${etag}"`);
    
    // Check if client sent If-None-Match header
    const clientETag = req.get('If-None-Match');
    if (clientETag === `"${etag}"`) {
      return res.status(304).end();
    }
    
    return originalJson(body);
  };
  
  next();
}

/**
 * Apply appropriate cache headers based on request method
 * GET/HEAD requests can be cached, others cannot
 */
export function methodBasedCache(maxAge = 60) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.set({
        'Cache-Control': `private, max-age=${maxAge}`,
      });
    } else {
      res.set({
        'Cache-Control': 'no-store',
      });
    }
    next();
  };
}

export default {
  noCache,
  privateCache,
  publicCache,
  staleWhileRevalidate,
  immutableCache,
  withETag,
  methodBasedCache,
};

