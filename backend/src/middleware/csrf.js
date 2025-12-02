import crypto from 'crypto';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

/**
 * CSRF Protection Middleware
 * 
 * Implements Double Submit Cookie pattern for CSRF protection.
 * Generates and validates CSRF tokens for state-changing requests.
 * 
 * Manual Setup Required:
 * - Ensure cookies are properly configured in server.js
 * - Set CSRF_COOKIE_SECURE=true in production (requires HTTPS)
 * - Configure CSRF_COOKIE_SAMESITE (default: 'strict')
 */

// Store for server-side token validation (optional, for additional security)
// In production, consider using Redis for distributed systems
const tokenStore = new Map();

// Configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN';
const CSRF_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a CSRF token
 * @returns {string} CSRF token
 */
function generateCSRFToken() {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('base64url');
}

/**
 * Get CSRF token from request (cookie or header)
 * @param {object} req - Express request object
 * @returns {string|null} CSRF token or null
 */
function getCSRFToken(req) {
  // Check header first (preferred)
  const headerToken = req.headers[CSRF_HEADER_NAME.toLowerCase()] || 
                      req.headers['x-xsrf-token'];
  
  // Fallback to cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  
  return headerToken || cookieToken || null;
}

/**
 * Validate CSRF token
 * @param {string} token - Token to validate
 * @param {string} cookieToken - Token from cookie
 * @returns {boolean} True if valid
 */
function validateCSRFToken(token, cookieToken) {
  if (!token || !cookieToken) {
    return false;
  }
  
  // Double Submit Cookie: tokens must match
  if (token !== cookieToken) {
    return false;
  }
  
  // Optional: Check if token exists in store (for additional security)
  // This requires server-side storage, which may not be needed for Double Submit Cookie
  // Uncomment if you want server-side validation:
  // if (!tokenStore.has(token)) {
  //   return false;
  // }
  
  return true;
}

/**
 * CSRF protection middleware
 * Only applies to state-changing HTTP methods (POST, PUT, PATCH, DELETE)
 */
export function csrfProtection(req, res, next) {
  // Skip CSRF check for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }
  
  // Skip CSRF check for public endpoints (if needed)
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Get tokens
  const token = getCSRFToken(req);
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  
  // Validate token
  if (!validateCSRFToken(token, cookieToken)) {
    return sendError(
      res,
      403,
      'Invalid CSRF token. Please refresh the page and try again.',
      ErrorCodes.ACC_CSRF_TOKEN_INVALID
    );
  }
  
  next();
}

/**
 * Middleware to generate and set CSRF token
 * Should be applied before routes that need CSRF protection
 */
export function generateCSRFToken(req, res, next) {
  // Only generate token for GET requests (to avoid unnecessary token generation)
  if (req.method !== 'GET') {
    return next();
  }
  
  // Check if token already exists in cookie
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!existingToken) {
    // Generate new token
    const token = generateCSRFToken();
    
    // Store token (optional, for server-side validation)
    tokenStore.set(token, {
      createdAt: Date.now(),
      ip: req.ip,
    });
    
    // Set cookie
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be accessible to JavaScript for Double Submit Cookie
      secure: process.env.CSRF_COOKIE_SECURE === 'true', // HTTPS only in production
      sameSite: process.env.CSRF_COOKIE_SAMESITE || 'strict',
      maxAge: CSRF_TOKEN_TTL,
      path: '/',
    });
    
    // Also set in response header for easy access
    res.setHeader('X-CSRF-Token', token);
  } else {
    // Token exists, just set header
    res.setHeader('X-CSRF-Token', existingToken);
  }
  
  // Clean up expired tokens from store
  cleanupExpiredTokens();
  
  next();
}

/**
 * Clean up expired tokens from store
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (now - data.createdAt > CSRF_TOKEN_TTL) {
      tokenStore.delete(token);
    }
  }
}

/**
 * Get CSRF token for frontend (helper endpoint)
 */
export function getCSRFTokenHandler(req, res) {
  const token = req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!token) {
    // Generate new token
    const newToken = generateCSRFToken();
    
    tokenStore.set(newToken, {
      createdAt: Date.now(),
      ip: req.ip,
    });
    
    res.cookie(CSRF_COOKIE_NAME, newToken, {
      httpOnly: false,
      secure: process.env.CSRF_COOKIE_SECURE === 'true',
      sameSite: process.env.CSRF_COOKIE_SAMESITE || 'strict',
      maxAge: CSRF_TOKEN_TTL,
      path: '/',
    });
    
    return res.json({ token: newToken });
  }
  
  res.json({ token });
}

export default {
  csrfProtection,
  generateCSRFToken,
  getCSRFTokenHandler,
};

