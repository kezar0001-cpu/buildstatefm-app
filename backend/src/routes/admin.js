import express from 'express';
import crypto from 'crypto';
import prisma from '../config/prismaClient.js';
import { requireAdmin, logAdminAction } from '../middleware/adminAuth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = express.Router();

/**
 * Admin Panel Routes
 * 
 * Centralized admin operations for:
 * - User management
 * - Analytics and metrics
 * - Subscription monitoring
 * - System health
 * - Audit logs
 */

// ==================== DASHBOARD & ANALYTICS ====================

/**
 * GET /api/admin/dashboard
 * Get admin dashboard overview with key metrics
 */
router.get('/dashboard', requireAdmin, logAdminAction('view_dashboard'), async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalProperties,
      totalInspections,
      totalJobs,
      recentSignups,
      subscriptionStats,
      revenueStats
    ] = await Promise.all([
      // Total users count
      prisma.user.count(),
      
      // Active users (logged in within last 30 days)
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Total properties
      prisma.property.count(),
      
      // Total inspections
      prisma.inspection.count(),
      
      // Total jobs
      prisma.job.count(),
      
      // Recent signups (last 7 days)
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Subscription breakdown
      prisma.user.groupBy({
        by: ['subscriptionPlan', 'subscriptionStatus'],
        _count: true,
        where: {
          role: 'PROPERTY_MANAGER'
        }
      }),
      
      // Revenue stats (mock - replace with actual Stripe data)
      Promise.resolve({
        mrr: 0, // Monthly Recurring Revenue
        arr: 0, // Annual Recurring Revenue
        churnRate: 0
      })
    ]);

    // Calculate growth metrics
    const lastMonthSignups = await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });

    const currentMonthSignups = await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });

    const growthRate = lastMonthSignups > 0 
      ? ((currentMonthSignups - lastMonthSignups) / lastMonthSignups * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          totalProperties,
          totalInspections,
          totalJobs,
          recentSignups,
          growthRate: parseFloat(growthRate)
        },
        subscriptions: subscriptionStats,
        revenue: revenueStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Admin] Dashboard error:', error);
    return sendError(res, 500, 'Failed to load dashboard', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/admin/analytics/users
 * Get detailed user analytics
 */
router.get('/analytics/users', requireAdmin, logAdminAction('view_user_analytics'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // User growth over time
    const userGrowth = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        role
      FROM "User"
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at), role
      ORDER BY date ASC
    `;

    // User activity metrics
    const activityMetrics = await prisma.user.groupBy({
      by: ['role'],
      _count: true,
      _avg: {
        lastLoginAt: true
      },
      where: {
        lastLoginAt: {
          gte: startDate
        }
      }
    });

    // Top users by activity (most properties, inspections, etc.)
    const topPropertyManagers = await prisma.user.findMany({
      where: {
        role: 'PROPERTY_MANAGER'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        subscriptionPlan: true,
        _count: {
          select: {
            managedProperties: true
          }
        }
      },
      orderBy: {
        managedProperties: {
          _count: 'desc'
        }
      },
      take: 10
    });

    res.json({
      success: true,
      data: {
        userGrowth,
        activityMetrics,
        topPropertyManagers,
        period,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Admin] User analytics error:', error);
    return sendError(res, 500, 'Failed to load user analytics', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/admin/analytics/subscriptions
 * Get subscription and revenue analytics
 */
router.get('/analytics/subscriptions', requireAdmin, logAdminAction('view_subscription_analytics'), async (req, res) => {
  try {
    // Subscription distribution
    const subscriptionDistribution = await prisma.user.groupBy({
      by: ['subscriptionPlan'],
      _count: true,
      where: {
        role: 'PROPERTY_MANAGER'
      }
    });

    // Trial conversion rate
    const trialUsers = await prisma.user.count({
      where: {
        subscriptionStatus: 'TRIAL',
        role: 'PROPERTY_MANAGER'
      }
    });

    const convertedUsers = await prisma.user.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        role: 'PROPERTY_MANAGER',
        trialEndDate: {
          not: null
        }
      }
    });

    const conversionRate = trialUsers > 0 
      ? ((convertedUsers / (trialUsers + convertedUsers)) * 100).toFixed(2)
      : 0;

    // Churn analysis
    const suspendedUsers = await prisma.user.count({
      where: {
        subscriptionStatus: 'SUSPENDED',
        role: 'PROPERTY_MANAGER'
      }
    });

    const canceledUsers = await prisma.user.count({
      where: {
        subscriptionStatus: 'CANCELED',
        role: 'PROPERTY_MANAGER'
      }
    });

    res.json({
      success: true,
      data: {
        distribution: subscriptionDistribution,
        metrics: {
          trialUsers,
          convertedUsers,
          conversionRate: parseFloat(conversionRate),
          suspendedUsers,
          canceledUsers
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Admin] Subscription analytics error:', error);
    return sendError(res, 500, 'Failed to load subscription analytics', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ==================== USER MANAGEMENT ====================

/**
 * GET /api/admin/users
 * Get all users with filtering and pagination
 */
router.get('/users', requireAdmin, logAdminAction('view_users'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    if (role) {
      where.role = role;
    }

    if (status) {
      where.subscriptionStatus = status;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          trialEndDate: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              managedProperties: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('[Admin] Get users error:', error);
    return sendError(res, 500, 'Failed to fetch users', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/admin/users/:id
 * Get detailed user information
 */
router.get('/users/:id', requireAdmin, logAdminAction('view_user_details'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        managedProperties: {
          select: {
            id: true,
            name: true,
            address: true,
            createdAt: true,
            _count: {
              select: {
                units: true,
                inspections: true,
                jobs: true
              }
            }
          }
        },
        ownedProperties: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        },
        assignedJobs: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true
          },
          take: 10,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!user) {
      return sendError(res, 404, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
    }

    // Remove sensitive data
    const { passwordHash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('[Admin] Get user details error:', error);
    return sendError(res, 500, 'Failed to fetch user details', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * PATCH /api/admin/users/:id
 * Update user (admin can modify subscription, status, etc.)
 */
router.patch('/users/:id', requireAdmin, logAdminAction('update_user'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subscriptionStatus,
      subscriptionPlan,
      isActive,
      emailVerified
    } = req.body;

    // Build update data
    const updateData = {};

    if (subscriptionStatus !== undefined) {
      updateData.subscriptionStatus = subscriptionStatus;
    }

    if (subscriptionPlan !== undefined) {
      updateData.subscriptionPlan = subscriptionPlan;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (emailVerified !== undefined) {
      updateData.emailVerified = emailVerified;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        isActive: true,
        emailVerified: true
      }
    });

    res.json({
      success: true,
      data: user,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('[Admin] Update user error:', error);
    return sendError(res, 500, 'Failed to update user', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/admin/users/:id/deletion-preview
 * Returns dependency counts and whether a hard delete would cascade-delete core data.
 */
router.get('/users/:id/deletion-preview', requireAdmin, logAdminAction('view_user_deletion_preview'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 400, 'User id is required', ErrorCodes.ERR_VALIDATION);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!targetUser) {
      return sendError(res, 404, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
    }

    const [
      managedProperties,
      ownedProperties,
      serviceRequestsRequested,
      jobsCreated,
      jobsAssigned,
      jobComments,
      recommendationComments,
      recommendationsApproved,
      inspectionsAssigned,
      inspectionsCompleted,
      inspectionsApproved,
      inspectionsRejected,
      invitesAccepted,
    ] = await Promise.all([
      prisma.property.count({ where: { managerId: id } }),
      prisma.propertyOwner.count({ where: { ownerId: id } }),
      prisma.serviceRequest.count({ where: { requestedById: id } }),
      prisma.job.count({ where: { createdById: id } }),
      prisma.job.count({ where: { assignedToId: id } }),
      prisma.jobComment.count({ where: { userId: id } }),
      prisma.recommendationComment.count({ where: { userId: id } }),
      prisma.recommendation.count({ where: { approvedById: id } }),
      prisma.inspection.count({ where: { assignedToId: id } }),
      prisma.inspection.count({ where: { completedById: id } }),
      prisma.inspection.count({ where: { approvedById: id } }),
      prisma.inspection.count({ where: { rejectedById: id } }),
      prisma.invite.count({ where: { invitedUserId: id } }),
    ]);

    const wouldCascadeDeleteCoreData =
      managedProperties > 0 ||
      ownedProperties > 0 ||
      serviceRequestsRequested > 0 ||
      jobsCreated > 0;

    return res.json({
      success: true,
      data: {
        user: targetUser,
        counts: {
          managedProperties,
          ownedProperties,
          serviceRequestsRequested,
          jobsCreated,
          jobsAssigned,
          jobComments,
          recommendationComments,
          recommendationsApproved,
          inspectionsAssigned,
          inspectionsCompleted,
          inspectionsApproved,
          inspectionsRejected,
          invitesAccepted,
        },
        wouldCascadeDeleteCoreData,
        notes: {
          hardDeletePermanentlyRemovesRows: true,
          forceRequiredIfCoreData: true,
        },
      },
    });
  } catch (error) {
    console.error('[Admin] User deletion preview error:', error);
    return sendError(res, 500, 'Failed to load deletion preview', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * DELETE /api/admin/users/:id/hard
 * Permanently deletes the user row and (depending on schema) cascades to related data.
 *
 * Safety:
 * - blocks self-delete
 * - prevents deleting last active admin
 * - blocks unless `force=true` when it would cascade-delete core data
 * - explicitly deletes / NULLs non-cascading FK references so the delete does not fail
 */
router.delete('/users/:id/hard', requireAdmin, logAdminAction('hard_delete_user'), async (req, res) => {
  try {
    const { id } = req.params;
    const force = String(req.query.force || '').toLowerCase() === 'true';

    if (!id) {
      return sendError(res, 400, 'User id is required', ErrorCodes.ERR_VALIDATION);
    }

    if (req.user?.id === id) {
      return sendError(res, 400, 'You cannot delete your own admin account', ErrorCodes.ERR_VALIDATION);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!targetUser) {
      return sendError(res, 404, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
    }

    if (targetUser.role === 'ADMIN' && targetUser.isActive) {
      const remainingActiveAdmins = await prisma.user.count({
        where: {
          role: 'ADMIN',
          isActive: true,
          NOT: { id: targetUser.id },
        },
      });

      if (remainingActiveAdmins < 1) {
        return sendError(res, 400, 'Cannot delete the last active admin account', ErrorCodes.ERR_VALIDATION);
      }
    }

    const [managedProperties, ownedProperties, serviceRequestsRequested, jobsCreated] = await Promise.all([
      prisma.property.count({ where: { managerId: id } }),
      prisma.propertyOwner.count({ where: { ownerId: id } }),
      prisma.serviceRequest.count({ where: { requestedById: id } }),
      prisma.job.count({ where: { createdById: id } }),
    ]);

    const wouldCascadeDeleteCoreData =
      managedProperties > 0 ||
      ownedProperties > 0 ||
      serviceRequestsRequested > 0 ||
      jobsCreated > 0;

    if (wouldCascadeDeleteCoreData && !force) {
      return sendError(
        res,
        400,
        'Hard delete would cascade-delete core data (properties/service requests/jobs). Re-run with ?force=true or use safe delete.',
        ErrorCodes.ERR_VALIDATION
      );
    }

    await prisma.$transaction(async (tx) => {
      // NULL optional refs that do not cascade
      await Promise.all([
        tx.invite.updateMany({ where: { invitedUserId: id }, data: { invitedUserId: null } }),
        tx.job.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
        tx.inspection.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
        tx.inspection.updateMany({ where: { completedById: id }, data: { completedById: null } }),
        tx.inspection.updateMany({ where: { approvedById: id }, data: { approvedById: null } }),
        tx.inspection.updateMany({ where: { rejectedById: id }, data: { rejectedById: null } }),
        tx.serviceRequest.updateMany({ where: { approvedById: id }, data: { approvedById: null } }),
        tx.serviceRequest.updateMany({ where: { rejectedById: id }, data: { rejectedById: null } }),
        tx.serviceRequest.updateMany({ where: { lastReviewedById: id }, data: { lastReviewedById: null } }),
        tx.recommendation.updateMany({ where: { approvedById: id }, data: { approvedById: null } }),
        tx.maintenancePlan.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
      ]);

      // Delete required non-cascading refs
      await Promise.all([
        tx.jobComment.deleteMany({ where: { userId: id } }),
        tx.recommendationComment.deleteMany({ where: { userId: id } }),
      ]);

      // Jobs created by this user reference userId in a required non-cascading relation (createdById).
      // If we are hard-deleting the user, we must delete those jobs first.
      await tx.job.deleteMany({ where: { createdById: id } });

      await tx.user.delete({ where: { id } });
    });

    return res.json({
      success: true,
      message: 'User hard-deleted successfully',
    });
  } catch (error) {
    console.error('[Admin] Hard delete user error:', error);
    return sendError(res, 500, 'Failed to hard delete user', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * DELETE /api/admin/users/:id
 * Safe-delete a user account.
 *
 * Hard deleting users in this schema can cascade-delete properties/audit logs.
 * So we do a "safe delete": disable account + revoke credentials + anonymize identity.
 */
router.delete('/users/:id', requireAdmin, logAdminAction('delete_user'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, 400, 'User id is required', ErrorCodes.ERR_VALIDATION);
    }

    if (req.user?.id === id) {
      return sendError(res, 400, 'You cannot delete your own admin account', ErrorCodes.ERR_VALIDATION);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!targetUser) {
      return sendError(res, 404, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
    }

    if (targetUser.role === 'ADMIN' && targetUser.isActive) {
      const remainingActiveAdmins = await prisma.user.count({
        where: {
          role: 'ADMIN',
          isActive: true,
          NOT: { id: targetUser.id },
        },
      });

      if (remainingActiveAdmins < 1) {
        return sendError(res, 400, 'Cannot delete the last active admin account', ErrorCodes.ERR_VALIDATION);
      }
    }

    const anonymizedEmail = `deleted+${targetUser.id}+${Date.now()}@deleted.invalid`;
    const newPasswordHash = crypto.randomBytes(48).toString('hex');

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        isActive: false,
        emailVerified: false,
        refreshTokenHash: null,
        lastLoginAt: null,
        email: anonymizedEmail,
        firstName: 'Deleted',
        lastName: 'User',
        phone: null,
        passwordHash: newPasswordHash,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
      },
    });

    return res.json({
      success: true,
      data: updatedUser,
      message: 'User account deleted (disabled + anonymized) successfully',
    });
  } catch (error) {
    console.error('[Admin] Delete user error:', error);
    return sendError(res, 500, 'Failed to delete user', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/admin/invites
 * Get all invites with filtering and pagination
 */
router.get('/invites', requireAdmin, logAdminAction('view_invites'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }

    const [invites, total] = await Promise.all([
      prisma.invite.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          invitedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          invitedUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              createdAt: true,
              lastLoginAt: true,
              isActive: true,
            },
          },
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
              propertyId: true,
            },
          },
        },
      }),
      prisma.invite.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        invites,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('[Admin] Get invites error:', error);
    return sendError(res, 500, 'Failed to fetch invites', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ==================== SYSTEM HEALTH ====================

/**
 * GET /api/admin/health
 * Get system health metrics
 */
router.get('/health', requireAdmin, async (req, res) => {
  try {
    const dbHealth = await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: dbHealth ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
  } catch (error) {
    console.error('[Admin] Health check error:', error);
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;
