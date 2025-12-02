/**
 * Middleware to add rate limit information to response headers.
 * Works with express-rate-limit to provide clients with rate limit status.
 */

/**
 * Add rate limit headers to response
 * This should be used after rate limiting middleware
 */
export function addRateLimitHeaders(req, res, next) {
  // Get rate limit info from request (set by express-rate-limit)
  const rateLimitInfo = req.rateLimit || {};
  
  // Add standard rate limit headers
  if (rateLimitInfo.limit !== undefined) {
    res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit);
  }
  
  if (rateLimitInfo.remaining !== undefined) {
    res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitInfo.remaining));
  }
  
  if (rateLimitInfo.reset !== undefined) {
    // Convert reset time to Unix timestamp
    const resetTime = typeof rateLimitInfo.reset === 'number' 
      ? rateLimitInfo.reset 
      : new Date(rateLimitInfo.reset).getTime();
    res.setHeader('X-RateLimit-Reset', Math.floor(resetTime / 1000));
  }
  
  // Add retry-after header if rate limit is exceeded
  if (rateLimitInfo.remaining === 0 && rateLimitInfo.reset) {
    const resetTime = typeof rateLimitInfo.reset === 'number' 
      ? rateLimitInfo.reset 
      : new Date(rateLimitInfo.reset).getTime();
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    if (retryAfter > 0) {
      res.setHeader('Retry-After', retryAfter);
    }
  }
  
  next();
}

export default addRateLimitHeaders;

