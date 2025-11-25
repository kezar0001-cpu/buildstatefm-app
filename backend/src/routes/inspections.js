import { Router } from 'express';
import { z } from 'zod';

import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole, requireActiveSubscription } from '../middleware/auth.js';
import { notifyInspectionCompleted, notifyInspectionReminder } from '../utils/notificationService.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = Router();

// Roles from Prisma schema
const ROLE_MANAGER = 'PROPERTY_MANAGER';
const ROLE_OWNER = 'OWNER';
const ROLE_TECHNICIAN = 'TECHNICIAN';
const ROLE_TENANT = 'TENANT';

const SORTABLE_FIELDS = {
  scheduledDate: 'scheduledDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  status: 'status',
  title: 'title',
};

const DEFAULT_SORT = { scheduledDate: 'asc' };

const INSPECTION_STATUS = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const INSPECTION_TYPES = ['ROUTINE', 'MOVE_IN', 'MOVE_OUT', 'EMERGENCY', 'COMPLIANCE'];

const baseInspectionInclude = {
  property: {
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
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
  completedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  attachments: {
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      url: true,
      name: true,
      mimeType: true,
      size: true,
      annotations: true,
      createdAt: true,
      uploadedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  reminders: {
    orderBy: { remindAt: 'asc' },
  },
  report: true,
  jobs: {
    select: { id: true, title: true, status: true },
    orderBy: { createdAt: 'desc' },
  },
};

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
});

const inspectionUpdateSchema = inspectionCreateSchema.partial();

const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative().optional(),
  annotations: z.any().optional(),
});

const reminderSchema = z.object({
  remindAt: z.preprocess((val) => (val ? new Date(val) : val), z.date()),
  channel: z.enum(['IN_APP', 'EMAIL']).default('IN_APP'),
  recipients: z.array(z.string().min(1)).optional(),
  note: z.string().optional().nullable(),
});

const jobFromInspectionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  assignedToId: z.string().optional().nullable(),
  scheduledDate: z
    .preprocess((val) => (val ? new Date(val) : val), z.date())
    .optional(),
});

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function parseSort(sortBy, sortOrder) {
  const field = SORTABLE_FIELDS[sortBy];
  if (!field) return DEFAULT_SORT;
  const direction = sortOrder === 'desc' ? 'desc' : 'asc';
  return { [field]: direction };
}

/**
 * Parse inspection findings and extract high-priority issues
 * Looks for patterns like:
 * - "HIGH: description" or "[HIGH] description"
 * - "URGENT: description" or "[URGENT] description"
 * - Lines containing keywords like "critical", "immediate", "safety hazard"
 */
function parseHighPriorityFindings(findingsText) {
  if (!findingsText || typeof findingsText !== 'string') {
    return [];
  }

  const findings = [];
  const lines = findingsText.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for explicit priority markers
    const urgentMatch = trimmedLine.match(/^(?:\[?URGENT\]?:?\s*)(.*)/i);
    const highMatch = trimmedLine.match(/^(?:\[?HIGH\]?:?\s*)(.*)/i);

    if (urgentMatch) {
      findings.push({
        priority: 'URGENT',
        description: urgentMatch[1].trim() || trimmedLine,
      });
    } else if (highMatch) {
      findings.push({
        priority: 'HIGH',
        description: highMatch[1].trim() || trimmedLine,
      });
    } else {
      // Check for implicit high-priority keywords
      const lowerLine = trimmedLine.toLowerCase();
      const criticalKeywords = ['critical', 'urgent', 'immediate', 'safety hazard', 'emergency', 'severe', 'dangerous'];

      if (criticalKeywords.some(keyword => lowerLine.includes(keyword))) {
        findings.push({
          priority: 'HIGH',
          description: trimmedLine,
        });
      }
    }
  }

  return findings;
}

function isAdmin(user) {
  return user?.role === ROLE_MANAGER;
}

function augmentUser(user) {
  const managedPropertyIds = user?.managedProperties?.map((property) => property.id) ?? [];
  const ownedPropertyIds = user?.ownedProperties?.map((record) => record.propertyId) ?? [];
  const tenantUnitIds = user?.tenantUnits?.filter((link) => link.isActive).map((link) => link.unitId) ?? [];

  return {
    ...user,
    managedPropertyIds,
    ownedPropertyIds,
    tenantUnitIds,
  };
}

function buildAccessWhere(user) {
  if (!user) return undefined;
  if (isAdmin(user)) return undefined;

  if (user.role === ROLE_MANAGER) {
    if (!user.managedPropertyIds.length) {
      return { propertyId: { in: ['__none__'] } };
    }
    return { propertyId: { in: user.managedPropertyIds } };
  }

  if (user.role === ROLE_OWNER) {
    if (!user.ownedPropertyIds.length) {
      return { propertyId: { in: ['__none__'] } };
    }
    return { propertyId: { in: user.ownedPropertyIds } };
  }

  if (user.role === ROLE_TENANT) {
    if (!user.tenantUnitIds.length) {
      return { unitId: { in: ['__none__'] } };
    }
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
    filters.push(accessFilter);
  }

  const { search, propertyId, unitId, status, inspectorId, inspector, dateFrom, dateTo, tags, tag } = query;

  if (propertyId) {
    filters.push({ propertyId });
  }

  if (unitId) {
    filters.push({ unitId });
  }

  if (status) {
    const statuses = Array.isArray(status)
      ? status
      : String(status)
          .split(',')
          .map((value) => value.trim().toUpperCase())
          .filter((value) => INSPECTION_STATUS.includes(value));

    if (statuses.length) {
      filters.push({ status: { in: statuses } });
    }
  }

  if (inspectorId) {
    filters.push({ assignedToId: inspectorId });
  }

  if (inspector) {
    const searchTerm = String(inspector).trim();
    if (searchTerm) {
      filters.push({
        assignedTo: {
          OR: [
            { firstName: { contains: searchTerm, mode: 'insensitive' } },
            { lastName: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      });
    }
  }

  if (search) {
    const value = String(search).trim();
    if (value) {
      filters.push({
        OR: [
          { title: { contains: value, mode: 'insensitive' } },
          { notes: { contains: value, mode: 'insensitive' } },
          { findings: { contains: value, mode: 'insensitive' } },
        ],
      });
    }
  }

  const tagList = [];
  if (tag) tagList.push(tag);
  if (tags) {
    if (Array.isArray(tags)) {
      tagList.push(...tags);
    } else {
      tagList.push(
        ...String(tags)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      );
    }
  }
  if (tagList.length) {
    filters.push({ tags: { hasEvery: tagList } });
  }

  const range = {};
  if (dateFrom) {
    const parsed = new Date(dateFrom);
    if (isValidDate(parsed)) range.gte = parsed;
  }
  if (dateTo) {
    const parsed = new Date(dateTo);
    if (isValidDate(parsed)) range.lte = parsed;
  }
  if (Object.keys(range).length) {
    filters.push({ scheduledDate: range });
  }

  if (!filters.length) {
    return {};
  }

  return { AND: filters };
}

async function logAudit(inspectionId, userId, action, changes = null) {
  try {
    await prisma.inspectionAuditLog.create({
      data: {
        inspectionId,
        userId: userId || null,
        action,
        changes,
      },
    });
  } catch (error) {
    console.error('Failed to persist inspection audit log', error);
  }
}

/**
 * Log inspection action to audit trail
 * This is an alias for logAudit to support room-based inspection actions
 */
async function logInspectionAction(inspectionId, userId, action, changes = null) {
  return logAudit(inspectionId, userId, action, changes);
}

function canAccessInspection(user, inspection) {
  if (!user || !inspection) return false;
  if (isAdmin(user)) return true;

  if (user.role === ROLE_MANAGER) {
    return inspection.propertyId ? user.managedPropertyIds.includes(inspection.propertyId) : true;
  }
  if (user.role === ROLE_OWNER) {
    return inspection.propertyId ? user.ownedPropertyIds.includes(inspection.propertyId) : false;
  }
  if (user.role === ROLE_TECHNICIAN) {
    return inspection.assignedToId === user.id;
  }
  if (user.role === ROLE_TENANT) {
    return inspection.unitId ? user.tenantUnitIds.includes(inspection.unitId) : false;
  }
  return false;
}

async function ensureInspectionAccess(req, res, next) {
  try {
    const inspection = await prisma.inspection.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        propertyId: true,
        unitId: true,
        assignedToId: true,
      },
    });

    if (!inspection) {
      return sendError(res, 404, 'Inspection not found', ErrorCodes.RES_INSPECTION_NOT_FOUND);
    }

    if (!canAccessInspection(req.user, inspection)) {
      return sendError(res, 403, 'Forbidden', ErrorCodes.ACC_ACCESS_DENIED);
    }

    req.inspection = inspection;
    next();
  } catch (error) {
    console.error('Failed to check inspection access', error);
    sendError(res, 500, 'Failed to verify permissions', ErrorCodes.ERR_INTERNAL_SERVER);
  }
}

async function sendReminderNotifications({ inspection, reminder, recipients, note }) {
  if (!recipients?.length) return;

  const title = `Inspection reminder: ${inspection.title}`;
  const message =
    note ||
    `Reminder that inspection "${inspection.title}" at ${inspection.property?.name ?? 'the property'} is scheduled for ${inspection.scheduledDate.toLocaleString()}.`;

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: 'INSPECTION_REMINDER',
      title,
      message,
      entityType: 'inspection',
      entityId: inspection.id,
    })),
  });

  if (reminder.channel === 'EMAIL') {
    // Send email reminders to all recipients
    for (const recipientId of recipients) {
      try {
        const recipient = await prisma.user.findUnique({
          where: { id: recipientId },
          select: { id: true, firstName: true, lastName: true, email: true },
        });

        if (recipient && inspection.property) {
          await notifyInspectionReminder(inspection, recipient, inspection.property);
        }
      } catch (emailError) {
        console.error(`Failed to send email reminder to user ${recipientId}:`, emailError);
        // Continue sending to other recipients even if one fails
      }
    }
  }
}

const hydrateInspectionUser = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 401, 'Unauthorized', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        managedProperties: { select: { id: true } },
        ownedProperties: { select: { propertyId: true } },
        tenantUnits: { select: { unitId: true, isActive: true } },
      },
    });

    if (!user) {
      return sendError(res, 401, 'User not found', ErrorCodes.AUTH_UNAUTHORIZED);
    }

    req.user = augmentUser(user);
    next();
  } catch (error) {
    console.error('Failed to hydrate inspection user', error);
    return sendError(res, 401, 'Unauthorized', ErrorCodes.AUTH_UNAUTHORIZED);
  }
};

router.use(requireAuth);
router.use(hydrateInspectionUser);

router.get('/inspectors', async (req, res) => {
  try {
    const inspectors = await prisma.user.findMany({
      where: { role: ROLE_TECHNICIAN },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    res.json({ inspectors });
  } catch (error) {
    console.error('Failed to fetch inspectors', error);
    sendError(res, 500, 'Failed to load inspectors', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.get('/tags', async (req, res) => {
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
});

router.get('/analytics', async (req, res) => {
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
});

router.get('/calendar', async (req, res) => {
  try {
    const where = buildInspectionWhere(req.query, req.user);
    const { start, end } = req.query;
    const range = {};

    if (start) {
      const parsed = new Date(start);
      if (isValidDate(parsed)) range.gte = parsed;
    }
    if (end) {
      const parsed = new Date(end);
      if (isValidDate(parsed)) range.lte = parsed;
    }
    if (Object.keys(range).length) {
      where.AND = where.AND || [];
      where.AND.push({ scheduledDate: range });
    }

    const inspections = await prisma.inspection.findMany({
      where,
      include: baseInspectionInclude,
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
});

router.get('/', async (req, res) => {
  try {
    const where = buildInspectionWhere(req.query, req.user);

    // Parse pagination parameters
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const orderBy = parseSort(req.query.sortBy, req.query.sortOrder);

    const [items, total] = await Promise.all([
      prisma.inspection.findMany({
        where,
        include: baseInspectionInclude,
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.inspection.count({ where }),
    ]);

    // Calculate page number and hasMore
    const page = Math.floor(offset / limit) + 1;
    const hasMore = offset + limit < total;

    // Return paginated response
    res.json({
      items,
      total,
      page,
      hasMore,
    });
  } catch (error) {
    console.error('Failed to fetch inspections', error);
    sendError(res, 500, 'Failed to load inspections', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST / - Create inspection (requires active subscription)
router.post('/', requireAuth, requireRole(ROLE_MANAGER), requireActiveSubscription, async (req, res) => {
  try {
    const payload = inspectionCreateSchema.parse(req.body);

    const inspection = await prisma.inspection.create({
      data: {
        ...payload,
        scheduledDate: payload.scheduledDate,
        tags: payload.tags ?? [],
      },
      include: baseInspectionInclude,
    });

    await logAudit(inspection.id, req.user.id, 'CREATED', { after: inspection });

    res.status(201).json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to create inspection', error);
    sendError(res, 500, 'Failed to create inspection', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.get('/:id', ensureInspectionAccess, async (req, res) => {
  try {
    const inspection = await prisma.inspection.findUnique({
      where: { id: req.params.id },
      include: {
        ...baseInspectionInclude,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
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
});

router.patch(
  '/:id',
  requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_MANAGER),
  ensureInspectionAccess,
  async (req, res) => {
  try {
    const payload = inspectionUpdateSchema.parse(req.body);

    const before = await prisma.inspection.findUnique({ where: { id: req.params.id } });
    const inspection = await prisma.inspection.update({
      where: { id: req.params.id },
      data: {
        ...payload,
        scheduledDate: payload.scheduledDate ?? undefined,
        tags: payload.tags ?? undefined,
      },
      include: baseInspectionInclude,
    });

    await logAudit(inspection.id, req.user.id, 'UPDATED', { before, after: inspection });

    res.json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to update inspection', error);
    sendError(res, 500, 'Failed to update inspection', ErrorCodes.ERR_INTERNAL_SERVER);
  }
  },
);

router.delete('/:id', requireRole(ROLE_MANAGER, ROLE_MANAGER), ensureInspectionAccess, async (req, res) => {
  try {
    const inspection = await prisma.inspection.delete({ where: { id: req.params.id } });
    await logAudit(inspection.id, req.user.id, 'DELETED', { before: inspection });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete inspection', error);
    sendError(res, 500, 'Failed to delete inspection', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.post(
  '/:id/complete',
  requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_MANAGER),
  ensureInspectionAccess,
  async (req, res) => {
  try {
    const payload = z
      .object({
        findings: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        tags: z.array(z.string()).optional(),
        autoCreateJobs: z.boolean().optional().default(true),
        previewOnly: z.boolean().optional().default(false),
      })
      .parse(req.body);

    const before = await prisma.inspection.findUnique({
      where: { id: req.params.id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
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
        completedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!before) {
      return sendError(res, 404, 'Inspection not found', ErrorCodes.RES_INSPECTION_NOT_FOUND);
    }

    // Parse findings to identify high-priority issues
    const findingsText = payload.findings ?? before.findings ?? '';
    const highPriorityFindings = parseHighPriorityFindings(findingsText);

    // If preview mode, return the jobs that would be created without actually creating them
    if (payload.previewOnly) {
      const previewJobs = highPriorityFindings.map((finding, index) => ({
        title: `${before.title} - Follow-Up ${index + 1}`,
        description: finding.description,
        priority: finding.priority,
        propertyId: before.propertyId,
        unitId: before.unitId,
        inspectionId: before.id,
      }));

      return res.json({
        preview: true,
        followUpJobs: previewJobs,
        totalJobsToCreate: previewJobs.length,
      });
    }

    // Complete the inspection
    const inspection = await prisma.inspection.update({
      where: { id: req.params.id },
      data: {
        status: 'COMPLETED',
        completedDate: new Date(),
        completedById: req.user.id,
        findings: payload.findings ?? before.findings,
        notes: payload.notes ?? before.notes,
        tags: payload.tags ?? before.tags,
      },
      include: baseInspectionInclude,
    });

    await logAudit(inspection.id, req.user.id, 'COMPLETED', { before, after: inspection });

    // Auto-create follow-up jobs for high-priority findings
    const createdJobs = [];
    if (payload.autoCreateJobs && highPriorityFindings.length > 0) {
      for (const [index, finding] of highPriorityFindings.entries()) {
        try {
          const job = await prisma.job.create({
            data: {
              title: `${inspection.title} - Follow-Up ${index + 1}`,
              description: finding.description,
              priority: finding.priority,
              propertyId: inspection.propertyId,
              unitId: inspection.unitId,
              inspectionId: inspection.id,
              status: 'OPEN',
            },
          });

          createdJobs.push(job);
          await logAudit(inspection.id, req.user.id, 'JOB_CREATED', { jobId: job.id, priority: finding.priority });
        } catch (jobError) {
          console.error('Failed to create follow-up job', jobError);
          // Continue creating other jobs even if one fails
        }
      }
    }

    // Send email notification to property manager
    try {
      const propertyManager = before.property?.manager;
      const completedByUser = req.user.id === before.completedById
        ? before.completedBy
        : await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, firstName: true, lastName: true, email: true },
          });

      if (propertyManager && completedByUser) {
        await notifyInspectionCompleted(
          inspection,
          completedByUser,
          before.property,
          propertyManager,
          createdJobs
        );
      }
    } catch (notificationError) {
      console.error('Failed to send notification', notificationError);
      // Don't fail the request if notification fails
    }

    res.json({
      ...inspection,
      followUpJobsCreated: createdJobs.length,
      followUpJobs: createdJobs,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to complete inspection', error);
    sendError(res, 500, 'Failed to complete inspection', ErrorCodes.ERR_INTERNAL_SERVER);
  }
  },
);

router.post(
  '/:id/attachments',
  requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_MANAGER),
  ensureInspectionAccess,
  async (req, res) => {
  try {
    const parsed = z.object({ attachments: z.array(attachmentSchema).min(1) }).parse(req.body);

    const created = await prisma.$transaction(
      parsed.attachments.map((attachment) =>
        prisma.inspectionAttachment.create({
          data: {
            inspectionId: req.params.id,
            url: attachment.url,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size ?? null,
            annotations: attachment.annotations ?? null,
            uploadedById: req.user.id,
          },
        }),
      ),
    );

    await logAudit(req.params.id, req.user.id, 'ATTACHMENTS_ADDED', { attachments: created });

    res.status(201).json({ attachments: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to add attachments', error);
    sendError(res, 500, 'Failed to add attachments', ErrorCodes.ERR_INTERNAL_SERVER);
  }
  },
);

router.patch(
  '/:id/attachments/:attachmentId',
  requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_MANAGER),
  ensureInspectionAccess,
  async (req, res) => {
  try {
    const payload = z
      .object({
        annotations: z.any().optional(),
        name: z.string().min(1).optional(),
      })
      .parse(req.body);

    const attachment = await prisma.inspectionAttachment.update({
      where: { id: req.params.attachmentId },
      data: {
        annotations: payload.annotations ?? undefined,
        name: payload.name ?? undefined,
      },
    });

    await logAudit(req.params.id, req.user.id, 'ATTACHMENT_UPDATED', { attachment });

    res.json({ attachment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to update attachment', error);
    sendError(res, 500, 'Failed to update attachment', ErrorCodes.ERR_INTERNAL_SERVER);
  }
  },
);

router.delete(
  '/:id/attachments/:attachmentId',
  requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_MANAGER),
  ensureInspectionAccess,
  async (req, res) => {
  try {
    const attachment = await prisma.inspectionAttachment.delete({ where: { id: req.params.attachmentId } });
    await logAudit(req.params.id, req.user.id, 'ATTACHMENT_REMOVED', { attachment });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to remove attachment', error);
    sendError(res, 500, 'Failed to remove attachment', ErrorCodes.ERR_INTERNAL_SERVER);
  }
  },
);

router.post(
  '/:id/reminders',
  requireRole(ROLE_MANAGER, ROLE_MANAGER),
  ensureInspectionAccess,
  async (req, res) => {
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
      include: baseInspectionInclude,
    });

    await sendReminderNotifications({
      inspection,
      reminder,
      recipients: payload.recipients,
      note: payload.note,
    });

    await logAudit(req.params.id, req.user.id, 'REMINDER_CREATED', { reminder });

    res.status(201).json({ reminder });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to create reminder', error);
    sendError(res, 500, 'Failed to create reminder', ErrorCodes.ERR_INTERNAL_SERVER);
  }
  },
);

router.patch(
  '/:id/schedule',
  requireRole(ROLE_MANAGER, ROLE_MANAGER),
  ensureInspectionAccess,
  async (req, res) => {
  try {
    const payload = z
      .object({
        scheduledDate: z.preprocess((val) => (val ? new Date(val) : val), z.date()),
        status: z.enum(INSPECTION_STATUS).optional(),
      })
      .parse(req.body);

    const before = await prisma.inspection.findUnique({ where: { id: req.params.id } });

    const inspection = await prisma.inspection.update({
      where: { id: req.params.id },
      data: {
        scheduledDate: payload.scheduledDate,
        status: payload.status ?? before.status,
      },
      include: baseInspectionInclude,
    });

    await logAudit(req.params.id, req.user.id, 'SCHEDULE_UPDATED', { before, after: inspection });

    res.json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to reschedule inspection', error);
    sendError(res, 500, 'Failed to update schedule', ErrorCodes.ERR_INTERNAL_SERVER);
  }
  },
);

router.post(
  '/:id/jobs',
  requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_MANAGER),
  ensureInspectionAccess,
  async (req, res) => {
  try {
    const payload = jobFromInspectionSchema.parse(req.body);

    const inspection = await prisma.inspection.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        propertyId: true,
        unitId: true,
      },
    });

    if (!inspection) {
      return sendError(res, 404, 'Inspection not found', ErrorCodes.RES_INSPECTION_NOT_FOUND);
    }

    const job = await prisma.job.create({
      data: {
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        assignedToId: payload.assignedToId ?? null,
        scheduledDate: payload.scheduledDate ?? null,
        propertyId: inspection.propertyId,
        unitId: inspection.unitId,
        inspectionId: inspection.id,
      },
    });

    await logAudit(req.params.id, req.user.id, 'JOB_CREATED', { jobId: job.id });

    res.status(201).json({ job });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation failed', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to create job from inspection', error);
    sendError(res, 500, 'Failed to create job', ErrorCodes.ERR_INTERNAL_SERVER);
  }
  },
);

router.get(
  '/:id/audit',
  requireRole(ROLE_MANAGER, ROLE_TECHNICIAN, ROLE_MANAGER),
  ensureInspectionAccess,
  async (req, res) => {
  try {
    const logs = await prisma.inspectionAuditLog.findMany({
      where: { inspectionId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    res.json({ logs });
  } catch (error) {
    console.error('Failed to load audit history', error);
    sendError(res, 500, 'Failed to load audit logs', ErrorCodes.ERR_INTERNAL_SERVER);
  }
  },
);

// ===================================================
// ROOM-BASED INSPECTION ENDPOINTS
// ===================================================

// Add room to inspection
router.post(
  '/:id/rooms',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const { name, roomType, notes } = req.body;
      const inspectionId = req.params.id;

      // Get current room count for ordering
      const roomCount = await prisma.inspectionRoom.count({
        where: { inspectionId },
      });

      const room = await prisma.inspectionRoom.create({
        data: {
          inspectionId,
          name,
          roomType,
          notes,
          order: roomCount,
        },
        include: {
          checklistItems: true,
          issues: true,
          photos: true,
        },
      });

      // Log the action
      await logInspectionAction(inspectionId, req.user.id, 'ROOM_ADDED', { roomId: room.id, name });

      res.status(201).json({ room });
    } catch (error) {
      console.error('Failed to add room', error);
      sendError(res, 500, 'Failed to add room', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Get rooms for inspection
router.get(
  '/:id/rooms',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const rooms = await prisma.inspectionRoom.findMany({
        where: { inspectionId: req.params.id },
        orderBy: { order: 'asc' },
        include: {
          checklistItems: {
            orderBy: { order: 'asc' },
          },
          issues: {
            include: {
              photos: true,
            },
          },
          photos: {
            orderBy: { order: 'asc' },
          },
        },
      });
      res.json({ rooms });
    } catch (error) {
      console.error('Failed to load rooms', error);
      sendError(res, 500, 'Failed to load rooms', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Update room
router.patch(
  '/:id/rooms/:roomId',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const { name, roomType, notes, order } = req.body;
      const room = await prisma.inspectionRoom.update({
        where: { id: req.params.roomId },
        data: { name, roomType, notes, order },
        include: {
          checklistItems: true,
          issues: true,
          photos: true,
        },
      });

      await logInspectionAction(req.params.id, req.user.id, 'ROOM_UPDATED', { roomId: room.id });

      res.json({ room });
    } catch (error) {
      console.error('Failed to update room', error);
      sendError(res, 500, 'Failed to update room', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Delete room
router.delete(
  '/:id/rooms/:roomId',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      await prisma.inspectionRoom.delete({
        where: { id: req.params.roomId },
      });

      await logInspectionAction(req.params.id, req.user.id, 'ROOM_DELETED', { roomId: req.params.roomId });

      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete room', error);
      sendError(res, 500, 'Failed to delete room', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Add checklist item to room
router.post(
  '/:id/rooms/:roomId/checklist',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const { description, status, notes } = req.body;
      const roomId = req.params.roomId;

      const itemCount = await prisma.inspectionChecklistItem.count({
        where: { roomId },
      });

      const item = await prisma.inspectionChecklistItem.create({
        data: {
          roomId,
          description,
          status: status || 'PENDING',
          notes,
          order: itemCount,
        },
      });

      await logInspectionAction(req.params.id, req.user.id, 'CHECKLIST_ITEM_ADDED', { itemId: item.id });

      res.status(201).json({ item });
    } catch (error) {
      console.error('Failed to add checklist item', error);
      sendError(res, 500, 'Failed to add checklist item', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Update checklist item
router.patch(
  '/:id/rooms/:roomId/checklist/:itemId',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const { description, status, notes, order } = req.body;
      const item = await prisma.inspectionChecklistItem.update({
        where: { id: req.params.itemId },
        data: { description, status, notes, order },
      });

      await logInspectionAction(req.params.id, req.user.id, 'CHECKLIST_ITEM_UPDATED', { itemId: item.id, status });

      res.json({ item });
    } catch (error) {
      console.error('Failed to update checklist item', error);
      sendError(res, 500, 'Failed to update checklist item', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Delete checklist item
router.delete(
  '/:id/rooms/:roomId/checklist/:itemId',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      await prisma.inspectionChecklistItem.delete({
        where: { id: req.params.itemId },
      });

      await logInspectionAction(req.params.id, req.user.id, 'CHECKLIST_ITEM_DELETED', { itemId: req.params.itemId });

      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete checklist item', error);
      sendError(res, 500, 'Failed to delete checklist item', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Add issue to inspection
router.post(
  '/:id/issues',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const { roomId, checklistItemId, title, description, severity, status } = req.body;
      const inspectionId = req.params.id;

      const issue = await prisma.inspectionIssue.create({
        data: {
          inspectionId,
          roomId,
          checklistItemId,
          title,
          description,
          severity: severity || 'MEDIUM',
          status: status || 'OPEN',
        },
        include: {
          room: true,
          checklistItem: true,
          photos: true,
        },
      });

      await logInspectionAction(inspectionId, req.user.id, 'ISSUE_ADDED', { issueId: issue.id, severity });

      res.status(201).json({ issue });
    } catch (error) {
      console.error('Failed to add issue', error);
      sendError(res, 500, 'Failed to add issue', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Get issues for inspection
router.get(
  '/:id/issues',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const issues = await prisma.inspectionIssue.findMany({
        where: { inspectionId: req.params.id },
        include: {
          room: true,
          checklistItem: true,
          photos: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ issues });
    } catch (error) {
      console.error('Failed to load issues', error);
      sendError(res, 500, 'Failed to load issues', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Update issue
router.patch(
  '/:id/issues/:issueId',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const { title, description, severity, status } = req.body;
      const issue = await prisma.inspectionIssue.update({
        where: { id: req.params.issueId },
        data: { title, description, severity, status },
        include: {
          room: true,
          checklistItem: true,
          photos: true,
        },
      });

      await logInspectionAction(req.params.id, req.user.id, 'ISSUE_UPDATED', { issueId: issue.id });

      res.json({ issue });
    } catch (error) {
      console.error('Failed to update issue', error);
      sendError(res, 500, 'Failed to update issue', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Delete issue
router.delete(
  '/:id/issues/:issueId',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      await prisma.inspectionIssue.delete({
        where: { id: req.params.issueId },
      });

      await logInspectionAction(req.params.id, req.user.id, 'ISSUE_DELETED', { issueId: req.params.issueId });

      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete issue', error);
      sendError(res, 500, 'Failed to delete issue', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Add photo to inspection/room/issue
router.post(
  '/:id/photos',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const { roomId, issueId, url, caption } = req.body;
      const inspectionId = req.params.id;

      // Get photo count for ordering (per room or issue or general)
      let photoCount = 0;
      if (roomId) {
        photoCount = await prisma.inspectionPhoto.count({ where: { roomId } });
      } else if (issueId) {
        photoCount = await prisma.inspectionPhoto.count({ where: { issueId } });
      } else {
        photoCount = await prisma.inspectionPhoto.count({
          where: { inspectionId, roomId: null, issueId: null }
        });
      }

      const photo = await prisma.inspectionPhoto.create({
        data: {
          inspectionId,
          roomId,
          issueId,
          url,
          caption,
          order: photoCount,
          uploadedById: req.user.id,
        },
        include: {
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      await logInspectionAction(inspectionId, req.user.id, 'PHOTO_ADDED', { photoId: photo.id });

      res.status(201).json({ photo });
    } catch (error) {
      console.error('Failed to add photo', error);
      sendError(res, 500, 'Failed to add photo', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Get photos for inspection
router.get(
  '/:id/photos',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const photos = await prisma.inspectionPhoto.findMany({
        where: { inspectionId: req.params.id },
        orderBy: { order: 'asc' },
        include: {
          room: true,
          issue: true,
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      res.json({ photos });
    } catch (error) {
      console.error('Failed to load photos', error);
      sendError(res, 500, 'Failed to load photos', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Update photo
router.patch(
  '/:id/photos/:photoId',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      const { caption, order } = req.body;
      const photo = await prisma.inspectionPhoto.update({
        where: { id: req.params.photoId },
        data: { caption, order },
      });

      res.json({ photo });
    } catch (error) {
      console.error('Failed to update photo', error);
      sendError(res, 500, 'Failed to update photo', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

// Delete photo
router.delete(
  '/:id/photos/:photoId',
  requireAuth,
  ensureInspectionAccess,
  async (req, res) => {
    try {
      await prisma.inspectionPhoto.delete({
        where: { id: req.params.photoId },
      });

      await logInspectionAction(req.params.id, req.user.id, 'PHOTO_DELETED', { photoId: req.params.photoId });

      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete photo', error);
      sendError(res, 500, 'Failed to delete photo', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  },
);

export default router;
