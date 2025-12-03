import prisma from '../config/prismaClient.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { hasFeature, getLimitReachedMessage } from '../utils/subscriptionLimits.js';

/**
 * Middleware to require authentication
 * Verifies JWT token and attaches user to req.user
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'No token provided', ErrorCodes.AUTH_NO_TOKEN);
    }

    const token = authHeader.slice('Bearer '.length).trim();

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      console.error('JWT verify error:', err?.name, err?.message);
      const errorCode = err?.name === 'TokenExpiredError'
        ? ErrorCodes.AUTH_TOKEN_EXPIRED
        : ErrorCodes.AUTH_INVALID_TOKEN;
      return sendError(res, 401, 'Invalid or expired token', errorCode);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return sendError(res, 401, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
    }

    // Check if user is active
    if (!user.isActive) {
      return sendError(res, 403, 'Account is inactive', ErrorCodes.AUTH_ACCOUNT_INACTIVE);
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return sendError(res, 401, 'Unauthorized', ErrorCodes.AUTH_UNAUTHORIZED);
  }
};

/**
 * Middleware to require specific role(s)
 * Must be used after requireAuth
 * @param {...string} allowedRoles - One or more roles that are allowed
 * @example requireRole('PROPERTY_MANAGER', 'OWNER')
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        ErrorCodes.ACC_ROLE_REQUIRED
      );
    }

    next();
  };
};

/**
 * Middleware to check if user has access to a specific property
 * Must be used after requireAuth
 * Checks if user is property manager or owner of the property
 */
export const requirePropertyAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const propertyId = req.params.propertyId || req.params.id || req.body.propertyId;

    if (!propertyId) {
      return sendError(res, 400, 'Property ID required', ErrorCodes.VAL_MISSING_FIELD);
    }

    // Property managers can access properties they manage
    if (req.user.role === 'PROPERTY_MANAGER') {
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          managerId: req.user.id,
        },
      });

      if (property) {
        req.property = property;
        return next();
      }
    }

    // Owners can access properties they own
    if (req.user.role === 'OWNER') {
      const ownership = await prisma.propertyOwner.findFirst({
        where: {
          propertyId,
          ownerId: req.user.id,
        },
        include: {
          property: true,
        },
      });

      if (ownership) {
        req.property = ownership.property;
        return next();
      }
    }

    // Technicians can access properties they're assigned to via jobs
    if (req.user.role === 'TECHNICIAN') {
      const job = await prisma.job.findFirst({
        where: {
          propertyId,
          assignedToId: req.user.id,
        },
        include: {
          property: true,
        },
      });

      if (job) {
        req.property = job.property;
        return next();
      }
    }

    return sendError(res, 403, 'Access denied to this property', ErrorCodes.ACC_PROPERTY_ACCESS_DENIED);
  } catch (error) {
    console.error('Property access check error:', error);
    return sendError(res, 500, 'Failed to verify property access', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

/**
 * Middleware to check subscription status
 * Blocks access if trial expired or subscription inactive
 * Checks the current user's subscription (for property manager-only endpoints)
 */
export const requireActiveSubscription = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required', ErrorCodes.AUTH_UNAUTHORIZED);
  }

  const { subscriptionStatus, trialEndDate } = req.user;

  // Active subscription is good
  if (subscriptionStatus === 'ACTIVE') {
    return next();
  }

  // Trial is good if not expired
  if (subscriptionStatus === 'TRIAL') {
    if (trialEndDate && new Date(trialEndDate) > new Date()) {
      return next();
    }
    return sendError(
      res,
      403,
      'Your trial period has expired. Please upgrade your plan to continue.',
      ErrorCodes.SUB_TRIAL_EXPIRED
    );
  }

  // All other statuses are blocked
  return sendError(
    res,
    403,
    'Active subscription required. Please upgrade your plan to access this feature.',
    ErrorCodes.SUB_SUBSCRIPTION_REQUIRED
  );
};

/**
 * Helper function to check if a user's subscription is active
 */
export const isSubscriptionActive = (user) => {
  if (!user) return false;

  const { subscriptionStatus, trialEndDate } = user;

  // Active subscription is good
  if (subscriptionStatus === 'ACTIVE') {
    return true;
  }

  // Trial is good if not expired
  if (subscriptionStatus === 'TRIAL') {
    if (trialEndDate && new Date(trialEndDate) > new Date()) {
      return true;
    }
  }

  return false;
};

/**
 * Middleware to check property manager's subscription status
 * For property managers: checks their own subscription
 * For tenants/owners/technicians: checks the property manager's subscription
 *
 * Requires propertyId to be present in req.body, req.params, or req.query
 * Must be used after requireAuth
 */
export const requirePropertyManagerSubscription = async (req, res, next) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    // If user is a property manager, check their own subscription
    if (req.user.role === 'PROPERTY_MANAGER') {
      if (isSubscriptionActive(req.user)) {
        return next();
      }
      return sendError(
        res,
        403,
        'Your trial period has expired. Please upgrade your plan to continue.',
        ErrorCodes.SUB_TRIAL_EXPIRED
      );
    }

    // For other roles (TENANT, OWNER, TECHNICIAN), check the property manager's subscription
    // First, resolve the propertyId from the request
    const propertyId = req.body?.propertyId || req.params?.propertyId || req.query?.propertyId;

    if (!propertyId) {
      // If no propertyId, we can't check the manager's subscription
      // This shouldn't happen in normal flow, but we'll allow it through
      // and let the route handler's access control deal with it
      return next();
    }

    // Look up the property to get the manager
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        managerId: true,
        manager: {
          select: {
            id: true,
            subscriptionStatus: true,
            trialEndDate: true,
          },
        },
      },
    });

    if (!property) {
      // Property not found - let the route handler deal with this
      return next();
    }

    // Check if the property manager has an active subscription
    if (isSubscriptionActive(property.manager)) {
      return next();
    }

    // Property manager's subscription is not active
    return sendError(
      res,
      403,
      'This property\'s subscription has expired. Please contact your property manager.',
      ErrorCodes.SUB_MANAGER_SUBSCRIPTION_REQUIRED
    );
  } catch (error) {
    console.error('Property manager subscription check error:', error);
    return sendError(res, 500, 'Failed to verify subscription status', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

/**
 * Middleware to require a specific feature based on subscription plan
 * NOTE: In the new usage-based model, all features are available to all plans.
 * This middleware is kept for backward compatibility but always allows access.
 * Use requireUsage instead to enforce usage limits.
 * @param {string} feature - The feature name (kept for backward compatibility)
 * @returns {Function} Express middleware
 */
export const requireFeature = (feature) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    // All features are available in the usage-based model
    return next();
  };
};

/**
 * Middleware to check and enforce usage limits
 * Prevents actions when usage limits are reached
 * @param {string} limitType - The type of limit to check (e.g., 'properties', 'teamMembers', 'inspectionsPerMonth')
 * @param {Function} getCurrentUsageFn - Async function that returns current usage count
 * @returns {Function} Express middleware
 */
export const requireUsage = (limitType, getCurrentUsageFn) => {
  return async (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    try {
      // Get the property manager's plan (for property managers, it's their own plan)
      let userPlan = req.user.subscriptionPlan || 'FREE_TRIAL';
      let userId = req.user.id;

      // For non-property managers, check their property manager's subscription
      if (req.user.role !== 'PROPERTY_MANAGER') {
        const propertyId = req.body?.propertyId || req.params?.propertyId || req.query?.propertyId;

        if (propertyId) {
          const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: {
              managerId: true,
              manager: {
                select: {
                  subscriptionPlan: true,
                },
              },
            },
          });

          if (property) {
            userPlan = property.manager.subscriptionPlan;
            userId = property.managerId;
          }
        }
      }

      // Get current usage
      const currentUsage = await getCurrentUsageFn(userId, req);

      // Import after function declaration to avoid circular dependency
      const { hasReachedLimit, getLimitReachedMessage } = await import('../utils/subscriptionLimits.js');

      // Check if limit is reached
      if (hasReachedLimit(userPlan, limitType, currentUsage)) {
        const message = getLimitReachedMessage(limitType, userPlan);
        return sendError(res, 403, message, ErrorCodes.SUB_USAGE_LIMIT_REACHED);
      }

      // Store usage info in request for potential use in route handler
      req.usageInfo = {
        limitType,
        currentUsage,
        plan: userPlan,
      };

      return next();
    } catch (error) {
      console.error('Usage limit check error:', error);
      return sendError(res, 500, 'Failed to verify usage limits', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  };
};
