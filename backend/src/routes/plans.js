import express from 'express';
import { z } from 'zod';
import { prisma } from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = express.Router();

const FREQUENCIES = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY'];

const planSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  propertyId: z.string().min(1, 'Property ID is required'),
  frequency: z.enum(FREQUENCIES, { errorMap: () => ({ message: 'Invalid frequency' }) }),
  description: z.string().optional(),
  nextDueDate: z.string().optional(),
  autoCreateJobs: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const planUpdateSchema = z.object({
  name: z.string().min(1, 'Plan name is required').optional(),
  frequency: z.enum(FREQUENCIES, { errorMap: () => ({ message: 'Invalid frequency' }) }).optional(),
  description: z.string().optional().nullable(),
  nextDueDate: z.string().optional(),
  autoCreateJobs: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// Helper to build where clause based on user role
const buildWhereClause = (userId, userRole, filters = {}) => {
  const where = {};

  // Plans are only accessible to Property Managers
  if (userRole === 'PROPERTY_MANAGER') {
    // Property managers see plans for their properties
    where.property = {
      managerId: userId,
    };
  } else {
    // Other roles cannot access plans
    where.id = 'no-access'; // This will return no results
  }

  // Apply additional filters
  if (filters.propertyId) {
    where.propertyId = filters.propertyId;
  }
  if (filters.frequency) {
    where.frequency = filters.frequency;
  }
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive === 'true' || filters.isActive === true;
  }

  return where;
};

// Helper to verify user has access to a property
const verifyPropertyAccess = async (propertyId, userId, userRole) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      owners: {
        where: { ownerId: userId },
        select: { ownerId: true },
      },
    },
  });

  if (!property) {
    return { hasAccess: false, error: 'Property not found' };
  }

  // Check access based on role
  if (userRole === 'PROPERTY_MANAGER' && property.managerId !== userId) {
    return { 
      hasAccess: false, 
      error: 'You can only create maintenance plans for properties you manage. Please select a property where you are assigned as the property manager.',
      property 
    };
  }

  if (userRole === 'OWNER' && property.owners.length === 0) {
    return { hasAccess: false, error: 'You do not have permission to access this property' };
  }

  return { hasAccess: true, property };
};

// GET / - List all maintenance plans (with role-based filtering)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { propertyId, frequency, isActive, search } = req.query;

    const where = buildWhereClause(req.user.id, req.user.role, {
      propertyId,
      frequency,
      isActive,
    });

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const plans = await prisma.maintenancePlan.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
          },
        },
        _count: {
          select: {
            jobs: true,
          },
        },
      },
      orderBy: {
        nextDueDate: 'asc',
      },
    });

    res.json(plans);
  } catch (error) {
    console.error('Error fetching maintenance plans:', error);
    return sendError(res, 500, 'Failed to fetch maintenance plans', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /:id - Get a single maintenance plan with related jobs
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await prisma.maintenancePlan.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            managerId: true,
          },
          include: {
            owners: {
              select: {
                ownerId: true,
              },
            },
          },
        },
        jobs: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            scheduledDate: true,
            createdAt: true,
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Last 10 jobs
        },
      },
    });

    if (!plan) {
      return sendError(res, 404, 'Maintenance plan not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Verify user has access - Plans are only accessible to Property Managers
    const hasAccess =
      req.user.role === 'PROPERTY_MANAGER' && plan.property.managerId === req.user.id;

    if (!hasAccess) {
      return sendError(res, 403, 'You do not have permission to access this plan', ErrorCodes.ACC_ACCESS_DENIED);
    }

    res.json(plan);
  } catch (error) {
    console.error('Error fetching maintenance plan:', error);
    return sendError(res, 500, 'Failed to fetch maintenance plan', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST / - Create a new maintenance plan (Property Manager only)
router.post('/', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return sendError(res, 400, issue?.message || 'Invalid request', ErrorCodes.VAL_VALIDATION_ERROR, parsed.error.issues);
    }

    const { name, propertyId, frequency, description, nextDueDate, autoCreateJobs, isActive } = parsed.data;

    // Verify property exists and user has access
    const { hasAccess, error, property } = await verifyPropertyAccess(propertyId, req.user.id, req.user.role);
    if (!hasAccess) {
      const statusCode = property ? 403 : 404;
      const errorCode = property ? ErrorCodes.ACC_PROPERTY_ACCESS_DENIED : ErrorCodes.RES_PROPERTY_NOT_FOUND;
      return sendError(res, statusCode, error, errorCode);
    }

    // Create maintenance plan
    const plan = await prisma.maintenancePlan.create({
      data: {
        name,
        propertyId,
        frequency,
        description: description || null,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : new Date(),
        autoCreateJobs: autoCreateJobs ?? false,
        isActive: isActive ?? true,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
          },
        },
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    });

    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating maintenance plan:', error);
    return sendError(res, 500, 'Failed to create maintenance plan', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// PATCH /:id - Update a maintenance plan (Property Manager only)
router.patch('/:id', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;

    const parsed = planUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return sendError(res, 400, issue?.message || 'Invalid request', ErrorCodes.VAL_VALIDATION_ERROR, parsed.error.issues);
    }

    // Check if plan exists and user has access
    const existingPlan = await prisma.maintenancePlan.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            managerId: true,
          },
        },
      },
    });

    if (!existingPlan) {
      return sendError(res, 404, 'Maintenance plan not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Verify user has access
    if (req.user.role === 'PROPERTY_MANAGER' && existingPlan.property.managerId !== req.user.id) {
      return sendError(res, 403, 'You do not have permission to update this plan', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const { name, frequency, description, nextDueDate, autoCreateJobs, isActive } = parsed.data;

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (description !== undefined) updateData.description = description;
    if (nextDueDate !== undefined) updateData.nextDueDate = new Date(nextDueDate);
    if (autoCreateJobs !== undefined) updateData.autoCreateJobs = autoCreateJobs;
    if (isActive !== undefined) updateData.isActive = isActive;

    const plan = await prisma.maintenancePlan.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
          },
        },
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    });

    res.json(plan);
  } catch (error) {
    console.error('Error updating maintenance plan:', error);
    return sendError(res, 500, 'Failed to update maintenance plan', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /:id - Delete a maintenance plan (Property Manager only)
router.delete('/:id', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if plan exists and user has access
    const existingPlan = await prisma.maintenancePlan.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            managerId: true,
          },
        },
      },
    });

    if (!existingPlan) {
      return sendError(res, 404, 'Maintenance plan not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Verify user has access
    if (req.user.role === 'PROPERTY_MANAGER' && existingPlan.property.managerId !== req.user.id) {
      return sendError(res, 403, 'You do not have permission to delete this plan', ErrorCodes.ACC_ACCESS_DENIED);
    }

    await prisma.maintenancePlan.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Maintenance plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting maintenance plan:', error);
    return sendError(res, 500, 'Failed to delete maintenance plan', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
