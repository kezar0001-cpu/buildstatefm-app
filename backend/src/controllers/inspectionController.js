import { z } from 'zod';
import prisma from '../config/prismaClient.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { isValidInspectionTransition, getAllowedInspectionTransitions } from '../utils/statusTransitions.js';
import * as inspectionService from '../services/inspectionService.js';
import { generateAndUploadInspectionPDF } from '../services/pdfService.js';
import { sendNotification, notifyInspectionReminder } from '../utils/notificationService.js';
import { exportInspectionsToCSV, setCSVHeaders } from '../utils/exportUtils.js';

const ROLE_MANAGER = 'PROPERTY_MANAGER';
const ROLE_OWNER = 'OWNER';
const ROLE_TECHNICIAN = 'TECHNICIAN';
const ROLE_TENANT = 'TENANT';
const INSPECTION_STATUS = ['SCHEDULED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED'];
const INSPECTION_TYPES = ['ROUTINE', 'MOVE_IN', 'MOVE_OUT', 'EMERGENCY', 'COMPLIANCE'];

// Schemas
const inspectionCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(INSPECTION_TYPES),
  scheduledDate: z.preprocess((val) => (val ? new Date(val) : val), z.date()),
  propertyId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string().min(1)).optional().default([]),
  findings: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
});

const inspectionUpdateSchema = inspectionCreateSchema.partial();

const bulkInspectionSchema = z.object({
  unitIds: z.array(z.string().min(1)).min(1, 'At least one unit must be selected'),
  propertyId: z.string().min(1),
  inspectionType: z.enum(INSPECTION_TYPES),
  scheduledDate: z.preprocess((val) => (val ? new Date(val) : val), z.date()),
  templateId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const completeSchema = z.object({
  findings: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  autoCreateJobs: z.boolean().optional().default(true),
  previewOnly: z.boolean().optional().default(false),
});

const rejectSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
  reassignToId: z.string().optional()
});

// Access Control Helper (Internal)
function buildAccessWhere(user) {
  if (!user) return undefined;

  if (user.role === ROLE_MANAGER) {
    if (!user.managedPropertyIds?.length) return { propertyId: { in: ['__none__'] } };
    return { propertyId: { in: user.managedPropertyIds } };
  }
  if (user.role === ROLE_OWNER) {
    if (!user.ownedPropertyIds?.length) return { propertyId: { in: ['__none__'] } };
    return { propertyId: { in: user.ownedPropertyIds } };
  }
  if (user.role === ROLE_TENANT) {
    if (!user.tenantUnitIds?.length) return { unitId: { in: ['__none__'] } };
    return { unitId: { in: user.tenantUnitIds } };
  }
  if (user.role === ROLE_TECHNICIAN) {
    return { assignedToId: user.id };
  }
  return undefined;
}

function buildInspectionWhere(query, user) {
  const filters = [];
  const accessFilter = buildAccessWhere(user);
  if (accessFilter) {
    // Check if accessFilter would result in no results (empty array)
    if (accessFilter.propertyId?.in && accessFilter.propertyId.in.includes('__none__')) {
      // User has no access - return a filter that matches nothing
      return { id: { in: [] } };
    }
    if (accessFilter.unitId?.in && accessFilter.unitId.in.includes('__none__')) {
      // User has no access - return a filter that matches nothing
      return { id: { in: [] } };
    }
    filters.push(accessFilter);
  }

  const { search, propertyId, unitId, status, inspectorId, inspector, assignedToId, dateFrom, dateTo, tags, tag, hasRejection } = query;

  if (propertyId) filters.push({ propertyId });
  if (unitId) filters.push({ unitId });

  if (status) {
    const statuses = Array.isArray(status)
      ? status
      : String(status).split(',').map(v => v.trim().toUpperCase()).filter(v => INSPECTION_STATUS.includes(v));
    if (statuses.length) filters.push({ status: { in: statuses } });
  }

  if (inspectorId) filters.push({ assignedToId: inspectorId });
  if (assignedToId) filters.push({ assignedToId: assignedToId });

  // Filter for rejected inspections (those with rejection reason)
  if (hasRejection === 'true' || hasRejection === true) {
    filters.push({ rejectionReason: { not: null } });
  }
  
  if (inspector) {
    const term = String(inspector).trim();
    if (term) {
      filters.push({
        assignedTo: {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
          ],
        },
      });
    }
  }

  if (search) {
    const val = String(search).trim();
    if (val) {
      filters.push({
        OR: [
          { title: { contains: val, mode: 'insensitive' } },
          { notes: { contains: val, mode: 'insensitive' } },
          { findings: { contains: val, mode: 'insensitive' } },
        ],
      });
    }
  }

  const tagList = [];
  if (tag) tagList.push(tag);
  if (tags) {
    if (Array.isArray(tags)) tagList.push(...tags);
    else tagList.push(...String(tags).split(',').map(v => v.trim()).filter(Boolean));
  }
  if (tagList.length) filters.push({ tags: { hasEvery: tagList } });

  const range = {};
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!isNaN(d.getTime())) range.gte = d;
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (!isNaN(d.getTime())) range.lte = d;
  }
  if (Object.keys(range).length) filters.push({ scheduledDate: range });

  return filters.length ? { AND: filters } : {};
}

// Controllers

export const listInspections = async (req, res) => {
  try {
    const where = buildInspectionWhere(req.query, req.user);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const sortField = req.query.sortBy || 'scheduledDate';
    const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';
    const orderBy = { [sortField]: sortOrder };

    // Phase 6: Handle CSV export
    if (req.query.format === 'csv') {
      // For CSV, fetch all inspections (respecting access control) without pagination
      const allInspections = await prisma.inspection.findMany({
        where,
        include: inspectionService.baseInspectionInclude,
        orderBy,
      });

      const csv = exportInspectionsToCSV(allInspections);
      setCSVHeaders(res, `inspections-export-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }

    const [items, total] = await Promise.all([
      prisma.inspection.findMany({
        where,
        include: inspectionService.baseInspectionInclude,
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.inspection.count({ where }),
    ]);

    res.json({
      items,
      total,
      page: Math.floor(offset / limit) + 1,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Failed to fetch inspections', error);
    sendError(res, 500, 'Failed to load inspections', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const getOverdueInspections = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Unauthorized', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const now = new Date();
    const accessFilter = buildAccessWhere(req.user);

    const where = {
      status: 'SCHEDULED',
      scheduledDate: {
        lt: now,
      },
    };

    // Only add access filter if it's valid (not undefined and not an empty array filter)
    if (accessFilter) {
      // Check if accessFilter would result in no results (empty array)
      if (accessFilter.propertyId?.in && accessFilter.propertyId.in.includes('__none__')) {
        // User has no access - return empty result
        return res.json({
          inspections: [],
          total: 0,
        });
      }
      Object.assign(where, accessFilter);
    }

    const inspections = await prisma.inspection.findMany({
      where,
      include: inspectionService.baseInspectionInclude,
      orderBy: { scheduledDate: 'asc' },
    });

    // Calculate days overdue for each inspection
    const overdueInspections = inspections.map(inspection => ({
      ...inspection,
      daysOverdue: Math.round((now - new Date(inspection.scheduledDate)) / (1000 * 60 * 60 * 24)),
    }));

    res.json({
      inspections: overdueInspections,
      total: overdueInspections.length,
    });
  } catch (error) {
    console.error('Failed to fetch overdue inspections', error);
    sendError(res, 500, 'Failed to load overdue inspections', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const getInspection = async (req, res) => {
  try {
    const inspection = await prisma.inspection.findUnique({
      where: { id: req.params.id },
      include: {
        ...inspectionService.baseInspectionInclude,
        InspectionAuditLog: {
          orderBy: { timestamp: 'desc' },
          include: { User: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });

    if (!inspection) {
      return sendError(res, 404, 'Inspection not found', ErrorCodes.RES_INSPECTION_NOT_FOUND);
    }

    res.json(inspection);
  } catch (error) {
    console.error('Failed to load inspection', error);
    sendError(res, 500, 'Failed to load inspection', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const createInspection = async (req, res) => {
  try {
    const payload = inspectionCreateSchema.parse(req.body);

    // Verify property exists and user has access
    if (payload.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: payload.propertyId },
        select: { id: true, managerId: true },
      });

      if (!property) {
        return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
      }

      // Verify unit exists and belongs to property if provided
      if (payload.unitId) {
        const unit = await prisma.unit.findFirst({
          where: {
            id: payload.unitId,
            propertyId: payload.propertyId,
          },
        });

        if (!unit) {
          return sendError(res, 400, 'Unit not found or does not belong to this property', ErrorCodes.RES_UNIT_NOT_FOUND);
        }
      }
    }

    let inspection;

    if (payload.templateId) {
      const template = await prisma.inspectionTemplate.findUnique({
        where: { id: payload.templateId },
        include: {
          InspectionTemplateRoom: {
            include: {
              InspectionTemplateChecklistItem: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!template) {
        return sendError(res, 404, 'Template not found', ErrorCodes.RES_NOT_FOUND);
      }

      inspection = await prisma.inspection.create({
        data: {
          ...payload,
          scheduledDate: payload.scheduledDate,
          tags: payload.tags ?? [],
          InspectionRoom: {
            create: template.InspectionTemplateRoom.map((room) => ({
              name: room.name,
              roomType: room.roomType,
              order: room.order,
              InspectionChecklistItem: {
                create: room.InspectionTemplateChecklistItem.map((item) => ({
                  description: item.description,
                  order: item.order,
                  status: 'PENDING',
                })),
              },
            })),
          },
        },
        include: inspectionService.baseInspectionInclude,
      });
    } else {
      inspection = await prisma.inspection.create({
        data: {
          ...payload,
          scheduledDate: payload.scheduledDate,
          tags: payload.tags ?? [],
        },
        include: inspectionService.baseInspectionInclude,
      });
    }

    await inspectionService.logAudit(inspection.id, req.user.id, 'CREATED', { after: inspection });

    // Send notification if inspection is assigned to a technician
    if (inspection.assignedToId && inspection.assignedTo && inspection.property) {
      try {
        await sendNotification(
          inspection.assignedTo.id,
          'INSPECTION_SCHEDULED',
          'New Inspection Assigned',
          `You have been assigned to inspection: ${inspection.title} at ${inspection.property.name}`,
          {
            entityType: 'inspection',
            entityId: inspection.id,
            emailData: {
              technicianName: `${inspection.assignedTo.firstName} ${inspection.assignedTo.lastName}`,
              inspectionTitle: inspection.title,
              propertyName: inspection.property.name,
              inspectionType: inspection.type,
              scheduledDate: new Date(inspection.scheduledDate).toLocaleDateString(),
              inspectionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/inspections/${inspection.id}`,
            },
          }
        );
      } catch (notifError) {
        console.error('Failed to send inspection assignment notification:', notifError);
        // Don't fail the inspection creation if notification fails
      }
    }

    res.status(201).json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to create inspection', error);
    sendError(res, 500, 'Failed to create inspection', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const updateInspection = async (req, res) => {
  try {
    const payload = inspectionUpdateSchema.parse(req.body);
    const before = await prisma.inspection.findUnique({ where: { id: req.params.id } });
    
    if (!before) {
      return sendError(res, 404, 'Inspection not found', ErrorCodes.RES_INSPECTION_NOT_FOUND);
    }
    
    // Validate status transition if status is being changed
    if (payload.status !== undefined && payload.status !== before.status) {
      if (!isValidInspectionTransition(before.status, payload.status)) {
        const allowed = getAllowedInspectionTransitions(before.status);
        return sendError(
          res,
          400,
          `Invalid status transition from ${before.status} to ${payload.status}. Allowed transitions: ${allowed.join(', ') || 'none'}`,
          ErrorCodes.BIZ_INVALID_STATUS_TRANSITION
        );
      }
    }
    
    const inspection = await prisma.inspection.update({
      where: { id: req.params.id },
      data: {
        ...payload,
        scheduledDate: payload.scheduledDate ?? undefined,
        tags: payload.tags ?? undefined,
      },
      include: inspectionService.baseInspectionInclude,
    });

    // Send notification if assignment changed
    if (payload.assignedToId !== undefined && payload.assignedToId !== before.assignedToId) {
      if (inspection.assignedTo && inspection.property) {
        try {
          await sendNotification(
            inspection.assignedTo.id,
            'INSPECTION_SCHEDULED',
            'Inspection Assigned',
            `You have been assigned to inspection: ${inspection.title} at ${inspection.property.name}`,
            {
              entityType: 'inspection',
              entityId: inspection.id,
              emailData: {
                technicianName: `${inspection.assignedTo.firstName} ${inspection.assignedTo.lastName}`,
                inspectionTitle: inspection.title,
                propertyName: inspection.property.name,
                inspectionType: inspection.type,
                scheduledDate: new Date(inspection.scheduledDate).toLocaleDateString(),
                inspectionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/inspections/${inspection.id}`,
              },
            }
          );
        } catch (notifError) {
          console.error('Failed to send inspection assignment notification:', notifError);
        }
      }
    }

    await inspectionService.logAudit(inspection.id, req.user.id, 'UPDATED', { before, after: inspection });
    res.json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to update inspection', error);
    sendError(res, 500, 'Failed to update inspection', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const deleteInspection = async (req, res) => {
  try {
    const inspection = await prisma.inspection.delete({ where: { id: req.params.id } });
    await inspectionService.logAudit(inspection.id, req.user.id, 'DELETED', { before: inspection });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete inspection', error);
    sendError(res, 500, 'Failed to delete inspection', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const completeInspection = async (req, res) => {
  try {
    const payload = completeSchema.parse(req.body);
    const result = await inspectionService.completeInspection(req.params.id, req.user.id, req.user.role, payload);
    
    if (payload.previewOnly) {
      return res.json(result);
    }
    
    // Notification is handled in inspectionService.completeInspection
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to complete inspection', error);
    sendError(res, 500, error.message, ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const approveInspection = async (req, res) => {
  try {
    const result = await inspectionService.approveInspection(req.params.id, req.user.id);
    // Notification is handled in inspectionService.approveInspection
    res.json(result);
  } catch (error) {
    console.error('Failed to approve inspection', error);
    sendError(res, 500, error.message, ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const rejectInspection = async (req, res) => {
  try {
    const { rejectionReason, reassignToId } = rejectSchema.parse(req.body);
    const result = await inspectionService.rejectInspection(req.params.id, req.user.id, rejectionReason, reassignToId);
    // Notification is handled in inspectionService.rejectInspection
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to reject inspection', error);
    sendError(res, 500, error.message, ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const uploadSignature = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'Signature image is required', ErrorCodes.VAL_MISSING_FIELD);
    }
    const result = await inspectionService.uploadSignature(req.params.id, req.user.id, req.file.buffer, req.file.mimetype);
    res.json({ inspection: result });
  } catch (error) {
    console.error('Failed to upload signature', error);
    sendError(res, 500, error.message, ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const generatePDF = async (req, res) => {
  try {
    const inspection = await prisma.inspection.findUnique({
      where: { id: req.params.id },
      include: {
        property: true,
        unit: true,
        assignedTo: true,
        completedBy: true,
        InspectionRoom: {
          orderBy: { order: 'asc' },
          include: { InspectionChecklistItem: { orderBy: { order: 'asc' } } },
        },
        InspectionIssue: { orderBy: { createdAt: 'asc' } },
        InspectionPhoto: { orderBy: { order: 'asc' } },
      },
    });

    if (!inspection) return sendError(res, 404, 'Inspection not found', ErrorCodes.RES_INSPECTION_NOT_FOUND);

    const { url, key, path: localPath } = await generateAndUploadInspectionPDF({
      inspection,
      property: inspection.property,
      unit: inspection.unit,
      assignedTo: inspection.assignedTo,
      completedBy: inspection.completedBy,
    });

    await inspectionService.logAudit(req.params.id, req.user.id, 'PDF_GENERATED', { pdfUrl: url });
    
    res.json({
      message: 'PDF generated successfully',
      downloadUrl: url,
      pdfKey: key || localPath,
    });
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    sendError(res, 500, 'Failed to generate PDF report', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const getCalendar = async (req, res) => {
  try {
    const where = buildInspectionWhere(req.query, req.user);
    const { start, end } = req.query;
    const range = {};

    if (start) {
      const parsed = new Date(start);
      if (!isNaN(parsed.getTime())) range.gte = parsed;
    }
    if (end) {
      const parsed = new Date(end);
      if (!isNaN(parsed.getTime())) range.lte = parsed;
    }
    if (Object.keys(range).length) {
      where.AND = where.AND || [];
      where.AND.push({ scheduledDate: range });
    }

    const inspections = await prisma.inspection.findMany({
      where,
      include: inspectionService.baseInspectionInclude,
      orderBy: { scheduledDate: 'asc' },
    });

    const events = inspections.map((inspection) => ({
      id: inspection.id,
      title: inspection.title,
      start: inspection.scheduledDate,
      end: inspection.completedDate ?? inspection.scheduledDate,
      status: inspection.status,
      property: inspection.property?.name ?? null,
      unit: inspection.unit?.unitNumber ?? null,
    }));

    res.json({ events });
  } catch (error) {
    console.error('Failed to fetch calendar inspections', error);
    sendError(res, 500, 'Failed to load calendar data', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const where = buildInspectionWhere(req.query, req.user);
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [statusBreakdown, totalCount, overdueCount, upcomingCount, inspections] = await Promise.all([
      prisma.inspection.groupBy({
        where,
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.inspection.count({ where }),
      prisma.inspection.count({
        where: {
          ...where,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          scheduledDate: { lt: now },
        },
      }),
      prisma.inspection.count({
        where: {
          ...where,
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          scheduledDate: { gte: now, lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14) },
        },
      }),
      prisma.inspection.findMany({
        where,
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          completedDate: true,
          tags: true,
          findings: true,
        },
        orderBy: { scheduledDate: 'asc' },
      }),
    ]);

    const statusMap = statusBreakdown.reduce((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});

    const completed = statusMap.COMPLETED || 0;
    const completionRate = totalCount ? Math.round((completed / totalCount) * 100) : 0;

    const monthlyTrend = new Map();
    inspections.forEach((inspection) => {
      if (!inspection.completedDate) return;
      const key = `${inspection.completedDate.getFullYear()}-${String(inspection.completedDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyTrend.set(key, (monthlyTrend.get(key) || 0) + 1);
    });

    const monthlyData = Array.from(monthlyTrend.entries())
      .map(([key, value]) => ({ month: key, completed: value }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .filter((entry) => {
        const [year, month] = entry.month.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return date >= sixMonthsAgo;
      });

    const tagFrequency = new Map();
    inspections.forEach((inspection) => {
      (inspection.tags || []).forEach((value) => {
        tagFrequency.set(value, (tagFrequency.get(value) || 0) + 1);
      });
    });

    const recurringIssues = Array.from(tagFrequency.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    res.json({
      metrics: {
        total: totalCount,
        status: statusMap,
        completionRate,
        overdue: overdueCount,
        upcoming: upcomingCount,
      },
      charts: {
        monthlyCompletion: monthlyData,
        recurringIssues,
      },
    });
  } catch (error) {
    console.error('Failed to build inspection analytics', error);
    sendError(res, 500, 'Failed to load analytics', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const getTags = async (req, res) => {
  try {
    const where = buildInspectionWhere(req.query, req.user);
    const rows = await prisma.inspection.findMany({
      where,
      select: { tags: true },
    });
    const tagSet = new Set();
    rows.forEach((row) => {
      if (Array.isArray(row.tags)) {
        row.tags.forEach((value) => tagSet.add(value));
      }
    });
    res.json({ tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b)) });
  } catch (error) {
    console.error('Failed to fetch tags', error);
    sendError(res, 500, 'Failed to load tags', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

const reminderSchema = z.object({
  remindAt: z.preprocess((val) => (val ? new Date(val) : val), z.date()),
  channel: z.enum(['IN_APP', 'EMAIL']).default('IN_APP'),
  recipients: z.array(z.string().min(1)).optional(),
  note: z.string().optional().nullable(),
});

export const createReminder = async (req, res) => {
  try {
    const payload = reminderSchema.parse(req.body);

    const reminder = await prisma.inspectionReminder.create({
      data: {
        inspectionId: req.params.id,
        remindAt: payload.remindAt,
        channel: payload.channel,
        recipients: payload.recipients ?? [],
        metadata: payload.note ? { note: payload.note } : undefined,
        createdById: req.user.id,
      },
    });

    const inspection = await prisma.inspection.findUnique({
      where: { id: req.params.id },
      include: inspectionService.baseInspectionInclude,
    });

    // Send reminder notifications to specified recipients
    if (payload.recipients?.length && inspection.assignedTo && inspection.property) {
      try {
        // Send reminder to assigned technician if they're in the recipients list
        if (payload.recipients.includes(inspection.assignedTo.id)) {
          await notifyInspectionReminder(inspection, inspection.assignedTo, inspection.property);
        }
        
        // Send reminders to other recipients (e.g., property manager)
        const otherRecipients = payload.recipients.filter(id => id !== inspection.assignedTo?.id);
        for (const recipientId of otherRecipients) {
          try {
            const recipient = await prisma.user.findUnique({
              where: { id: recipientId },
              select: { id: true, firstName: true, lastName: true, email: true },
            });
            
            if (recipient) {
              await sendNotification(
                recipient.id,
                'INSPECTION_REMINDER',
                'Inspection Reminder',
                `Reminder: ${inspection.title} at ${inspection.property.name} is scheduled for ${new Date(inspection.scheduledDate).toLocaleDateString()}`,
                {
                  entityType: 'inspection',
                  entityId: inspection.id,
                  emailData: {
                    recipientName: `${recipient.firstName} ${recipient.lastName}`,
                    inspectionTitle: inspection.title,
                    propertyName: inspection.property.name,
                    scheduledDate: new Date(inspection.scheduledDate).toLocaleDateString(),
                    inspectionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/inspections/${inspection.id}`,
                  },
                }
              );
            }
          } catch (recipientError) {
            console.error(`Failed to send reminder to recipient ${recipientId}:`, recipientError);
          }
        }
      } catch (notifError) {
        console.error('Failed to send inspection reminder notifications:', notifError);
        // Don't fail reminder creation if notification fails
      }
    }

    await inspectionService.logAudit(req.params.id, req.user.id, 'REMINDER_CREATED', { reminder });

    res.status(201).json({ reminder });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to create reminder', error);
    sendError(res, 500, 'Failed to create reminder', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const bulkCreateInspections = async (req, res) => {
  try {
    const payload = bulkInspectionSchema.parse(req.body);

    // Verify property access
    const property = await prisma.property.findUnique({
      where: { id: payload.propertyId },
      select: { id: true, managerId: true, name: true },
    });

    if (!property) {
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_NOT_FOUND);
    }

    if (property.managerId !== req.user.id && req.user.role !== 'ADMIN') {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Verify all units belong to the property
    const units = await prisma.unit.findMany({
      where: {
        id: { in: payload.unitIds },
        propertyId: payload.propertyId,
      },
      select: { id: true, unitNumber: true },
    });

    if (units.length !== payload.unitIds.length) {
      return sendError(res, 400, 'Some units do not belong to this property', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Get active technicians for round-robin assignment
    const technicians = await prisma.user.findMany({
      where: {
        role: 'TECHNICIAN',
        isActive: true,
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    // Get template if specified
    let template = null;
    if (payload.templateId) {
      template = await prisma.inspectionTemplate.findUnique({
        where: { id: payload.templateId },
        include: {
          InspectionTemplateRoom: {
            include: {
              InspectionTemplateChecklistItem: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!template) {
        return sendError(res, 404, 'Template not found', ErrorCodes.RES_NOT_FOUND);
      }
    }

    // Create inspections with round-robin assignment
    const inspections = [];
    let technicianIndex = 0;

    for (const unit of units) {
      const assignedToId = technicians.length > 0
        ? technicians[technicianIndex % technicians.length].id
        : null;

      const inspectionData = {
        title: `${payload.inspectionType.replace(/_/g, ' ')} - Unit ${unit.unitNumber}`,
        type: payload.inspectionType,
        scheduledDate: payload.scheduledDate,
        propertyId: payload.propertyId,
        unitId: unit.id,
        assignedToId,
        notes: payload.notes || null,
        templateId: payload.templateId || null,
        tags: [],
      };

      if (template) {
        inspectionData.InspectionRoom = {
          create: template.InspectionTemplateRoom.map((room) => ({
            name: room.name,
            roomType: room.roomType,
            order: room.order,
            InspectionChecklistItem: {
              create: room.InspectionTemplateChecklistItem.map((item) => ({
                description: item.description,
                order: item.order,
                status: 'PENDING',
              })),
            },
          })),
        };
      }

      const inspection = await prisma.inspection.create({
        data: inspectionData,
        include: inspectionService.baseInspectionInclude,
      });

      await inspectionService.logAudit(inspection.id, req.user.id, 'CREATED', { after: inspection });

      inspections.push(inspection);
      technicianIndex++;
    }

    res.status(201).json({
      message: `Successfully created ${inspections.length} inspection(s)`,
      count: inspections.length,
      inspections,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to bulk create inspections', error);
    sendError(res, 500, 'Failed to create inspections', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};
