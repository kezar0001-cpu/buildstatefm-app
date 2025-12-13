import express from 'express';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole, requireActiveSubscription } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = express.Router();

const requireActiveSubscriptionUnlessAdmin = (req, res, next) => {
  if (req.user?.role === 'ADMIN') {
    return next();
  }
  return requireActiveSubscription(req, res, next);
};

// Helper function to calculate next due date
function calculateNextDueDate(frequency, interval, startDate, dayOfMonth, dayOfWeek) {
  const date = new Date(startDate);

  switch (frequency) {
    case 'DAILY':
      date.setDate(date.getDate() + interval);
      break;
    case 'WEEKLY':
      date.setDate(date.getDate() + (interval * 7));
      if (dayOfWeek !== null && dayOfWeek !== undefined) {
        // Adjust to the specified day of week
        const currentDay = date.getDay();
        const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
        date.setDate(date.getDate() + daysToAdd);
      }
      break;
    case 'MONTHLY':
      date.setMonth(date.getMonth() + interval);
      if (dayOfMonth) {
        date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'QUARTERLY':
      date.setMonth(date.getMonth() + (interval * 3));
      break;
    case 'YEARLY':
      date.setFullYear(date.getFullYear() + interval);
      break;
  }

  return date;
}

// Helper function to generate preview of upcoming inspections
function generateInspectionPreview(recurringInspection, count = 5) {
  const previews = [];
  let currentDate = new Date(recurringInspection.nextDueDate);
  const endDate = recurringInspection.endDate ? new Date(recurringInspection.endDate) : null;

  for (let i = 0; i < count; i++) {
    if (endDate && currentDate > endDate) {
      break;
    }

    previews.push({
      scheduledDate: new Date(currentDate),
      title: recurringInspection.title,
      type: recurringInspection.type
    });

    currentDate = calculateNextDueDate(
      recurringInspection.frequency,
      recurringInspection.interval,
      currentDate,
      recurringInspection.dayOfMonth,
      recurringInspection.dayOfWeek
    );
  }

  return previews;
}

// Get all recurring inspections
router.get('/', requireAuth, async (req, res) => {
  try {
    const { propertyId, unitId, isActive } = req.query;

    const where = {};
    if (propertyId) where.propertyId = propertyId;
    if (unitId) where.unitId = unitId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const recurringInspections = await prisma.recurringInspection.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        unit: {
          select: {
            id: true,
            unitNumber: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        template: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            inspections: true
          }
        }
      },
      orderBy: { nextDueDate: 'asc' }
    });

    res.json(recurringInspections);
  } catch (error) {
    console.error('Error fetching recurring inspections:', error);
    res.status(500).json({ error: 'Failed to fetch recurring inspections' });
  }
});

// Get a single recurring inspection
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const recurringInspection = await prisma.recurringInspection.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        unit: {
          select: {
            id: true,
            unitNumber: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        inspections: {
          select: {
            id: true,
            title: true,
            scheduledDate: true,
            status: true,
            completedDate: true
          },
          orderBy: { scheduledDate: 'desc' },
          take: 10
        }
      }
    });

    if (!recurringInspection) {
      return res.status(404).json({ error: 'Recurring inspection not found' });
    }

    res.json(recurringInspection);
  } catch (error) {
    console.error('Error fetching recurring inspection:', error);
    res.status(500).json({ error: 'Failed to fetch recurring inspection' });
  }
});

// Preview upcoming inspections for a recurring schedule
router.post('/preview', requireAuth, async (req, res) => {
  try {
    const { frequency, interval, startDate, endDate, dayOfMonth, dayOfWeek, count = 10 } = req.body;

    if (!frequency || !interval || !startDate) {
      return res.status(400).json({ error: 'Frequency, interval, and start date are required' });
    }

    const recurringInspection = {
      frequency,
      interval: parseInt(interval),
      nextDueDate: startDate,
      endDate,
      dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : null,
      dayOfWeek: dayOfWeek !== null && dayOfWeek !== undefined ? parseInt(dayOfWeek) : null,
      title: 'Preview Inspection',
      type: 'ROUTINE'
    };

    const previews = generateInspectionPreview(recurringInspection, Math.min(count, 20));

    res.json({ previews });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// Create a new recurring inspection
router.post('/', requireAuth, requireRole('PROPERTY_MANAGER', 'ADMIN'), requireActiveSubscriptionUnlessAdmin, async (req, res) => {
  try {
    const {
      title,
      type,
      propertyId,
      unitId,
      assignedToId,
      frequency,
      interval,
      dayOfMonth,
      dayOfWeek,
      startDate,
      endDate,
      templateId
    } = req.body;

    if (!title || !type || !propertyId || !frequency || !interval || !startDate) {
      return res.status(400).json({
        error: 'Title, type, propertyId, frequency, interval, and startDate are required'
      });
    }

    // Calculate the first next due date
    const nextDueDate = calculateNextDueDate(
      frequency,
      parseInt(interval),
      new Date(startDate),
      dayOfMonth ? parseInt(dayOfMonth) : null,
      dayOfWeek !== null && dayOfWeek !== undefined ? parseInt(dayOfWeek) : null
    );

    const recurringInspection = await prisma.recurringInspection.create({
      data: {
        title,
        type,
        propertyId,
        unitId,
        assignedToId,
        frequency,
        interval: parseInt(interval),
        dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : null,
        dayOfWeek: dayOfWeek !== null && dayOfWeek !== undefined ? parseInt(dayOfWeek) : null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        nextDueDate,
        templateId
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        unit: {
          select: {
            id: true,
            unitNumber: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        template: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json(recurringInspection);
  } catch (error) {
    console.error('Error creating recurring inspection:', error);
    res.status(500).json({ error: 'Failed to create recurring inspection' });
  }
});

// Update a recurring inspection
router.patch('/:id', requireAuth, requireRole('PROPERTY_MANAGER', 'ADMIN'), requireActiveSubscriptionUnlessAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      assignedToId,
      frequency,
      interval,
      dayOfMonth,
      dayOfWeek,
      startDate,
      endDate,
      isActive,
      templateId
    } = req.body;

    // Check if recurring inspection exists
    const existing = await prisma.recurringInspection.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Recurring inspection not found' });
    }

    // Build update data
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (templateId !== undefined) updateData.templateId = templateId;

    // If recurrence settings are updated, recalculate next due date
    const recurrenceUpdated = frequency !== undefined || interval !== undefined ||
      dayOfMonth !== undefined || dayOfWeek !== undefined || startDate !== undefined;

    if (recurrenceUpdated) {
      const newFrequency = frequency || existing.frequency;
      const newInterval = interval !== undefined ? parseInt(interval) : existing.interval;
      const newDayOfMonth = dayOfMonth !== undefined ? (dayOfMonth ? parseInt(dayOfMonth) : null) : existing.dayOfMonth;
      const newDayOfWeek = dayOfWeek !== undefined ? (dayOfWeek !== null ? parseInt(dayOfWeek) : null) : existing.dayOfWeek;
      const newStartDate = startDate ? new Date(startDate) : existing.startDate;

      updateData.frequency = newFrequency;
      updateData.interval = newInterval;
      updateData.dayOfMonth = newDayOfMonth;
      updateData.dayOfWeek = newDayOfWeek;
      updateData.startDate = newStartDate;

      // Recalculate next due date
      updateData.nextDueDate = calculateNextDueDate(
        newFrequency,
        newInterval,
        new Date(),
        newDayOfMonth,
        newDayOfWeek
      );
    }

    if (endDate !== undefined) {
      updateData.endDate = endDate ? new Date(endDate) : null;
    }

    const recurringInspection = await prisma.recurringInspection.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        unit: {
          select: {
            id: true,
            unitNumber: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        template: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json(recurringInspection);
  } catch (error) {
    console.error('Error updating recurring inspection:', error);
    res.status(500).json({ error: 'Failed to update recurring inspection' });
  }
});

// Delete a recurring inspection
router.delete('/:id', requireAuth, requireRole('PROPERTY_MANAGER', 'ADMIN'), requireActiveSubscriptionUnlessAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if recurring inspection exists
    const recurringInspection = await prisma.recurringInspection.findUnique({
      where: { id }
    });

    if (!recurringInspection) {
      return res.status(404).json({ error: 'Recurring inspection not found' });
    }

    await prisma.recurringInspection.delete({
      where: { id }
    });

    res.json({ message: 'Recurring inspection deleted successfully' });
  } catch (error) {
    console.error('Error deleting recurring inspection:', error);
    res.status(500).json({ error: 'Failed to delete recurring inspection' });
  }
});

// Get preview of upcoming inspections for a specific recurring schedule
router.get('/:id/preview', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { count = 10 } = req.query;

    const recurringInspection = await prisma.recurringInspection.findUnique({
      where: { id }
    });

    if (!recurringInspection) {
      return res.status(404).json({ error: 'Recurring inspection not found' });
    }

    const previews = generateInspectionPreview(recurringInspection, Math.min(parseInt(count), 20));

    res.json({ previews });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

export default router;
