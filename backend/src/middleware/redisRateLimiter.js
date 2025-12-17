// backend/src/middleware/redisRateLimiter.js
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { getConnectedRedisClient } from '../config/redisClient.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

/**
 * In-memory fallback rate limiter (used when Redis is unavailable)
 */
const memoryLimiters = new Map();

/**
 * Get or create a memory-based rate limiter
 * @param {string} keyPrefix - Rate limiter key prefix
 * @param {number} points - Maximum number of points
 * @param {number} duration - Duration in seconds
 * @returns {RateLimiterMemory}
 */
function getMemoryLimiter(keyPrefix, points, duration) {
  const key = `${keyPrefix}-${points}-${duration}`;

  if (!memoryLimiters.has(key)) {
    memoryLimiters.set(key, new RateLimiterMemory({
      points,
      duration,
      keyPrefix,
    }));
  }

  return memoryLimiters.get(key);
}

/**
 * Create a Redis-backed rate limiter middleware
 * Falls back to in-memory rate limiting if Redis is unavailable
 *
 * @param {Object} options - Rate limiter configuration
 * @param {string} options.keyPrefix - Redis key prefix (e.g., 'upload_rate_limit')
 * @param {number} options.points - Maximum number of requests (default: 30)
 * @param {number} options.duration - Time window in seconds (default: 60)
 * @param {string} options.errorMessage - Custom error message
 * @param {Function} options.keyGenerator - Custom key generator function (req) => string
 * @returns {Function} Express middleware
 */
export function createRedisRateLimiter(options = {}) {
  const {
    keyPrefix = 'rate_limit',
    points = 30,
    duration = 60,
    errorMessage,
    keyGenerator = (req) => {
  // ALWAYS limit per-user, regardless of proxy IPs
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  // If somehow not authenticated, allow instead of rate-limit by IP
  console.warn(`[RateLimiter:${keyPrefix}] No user ID found. Allowing request (no IP fallback).`);
  return null;
},
  } = options;

  let rateLimiter = null;
  let isRedisAvailable = false;

  // Initialize rate limiter asynchronously
  (async () => {
    try {
      const redisClient = await getConnectedRedisClient();

      if (redisClient && redisClient.isOpen) {
        rateLimiter = new RateLimiterRedis({
          storeClient: redisClient,
          keyPrefix,
          points,
          duration,
          execEvenly: false,
          blockDuration: 0,
        });
        isRedisAvailable = true;
        console.log(`✅ Redis rate limiter initialized: ${keyPrefix} (${points} requests per ${duration}s)`);
      } else {
        console.warn(`⚠️  Redis unavailable for rate limiter: ${keyPrefix}, using in-memory fallback`);
        rateLimiter = getMemoryLimiter(keyPrefix, points, duration);
        isRedisAvailable = false;
      }
    } catch (error) {
      console.error(`❌ Failed to initialize Redis rate limiter: ${keyPrefix}`, error);
      rateLimiter = getMemoryLimiter(keyPrefix, points, duration);
      isRedisAvailable = false;
    }
  })();

  // Return middleware function
  return async (req, res, next) => {
    // Wait for rate limiter to be initialized
    if (!rateLimiter) {
      // Use temporary in-memory limiter while initializing
      const tempLimiter = getMemoryLimiter(keyPrefix, points, duration);
      rateLimiter = tempLimiter;
    }

    try {
      const key = keyGenerator(req);

      if (!key) {
        // No key available (e.g., unauthenticated request with no IP), allow the request
        console.warn(`[RateLimiter:${keyPrefix}] No key generated for request - allowing (req.user: ${req.user?.id || 'none'}, req.ip: ${req.ip || 'none'})`);
        return next();
      }

      // Log rate limit key for debugging (only in development or when explicitly enabled)
      if (process.env.LOG_RATE_LIMIT_KEYS === 'true' || process.env.NODE_ENV === 'development') {
        console.log(`[RateLimiter:${keyPrefix}] Consuming 1 point for key: ${key} (user: ${req.user?.id || 'none'}, ip: ${req.ip || 'none'})`);
      }

      // Consume 1 point
      await rateLimiter.consume(key, 1);

      // Request allowed
      next();
    } catch (err) {
      const key = keyGenerator(req);

      // Detect a genuine RateLimiterRes object (rate limit exceeded)
      const isRateLimiterRes =
        err && typeof err === 'object' &&
        (typeof err.msBeforeNext === 'number' || typeof err.remainingPoints === 'number');

      if (!isRateLimiterRes) {
        // Unexpected error from Redis or rate-limiter-flexible – do NOT block the request
        console.error(`❌ [RateLimiter:${keyPrefix}] Unexpected error while consuming rate limit for key: ${key} (user: ${req.user?.id || 'none'}, ip: ${req.ip || 'none'})`, err);
        console.warn(`[RateLimiter:${keyPrefix}] Degrading gracefully: allowing request despite rate limiter error.`);
        return next();
      }

      const rateLimiterRes = err;
      const message = errorMessage || `Too many requests. Maximum ${points} requests per ${duration} seconds.`;

      // Log rate limit exceeded for debugging
      console.warn(`[RateLimiter:${keyPrefix}] Rate limit exceeded for key: ${key} (user: ${req.user?.id || 'none'}, ip: ${req.ip || 'none'}, msBeforeNext: ${rateLimiterRes?.msBeforeNext || 'unknown'})`);

      // Add rate limit headers
      if (rateLimiterRes?.msBeforeNext) {
        res.set('Retry-After', Math.ceil(rateLimiterRes.msBeforeNext / 1000));
        res.set('X-RateLimit-Limit', points);
        res.set('X-RateLimit-Remaining', 0);
        res.set('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
        res.set('X-RateLimit-Key', key); // Include key in response for debugging
      }

      return sendError(res, 429, message, ErrorCodes.RATE_LIMIT_EXCEEDED);
    }
  };
}

export function redisRateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000,
    max = 30,
    keyPrefix = 'public_rate_limit',
    message,
    keyGenerator,
  } = options;

  const duration = Math.max(1, Math.ceil(windowMs / 1000));

  return createRedisRateLimiter({
    keyPrefix,
    points: max,
    duration,
    errorMessage: message,
    keyGenerator:
      keyGenerator ||
      ((req) => {
        const sessionId = req.body?.sessionId;
        if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
          return `session:${sessionId.trim()}`;
        }

        if (req.ip) {
          return `ip:${req.ip}`;
        }

        return null;
      }),
  });
}

/**
 * Pre-configured rate limiters for common use cases
 * 
 * NOTE: Rate limits are per-user, not global. Each authenticated user
 * has their own quota that resets independently.
 */

// Upload rate limiter: 500 uploads per minute (generous for batch uploads)
// This allows users to upload multiple images at once without hitting limits
export const uploadRateLimiter = createRedisRateLimiter({
  keyPrefix: 'upload_rate_limit',
  points: 500,
  duration: 60,
  errorMessage: 'Too many uploads. Maximum 500 uploads per minute. Please wait a moment before uploading more files.',
});

// Property upload rate limiter: 100 uploads per minute (generous for property images)
export const propertyUploadRateLimiter = createRedisRateLimiter({
  keyPrefix: 'property_upload_rate_limit',
  points: 100,
  duration: 60,
  errorMessage: 'Too many property uploads. Maximum 100 uploads per minute.',
});

// API rate limiter: 100 requests per minute
export const apiRateLimiter = createRedisRateLimiter({
  keyPrefix: 'api_rate_limit',
  points: 100,
  duration: 60,
  errorMessage: 'Too many API requests. Maximum 100 requests per minute.',
});

// Strict rate limiter: 10 requests per minute (for sensitive operations)
export const strictRateLimiter = createRedisRateLimiter({
  keyPrefix: 'strict_rate_limit',
  points: 10,
  duration: 60,
  errorMessage: 'Too many requests. Maximum 10 requests per minute.',
});

export default {
  createRedisRateLimiter,
  uploadRateLimiter,
  propertyUploadRateLimiter,
  apiRateLimiter,
  strictRateLimiter,
};
