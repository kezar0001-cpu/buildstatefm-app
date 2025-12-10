import express from 'express';
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
