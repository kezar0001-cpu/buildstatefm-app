import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/prismaClient.js';
import { requireAuth, requireRole, requireUsage } from '../middleware/auth.js';
import { getTeamMemberCount } from '../utils/usageTracking.js';
import { sendInviteEmail } from '../utils/email.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = Router();

// Generate a secure random token
function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Calculate expiration date (7 days from now)
function calculateExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}

// Validation schema for creating an invite
const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'TECHNICIAN', 'TENANT']),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
});

/**
 * POST /api/invites
 * Property Manager creates an invite for Owner, Technician, or Tenant
 */
router.post(
  '/',
  requireAuth,
  requireRole('PROPERTY_MANAGER'),
  requireUsage('teamMembers', async (userId) => await getTeamMemberCount(userId)),
  async (req, res) => {
  try {
    const { email, role, propertyId, unitId } = createInviteSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return sendError(res, 400, 'User with this email already exists', ErrorCodes.BIZ_EMAIL_ALREADY_REGISTERED);
    }

    // Check if there's already a pending invite for this email
    const existingInvite = await prisma.invite.findFirst({
      where: {
        email,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvite) {
      return sendError(res, 400, 'A pending invite already exists for this email', ErrorCodes.RES_ALREADY_EXISTS);
    }

    // If inviting to a property, verify the property exists and belongs to this manager
    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          managerId: req.user.id,
        },
      });

      if (!property) {
        return sendError(res, 404, 'Property not found or you do not have permission', ErrorCodes.RES_PROPERTY_NOT_FOUND);
      }
    }

    // If inviting to a unit, verify the unit exists
    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: { property: true },
      });

      if (!unit || unit.property.managerId !== req.user.id) {
        return sendError(res, 404, 'Unit not found or you do not have permission', ErrorCodes.RES_UNIT_NOT_FOUND);
      }
    }

    // Create the invite
    const token = generateInviteToken();
    const expiresAt = calculateExpirationDate();

    const invite = await prisma.invite.create({
      data: {
        email,
        role,
        token,
        status: 'PENDING',
        expiresAt,
        invitedById: req.user.id,
        propertyId: propertyId || null,
        unitId: unitId || null,
      },
      include: {
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        property: true,
        unit: true,
      },
    });

    // Generate the signup URL with the invite token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const signupUrl = `${frontendUrl}/signup?invite=${token}`;

    // Send invitation email
    try {
      const inviterName = `${invite.invitedBy.firstName} ${invite.invitedBy.lastName}`;
      const propertyName = invite.property?.name || null;
      const unitName = invite.unit?.unitNumber || null;

      await sendInviteEmail(
        invite.email,
        signupUrl,
        inviterName,
        invite.role,
        propertyName,
        unitName
      );
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError);
      // Log error but don't fail the request - invite was created successfully
      // The property manager can manually share the invite link if needed
    }

    res.status(201).json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        signupUrl,
        property: invite.property,
        unit: invite.unit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.errors);
    }
    console.error('Create invite error:', error);
    return sendError(res, 500, 'Failed to create invite', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/invites/:token
 * Verify an invite token and get invite details
 */
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: {
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            propertyId: true,
          },
        },
      },
    });

    if (!invite) {
      return sendError(res, 404, 'Invite not found', ErrorCodes.RES_INVITE_NOT_FOUND);
    }

    // Check if invite has expired
    if (new Date() > new Date(invite.expiresAt)) {
      return sendError(res, 400, 'This invite has expired', ErrorCodes.BIZ_INVITE_EXPIRED);
    }

    // Check if invite has already been accepted
    if (invite.status !== 'PENDING') {
      return sendError(res, 400, 'This invite has already been used', ErrorCodes.BIZ_INVITE_ALREADY_ACCEPTED);
    }

    res.json({
      success: true,
      invite: {
        role: invite.role,
        invitedBy: invite.invitedBy,
        property: invite.property,
        unit: invite.unit,
      },
    });
  } catch (error) {
    console.error('Get invite error:', error);
    return sendError(res, 500, 'Failed to retrieve invite', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/invites
 * Get all invites created by the authenticated Property Manager
 * By default, only returns PENDING invites unless status query parameter is provided
 */
router.get('/', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { status } = req.query;

    // Build where clause - default to PENDING invites only
    const where = {
      invitedById: req.user.id,
    };

    // If status is explicitly provided, filter by it
    // Otherwise, default to only PENDING invites
    if (status) {
      where.status = status;
    } else {
      where.status = 'PENDING';
    }

    const invites = await prisma.invite.findMany({
      where,
      include: {
        property: true,
        unit: true,
        invitedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      invites,
    });
  } catch (error) {
    console.error('Get invites error:', error);
    return sendError(res, 500, 'Failed to retrieve invites', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * DELETE /api/invites/:id
 * Cancel/delete a pending invite
 */
router.delete('/:id', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;

    const invite = await prisma.invite.findUnique({
      where: { id },
    });

    if (!invite) {
      return sendError(res, 404, 'Invite not found', ErrorCodes.RES_INVITE_NOT_FOUND);
    }

    if (invite.invitedById !== req.user.id) {
      return sendError(res, 403, 'You do not have permission to delete this invite', ErrorCodes.ACC_ACCESS_DENIED);
    }

    await prisma.invite.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Invite deleted successfully',
    });
  } catch (error) {
    console.error('Delete invite error:', error);
    return sendError(res, 500, 'Failed to delete invite', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
