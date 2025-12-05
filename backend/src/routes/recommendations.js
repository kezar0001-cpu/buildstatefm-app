import express from 'express';
import { prisma } from '../config/prismaClient.js';
import { requireAuth } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { sendNotification } from '../utils/notificationService.js';

const router = express.Router();


// POST /recommendations - Create a new recommendation
router.post('/', requireAuth, async (req, res) => {
  try {
    // Only property managers can create recommendations
    if (req.user.role !== 'PROPERTY_MANAGER') {
      return sendError(res, 403, 'Only property managers can create recommendations', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const { propertyId, title, description, priority, estimatedCost } = req.body;

    // Validation
    if (!propertyId || !title || !description) {
      return sendError(res, 400, 'Property ID, title, and description are required', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Verify property exists and belongs to the manager
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        manager: {
          select: {
            id: true,
            subscriptionStatus: true,
            trialEndDate: true,
          },
        },
        owners: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!property) {
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    if (property.managerId !== req.user.id) {
      return sendError(res, 403, 'You can only create recommendations for your own properties', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Check subscription
    const isManagerSubscriptionActive =
      property.manager.subscriptionStatus === 'ACTIVE' ||
      (property.manager.subscriptionStatus === 'TRIAL' && property.manager.trialEndDate && new Date(property.manager.trialEndDate) > new Date());

    if (!isManagerSubscriptionActive) {
      return sendError(res, 403, 'Your trial period has expired. Please upgrade your plan to continue.', ErrorCodes.SUB_MANAGER_SUBSCRIPTION_REQUIRED);
    }

    // Find the most recent inspection report for this property (optional)
    const mostRecentReport = await prisma.report.findFirst({
      where: {
        inspection: {
          propertyId: propertyId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Create the recommendation (reportId is now optional)
    const recommendation = await prisma.recommendation.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        propertyId: propertyId,
        reportId: mostRecentReport?.id || null,
        priority: priority || 'MEDIUM',
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        status: 'SUBMITTED',
        createdById: req.user.id,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        report: {
          include: {
            inspection: {
              select: {
                propertyId: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Send notifications to all property owners
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const ownerNotifications = property.owners
      .filter((po) => !po.endDate || new Date(po.endDate) > new Date()) // Only active owners
      .map((propertyOwner) => {
        const owner = propertyOwner.owner;
        return sendNotification(
          owner.id,
          'SERVICE_REQUEST_UPDATE', // Reuse this type for recommendation notifications
          'New Job Recommendation',
          `${req.user.firstName} ${req.user.lastName} has created a new job recommendation: "${title}"`,
          {
            entityType: 'recommendation',
            entityId: recommendation.id,
            sendEmail: true,
            emailData: {
              ownerName: `${owner.firstName} ${owner.lastName}`,
              managerName: `${req.user.firstName} ${req.user.lastName}`,
              recommendationTitle: title,
              propertyName: property.name,
              description: description,
              priority: priority || 'MEDIUM',
              estimatedCost: estimatedCost ? `$${parseFloat(estimatedCost).toLocaleString()}` : 'Not specified',
              recommendationUrl: `${frontendUrl}/recommendations`,
            },
          }
        );
      });

    // Send all notifications (don't fail if one fails)
    try {
      await Promise.allSettled(ownerNotifications);
    } catch (notifError) {
      console.error('Failed to send some owner notifications:', notifError);
      // Don't fail the request if notifications fail
    }

    res.status(201).json(recommendation);
  } catch (error) {
    console.error('Error creating recommendation:', error);
    return sendError(res, 500, 'Failed to create recommendation', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { reportId, status, priority, search } = req.query;
    
    const where = {};
    if (reportId) where.reportId = reportId;
    if (priority) where.priority = priority;
    
    // Filter out archived recommendations by default (unless explicitly requested)
    const includeArchived = req.query.includeArchived === 'true';
    if (status) {
      where.status = status;
    } else if (!includeArchived) {
      where.status = {
        not: 'ARCHIVED',
      };
    }
    
    // Search filter (searches in title and description)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Add role-based access control
    // Recommendations are now directly linked to properties via propertyId
    if (req.user.role === 'PROPERTY_MANAGER') {
      // Property managers see recommendations for their properties
      where.property = {
        managerId: req.user.id,
      };
    } else if (req.user.role === 'OWNER') {
      // Owners see recommendations for properties they own
      where.property = {
        owners: {
          some: {
            ownerId: req.user.id,
          },
        },
      };
    } else if (req.user.role === 'TECHNICIAN') {
      // Technicians see recommendations for inspections assigned to them (if report exists)
      // Or recommendations for properties where they have assigned inspections
      where.OR = [
        {
          report: {
            inspection: {
              assignedToId: req.user.id,
            },
          },
        },
        {
          property: {
            inspections: {
              some: {
                assignedToId: req.user.id,
              },
            },
          },
        },
      ];
    } else {
      // Tenants and other roles have no access to recommendations
      return sendError(res, 403, 'Access denied. You do not have permission to view recommendations.', ErrorCodes.ACC_ACCESS_DENIED);
    }
    
    const recommendations = await prisma.recommendation.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        report: {
          select: {
            id: true,
            title: true,
            inspectionId: true,
            inspection: {
              select: {
                id: true,
                title: true,
                propertyId: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approvedBy: {
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
    
    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return sendError(res, 500, 'Failed to fetch recommendations', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.post('/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            owners: {
              select: { 
                ownerId: true,
                endDate: true,
              },
            },
            manager: {
              select: {
                id: true,
                subscriptionStatus: true,
                trialEndDate: true,
              },
            },
          },
        },
      },
    });

    if (!recommendation) {
      return sendError(res, 404, 'Recommendation not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Access control: Only property managers and owners can approve recommendations
    const property = recommendation.property;
    if (!property) {
      return sendError(res, 404, 'Associated property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    // Check if property has active owners
    const activeOwners = property.owners?.filter(po => 
      !po.endDate || new Date(po.endDate) > new Date()
    ) || [];
    const hasActiveOwners = activeOwners.length > 0;

    let hasAccess = false;
    
    // Primary approvers: Owners (if they exist)
    if (hasActiveOwners && req.user.role === 'OWNER') {
      hasAccess = activeOwners.some(o => o.ownerId === req.user.id);
    }
    // Fallback: If property has no active owners, property manager acts as owner authority
    else if (!hasActiveOwners && req.user.role === 'PROPERTY_MANAGER' && property.managerId === req.user.id) {
      hasAccess = true; // Manager can approve when no active owners exist
    }

    if (!hasAccess) {
      return sendError(res, 403, 'Access denied. You do not have permission to approve this recommendation.', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Check property manager's subscription
    const manager = property.manager;
    const isManagerSubscriptionActive =
      manager.subscriptionStatus === 'ACTIVE' ||
      (manager.subscriptionStatus === 'TRIAL' && manager.trialEndDate && new Date(manager.trialEndDate) > new Date());

    if (!isManagerSubscriptionActive) {
      const message = req.user.role === 'PROPERTY_MANAGER'
        ? 'Your trial period has expired. Please upgrade your plan to continue.'
        : 'This property\'s subscription has expired. Please contact your property manager.';
      return sendError(res, 403, message, ErrorCodes.SUB_MANAGER_SUBSCRIPTION_REQUIRED);
    }
    
    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: req.user.id,
        approvedAt: new Date(),
      },
      include: {
        property: {
          include: {
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
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Notify property manager when owner approves
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const updatedProperty = updated.property;
    if (updatedProperty && updatedProperty.manager) {
      try {
        await sendNotification(
          updatedProperty.manager.id,
          'SERVICE_REQUEST_UPDATE',
          'Recommendation Approved',
          `${req.user.firstName} ${req.user.lastName} approved your recommendation: "${updated.title}"`,
          {
            entityType: 'recommendation',
            entityId: updated.id,
            sendEmail: true,
            emailData: {
              managerName: `${updatedProperty.manager.firstName} ${updatedProperty.manager.lastName}`,
              ownerName: `${req.user.firstName} ${req.user.lastName}`,
              recommendationTitle: updated.title,
              propertyName: updatedProperty.name,
              estimatedCost: updated.estimatedCost ? `$${updated.estimatedCost.toLocaleString()}` : 'Not specified',
              recommendationUrl: `${frontendUrl}/recommendations`,
            },
          }
        );
      } catch (notifError) {
        console.error('Failed to send approval notification:', notifError);
        // Don't fail the request if notification fails
      }
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Error approving recommendation:', error);
    return sendError(res, 500, 'Failed to approve recommendation', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.post('/:id/reject', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    // Rejection reason is required
    if (!rejectionReason || !rejectionReason.trim()) {
      return sendError(res, 400, 'Rejection reason is required', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            owners: {
              select: { ownerId: true },
            },
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                subscriptionStatus: true,
                trialEndDate: true,
              },
            },
          },
        },
      },
    });

    if (!recommendation) {
      return sendError(res, 404, 'Recommendation not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Access control: Only property managers and owners can reject recommendations
    const property = recommendation.property;
    if (!property) {
      return sendError(res, 404, 'Associated property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    let hasAccess = false;
    if (req.user.role === 'PROPERTY_MANAGER') {
      hasAccess = property.managerId === req.user.id;
    } else if (req.user.role === 'OWNER') {
      hasAccess = property.owners?.some(o => o.ownerId === req.user.id);
    }

    if (!hasAccess) {
      return sendError(res, 403, 'Access denied. You do not have permission to reject this recommendation.', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Check property manager's subscription
    const manager = property.manager;
    const isManagerSubscriptionActive =
      manager.subscriptionStatus === 'ACTIVE' ||
      (manager.subscriptionStatus === 'TRIAL' && manager.trialEndDate && new Date(manager.trialEndDate) > new Date());

    if (!isManagerSubscriptionActive) {
      const message = req.user.role === 'PROPERTY_MANAGER'
        ? 'Your trial period has expired. Please upgrade your plan to continue.'
        : 'This property\'s subscription has expired. Please contact your property manager.';
      return sendError(res, 403, message, ErrorCodes.SUB_MANAGER_SUBSCRIPTION_REQUIRED);
    }
    
    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
        rejectedAt: new Date(),
      },
    });

    // Notify property manager when owner rejects
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    // Reuse the property from the recommendation query above
    if (property && property.manager) {
      try {
        await sendNotification(
          property.manager.id,
          'SERVICE_REQUEST_UPDATE',
          'Recommendation Rejected',
          `${req.user.firstName} ${req.user.lastName} rejected your recommendation: "${recommendation.title}"${rejectionReason ? `. Reason: ${rejectionReason}` : ''}`,
          {
            entityType: 'recommendation',
            entityId: updated.id,
            sendEmail: true,
            emailData: {
              managerName: `${property.manager.firstName} ${property.manager.lastName}`,
              ownerName: `${req.user.firstName} ${req.user.lastName}`,
              recommendationTitle: recommendation.title,
              propertyName: property.name,
              rejectionReason: rejectionReason || 'No reason provided',
              recommendationUrl: `${frontendUrl}/recommendations`,
            },
          }
        );
      } catch (notifError) {
        console.error('Failed to send rejection notification:', notifError);
        // Don't fail the request if notification fails
      }
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Error rejecting recommendation:', error);
    return sendError(res, 500, 'Failed to reject recommendation', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /recommendations/:id/respond - Property manager responds to rejection
router.post('/:id/respond', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { managerResponse } = req.body;

    // Manager response is required
    if (!managerResponse || !managerResponse.trim()) {
      return sendError(res, 400, 'Manager response is required', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            manager: {
              select: {
                id: true,
                subscriptionStatus: true,
                trialEndDate: true,
              },
            },
            owners: {
              include: {
                owner: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!recommendation) {
      return sendError(res, 404, 'Recommendation not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Only property managers can respond
    if (req.user.role !== 'PROPERTY_MANAGER') {
      return sendError(res, 403, 'Only property managers can respond to rejections', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Verify the manager owns the property
    if (recommendation.property.managerId !== req.user.id) {
      return sendError(res, 403, 'You can only respond to recommendations for your own properties', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Can only respond to rejected recommendations
    if (recommendation.status !== 'REJECTED') {
      return sendError(res, 400, 'Can only respond to rejected recommendations', ErrorCodes.BIZ_INVALID_STATUS_TRANSITION);
    }

    // Check subscription
    const manager = recommendation.property.manager;
    const isManagerSubscriptionActive =
      manager.subscriptionStatus === 'ACTIVE' ||
      (manager.subscriptionStatus === 'TRIAL' && manager.trialEndDate && new Date(manager.trialEndDate) > new Date());

    if (!isManagerSubscriptionActive) {
      return sendError(res, 403, 'Your trial period has expired. Please upgrade your plan to continue.', ErrorCodes.SUB_MANAGER_SUBSCRIPTION_REQUIRED);
    }

    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        managerResponse: managerResponse.trim(),
        managerResponseAt: new Date(),
      },
    });

    // Notify property owners about the response
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const property = recommendation.property;
    const activeOwners = property.owners?.filter(po => !po.endDate || new Date(po.endDate) > new Date()) || [];

    const ownerNotifications = activeOwners.map((propertyOwner) => {
      const owner = propertyOwner.owner;
      return sendNotification(
        owner.id,
        'SERVICE_REQUEST_UPDATE',
        'Manager Response to Rejection',
        `${req.user.firstName} ${req.user.lastName} has responded to your rejection of: "${recommendation.title}"`,
        {
          entityType: 'recommendation',
          entityId: updated.id,
          sendEmail: true,
          emailData: {
            ownerName: `${owner.firstName} ${owner.lastName}`,
            managerName: `${req.user.firstName} ${req.user.lastName}`,
            recommendationTitle: recommendation.title,
            propertyName: property.name,
            rejectionReason: recommendation.rejectionReason || 'No reason provided',
            managerResponse: managerResponse,
            recommendationUrl: `${frontendUrl}/recommendations`,
          },
        }
      );
    });

    // Send all notifications (don't fail if one fails)
    try {
      await Promise.allSettled(ownerNotifications);
    } catch (notifError) {
      console.error('Failed to send some owner notifications:', notifError);
      // Don't fail the request if notifications fail
    }

    res.json(updated);
  } catch (error) {
    console.error('Error adding manager response:', error);
    return sendError(res, 500, 'Failed to add manager response', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// POST /recommendations/:id/convert - Convert approved recommendation to job
router.post('/:id/convert', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, assignedToId, estimatedCost, notes } = req.body;

    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            manager: {
              select: {
                id: true,
                subscriptionStatus: true,
                trialEndDate: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!recommendation) {
      return sendError(res, 404, 'Recommendation not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Only property managers can convert recommendations to jobs
    if (req.user.role !== 'PROPERTY_MANAGER') {
      return sendError(res, 403, 'Only property managers can convert recommendations to jobs', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Verify the manager owns the property
    if (recommendation.property.managerId !== req.user.id) {
      return sendError(res, 403, 'You can only convert recommendations for your own properties', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Check subscription
    const manager = recommendation.property.manager;
    const isManagerSubscriptionActive =
      manager.subscriptionStatus === 'ACTIVE' ||
      (manager.subscriptionStatus === 'TRIAL' && manager.trialEndDate && new Date(manager.trialEndDate) > new Date());

    if (!isManagerSubscriptionActive) {
      return sendError(res, 403, 'Your trial period has expired. Please upgrade your plan to continue.', ErrorCodes.SUB_MANAGER_SUBSCRIPTION_REQUIRED);
    }

    // Only approved recommendations can be converted
    if (recommendation.status !== 'APPROVED') {
      return sendError(res, 400, 'Only approved recommendations can be converted to jobs', ErrorCodes.BIZ_INVALID_STATUS_TRANSITION);
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

    // Use recommendation's estimated cost if not provided
    const jobEstimatedCost = estimatedCost || recommendation.estimatedCost || null;
    const jobStatus = assignedToId ? 'ASSIGNED' : 'OPEN';

    // Create job from recommendation
    const [job, updatedRecommendation] = await prisma.$transaction(async (tx) => {
      const createdJob = await tx.job.create({
        data: {
          title: recommendation.title,
          description: recommendation.description,
          status: jobStatus,
          priority: recommendation.priority,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          propertyId: recommendation.propertyId,
          unitId: null, // Recommendations are property-level, not unit-level
          assignedToId: assignedToId || null,
          createdById: req.user.id,
          estimatedCost: jobEstimatedCost,
          notes: notes || `Converted from recommendation: "${recommendation.title}" (ID: ${recommendation.id})`,
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

      // Update recommendation status to IMPLEMENTED
      const updated = await tx.recommendation.update({
        where: { id },
        data: {
          status: 'IMPLEMENTED',
          implementedAt: new Date(),
        },
      });

      return [createdJob, updated];
    });

    // Notify assigned technician if job was assigned
    if (job.assignedTo) {
      try {
        await sendNotification(
          job.assignedTo.id,
          'JOB_ASSIGNED',
          'New Job Assigned',
          `You have been assigned a new job: "${job.title}"`,
          {
            entityType: 'job',
            entityId: job.id,
            sendEmail: true,
            emailData: {
              technicianName: `${job.assignedTo.firstName} ${job.assignedTo.lastName}`,
              jobTitle: job.title,
              propertyName: job.property.name,
              priority: job.priority,
              jobUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/jobs`,
            },
          }
        );
      } catch (notifError) {
        console.error('Failed to send job assignment notification:', notifError);
      }
    }

    res.json({ success: true, job, recommendation: updatedRecommendation });
  } catch (error) {
    console.error('Error converting recommendation to job:', error);
    return sendError(res, 500, 'Failed to convert recommendation to job', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
