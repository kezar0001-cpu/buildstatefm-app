import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../config/prismaClient.js';
import { requireAuth } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { asyncHandler, sendError, ErrorCodes } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import { cacheMiddleware, invalidate } from '../utils/cache.js';

const router = Router();

router.use(requireAuth);

// Validation schemas
const userUpdateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().min(10).max(20).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

const BASIC_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
};

function normalisePropertyIds(propertyIds) {
  if (!Array.isArray(propertyIds)) {
    return [];
  }
  return propertyIds.filter(Boolean);
}

export async function fetchUsersForManagedProperties(prismaClient, propertyIds, requestedRole) {
  const safePropertyIds = normalisePropertyIds(propertyIds);

  if (requestedRole === 'OWNER') {
    if (safePropertyIds.length === 0) {
      return [];
    }

    const ownerships = await prismaClient.propertyOwner.findMany({
      where: {
        propertyId: { in: safePropertyIds },
      },
      include: {
        owner: {
          select: BASIC_USER_SELECT,
        },
      },
    });

    return ownerships.map(record => record.owner).filter(Boolean);
  }

  if (requestedRole === 'TENANT') {
    if (safePropertyIds.length === 0) {
      return [];
    }

    const assignments = await prismaClient.unitTenant.findMany({
      where: {
        isActive: true,
        unit: {
          propertyId: { in: safePropertyIds },
        },
      },
      include: {
        tenant: {
          select: BASIC_USER_SELECT,
        },
      },
    });

    return assignments.map(record => record.tenant).filter(Boolean);
  }

  return [];
}

// GET /api/users - List users by role (restricted to PROPERTY_MANAGER)
router.get('/', asyncHandler(async (req, res) => {
  const { role } = req.query;

  if (!role) {
    return sendError(res, 400, 'Role query parameter is required', ErrorCodes.VAL_MISSING_FIELD);
  }

  // Access control: Only property managers can list users
  // This prevents unauthorized enumeration of users in the system
  if (req.user.role !== 'PROPERTY_MANAGER') {
    return sendError(res, 403, 'Access denied. Only property managers can list users.', ErrorCodes.ACC_ACCESS_DENIED);
  }

  // Property managers can query for users they manage or work with
  // Allowed roles: OWNER (property owners), TENANT (tenants), TECHNICIAN (service providers)
  // Not allowed: PROPERTY_MANAGER (other managers)
  const allowedRoles = ['OWNER', 'TENANT', 'TECHNICIAN'];
  const requestedRole = role.toUpperCase();

  if (!allowedRoles.includes(requestedRole)) {
    return sendError(res, 403, `Access denied. You can only list users with roles: ${allowedRoles.join(', ')}`, ErrorCodes.ACC_ACCESS_DENIED);
  }

  // For better security, only return users associated with properties managed by this property manager
  // Get all properties managed by the current user
  const managedProperties = await prisma.property.findMany({
    where: {
      managerId: req.user.id,
    },
    select: {
      id: true,
    },
  });

  const propertyIds = managedProperties.map(p => p.id);

  let rawUsers;

  if (requestedRole === 'TECHNICIAN') {
    // Technicians should be scoped to the current manager's organization
    const manager = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { orgId: true },
    });

    if (!manager?.orgId) {
      rawUsers = [];
    } else {
      rawUsers = await prisma.user.findMany({
        where: {
          role: 'TECHNICIAN',
          orgId: manager.orgId,
        },
        select: BASIC_USER_SELECT,
      });
    }
  } else {
    rawUsers = await fetchUsersForManagedProperties(prisma, propertyIds, requestedRole);

    // Tenants can exist without an active unit assignment yet (e.g. invite accepted but not assigned).
    // Include tenants who accepted an invite created by the current property manager to avoid "missing" tenants
    // in Team Management.
    if (requestedRole === 'TENANT') {
      const invitedTenants = await prisma.invite.findMany({
        where: {
          invitedById: req.user.id,
          role: 'TENANT',
          status: 'ACCEPTED',
          invitedUserId: { not: null },
        },
        include: {
          invitedUser: {
            select: BASIC_USER_SELECT,
          },
        },
      });

      rawUsers = [
        ...rawUsers,
        ...invitedTenants.map((record) => record.invitedUser).filter(Boolean),
      ];
    }
  }

  // Remove duplicates (same owner/tenant might be associated with multiple properties)
  const uniqueUsers = Array.from(new Map(rawUsers.map(user => [user.id, user])).values());

  res.json({ success: true, users: uniqueUsers });
}));

// GET /api/users/me - Get current user profile (cached for 1 hour)
router.get('/me', cacheMiddleware({ ttl: 3600 }), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      company: true,
      emailVerified: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      trialEndDate: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    return sendError(res, 404, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
  }

  res.json({ success: true, data: user });
}));

// GET /api/users/:id - Get user by ID
router.get('/:id', asyncHandler(async (req, res) => {
  // Only allow users to view their own profile or property managers to view any
  if (req.user.id !== req.params.id && req.user.role !== 'PROPERTY_MANAGER') {
    return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      company: true,
      emailVerified: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    return sendError(res, 404, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
  }

  res.json({ success: true, data: user });
}));

// PATCH /api/users/:id - Update user profile
router.patch('/:id', validate(userUpdateSchema), asyncHandler(async (req, res) => {
  // Only allow users to update their own profile
  if (req.user.id !== req.params.id) {
    return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: req.body,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      company: true,
    },
  });

  // Invalidate user profile cache
  await invalidate(`cache:/api/users/me:user:${req.user.id}`);

  logger.info(`User ${req.user.id} updated their profile`);
  res.json({ success: true, data: user });
}));

// POST /api/users/:id/change-password - Change password
router.post('/:id/change-password', validate(passwordChangeSchema), asyncHandler(async (req, res) => {
  // Only allow users to change their own password
  if (req.user.id !== req.params.id) {
    return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
  }

  const { currentPassword, newPassword } = req.body;

  // Get user with password hash
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return sendError(res, 404, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    return sendError(res, 401, 'Current password is incorrect', ErrorCodes.AUTH_INVALID_CREDENTIALS);
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: newPasswordHash },
  });

  logger.info(`User ${req.user.id} changed their password`);
  res.json({ success: true, message: 'Password changed successfully' });
}));

export default router;
