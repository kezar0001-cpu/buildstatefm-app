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

    // Find the most recent inspection report for this property
    // If no report exists, we'll need to create a placeholder or return an error
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

    if (!mostRecentReport) {
      return sendError(res, 400, 'No inspection report found for this property. Please complete an inspection first.', ErrorCodes.VAL_VALIDATION_ERROR);
    }

    // Create the recommendation
    const recommendation = await prisma.recommendation.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        reportId: mostRecentReport.id,
        priority: priority || 'MEDIUM',
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        status: 'SUBMITTED',
        createdById: req.user.id,
      },
      include: {
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
    if (status) where.status = status;
    if (priority) where.priority = priority;
    
    // Search filter (searches in title and description)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Add role-based access control
    // Recommendations are tied to inspection reports, which are tied to properties
    if (req.user.role === 'PROPERTY_MANAGER') {
      // Property managers see recommendations for their properties
      where.report = {
        inspection: {
          property: {
            managerId: req.user.id,
          },
        },
      };
    } else if (req.user.role === 'OWNER') {
      // Owners see recommendations for properties they own
      where.report = {
        inspection: {
          property: {
            owners: {
              some: {
                ownerId: req.user.id,
              },
            },
          },
        },
      };
    } else if (req.user.role === 'TECHNICIAN') {
      // Technicians see recommendations for inspections assigned to them
      where.report = {
        inspection: {
          assignedToId: req.user.id,
        },
      };
    } else {
      // Tenants and other roles have no access to recommendations
      return sendError(res, 403, 'Access denied. You do not have permission to view recommendations.', ErrorCodes.ACC_ACCESS_DENIED);
    }
    
    const recommendations = await prisma.recommendation.findMany({
      where,
      include: {
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
        report: {
          include: {
            inspection: {
              include: {
                property: {
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

    // Access control: Only property managers and owners can approve recommendations
    const property = recommendation.report?.inspection?.property;
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
        report: {
          include: {
            inspection: {
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
    const property = updated.report?.inspection?.property;
    if (property && property.manager) {
      try {
        await sendNotification(
          property.manager.id,
          'SERVICE_REQUEST_UPDATE',
          'Recommendation Approved',
          `${req.user.firstName} ${req.user.lastName} approved your recommendation: "${updated.title}"`,
          {
            entityType: 'recommendation',
            entityId: updated.id,
            sendEmail: true,
            emailData: {
              managerName: `${property.manager.firstName} ${property.manager.lastName}`,
              ownerName: `${req.user.firstName} ${req.user.lastName}`,
              recommendationTitle: updated.title,
              propertyName: property.name,
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

    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        report: {
          include: {
            inspection: {
              include: {
                property: {
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

    // Access control: Only property managers and owners can reject recommendations
    const property = recommendation.report?.inspection?.property;
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
    
    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        report: {
          include: {
            inspection: {
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
              },
            },
          },
        },
      },
    });

    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason || null,
      },
    });

    // Notify property manager when owner rejects
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const property = recommendation.report?.inspection?.property;
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

export default router;
