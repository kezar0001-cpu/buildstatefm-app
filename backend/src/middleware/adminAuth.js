import { verifyAccessToken } from '../utils/jwt.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import prisma from '../config/prismaClient.js';

/**
 * Dedicated Admin Authentication Middleware
 * 
 * Best Practices Implemented:
 * - Separate admin auth from regular user auth
 * - Detailed error logging for troubleshooting
 * - Account status checks (active, not suspended)
 * - Token validation with clear error messages
 * - Request context enrichment for admin operations
 */

/**
 * Require admin authentication
 * Verifies JWT token and ensures user has ADMIN role
 */
export const requireAdmin = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization || '';
    
    if (!authHeader.startsWith('Bearer ')) {
      console.warn('[Admin Auth] No Bearer token provided', {
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      return sendError(
        res,
        401,
        'Admin authentication required. Please sign in to the admin panel.',
        ErrorCodes.AUTH_NO_TOKEN
      );
    }

    const token = authHeader.slice('Bearer '.length).trim();

    // Verify JWT token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      console.error('[Admin Auth] Token verification failed:', {
        error: err.name,
        message: err.message,
        path: req.path
      });
      
      const errorCode = err.name === 'TokenExpiredError'
        ? ErrorCodes.AUTH_TOKEN_EXPIRED
        : ErrorCodes.AUTH_INVALID_TOKEN;
      
      const message = err.name === 'TokenExpiredError'
        ? 'Your admin session has expired. Please sign in again.'
        : 'Invalid admin token. Please sign in again.';
      
      return sendError(res, 401, message, errorCode);
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      console.error('[Admin Auth] User not found:', {
        userId: decoded.id,
        path: req.path
      });
      return sendError(
        res,
        401,
        'Admin user not found. Please contact support.',
        ErrorCodes.RES_USER_NOT_FOUND
      );
    }

    // Verify user has ADMIN role
    if (user.role !== 'ADMIN') {
      console.warn('[Admin Auth] Non-admin user attempted admin access:', {
        userId: user.id,
        email: user.email,
        role: user.role,
        path: req.path,
        ip: req.ip
      });
      return sendError(
        res,
        403,
        'Access denied. Admin privileges required.',
        ErrorCodes.ACC_ROLE_REQUIRED
      );
    }

    // Check if account is active
    if (!user.isActive) {
      console.warn('[Admin Auth] Inactive admin account attempted access:', {
        userId: user.id,
        email: user.email
      });
      return sendError(
        res,
        403,
        'Admin account is inactive. Please contact support.',
        ErrorCodes.AUTH_ACCOUNT_INACTIVE
      );
    }

    // Attach user to request for downstream use
    req.user = user;
    req.isAdmin = true;
    
    // Log successful admin access (for audit trail)
    console.log('[Admin Auth] Admin access granted:', {
      userId: user.id,
      email: user.email,
      path: req.path,
      method: req.method
    });

    return next();
  } catch (err) {
    console.error('[Admin Auth] Unexpected error:', err);
    return sendError(
      res,
      500,
      'Admin authentication failed. Please try again.',
      ErrorCodes.AUTH_UNAUTHORIZED
    );
  }
};

/**
 * Optional admin authentication
 * Checks for admin token but doesn't require it
 * Useful for endpoints that have different behavior for admins
 */
export const optionalAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    
    if (!authHeader.startsWith('Bearer ')) {
      req.isAdmin = false;
      return next();
    }

    const token = authHeader.slice('Bearer '.length).trim();

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      req.isAdmin = false;
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    if (user && user.role === 'ADMIN' && user.isActive) {
      req.user = user;
      req.isAdmin = true;
    } else {
      req.isAdmin = false;
    }

    return next();
  } catch (err) {
    req.isAdmin = false;
    return next();
  }
};

/**
 * Middleware to log admin actions for audit trail
 * Should be used after requireAdmin
 */
export const logAdminAction = (action) => {
  return async (req, res, next) => {
    if (!req.user || !req.isAdmin) {
      return next();
    }

    try {
      // Log to console (in production, this would go to a logging service)
      console.log('[Admin Action]', {
        action,
        adminId: req.user.id,
        adminEmail: req.user.email,
        path: req.path,
        method: req.method,
        body: req.method !== 'GET' ? req.body : undefined,
        query: req.query,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      // In a production system, you would also:
      // 1. Store in database (AdminActionLog table)
      // 2. Send to monitoring service (DataDog, Sentry, etc.)
      // 3. Alert on sensitive actions (user deletion, permission changes, etc.)

      return next();
    } catch (err) {
      console.error('[Admin Action] Logging failed:', err);
      // Don't block the request if logging fails
      return next();
    }
  };
};

export default {
  requireAdmin,
  optionalAdmin,
  logAdminAction
};
