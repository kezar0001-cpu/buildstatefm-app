import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole, requireActiveSubscription } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get all inspection templates
router.get('/', requireAuth, async (req, res) => {
  try {
    const { type, propertyId, isActive } = req.query;

    const where = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    // Property managers can see default templates and their property-specific templates
    if (req.user.role === 'PROPERTY_MANAGER') {
      where.OR = [
        { isDefault: true },
        { propertyId: null },
        { propertyId: propertyId || undefined }
      ];
    }

    const templates = await prisma.inspectionTemplate.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true
          }
        },
        rooms: {
          include: {
            checklistItems: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            inspections: true
          }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching inspection templates:', error);
    return sendError(res, 500, 'Failed to fetch inspection templates', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Get a single inspection template
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const template = await prisma.inspectionTemplate.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true
          }
        },
        rooms: {
          include: {
            checklistItems: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!template) {
      return sendError(res, 404, 'Template not found', ErrorCodes.RES_NOT_FOUND);
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching inspection template:', error);
    return sendError(res, 500, 'Failed to fetch inspection template', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Create a new inspection template
router.post('/', requireAuth, requireRole('PROPERTY_MANAGER', 'ADMIN'), requireActiveSubscription, async (req, res) => {
  try {
    const { name, description, type, propertyId, rooms, isDefault } = req.body;

    if (!name || !type) {
      return sendError(res, 400, 'Name and type are required', ErrorCodes.VAL_MISSING_FIELD);
    }

    // Only admins can create default templates
    const templateData = {
      name,
      description,
      type,
      propertyId,
      isDefault: req.user.role === 'ADMIN' && isDefault ? true : false,
      createdById: req.user.id,
      rooms: {
        create: (rooms || []).map((room, roomIndex) => ({
          name: room.name,
          roomType: room.roomType,
          order: room.order !== undefined ? room.order : roomIndex,
          checklistItems: {
            create: (room.checklistItems || []).map((item, itemIndex) => ({
              description: item.description,
              order: item.order !== undefined ? item.order : itemIndex
            }))
          }
        }))
      }
    };

    const template = await prisma.inspectionTemplate.create({
      data: templateData,
      include: {
        property: {
          select: {
            id: true,
            name: true
          }
        },
        rooms: {
          include: {
            checklistItems: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating inspection template:', error);
    return sendError(res, 500, 'Failed to create inspection template', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Update an inspection template
router.patch('/:id', requireAuth, requireRole('PROPERTY_MANAGER', 'ADMIN'), requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, isDefault, rooms } = req.body;

    // Check if template exists
    const existingTemplate = await prisma.inspectionTemplate.findUnique({
      where: { id }
    });

    if (!existingTemplate) {
      return sendError(res, 404, 'Template not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Only admins can change isDefault
    if (req.user.role === 'ADMIN' && isDefault !== undefined) {
      updateData.isDefault = isDefault;
    }

    // If rooms are provided, update them
    if (rooms) {
      // Delete existing rooms and create new ones
      await prisma.inspectionTemplateRoom.deleteMany({
        where: { templateId: id }
      });

      updateData.rooms = {
        create: rooms.map((room, roomIndex) => ({
          name: room.name,
          roomType: room.roomType,
          order: room.order !== undefined ? room.order : roomIndex,
          checklistItems: {
            create: (room.checklistItems || []).map((item, itemIndex) => ({
              description: item.description,
              order: item.order !== undefined ? item.order : itemIndex
            }))
          }
        }))
      };
    }

    const template = await prisma.inspectionTemplate.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            name: true
          }
        },
        rooms: {
          include: {
            checklistItems: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    res.json(template);
  } catch (error) {
    console.error('Error updating inspection template:', error);
    return sendError(res, 500, 'Failed to update inspection template', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Delete an inspection template
router.delete('/:id', requireAuth, requireRole('PROPERTY_MANAGER', 'ADMIN'), requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template exists
    const template = await prisma.inspectionTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inspections: true,
            recurringInspections: true
          }
        }
      }
    });

    if (!template) {
      return sendError(res, 404, 'Template not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Prevent deletion if template is used in inspections or recurring schedules
    if (template._count.inspections > 0 || template._count.recurringInspections > 0) {
      return res.status(400).json({
        error: 'Cannot delete template that is being used in inspections or recurring schedules',
        details: {
          inspections: template._count.inspections,
          recurringInspections: template._count.recurringInspections
        }
      });
    }

    await prisma.inspectionTemplate.delete({
      where: { id }
    });

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting inspection template:', error);
    return sendError(res, 500, 'Failed to delete inspection template', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Duplicate an inspection template
router.post('/:id/duplicate', requireAuth, requireRole('PROPERTY_MANAGER', 'ADMIN'), requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, propertyId } = req.body;

    // Get the original template
    const originalTemplate = await prisma.inspectionTemplate.findUnique({
      where: { id },
      include: {
        rooms: {
          include: {
            checklistItems: true
          }
        }
      }
    });

    if (!originalTemplate) {
      return sendError(res, 404, 'Template not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Create a duplicate
    const duplicateTemplate = await prisma.inspectionTemplate.create({
      data: {
        name: name || `${originalTemplate.name} (Copy)`,
        description: originalTemplate.description,
        type: originalTemplate.type,
        propertyId: propertyId !== undefined ? propertyId : originalTemplate.propertyId,
        isDefault: false, // Duplicates are never default
        createdById: req.user.id,
        rooms: {
          create: originalTemplate.rooms.map((room, roomIndex) => ({
            name: room.name,
            roomType: room.roomType,
            order: room.order,
            checklistItems: {
              create: room.checklistItems.map((item, itemIndex) => ({
                description: item.description,
                order: item.order
              }))
            }
          }))
        }
      },
      include: {
        property: {
          select: {
            id: true,
            name: true
          }
        },
        rooms: {
          include: {
            checklistItems: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    res.status(201).json(duplicateTemplate);
  } catch (error) {
    console.error('Error duplicating inspection template:', error);
    return sendError(res, 500, 'Failed to duplicate inspection template', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
