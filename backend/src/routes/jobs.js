import express from 'express';
import { z } from 'zod';
import validate from '../middleware/validate.js';
import { requireAuth, requireRole, requireActiveSubscription } from '../middleware/auth.js';
import { prisma } from '../config/prismaClient.js';
import { notifyJobAssigned, notifyJobCompleted, notifyJobStarted, notifyJobReassigned } from '../utils/notificationService.js';
import { invalidate } from '../utils/cache.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { isValidJobTransition, getAllowedJobTransitions, getTransitionErrorMessage } from '../utils/statusTransitions.js';
import { exportJobsToCSV, setCSVHeaders } from '../utils/exportUtils.js';

const router = express.Router();

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// Note: Status transition validation is now handled by statusTransitions.js utility

// Helper to invalidate dashboard cache for a user (with role pattern matching)
const invalidateDashboardCache = async (userId) => {
  // Invalidate all role variations of the dashboard cache
  // Note: Redis pattern matching requires redisDelPattern, but for now we'll invalidate common patterns
  const roles = ['PROPERTY_MANAGER', 'OWNER', 'TENANT', 'TECHNICIAN', 'ADMIN'];
  await Promise.all(
    roles.map(role => invalidate(`cache:/api/dashboard/summary:user:${userId}:role:${role}`))
  );
};

const jobCreateSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(PRIORITIES).optional().default('MEDIUM'),
  scheduledDate: z
    .string()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
      message: 'scheduledDate must be a valid ISO date string',
    }),
  assignedToId: z.string().optional(),
  estimatedCost: z.number().optional(),
  notes: z.string().optional(),
});

const jobUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  scheduledDate: z
    .string()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
      message: 'scheduledDate must be a valid ISO date string',
    }),
  assignedToId: z.string().optional().nullable(),
  estimatedCost: z.number().optional().nullable(),
  actualCost: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  evidence: z
    .object({
      subtasks: z
        .array(
          z.object({
            id: z.string().min(1),
            text: z.string().min(1),
            completed: z.boolean(),
          })
        )
        .optional(),
      attachments: z
        .array(
          z.object({
            id: z.string().min(1),
            name: z.string().min(1),
            url: z.string().url(),
            mimeType: z.string().optional(),
            uploadedAt: z.string().optional(),
          })
        )
        .optional(),
    })
    .passthrough()
    .optional(),
});

const bulkAssignSchema = z.object({
  jobIds: z.array(z.string().min(1)).min(1, 'Select at least one job'),
  technicianId: z.string().min(1, 'Technician is required'),
});

const bulkUpdateSchema = z.object({
  jobIds: z.array(z.string().min(1)).min(1, 'Select at least one job'),
  updates: jobUpdateSchema,
});

const bulkDeleteSchema = z.object({
  jobIds: z.array(z.string().min(1)).min(1, 'Select at least one job'),
});

const jobListQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  propertyId: z.string().optional(),
  assignedToId: z.string().optional(),
  filter: z.enum(['overdue', 'unassigned']).optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// GET / - List jobs (role-based filtering)
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      status,
      priority,
      propertyId,
      assignedToId,
      filter,
      search,
      limit: parsedLimit,
      offset: parsedOffset,
    } = jobListQuerySchema.parse(req.query);

    // Build where clause based on filters and user role
    const where = {};

    // Role-based filtering
    if (req.user.role === 'TECHNICIAN') {
      // Technicians only see jobs assigned to them
      where.assignedToId = req.user.id;
    } else if (req.user.role === 'PROPERTY_MANAGER') {
      // Property managers see jobs for their properties
      where.property = {
        managerId: req.user.id,
      };
    } else if (req.user.role === 'OWNER') {
      // Owners see jobs for properties they own
      where.property = {
        owners: {
          some: {
            ownerId: req.user.id,
          },
        },
      };
    }

    // Apply query filters
    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (assignedToId && (req.user.role === 'PROPERTY_MANAGER' || req.user.role === 'OWNER')) {
      // Only managers and owners can filter by assignedToId
      where.assignedToId = assignedToId;
    }

    // Apply search across relevant fields
    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      const searchFilter = { contains: normalizedSearch, mode: 'insensitive' };
      where.OR = [
        { title: searchFilter },
        { description: searchFilter },
        { notes: searchFilter },
        { property: { name: searchFilter } },
        { property: { address: searchFilter } },
        { property: { city: searchFilter } },
        { property: { state: searchFilter } },
        { unit: { unitNumber: searchFilter } },
        { assignedTo: { firstName: searchFilter } },
        { assignedTo: { lastName: searchFilter } },
      ];
    }

    // Apply special filters
    if (filter === 'overdue') {
      const overdueStatuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS'];

      if (where.status) {
        if (typeof where.status === 'string' && !overdueStatuses.includes(where.status)) {
          where.status = { in: [] };
        }
      } else {
        where.status = { in: overdueStatuses };
      }

      where.scheduledDate = { lt: new Date() };
    } else if (filter === 'unassigned') {
      if (where.assignedToId === undefined) {
        where.assignedToId = null;
      }

      if (!where.status) {
        where.status = 'OPEN';
      }
    }

    // Parse pagination parameters
    const limit = parsedLimit ?? 50;
    const offset = parsedOffset ?? 0;

    // Fetch jobs and total count in parallel
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
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
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    // Calculate page number and hasMore
    const page = Math.floor(offset / limit) + 1;
    const hasMore = offset + limit < total;

    // Return paginated response
    res.json({
      items: jobs,
      total,
      page,
      hasMore,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.errors);
    }

    console.error('Error fetching jobs:', error);
    return sendError(res, 500, 'Failed to fetch jobs', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST / - Create job (PROPERTY_MANAGER only, requires active subscription)
router.post('/', requireAuth, requireRole('PROPERTY_MANAGER'), requireActiveSubscription, validate(jobCreateSchema), async (req, res) => {
  try {
    const { propertyId, unitId, title, description, priority, scheduledDate, assignedToId, estimatedCost, notes } = req.body;
    
    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }
    
    // Verify unit exists if provided
    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
      });

      if (!unit) {
        return sendError(res, 404, 'Unit not found', ErrorCodes.RES_UNIT_NOT_FOUND);
      }
    }
    
    // Verify assigned user exists if provided
    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
      });

      if (!assignedUser) {
        return sendError(res, 404, 'Assigned user not found', ErrorCodes.RES_USER_NOT_FOUND);
      }
    }
    
    // Create job
    const job = await prisma.job.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        status: assignedToId ? 'ASSIGNED' : 'OPEN',
        propertyId,
        unitId: unitId || null,
        assignedToId: assignedToId || null,
        createdById: req.user.id,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        estimatedCost: estimatedCost || null,
        notes: notes || null,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
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
      },
    });
    
    // Send notification if job is assigned
    if (job.assignedToId && job.assignedTo) {
      try {
        await notifyJobAssigned(job, job.assignedTo, job.property);
      } catch (notifError) {
        console.error('Failed to send job assignment notification:', notifError);
        // Don't fail the job creation if notification fails
      }
    }

    // Invalidate dashboard cache for property manager
    await invalidateDashboardCache(req.user.id);

    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    return sendError(res, 500, 'Failed to create job', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /bulk-assign - Assign multiple jobs to a technician
router.post(
  '/bulk-assign',
  requireAuth,
  requireRole('PROPERTY_MANAGER'),
  requireActiveSubscription,
  validate(bulkAssignSchema),
  async (req, res) => {
    try {
      const { jobIds, technicianId } = req.body;
      const uniqueJobIds = [...new Set(jobIds)];

      const technician = await prisma.user.findUnique({
        where: { id: technicianId },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      });

      if (!technician || technician.role !== 'TECHNICIAN') {
        return sendError(res, 404, 'Technician not found', ErrorCodes.RES_USER_NOT_FOUND);
      }

      const jobs = await prisma.job.findMany({
        where: { id: { in: uniqueJobIds } },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              managerId: true,
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
        },
      });

      if (jobs.length !== uniqueJobIds.length) {
        return sendError(res, 404, 'One or more jobs not found', ErrorCodes.RES_JOB_NOT_FOUND);
      }

      const jobMap = new Map(jobs.map((job) => [job.id, job]));

      const unauthorizedJob = jobs.find((job) => job.property.managerId !== req.user.id);
      if (unauthorizedJob) {
        return sendError(res, 403, 'You can only assign jobs for your properties', ErrorCodes.ACC_ACCESS_DENIED);
      }

      const lockedJob = jobs.find((job) => ['COMPLETED', 'CANCELLED'].includes(job.status));
      if (lockedJob) {
        return sendError(res, 400, 'Completed or cancelled jobs cannot be reassigned', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
      }

      // Validate status transitions for jobs that will change from OPEN to ASSIGNED
      const invalidTransitionJob = jobs.find((job) => {
        if (job.status === 'OPEN') {
          // This job will transition from OPEN to ASSIGNED
          return !isValidJobTransition('OPEN', 'ASSIGNED');
        }
        return false;
      });

      if (invalidTransitionJob) {
        return sendError(
          res,
          400,
          getTransitionErrorMessage(invalidTransitionJob.status, 'ASSIGNED'),
          ErrorCodes.BIZ_OPERATION_NOT_ALLOWED
        );
      }

      // Phase 2: Check for scheduling conflicts (overlapping scheduled dates)
      const jobsWithScheduledDates = jobs.filter(job => job.scheduledDate);
      if (jobsWithScheduledDates.length > 0) {
        // Get existing jobs for this technician with overlapping scheduled dates
        const scheduledDates = jobsWithScheduledDates.map(job => new Date(job.scheduledDate));
        const minDate = new Date(Math.min(...scheduledDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...scheduledDates.map(d => d.getTime())));
        
        // Expand range by 1 day on each side to catch potential overlaps
        minDate.setDate(minDate.getDate() - 1);
        maxDate.setDate(maxDate.getDate() + 1);

        const conflictingJobs = await prisma.job.findMany({
          where: {
            assignedToId: technicianId,
            scheduledDate: {
              gte: minDate,
              lte: maxDate,
            },
            status: {
              notIn: ['COMPLETED', 'CANCELLED'],
            },
            id: {
              notIn: uniqueJobIds, // Exclude jobs being assigned
            },
          },
          select: {
            id: true,
            title: true,
            scheduledDate: true,
          },
        });

        if (conflictingJobs.length > 0) {
          const conflictDetails = conflictingJobs.map(job => ({
            id: job.id,
            title: job.title,
            scheduledDate: job.scheduledDate,
          }));
          
          return sendError(
            res,
            409,
            `Technician has ${conflictingJobs.length} conflicting job(s) scheduled at the same time. Please adjust the scheduled dates.`,
            ErrorCodes.BIZ_SCHEDULING_CONFLICT,
            { conflicts: conflictDetails }
          );
        }
      }

      const updatedJobs = await prisma.$transaction(
        uniqueJobIds.map((jobId) => {
          const currentJob = jobMap.get(jobId);
          const updateData = {
            assignedToId: technicianId,
          };

          if (currentJob?.status === 'OPEN') {
            updateData.status = 'ASSIGNED';
          }

          return prisma.job.update({
            where: { id: jobId },
            data: updateData,
            include: {
              property: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  managerId: true,
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
            },
          });
        })
      );

      try {
        // Batch fetch all previous technicians to avoid N+1 queries
        const previousTechnicianIds = new Set();
        updatedJobs.forEach((updatedJob) => {
          const previousJob = jobMap.get(updatedJob.id);
          if (previousJob?.assignedToId &&
              previousJob.assignedToId !== technicianId &&
              !previousJob.assignedTo) {
            previousTechnicianIds.add(previousJob.assignedToId);
          }
        });

        // Fetch all previous technicians in a single query
        const previousTechniciansMap = new Map();
        if (previousTechnicianIds.size > 0) {
          const previousTechnicians = await prisma.user.findMany({
            where: { id: { in: Array.from(previousTechnicianIds) } },
            select: { id: true, firstName: true, lastName: true, email: true },
          });
          previousTechnicians.forEach((tech) => {
            previousTechniciansMap.set(tech.id, tech);
          });
        }

        await Promise.all(
          updatedJobs.map(async (updatedJob) => {
            const previousJob = jobMap.get(updatedJob.id);
            if (!previousJob) return;

            if (previousJob.assignedToId === technicianId) {
              return;
            }

            if (previousJob.assignedToId) {
              // Use cached assignedTo or look up from batch-fetched map
              let previousTechnician = previousJob.assignedTo ||
                previousTechniciansMap.get(previousJob.assignedToId);

              if (previousTechnician && updatedJob.assignedTo) {
                await notifyJobReassigned(updatedJob, previousTechnician, updatedJob.assignedTo, updatedJob.property);
              }
            } else if (updatedJob.assignedTo) {
              await notifyJobAssigned(updatedJob, updatedJob.assignedTo, updatedJob.property);
            }
          })
        );
      } catch (notifError) {
        console.error('Failed to send bulk assignment notifications:', notifError);
      }

      // Invalidate dashboard cache for property manager
      await invalidateDashboardCache(req.user.id);

      res.json({ success: true, jobs: updatedJobs });
    } catch (error) {
      console.error('Error bulk assigning jobs:', error);
      return sendError(res, 500, 'Failed to assign jobs', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  }
);

// Phase 4: PATCH /bulk - Bulk update multiple jobs
router.patch(
  '/bulk',
  requireAuth,
  requireRole('PROPERTY_MANAGER'),
  requireActiveSubscription,
  validate(bulkUpdateSchema),
  async (req, res) => {
    try {
      const { jobIds, updates } = req.body;
      const uniqueJobIds = [...new Set(jobIds)];

      // Fetch jobs to verify access
      const jobs = await prisma.job.findMany({
        where: { id: { in: uniqueJobIds } },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              managerId: true,
            },
          },
        },
      });

      if (jobs.length !== uniqueJobIds.length) {
        return sendError(res, 404, 'One or more jobs not found', ErrorCodes.RES_JOB_NOT_FOUND);
      }

      // Verify user has access to all jobs
      const unauthorizedJob = jobs.find((job) => job.property.managerId !== req.user.id);
      if (unauthorizedJob) {
        return sendError(res, 403, 'You can only update jobs for your properties', ErrorCodes.ACC_ACCESS_DENIED);
      }

      // Validate status transitions if status is being updated
      if (updates.status) {
        const invalidTransitionJob = jobs.find((job) => {
          if (job.status !== updates.status) {
            return !isValidJobTransition(job.status, updates.status);
          }
          return false;
        });

        if (invalidTransitionJob) {
          return sendError(
            res,
            400,
            getTransitionErrorMessage(invalidTransitionJob.status, updates.status),
            ErrorCodes.BIZ_INVALID_STATUS_TRANSITION
          );
        }
      }

      // Perform bulk update
      const updatedJobs = await prisma.job.updateMany({
        where: { id: { in: uniqueJobIds } },
        data: {
          ...updates,
          scheduledDate: updates.scheduledDate ? new Date(updates.scheduledDate) : undefined,
        },
      });

      // Invalidate dashboard cache
      await invalidateDashboardCache(req.user.id);

      res.json({
        success: true,
        message: `Updated ${updatedJobs.count} job(s)`,
        count: updatedJobs.count,
      });
    } catch (error) {
      console.error('Error bulk updating jobs:', error);
      return sendError(res, 500, 'Failed to update jobs', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  }
);

// Phase 4: DELETE /bulk - Bulk delete multiple jobs
router.delete(
  '/bulk',
  requireAuth,
  requireRole('PROPERTY_MANAGER'),
  requireActiveSubscription,
  validate(bulkDeleteSchema),
  async (req, res) => {
    try {
      const { jobIds } = req.body;
      const uniqueJobIds = [...new Set(jobIds)];

      // Fetch jobs to verify access
      const jobs = await prisma.job.findMany({
        where: { id: { in: uniqueJobIds } },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              managerId: true,
            },
          },
        },
      });

      if (jobs.length !== uniqueJobIds.length) {
        return sendError(res, 404, 'One or more jobs not found', ErrorCodes.RES_JOB_NOT_FOUND);
      }

      // Verify user has access to all jobs
      const unauthorizedJob = jobs.find((job) => job.property.managerId !== req.user.id);
      if (unauthorizedJob) {
        return sendError(res, 403, 'You can only delete jobs for your properties', ErrorCodes.ACC_ACCESS_DENIED);
      }

      // Prevent deletion of completed or in-progress jobs
      const lockedJob = jobs.find((job) => ['COMPLETED', 'IN_PROGRESS'].includes(job.status));
      if (lockedJob) {
        return sendError(
          res,
          400,
          'Completed or in-progress jobs cannot be deleted',
          ErrorCodes.BIZ_OPERATION_NOT_ALLOWED
        );
      }

      // Perform bulk delete
      const deletedJobs = await prisma.job.deleteMany({
        where: {
          id: { in: uniqueJobIds },
          status: { notIn: ['COMPLETED', 'IN_PROGRESS'] },
        },
      });

      // Invalidate dashboard cache
      await invalidateDashboardCache(req.user.id);

      res.json({
        success: true,
        message: `Deleted ${deletedJobs.count} job(s)`,
        count: deletedJobs.count,
      });
    } catch (error) {
      console.error('Error bulk deleting jobs:', error);
      return sendError(res, 500, 'Failed to delete jobs', ErrorCodes.ERR_INTERNAL_SERVER);
    }
  }
);

// PATCH /:id/status - Quick status update endpoint
const statusUpdateSchema = z.object({
  status: z.enum(STATUSES),
});

router.patch('/:id/status', requireAuth, requireRole('PROPERTY_MANAGER', 'TECHNICIAN'), requireActiveSubscription, validate(statusUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Fetch existing job with related data
    const existingJob = await prisma.job.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            managerId: true,
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
      },
    });

    if (!existingJob) {
      return sendError(res, 404, 'Job not found', ErrorCodes.RES_JOB_NOT_FOUND);
    }

    // Access control: Technicians can only update jobs assigned to them
    if (req.user.role === 'TECHNICIAN') {
      if (existingJob.assignedToId !== req.user.id) {
        return sendError(res, 403, 'You can only update jobs assigned to you', ErrorCodes.ACC_ACCESS_DENIED);
      }
    }

    // Property managers can only update jobs for their properties
    if (req.user.role === 'PROPERTY_MANAGER') {
      if (existingJob.property.managerId !== req.user.id) {
        return sendError(res, 403, 'You can only update jobs for your properties', ErrorCodes.ACC_ACCESS_DENIED);
      }
    }

    // No change needed
    if (existingJob.status === status) {
      return res.json(existingJob);
    }

    // Validate status transition using state machine
    if (!isValidJobTransition(existingJob.status, status)) {
      return sendError(
        res,
        400,
        getTransitionErrorMessage(existingJob.status, status),
        ErrorCodes.BIZ_OPERATION_NOT_ALLOWED
      );
    }

    // Prepare update data
    const updateData = { status };

    // If status is being set to COMPLETED, set completedDate
    if (status === 'COMPLETED' && !existingJob.completedDate) {
      updateData.completedDate = new Date();
    }

    // Update job
    const job = await prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            managerId: true,
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
      },
    });

    // Send notifications for status transitions
    try {
      // Job completion notification
      if (status === 'COMPLETED' && existingJob.status !== 'COMPLETED') {
        if (job.property.managerId) {
          const manager = await prisma.user.findUnique({
            where: { id: job.property.managerId },
            select: { id: true, firstName: true, lastName: true, email: true },
          });

          const technician = job.assignedTo || { firstName: 'Unknown', lastName: 'Technician' };

          if (manager) {
            await notifyJobCompleted(job, technician, job.property, manager);
          }
        }
      }

      // Job started notification
      if (status === 'IN_PROGRESS' && existingJob.status !== 'IN_PROGRESS') {
        if (job.property.managerId) {
          const manager = await prisma.user.findUnique({
            where: { id: job.property.managerId },
            select: { id: true, firstName: true, lastName: true, email: true },
          });

          if (manager) {
            await notifyJobStarted(job, job.property, manager);
          }
        }
      }

      // Job assigned notification (when status changes to ASSIGNED)
      if (status === 'ASSIGNED' && existingJob.status !== 'ASSIGNED' && job.assignedTo) {
        await notifyJobAssigned(job, job.assignedTo, job.property);
      }
    } catch (notifError) {
      console.error('Failed to send job status notification:', notifError);
      // Don't fail the job update if notification fails
    }

    // Invalidate dashboard cache for property manager
    if (existingJob.property.managerId) {
      await invalidateDashboardCache(existingJob.property.managerId);
    }

    res.json(job);
  } catch (error) {
    console.error('Error updating job status:', error);
    return sendError(res, 500, 'Failed to update job status', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/jobs/:id/accept
// Technician accepts a job assignment
// ========================================
router.post('/:id/accept', requireAuth, requireRole('TECHNICIAN'), async (req, res) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            managerId: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!job) {
      return sendError(res, 404, 'Job not found', ErrorCodes.RES_JOB_NOT_FOUND);
    }

    // Verify job is assigned to the technician
    if (job.assignedToId !== req.user.id) {
      return sendError(res, 403, 'You can only accept jobs assigned to you', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Verify job is in ASSIGNED status
    if (job.status !== 'ASSIGNED') {
      return sendError(res, 400, 'Job must be in ASSIGNED status to accept', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }

    // Update job status to IN_PROGRESS and set startedAt
    const updatedJob = await prisma.job.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
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

    // Notify property manager that technician accepted
    try {
      if (job.property.managerId) {
        const manager = await prisma.user.findUnique({
          where: { id: job.property.managerId },
        });
        if (manager) {
          await notifyJobStarted(updatedJob, updatedJob.property, manager);
        }
      }
    } catch (notifError) {
      console.error('Failed to send job acceptance notification:', notifError);
    }

    // Invalidate caches
    if (job.property.managerId) {
      await invalidateDashboardCache(job.property.managerId);
    }
    await invalidateDashboardCache(req.user.id);

    res.json({ success: true, job: updatedJob });
  } catch (error) {
    console.error('Error accepting job:', error);
    return sendError(res, 500, 'Failed to accept job', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// POST /api/jobs/:id/reject
// Technician rejects a job assignment
// ========================================
router.post('/:id/reject', requireAuth, requireRole('TECHNICIAN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return sendError(res, 400, 'Rejection reason is required', ErrorCodes.VAL_MISSING_FIELD);
    }

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            managerId: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!job) {
      return sendError(res, 404, 'Job not found', ErrorCodes.RES_JOB_NOT_FOUND);
    }

    // Verify job is assigned to the technician
    if (job.assignedToId !== req.user.id) {
      return sendError(res, 403, 'You can only reject jobs assigned to you', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Verify job is in ASSIGNED status
    if (job.status !== 'ASSIGNED') {
      return sendError(res, 400, 'Job must be in ASSIGNED status to reject', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }

    // Update job: remove assignment and reset to OPEN
    const updatedJob = await prisma.job.update({
      where: { id },
      data: {
        status: 'OPEN',
        assignedToId: null,
        notes: job.notes
          ? `${job.notes}\n\n[REJECTED by ${req.user.firstName} ${req.user.lastName}]: ${reason}`
          : `[REJECTED by ${req.user.firstName} ${req.user.lastName}]: ${reason}`,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    // Notify property manager about rejection
    try {
      if (job.property.managerId) {
        const manager = await prisma.user.findUnique({
          where: { id: job.property.managerId },
        });
        if (manager) {
          // Create notification for job rejection
          await prisma.notification.create({
            data: {
              userId: manager.id,
              type: 'JOB_REJECTED',
              title: 'Job Rejected by Technician',
              message: `${req.user.firstName} ${req.user.lastName} rejected job "${job.title}" at ${job.property.name}. Reason: ${reason}`,
              link: `/jobs/${job.id}`,
              data: {
                jobId: job.id,
                technicianId: req.user.id,
                reason,
              },
            },
          });
        }
      }
    } catch (notifError) {
      console.error('Failed to send job rejection notification:', notifError);
    }

    // Invalidate caches
    if (job.property.managerId) {
      await invalidateDashboardCache(job.property.managerId);
    }
    await invalidateDashboardCache(req.user.id);

    res.json({ success: true, job: updatedJob });
  } catch (error) {
    console.error('Error rejecting job:', error);
    return sendError(res, 500, 'Failed to reject job', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const job = await prisma.job.findUnique({
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
            owners: {
              select: { ownerId: true },
            },
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
      },
    });
    
    if (!job) {
      return sendError(res, 404, 'Job not found', ErrorCodes.RES_JOB_NOT_FOUND);
    }

    // Access control: Check user has permission to view this job
    let hasAccess = false;

    if (req.user.role === 'PROPERTY_MANAGER') {
      // Property managers can view jobs for properties they manage
      hasAccess = job.property.managerId === req.user.id;
    } else if (req.user.role === 'OWNER') {
      // Owners can view jobs for properties they own
      hasAccess = job.property.owners?.some(o => o.ownerId === req.user.id);
    } else if (req.user.role === 'TECHNICIAN') {
      // Technicians can view jobs assigned to them
      hasAccess = job.assignedToId === req.user.id;
    } else if (req.user.role === 'TENANT') {
      // Tenants cannot view jobs directly (they use service requests)
      hasAccess = false;
    }

    if (!hasAccess) {
      return sendError(res, 403, 'Access denied. You do not have permission to view this job.', ErrorCodes.ACC_ACCESS_DENIED);
    }
    
    // Remove sensitive fields before sending response
    const { property, ...jobData } = job;
    const { managerId, owners, ...propertyData } = property;
    
    res.json({
      ...jobData,
      property: propertyData,
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    return sendError(res, 500, 'Failed to fetch job', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// PATCH /:id - Update job (PROPERTY_MANAGER and TECHNICIAN can update, requires active subscription for managers)
router.patch('/:id', requireAuth, requireRole('PROPERTY_MANAGER', 'TECHNICIAN'), requireActiveSubscription, validate(jobUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check if job exists
    const existingJob = await prisma.job.findUnique({
      where: { id },
      include: {
        property: true,
      },
    });
    
    if (!existingJob) {
      return sendError(res, 404, 'Job not found', ErrorCodes.RES_JOB_NOT_FOUND);
    }

    // Access control: Technicians can only update jobs assigned to them
    if (req.user.role === 'TECHNICIAN') {
      if (existingJob.assignedToId !== req.user.id) {
        return sendError(res, 403, 'You can only update jobs assigned to you', ErrorCodes.ACC_ACCESS_DENIED);
      }

      // Technicians can only update status, notes, and evidence
      const allowedFields = ['status', 'notes', 'actualCost', 'evidence'];
      const requestedFields = Object.keys(updates);
      const unauthorizedFields = requestedFields.filter(f => !allowedFields.includes(f));

      if (unauthorizedFields.length > 0) {
        return sendError(res, 403, `Technicians can only update: ${allowedFields.join(', ')}`, ErrorCodes.ACC_ACCESS_DENIED);
      }
    }

    // Property managers can only update jobs for their properties
    if (req.user.role === 'PROPERTY_MANAGER') {
      if (existingJob.property.managerId !== req.user.id) {
        return sendError(res, 403, 'You can only update jobs for your properties', ErrorCodes.ACC_ACCESS_DENIED);
      }
    }

    // Validate status transition using centralized utility if status is being changed
    if (updates.status !== undefined && updates.status !== existingJob.status) {
      if (!isValidJobTransition(existingJob.status, updates.status)) {
        const allowed = getAllowedJobTransitions(existingJob.status);
        return sendError(
          res,
          400,
          `Invalid status transition from ${existingJob.status} to ${updates.status}. Allowed transitions: ${allowed.join(', ') || 'none'}`,
          ErrorCodes.BIZ_INVALID_STATUS_TRANSITION
        );
      }
    }

    // Prepare update data
    const updateData = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.scheduledDate !== undefined) {
      updateData.scheduledDate = updates.scheduledDate ? new Date(updates.scheduledDate) : null;
    }
    if (updates.assignedToId !== undefined) updateData.assignedToId = updates.assignedToId;
    if (updates.estimatedCost !== undefined) updateData.estimatedCost = updates.estimatedCost;
    if (updates.actualCost !== undefined) updateData.actualCost = updates.actualCost;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.evidence !== undefined) updateData.evidence = updates.evidence;

    if (Object.keys(updateData).length === 0) {
      return sendError(res, 400, 'No valid fields provided for update', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }
    
    // If status is being set to COMPLETED, set completedDate
    if (updates.status === 'COMPLETED' && !existingJob.completedDate) {
      updateData.completedDate = new Date();
    }
    
    // Update job
    const job = await prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            managerId: true,
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
      },
    });
    
    // Send notifications for various events
    try {
      // Job assignment notification
      if (updates.assignedToId !== undefined && updates.assignedToId !== existingJob.assignedToId) {
        if (updates.assignedToId && job.assignedTo) {
          // New assignment or reassignment
          if (existingJob.assignedToId) {
            // Reassignment - notify both old and new technician
            const previousTechnician = await prisma.user.findUnique({
              where: { id: existingJob.assignedToId },
              select: { id: true, firstName: true, lastName: true, email: true },
            });
            if (previousTechnician) {
              await notifyJobReassigned(job, previousTechnician, job.assignedTo, job.property);
            }
          } else {
            // New assignment
            await notifyJobAssigned(job, job.assignedTo, job.property);
          }
        }
      }
      
      // Job completion notification
      if (updates.status === 'COMPLETED' && existingJob.status !== 'COMPLETED') {
        // Notify property manager
        if (job.property.managerId) {
          const manager = await prisma.user.findUnique({
            where: { id: job.property.managerId },
            select: { id: true, firstName: true, lastName: true, email: true },
          });
          
          const technician = job.assignedTo || { firstName: 'Unknown', lastName: 'Technician' };
          
          if (manager) {
            await notifyJobCompleted(job, technician, job.property, manager);
          }
        }
      }
      
      // Job started notification
      if (updates.status === 'IN_PROGRESS' && existingJob.status !== 'IN_PROGRESS') {
        if (job.property.managerId) {
          const manager = await prisma.user.findUnique({
            where: { id: job.property.managerId },
            select: { id: true, firstName: true, lastName: true, email: true },
          });
          
          if (manager) {
            await notifyJobStarted(job, job.property, manager);
          }
        }
      }
    } catch (notifError) {
      console.error('Failed to send job notification:', notifError);
      // Don't fail the job update if notification fails
    }

    // Invalidate dashboard cache for property manager
    if (existingJob.property.managerId) {
      await invalidateDashboardCache(existingJob.property.managerId);
    }

    res.json(job);
  } catch (error) {
    console.error('Error updating job:', error);
    return sendError(res, 500, 'Failed to update job', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /:id - Delete job (PROPERTY_MANAGER only, requires active subscription)
router.delete('/:id', requireAuth, requireRole('PROPERTY_MANAGER'), requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if job exists
    const existingJob = await prisma.job.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            managerId: true,
          },
        },
      },
    });

    if (!existingJob) {
      return sendError(res, 404, 'Job not found', ErrorCodes.RES_JOB_NOT_FOUND);
    }

    // Delete job
    await prisma.job.delete({
      where: { id },
    });

    // Invalidate dashboard cache for property manager
    if (existingJob.property.managerId) {
      await invalidateDashboardCache(existingJob.property.managerId);
    }

    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    return sendError(res, 500, 'Failed to delete job', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ========================================
// JOB COMMENTS
// ========================================

const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000, 'Comment too long'),
});

// GET /:id/comments - Get all comments for a job
router.get('/:id/comments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if job exists and user has access
    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        assignedToId: true,
        property: {
          select: {
            managerId: true,
            owners: {
              select: {
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return sendError(res, 404, 'Job not found', ErrorCodes.RES_JOB_NOT_FOUND);
    }

    // Check access based on role
    const hasAccess =
      req.user.role === 'PROPERTY_MANAGER' && job.property?.managerId === req.user.id ||
      req.user.role === 'TECHNICIAN' && job.assignedToId === req.user.id ||
      req.user.role === 'OWNER' && job.property?.owners.some(o => o.ownerId === req.user.id);

    if (!hasAccess) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Fetch comments
    const comments = await prisma.jobComment.findMany({
      where: { jobId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    res.json({ success: true, comments });
  } catch (error) {
    console.error('Error fetching job comments:', error);
    return sendError(res, 500, 'Failed to fetch comments', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /:id/comments - Add a comment to a job
router.post('/:id/comments', requireAuth, validate(commentSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    // Check if job exists and user has access
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            managerId: true,
            owners: {
              select: {
                ownerId: true,
              },
            },
          },
        },
      },
    });
    
    if (!job) {
      return sendError(res, 404, 'Job not found', ErrorCodes.RES_JOB_NOT_FOUND);
    }

    // Check access based on role
    const hasAccess =
      req.user.role === 'PROPERTY_MANAGER' && job.property?.managerId === req.user.id ||
      req.user.role === 'TECHNICIAN' && job.assignedToId === req.user.id ||
      req.user.role === 'OWNER' && job.property?.owners.some(o => o.ownerId === req.user.id);

    if (!hasAccess) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Create comment
    const comment = await prisma.jobComment.create({
      data: {
        jobId: id,
        userId: req.user.id,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
    
    res.status(201).json({ success: true, comment });
  } catch (error) {
    console.error('Error creating job comment:', error);
    return sendError(res, 500, 'Failed to create comment', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// PATCH /:id/comments/:commentId - Edit a job comment (owner only)
router.patch('/:id/comments/:commentId', requireAuth, validate(commentSchema), async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { content } = req.body;

    // Find the comment
    const comment = await prisma.jobComment.findUnique({
      where: { id: commentId },
      include: {
        job: {
          include: {
            property: {
              select: {
                managerId: true,
              },
            },
          },
        },
      },
    });

    if (!comment) {
      return sendError(res, 404, 'Comment not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Verify comment belongs to the specified job
    if (comment.jobId !== id) {
      return sendError(res, 400, 'Comment does not belong to this job', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Only the comment author can edit their own comment
    if (comment.userId !== req.user.id) {
      return sendError(res, 403, 'You can only edit your own comments', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Update the comment
    const updatedComment = await prisma.jobComment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    res.json({ success: true, comment: updatedComment });
  } catch (error) {
    console.error('Error updating job comment:', error);
    return sendError(res, 500, 'Failed to update comment', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /:id/comments/:commentId - Delete a job comment (owner or property manager)
router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const { id, commentId } = req.params;

    // Find the comment with job and property info
    const comment = await prisma.jobComment.findUnique({
      where: { id: commentId },
      include: {
        job: {
          include: {
            property: {
              select: {
                managerId: true,
              },
            },
          },
        },
      },
    });

    if (!comment) {
      return sendError(res, 404, 'Comment not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Verify comment belongs to the specified job
    if (comment.jobId !== id) {
      return sendError(res, 400, 'Comment does not belong to this job', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Comment author can delete their own comment
    // Property manager can delete any comment on jobs for their properties
    const isAuthor = comment.userId === req.user.id;
    const isPropertyManager = req.user.role === 'PROPERTY_MANAGER' && 
      comment.job?.property?.managerId === req.user.id;

    if (!isAuthor && !isPropertyManager) {
      return sendError(res, 403, 'You can only delete your own comments', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Delete the comment
    await prisma.jobComment.delete({
      where: { id: commentId },
    });

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting job comment:', error);
    return sendError(res, 500, 'Failed to delete comment', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
export { jobListQuerySchema };
