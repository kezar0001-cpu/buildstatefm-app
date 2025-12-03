import express from 'express';
import { z } from 'zod';
import validate from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { prisma } from '../config/prismaClient.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = express.Router();

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().optional(),
  priority: z.enum(PRIORITIES).optional().default('MEDIUM'),
  estimatedCost: z.number().positive().optional(),
  estimatedHours: z.number().positive().optional(),
  instructions: z.string().optional(),
  requiredSkills: z.array(z.string()).optional().default([]),
});

const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  estimatedCost: z.number().positive().optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  instructions: z.string().optional().nullable(),
  requiredSkills: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ========================================
// GET /api/job-templates
// List job templates for current property manager
// ========================================
router.get('/', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { category, isActive, search, limit = 50, offset = 0 } = req.query;

    const where = {
      managerId: req.user.id,
    };

    if (category) {
      where.category = category;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.jobTemplate.findMany({
        where,
        orderBy: [
          { isActive: 'desc' },
          { usageCount: 'desc' },
          { createdAt: 'desc' },
        ],
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.jobTemplate.count({ where }),
    ]);

    res.json({
      templates,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Error fetching job templates:', error);
    return sendError(res, 500, 'Failed to fetch job templates', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// GET /api/job-templates/:id
// Get single job template
// ========================================
router.get('/:id', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;

    const template = await prisma.jobTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return sendError(res, 404, 'Job template not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Authorization: only owner can view
    if (template.managerId !== req.user.id) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching job template:', error);
    return sendError(res, 500, 'Failed to fetch job template', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/job-templates
// Create job template
// ========================================
router.post('/', requireAuth, requireRole('PROPERTY_MANAGER'), validate(templateSchema), async (req, res) => {
  try {
    const data = req.body;

    const template = await prisma.jobTemplate.create({
      data: {
        ...data,
        managerId: req.user.id,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating job template:', error);
    return sendError(res, 500, 'Failed to create job template', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// PATCH /api/job-templates/:id
// Update job template
// ========================================
router.patch('/:id', requireAuth, requireRole('PROPERTY_MANAGER'), validate(templateUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.jobTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return sendError(res, 404, 'Job template not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Authorization: only owner can update
    if (existing.managerId !== req.user.id) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const template = await prisma.jobTemplate.update({
      where: { id },
      data,
    });

    res.json(template);
  } catch (error) {
    console.error('Error updating job template:', error);
    return sendError(res, 500, 'Failed to update job template', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// DELETE /api/job-templates/:id
// Delete job template
// ========================================
router.delete('/:id', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.jobTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return sendError(res, 404, 'Job template not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Authorization: only owner can delete
    if (existing.managerId !== req.user.id) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    await prisma.jobTemplate.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Job template deleted' });
  } catch (error) {
    console.error('Error deleting job template:', error);
    return sendError(res, 500, 'Failed to delete job template', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/job-templates/:id/use
// Create job from template
// ========================================
router.post('/:id/use', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyId, unitId, scheduledDate, assignedToId, notes } = req.body;

    if (!propertyId) {
      return sendError(res, 400, 'Property ID is required', ErrorCodes.VAL_MISSING_FIELD);
    }

    const template = await prisma.jobTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return sendError(res, 404, 'Job template not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Authorization: only owner can use
    if (template.managerId !== req.user.id) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Verify property exists and belongs to manager
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property || property.managerId !== req.user.id) {
      return sendError(res, 403, 'Property not found or access denied', ErrorCodes.ACC_PROPERTY_ACCESS_DENIED);
    }

    // Create job from template
    const job = await prisma.job.create({
      data: {
        title: template.name,
        description: template.description,
        priority: template.priority,
        status: assignedToId ? 'ASSIGNED' : 'OPEN',
        propertyId,
        unitId: unitId || null,
        assignedToId: assignedToId || null,
        createdById: req.user.id,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        estimatedCost: template.estimatedCost || null,
        notes: notes
          ? `${template.instructions || ''}\n\n${notes}`.trim()
          : template.instructions || null,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Increment template usage count
    await prisma.jobTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });

    // Notify assigned technician if applicable
    if (assignedToId && job.assignedTo) {
      try {
        const { notifyJobAssigned } = await import('../utils/notificationService.js');
        await notifyJobAssigned(job, job.assignedTo, job.property);
      } catch (notifError) {
        console.error('Failed to send job assignment notification:', notifError);
      }
    }

    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job from template:', error);
    return sendError(res, 500, 'Failed to create job from template', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
