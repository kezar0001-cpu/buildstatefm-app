import express from 'express';
import { z } from 'zod';
import validate from '../middleware/validate.js';
import { prisma } from '../config/prismaClient.js';
import { requireAuth, requireRole, requirePropertyManagerSubscription, isSubscriptionActive } from '../middleware/auth.js';
import { redisDel } from '../config/redisClient.js';
import { logAudit } from '../utils/auditLog.js';
import {
  notifyOwnerCostEstimateReady,
  notifyManagerOwnerApproved,
  notifyManagerOwnerRejected,
  notifyOwnerJobCreated,
  notifyServiceRequestUpdate,
  sendNotification,
} from '../utils/notificationService.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { isValidServiceRequestTransition } from '../utils/statusTransitions.js';
import { exportServiceRequestsToCSV, setCSVHeaders } from '../utils/exportUtils.js';

const router = express.Router();

// Service request statuses from Prisma schema
const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CONVERTED_TO_JOB', 'REJECTED', 'COMPLETED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'STRUCTURAL', 'PEST_CONTROL', 'LANDSCAPING', 'GENERAL', 'OTHER'];

const requestSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES).optional().default('MEDIUM'),
  photos: z.array(z.string()).optional(),
  ownerEstimatedBudget: z.number().positive().optional(),
});

const requestUpdateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  reviewNotes: z.string().optional(),
  photos: z.array(z.string()).optional(),
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, propertyId, category, search, includeArchived } = req.query;

    // Build base where clause with filters
    const where = {};
    if (status) where.status = status;
    if (propertyId) where.propertyId = propertyId;
    if (category) where.category = category;
    
    // Add search filter if provided
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Recommendations-style archiving behavior:
    // - if status is explicitly set, honor it (including ARCHIVED)
    // - otherwise, exclude ARCHIVED by default unless includeArchived=true
    const shouldIncludeArchived = includeArchived === 'true' || includeArchived === true;
    if (status) {
      where.status = status;
    } else if (!shouldIncludeArchived) {
      where.status = { not: 'ARCHIVED' };
    }

    // Add role-based access control
    if (req.user.role === 'PROPERTY_MANAGER') {
      // Property managers see requests for properties they manage
      where.property = { managerId: req.user.id };
    } else if (req.user.role === 'OWNER') {
      // Owners see requests for properties they own
      where.property = {
        owners: {
          some: { ownerId: req.user.id }
        }
      };
    } else if (req.user.role === 'TENANT') {
      // Tenants see only their own requests
      where.requestedById = req.user.id;
    } else {
      // Other roles (e.g., TECHNICIAN) do not have access to service requests.
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ROLE_REQUIRED);
    }

    // Parse pagination parameters
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const includeRequesterEmail = req.user.role === 'PROPERTY_MANAGER';

    // Fetch service requests and total count in parallel
    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
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
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              ...(includeRequesterEmail ? { email: true } : {}),
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    // Calculate page number and hasMore
    const page = Math.floor(offset / limit) + 1;
    const hasMore = offset + limit < total;

    // Return paginated response
    res.json({
      items: requests,
      total,
      page,
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching service requests:', error);
    return sendError(res, 500, 'Failed to fetch service requests', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /archived - Get archived service requests
router.get('/archived', requireAuth, async (req, res) => {
  try {
    const { propertyId, category } = req.query;

    // Build base where clause with filters
    const where = {
      status: 'ARCHIVED', // Only archived items
    };
    if (propertyId) where.propertyId = propertyId;
    if (category) where.category = category;

    // Add role-based access control
    if (req.user.role === 'PROPERTY_MANAGER') {
      where.property = { managerId: req.user.id };
    } else if (req.user.role === 'OWNER') {
      where.property = {
        owners: {
          some: { ownerId: req.user.id }
        }
      };
    } else if (req.user.role === 'TENANT') {
      where.requestedById = req.user.id;
    } else {
      // Other roles (e.g., TECHNICIAN) do not have access to archived service requests.
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ROLE_REQUIRED);
    }

    // Parse pagination parameters
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const includeRequesterEmail = req.user.role === 'PROPERTY_MANAGER';

    // Fetch archived service requests and total count in parallel
    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            }
          },
          unit: {
            select: {
              id: true,
              unitNumber: true,
            }
          },
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              ...(includeRequesterEmail ? { email: true } : {}),
              role: true,
            }
          },
        },
        orderBy: { archivedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    // Calculate page number and hasMore
    const page = Math.floor(offset / limit) + 1;
    const hasMore = offset + limit < total;

    // Return paginated response
    res.json({
      items: requests,
      total,
      page,
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching archived service requests:', error);
    return sendError(res, 500, 'Failed to fetch archived service requests', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /:id - Get single service request with full details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await prisma.serviceRequest.findUnique({
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
              select: {
                ownerId: true,
              },
            },
          },
        },
        unit: true,
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        jobs: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
    
    if (!request) {
      return sendError(res, 404, 'Service request not found', ErrorCodes.RES_SERVICE_REQUEST_NOT_FOUND);
    }
    
    // Access control: Check user has access to property
    const hasAccess =
      req.user.role === 'PROPERTY_MANAGER' && request.property.managerId === req.user.id ||
      req.user.role === 'OWNER' && request.property.owners.some(o => o.ownerId === req.user.id) ||
      req.user.role === 'TENANT' && request.requestedById === req.user.id;
    
    if (!hasAccess) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    res.json({ success: true, request });
  } catch (error) {
    console.error('Error fetching service request:', error);
    return sendError(res, 500, 'Failed to fetch service request', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.post('/', requireAuth, validate(requestSchema), async (req, res) => {
  try {
    const { propertyId, unitId, title, description, category, priority, photos, ownerEstimatedBudget } = req.body;

    // Verify property exists and user has access
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owners: {
          select: { ownerId: true },
        },
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
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }
    
    // Verify user has access to create requests for this property
    // Property managers do NOT create service requests - they only review and manage them
    if (req.user.role === 'PROPERTY_MANAGER') {
      return sendError(res, 403, 'Property managers cannot create service requests. Only owners and tenants can submit requests.', ErrorCodes.ACC_ROLE_REQUIRED);
    }
    
    // Verify unit exists and belongs to property if provided
    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: {
          id: unitId,
          propertyId: propertyId,
        },
      });

      if (!unit) {
        return sendError(res, 400, 'Unit not found or does not belong to this property', ErrorCodes.RES_UNIT_NOT_FOUND);
      }
    }
    
    let hasAccess = false;
    
    if (req.user.role === 'OWNER') {
      hasAccess = property.owners.some(o => o.ownerId === req.user.id);
    } else if (req.user.role === 'TENANT') {
      if (unitId) {
        // Verify tenant has active lease for the unit
        const tenantUnit = await prisma.unitTenant.findFirst({
          where: {
            unitId: unitId,
            tenantId: req.user.id,
            isActive: true,
          },
          include: {
            unit: {
              select: {
                propertyId: true,
              },
            },
          },
        });

        // Verify tenant has lease AND unit belongs to the specified property
        hasAccess = !!tenantUnit && tenantUnit.unit.propertyId === propertyId;
      } else {
        // Property-wide request. Allow if tenant is assigned to ANY active unit within the property,
        // OR if they have a property-level assignment (house / no units).
        const [tenantUnitWithinProperty, tenantProperty] = await Promise.all([
          prisma.unitTenant.findFirst({
            where: {
              tenantId: req.user.id,
              isActive: true,
              unit: {
                propertyId,
              },
            },
            select: { id: true },
          }),
          prisma.propertyTenant.findFirst({
            where: {
              propertyId,
              tenantId: req.user.id,
              isActive: true,
            },
            select: { id: true },
          }),
        ]);

        hasAccess = Boolean(tenantUnitWithinProperty || tenantProperty);
      }
    } else if (req.user.role === 'TECHNICIAN') {
      return sendError(res, 403, 'Technicians cannot create service requests', ErrorCodes.ACC_ROLE_REQUIRED);
    }

    if (!hasAccess) {
      return sendError(res, 403, 'You do not have access to create service requests for this property', ErrorCodes.ACC_PROPERTY_ACCESS_DENIED);
    }

    // Verify the relevant subscription is active
    // (Property managers are already blocked above, so this only applies to owners/tenants)
    const manager = property.manager;

    if (!manager || !isSubscriptionActive(manager)) {
      return sendError(res, 403, 'This property\'s subscription has expired. Please contact your property manager.', ErrorCodes.SUB_MANAGER_SUBSCRIPTION_REQUIRED);
    }

    // Determine initial status based on user role
    // OWNER with budget estimate → PENDING_MANAGER_REVIEW
    // OWNER without budget OR TENANT/PM → SUBMITTED
    let initialStatus = 'SUBMITTED';
    if (req.user.role === 'OWNER' && ownerEstimatedBudget) {
      initialStatus = 'PENDING_MANAGER_REVIEW';
    }

    // Create service request
    const request = await prisma.serviceRequest.create({
      data: {
        title,
        description,
        category,
        priority: priority || 'MEDIUM',
        status: initialStatus,
        propertyId,
        unitId: unitId || null,
        requestedById: req.user.id,
        photos: photos || [],
        ownerEstimatedBudget: ownerEstimatedBudget || null,
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
      },
    });

    // Log audit
    await logAudit({
      entityType: 'ServiceRequest',
      entityId: request.id,
      action: 'CREATED',
      userId: req.user.id,
      metadata: {
        role: req.user.role,
        status: initialStatus,
        hasOwnerBudget: !!ownerEstimatedBudget,
      },
      req
    });

    // Send notifications
    try {
      // Notify property manager when tenant/owner submits a request
      if (req.user.role === 'TENANT' || req.user.role === 'OWNER') {
        const manager = property.manager;
        if (manager) {
          await sendNotification(
            manager.id,
            'SERVICE_REQUEST_UPDATE',
            'New Service Request',
            `${req.user.role === 'OWNER' ? 'Owner' : 'Tenant'} submitted a new service request: "${title}"`,
            {
              entityType: 'serviceRequest',
              entityId: request.id,
              sendEmail: true,
              emailData: {
                managerName: `${manager.firstName || ''} ${manager.lastName || ''}`.trim(),
                requestTitle: title,
                requestCategory: category,
                requestPriority: priority || 'MEDIUM',
                requesterName: `${req.user.firstName} ${req.user.lastName}`,
                requestUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/service-requests`,
              },
            }
          );
        }
      }
    } catch (notifError) {
      console.error('Failed to send service request creation notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating service request:', error);
    return sendError(res, 500, 'Failed to create service request', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.patch('/:id', requireAuth, validate(requestUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check if request exists and get full details for access control
    const existing = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            owners: {
              select: { ownerId: true },
            },
          },
        },
      },
    });
    
    if (!existing) {
      return sendError(res, 404, 'Service request not found', ErrorCodes.RES_SERVICE_REQUEST_NOT_FOUND);
    }
    
    // Archived requests are read-only
    if (existing.status === 'ARCHIVED') {
      return sendError(res, 403, 'Archived service requests cannot be modified', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }
    
    // Verify user has access to update this request
    let hasAccess = false;
    let allowedFields = [];
    
    if (req.user.role === 'PROPERTY_MANAGER') {
      hasAccess = existing.property.managerId === req.user.id;
      allowedFields = ['status', 'priority', 'title', 'description', 'reviewNotes'];
    } else if (req.user.role === 'OWNER') {
      hasAccess = existing.property.owners.some(o => o.ownerId === req.user.id);
      allowedFields = ['status', 'priority', 'reviewNotes'];
    } else if (req.user.role === 'TENANT') {
      hasAccess = existing.requestedById === req.user.id;
      // Tenants can only update their own requests and only certain fields
      allowedFields = ['title', 'description', 'priority', 'photos'];
      
      // Tenants can only update if request is still in SUBMITTED status
      if (existing.status !== 'SUBMITTED') {
        return sendError(res, 403, 'You can only update service requests that are still in submitted status', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
      }
    } else if (req.user.role === 'TECHNICIAN') {
      return sendError(res, 403, 'Technicians cannot update service requests directly', ErrorCodes.ACC_ROLE_REQUIRED);
    }

    if (!hasAccess) {
      return sendError(res, 403, 'You do not have access to update this service request', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Verify requested fields are allowed for this role
    const requestedFields = Object.keys(updates);
    const unauthorizedFields = requestedFields.filter(f => !allowedFields.includes(f));

    if (unauthorizedFields.length > 0) {
      return sendError(res, 403, `You can only update the following fields: ${allowedFields.join(', ')}`, ErrorCodes.ACC_ACCESS_DENIED);
    }

    if (
      req.user.role === 'PROPERTY_MANAGER' &&
      updates.status !== undefined &&
      ['PENDING_OWNER_APPROVAL', 'APPROVED', 'APPROVED_BY_OWNER'].includes(updates.status)
    ) {
      return sendError(
        res,
        403,
        'Property managers cannot set this status directly. Add a cost estimate and have the owner approve before converting to a job.',
        ErrorCodes.BIZ_OPERATION_NOT_ALLOWED
      );
    }
    
    // Validate status transition if status is being changed
    if (updates.status !== undefined && updates.status !== existing.status) {
      if (!isValidServiceRequestTransition(existing.status, updates.status)) {
        return sendError(
          res,
          400,
          `Invalid status transition from ${existing.status} to ${updates.status}`,
          ErrorCodes.BIZ_INVALID_STATUS_TRANSITION
        );
      }
    }
    
    // Prepare update data
    const updateData = {};
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.photos !== undefined) updateData.photos = updates.photos;
    if (updates.reviewNotes !== undefined) {
      updateData.reviewNotes = updates.reviewNotes;
      updateData.reviewedAt = new Date();
      updateData.lastReviewedById = req.user.id;
      updateData.lastReviewedAt = new Date();
    }
    
    // Update service request
    const request = await prisma.serviceRequest.update({
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
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });
    
    // Send notifications for status changes
    if (updates.status !== undefined && updates.status !== existing.status) {
      try {
        // Notify the requester (tenant or owner) of status changes
        if (request.requestedBy && request.requestedBy.role === 'TENANT') {
          await notifyServiceRequestUpdate(request, request.requestedBy, request.property);
        }
        
        // Notify property manager when tenant submits a request
        if (updates.status === 'UNDER_REVIEW' && existing.status === 'SUBMITTED') {
          const manager = await prisma.user.findUnique({
            where: { id: request.property.managerId },
            select: { id: true, firstName: true, lastName: true, email: true },
          });
          
          if (manager) {
            await sendNotification(
              manager.id,
              'SERVICE_REQUEST_UPDATE',
              'New Service Request to Review',
              `A new service request "${request.title}" has been submitted and requires your review.`,
              {
                entityType: 'serviceRequest',
                entityId: request.id,
                sendEmail: true,
                emailData: {
                  managerName: `${manager.firstName} ${manager.lastName}`,
                  requestTitle: request.title,
                  requestCategory: request.category,
                  requestPriority: request.priority,
                  requestUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/service-requests`,
                },
              }
            );
          }
        }
      } catch (notifError) {
        console.error('Failed to send status change notification:', notifError);
        // Don't fail the request if notification fails
      }
    }
    
    res.json(request);
  } catch (error) {
    console.error('Error updating service request:', error);
    return sendError(res, 500, 'Failed to update service request', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Property Manager adds cost estimate to owner-initiated request
router.post('/:id/estimate', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { managerEstimatedCost, costBreakdownNotes } = req.body;

    if (!managerEstimatedCost || managerEstimatedCost <= 0) {
      return sendError(res, 400, 'Valid estimated cost is required', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Get service request
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            manager: true,
            owners: {
              include: {
                owner: true
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
    });

    if (!serviceRequest) {
      return sendError(res, 404, 'Service request not found', ErrorCodes.RES_SERVICE_REQUEST_NOT_FOUND);
    }

    // Archived requests cannot be modified
    if (serviceRequest.status === 'ARCHIVED') {
      return sendError(res, 403, 'Archived service requests cannot be modified', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }

    // Verify it's the property manager
    if (serviceRequest.property.managerId !== req.user.id) {
      return sendError(res, 403, 'Only the property manager can add cost estimates', ErrorCodes.ACC_ROLE_REQUIRED);
    }

    // Verify it's in the correct status
    const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_MANAGER_REVIEW'];
    if (!validStatuses.includes(serviceRequest.status)) {
      return sendError(
        res,
        400,
        `Service request must be in ${validStatuses.join(' or ')} status`,
        ErrorCodes.BIZ_INVALID_STATUS_TRANSITION
      );
    }

    // Update service request with cost estimate
    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: {
        managerEstimatedCost,
        costBreakdownNotes,
        status: 'PENDING_OWNER_APPROVAL',
        lastReviewedById: req.user.id,
        lastReviewedAt: new Date(),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Log audit
    await logAudit({
      entityType: 'ServiceRequest',
      entityId: id,
      action: 'ESTIMATE_ADDED',
      userId: req.user.id,
      changes: {
        managerEstimatedCost,
        costBreakdownNotes,
        status: { before: 'PENDING_MANAGER_REVIEW', after: 'PENDING_OWNER_APPROVAL' }
      },
      req
    });

    // Send notification to owner (requestedBy should be the owner)
    if (serviceRequest.requestedBy.role === 'OWNER') {
      try {
        await notifyOwnerCostEstimateReady(
          updatedRequest,
          serviceRequest.requestedBy,
          req.user,
          updatedRequest.property
        );
      } catch (notifError) {
        console.error('Failed to send cost estimate notification:', notifError);
      }
    }

    res.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Error adding cost estimate:', error);
    return sendError(res, 500, 'Failed to add cost estimate', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Owner approves service request
router.post('/:id/approve', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBudget } = req.body;

    // Get service request
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            owners: {
              select: {
                ownerId: true
              }
            }
          }
        }
      },
    });

    if (!serviceRequest) {
      return sendError(res, 404, 'Service request not found', ErrorCodes.RES_SERVICE_REQUEST_NOT_FOUND);
    }

    // Archived requests cannot be approved
    if (serviceRequest.status === 'ARCHIVED') {
      return sendError(res, 403, 'Archived service requests cannot be modified', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }

    // Verify owner has access
    const isOwner = serviceRequest.property.owners.some(o => o.ownerId === req.user.id);
    if (!isOwner) {
      return sendError(res, 403, 'Only property owners can approve service requests', ErrorCodes.ACC_ROLE_REQUIRED);
    }

    // Verify it's in the correct status
    if (serviceRequest.status !== 'PENDING_OWNER_APPROVAL') {
      return sendError(res, 400, 'Service request must be in PENDING_OWNER_APPROVAL status', ErrorCodes.BIZ_INVALID_STATUS_TRANSITION);
    }

    // Update service request to approved
    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'APPROVED_BY_OWNER',
        approvedBudget: approvedBudget || serviceRequest.managerEstimatedCost,
        approvedById: req.user.id,
        approvedAt: new Date(),
        lastReviewedById: req.user.id,
        lastReviewedAt: new Date(),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        }
      }
    });

    // Log audit
    await logAudit({
      entityType: 'ServiceRequest',
      entityId: id,
      action: 'APPROVED_BY_OWNER',
      userId: req.user.id,
      changes: {
        approvedBudget: approvedBudget || serviceRequest.managerEstimatedCost,
        status: { before: 'PENDING_OWNER_APPROVAL', after: 'APPROVED_BY_OWNER' }
      },
      req
    });

    // Send notification to property manager
    try {
      await notifyManagerOwnerApproved(
        updatedRequest,
        serviceRequest.property.manager,
        req.user,
        updatedRequest.property
      );
    } catch (notifError) {
      console.error('Failed to send approval notification:', notifError);
    }

    res.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Error approving service request:', error);
    return sendError(res, 500, 'Failed to approve service request', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Owner rejects service request
router.post('/:id/reject', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return sendError(res, 400, 'Rejection reason is required', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Get service request
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            owners: {
              select: {
                ownerId: true
              }
            }
          }
        }
      },
    });

    if (!serviceRequest) {
      return sendError(res, 404, 'Service request not found', ErrorCodes.RES_SERVICE_REQUEST_NOT_FOUND);
    }

    // Archived requests cannot be rejected
    if (serviceRequest.status === 'ARCHIVED') {
      return sendError(res, 403, 'Archived service requests cannot be modified', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }

    // Verify owner has access
    const isOwner = serviceRequest.property.owners.some(o => o.ownerId === req.user.id);
    if (!isOwner) {
      return sendError(res, 403, 'Only property owners can reject service requests', ErrorCodes.ACC_ROLE_REQUIRED);
    }

    // Verify it's in the correct status
    if (serviceRequest.status !== 'PENDING_OWNER_APPROVAL') {
      return sendError(res, 400, 'Service request must be in PENDING_OWNER_APPROVAL status', ErrorCodes.BIZ_INVALID_STATUS_TRANSITION);
    }

    // Update service request to rejected
    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'REJECTED_BY_OWNER',
        rejectedById: req.user.id,
        rejectedAt: new Date(),
        rejectionReason,
        lastReviewedById: req.user.id,
        lastReviewedAt: new Date(),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        }
      }
    });

    // Log audit
    await logAudit({
      entityType: 'ServiceRequest',
      entityId: id,
      action: 'REJECTED_BY_OWNER',
      userId: req.user.id,
      changes: {
        rejectionReason,
        status: { before: 'PENDING_OWNER_APPROVAL', after: 'REJECTED_BY_OWNER' }
      },
      req
    });

    // Send notification to property manager
    try {
      await notifyManagerOwnerRejected(
        updatedRequest,
        serviceRequest.property.manager,
        req.user,
        updatedRequest.property,
        rejectionReason
      );
    } catch (notifError) {
      console.error('Failed to send rejection notification:', notifError);
    }

    res.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Error rejecting service request:', error);
    return sendError(res, 500, 'Failed to reject service request', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Property Manager directly approves service request (bypasses owner approval for simple requests)
router.post('/:id/manager-approve', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    return sendError(
      res,
      403,
      'Direct manager approval is disabled. Add a cost estimate to send to the owner for approval.',
      ErrorCodes.BIZ_OPERATION_NOT_ALLOWED
    );
  } catch (error) {
    console.error('Error approving service request:', error);
    return sendError(res, 500, 'Failed to approve service request', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Property Manager directly rejects service request
router.post('/:id/manager-reject', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, reviewNotes } = req.body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return sendError(res, 400, 'Rejection reason is required', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Get service request
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
    });

    if (!serviceRequest) {
      return sendError(res, 404, 'Service request not found', ErrorCodes.RES_SERVICE_REQUEST_NOT_FOUND);
    }

    // Archived requests cannot be rejected
    if (serviceRequest.status === 'ARCHIVED') {
      return sendError(res, 403, 'Archived service requests cannot be modified', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }

    // Verify it's the property manager
    if (serviceRequest.property.managerId !== req.user.id) {
      return sendError(res, 403, 'Only the property manager can reject service requests', ErrorCodes.ACC_ROLE_REQUIRED);
    }

    // Verify it's in a valid status for rejection
    const validStatuses = ['SUBMITTED', 'PENDING_MANAGER_REVIEW', 'UNDER_REVIEW', 'PENDING_OWNER_APPROVAL', 'APPROVED_BY_OWNER', 'APPROVED'];
    if (!validStatuses.includes(serviceRequest.status)) {
      return sendError(res, 400, `Cannot reject request with status ${serviceRequest.status}`, ErrorCodes.BIZ_INVALID_STATUS_TRANSITION);
    }

    // Update service request to rejected
    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedById: req.user.id,
        rejectedAt: new Date(),
        rejectionReason,
        reviewNotes: reviewNotes || null,
        lastReviewedById: req.user.id,
        lastReviewedAt: new Date(),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Log audit
    await logAudit({
      entityType: 'ServiceRequest',
      entityId: id,
      action: 'REJECTED_BY_MANAGER',
      userId: req.user.id,
      changes: {
        rejectionReason,
        reviewNotes,
        status: { before: serviceRequest.status, after: 'REJECTED' }
      },
      req
    });

    // Clear cache
    await redisDel(`property:${serviceRequest.propertyId}:*`);

    // Send notification to requester
    try {
      await sendNotification({
        userId: serviceRequest.requestedById,
        type: 'SERVICE_REQUEST_REJECTED',
        title: 'Service Request Rejected',
        message: `Your service request "${serviceRequest.title}" has been rejected. Reason: ${rejectionReason}`,
        data: {
          serviceRequestId: id,
          propertyId: serviceRequest.propertyId,
          rejectionReason
        }
      });
    } catch (notifError) {
      console.error('Failed to send rejection notification:', notifError);
    }

    res.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Error rejecting service request:', error);
    return sendError(res, 500, 'Failed to reject service request', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Convert service request to job (PROPERTY_MANAGER only)
router.post('/:id/convert-to-job', requireAuth, requireRole('PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, assignedToId, estimatedCost, notes } = req.body;
    
    // Get service request
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        property: true,
        unit: true,
      },
    });

    if (!serviceRequest) {
      return sendError(res, 404, 'Service request not found', ErrorCodes.RES_SERVICE_REQUEST_NOT_FOUND);
    }

    // Archived requests cannot be converted
    if (serviceRequest.status === 'ARCHIVED') {
      return sendError(res, 403, 'Archived service requests cannot be converted to jobs', ErrorCodes.BIZ_OPERATION_NOT_ALLOWED);
    }

    // Authorization check: Verify the requesting manager owns the property
    if (serviceRequest.property.managerId !== req.user.id) {
      return sendError(res, 403, 'You do not have permission to convert service requests for this property', ErrorCodes.ACC_PROPERTY_ACCESS_DENIED);
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

    // Check if service request is approved (for owner-initiated requests)
    if (serviceRequest.status !== 'APPROVED_BY_OWNER') {
      return sendError(
        res,
        400,
        'Cannot convert service request until it has been approved by the owner',
        ErrorCodes.BIZ_OPERATION_NOT_ALLOWED
      );
    }

    // Use approved budget if available, otherwise use provided or existing estimated cost
    const jobEstimatedCost = serviceRequest.approvedBudget || estimatedCost || serviceRequest.managerEstimatedCost || null;

    // Determine job status based on assignment
    const jobStatus = assignedToId ? 'ASSIGNED' : 'OPEN';

    // Create job from service request
    const [job, updatedRequest] = await prisma.$transaction(async (tx) => {
      const createdJob = await tx.job.create({
        data: {
          title: serviceRequest.title,
          description: serviceRequest.description,
          status: jobStatus,
          priority: serviceRequest.priority,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          propertyId: serviceRequest.propertyId,
          unitId: serviceRequest.unitId,
          assignedToId: assignedToId || null,
          createdById: req.user.id,
          estimatedCost: jobEstimatedCost,
          notes: notes || `Converted from service request #${serviceRequest.id}`,
          serviceRequestId: serviceRequest.id,
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

      const updatedServiceRequest = await tx.serviceRequest.update({
        where: { id },
        data: {
          status: 'CONVERTED_TO_JOB',
          reviewNotes: `Converted to job #${createdJob.id}`,
          reviewedAt: new Date(),
        },
        include: {
          jobs: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return [createdJob, updatedServiceRequest];
    });

    // Log audit
    await logAudit({
      entityType: 'ServiceRequest',
      entityId: serviceRequest.id,
      action: 'CONVERTED_TO_JOB',
      userId: req.user.id,
      metadata: {
        jobId: job.id,
        approvedBudget: serviceRequest.approvedBudget,
      },
      req
    });

    // Notify owner if this was an owner-initiated request
    if (serviceRequest.requestedBy && serviceRequest.requestedBy.role === 'OWNER') {
      try {
        await notifyOwnerJobCreated(serviceRequest, job, serviceRequest.requestedBy, job.property);
      } catch (notifError) {
        console.error('Failed to send job creation notification to owner:', notifError);
      }
    }

    // Invalidate cached property activity snapshots (best-effort)
    if (serviceRequest.propertyId) {
      await Promise.all([
        redisDel(`property:${serviceRequest.propertyId}:activity:20`),
        redisDel(`property:${serviceRequest.propertyId}:activity:50`),
      ]);
    }

    res.json({ success: true, job, serviceRequest: updatedRequest });
  } catch (error) {
    console.error('Error converting service request to job:', error);
    return sendError(res, 500, 'Failed to convert service request to job', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// DELETE /service-requests/:id - Delete a service request
// Only property managers can delete service requests, and only if they haven't been converted to jobs
router.delete('/:id', requireAuth, requirePropertyManagerSubscription, async (req, res) => {
  try {
    const { id } = req.params;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            manager: { select: { id: true } },
            owners: { select: { ownerId: true } },
          },
        },
        requestedBy: { select: { id: true, role: true } },
        jobs: { select: { id: true } },
      },
    });

    if (!serviceRequest) {
      return sendError(res, 404, 'Service request not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Check access: Property managers can delete requests for their properties
    if (req.user.role === 'PROPERTY_MANAGER') {
      if (serviceRequest.property.managerId !== req.user.id) {
        return sendError(res, 403, 'Access denied to this service request', ErrorCodes.ACC_ACCESS_DENIED);
      }
    } else {
      return sendError(res, 403, 'Only property managers can delete service requests', ErrorCodes.ACC_ROLE_REQUIRED);
    }

    // Cannot delete if already converted to job
    if (serviceRequest.status === 'CONVERTED_TO_JOB' || serviceRequest.jobs.length > 0) {
      return sendError(
        res,
        400,
        'Cannot delete service request that has been converted to a job',
        ErrorCodes.ERR_BAD_REQUEST
      );
    }

    // Delete the service request
    await prisma.serviceRequest.delete({
      where: { id },
    });

    // Invalidate cached property activity snapshots
    if (serviceRequest.propertyId) {
      await Promise.all([
        redisDel(`property:${serviceRequest.propertyId}:activity:20`),
        redisDel(`property:${serviceRequest.propertyId}:activity:50`),
      ]);
    }

    // Log audit
    await logAudit({
      entityType: 'ServiceRequest',
      entityId: id,
      action: 'DELETE',
      userId: req.user.id,
      changes: { deleted: true },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting service request:', error);
    return sendError(res, 500, 'Failed to delete service request', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
