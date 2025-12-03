import express from 'express';
import { z } from 'zod';
import validate from '../middleware/validate.js';
import { prisma } from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { getUserUsageStats } from '../utils/usageTracking.js';
import { getPlanLimits, getUsagePercentage, getRemainingUsage, getApproachingLimits } from '../utils/subscriptionLimits.js';

const router = express.Router();


// Get user's subscription
router.get('/', requireAuth, async (req, res) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return sendError(res, 500, 'Failed to fetch subscriptions', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Get current user's active subscription
router.get('/current', requireAuth, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: req.user.id,
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      return sendError(res, 404, 'No active subscription found', ErrorCodes.RES_NOT_FOUND);
    }

    res.json(subscription);
  } catch (error) {
    console.error('Error fetching current subscription:', error);
    return sendError(res, 500, 'Failed to fetch subscription', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// Get usage stats for current user
// Returns current consumption vs plan quotas
router.get('/usage', requireAuth, async (req, res) => {
  try {
    let userId = req.user.id;
    let subscriptionPlan = req.user.subscriptionPlan || 'FREE_TRIAL';

    // For non-property managers, get their property manager's usage stats
    // This is because the subscription is at the property manager level
    if (req.user.role !== 'PROPERTY_MANAGER' && req.user.role !== 'ADMIN') {
      // Find a property this user is associated with to get the manager
      let property = null;

      if (req.user.role === 'OWNER') {
        const ownership = await prisma.propertyOwner.findFirst({
          where: { ownerId: req.user.id },
          include: {
            property: {
              select: {
                managerId: true,
                manager: {
                  select: {
                    subscriptionPlan: true,
                  },
                },
              },
            },
          },
        });

        if (ownership) {
          property = ownership.property;
        }
      } else if (req.user.role === 'TENANT') {
        const tenancy = await prisma.unitTenant.findFirst({
          where: { tenantId: req.user.id },
          include: {
            unit: {
              select: {
                property: {
                  select: {
                    managerId: true,
                    manager: {
                      select: {
                        subscriptionPlan: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (tenancy) {
          property = tenancy.unit.property;
        }
      } else if (req.user.role === 'TECHNICIAN') {
        const job = await prisma.job.findFirst({
          where: { assignedToId: req.user.id },
          include: {
            property: {
              select: {
                managerId: true,
                manager: {
                  select: {
                    subscriptionPlan: true,
                  },
                },
              },
            },
          },
        });

        if (job) {
          property = job.property;
        }
      }

      if (property) {
        userId = property.managerId;
        subscriptionPlan = property.manager.subscriptionPlan;
      }
    }

    // Get usage statistics
    const usageStats = await getUserUsageStats(userId, subscriptionPlan);
    const planLimits = getPlanLimits(subscriptionPlan);

    // Calculate usage percentages and remaining quotas
    const usageWithLimits = {};

    for (const [limitType, currentUsage] of Object.entries(usageStats.usage)) {
      const limit = planLimits[limitType];

      usageWithLimits[limitType] = {
        current: currentUsage,
        limit: limit === Infinity ? 'unlimited' : limit,
        remaining: getRemainingUsage(subscriptionPlan, limitType, currentUsage),
        percentage: getUsagePercentage(subscriptionPlan, limitType, currentUsage),
        isUnlimited: limit === Infinity,
        isApproachingLimit: getUsagePercentage(subscriptionPlan, limitType, currentUsage) >= 80,
        hasReachedLimit: limit !== Infinity && currentUsage >= limit,
      };
    }

    // Get approaching limits warnings
    const approachingLimits = getApproachingLimits(subscriptionPlan, usageStats.usage);

    res.json({
      plan: subscriptionPlan,
      usage: usageWithLimits,
      warnings: approachingLimits,
      timestamp: usageStats.timestamp,
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return sendError(res, 500, 'Failed to fetch usage statistics', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /api/subscriptions/churn-analysis - Churn analysis (ADMIN only)
// Returns data about cancellations, downgrades, reactivations, and MRR changes
router.get('/churn-analysis', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { startDate, endDate, period = '30d' } = req.query;

    // Calculate date range
    let start, end;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      end = new Date();
      start = new Date();

      // Parse period (e.g., '30d', '7d', '90d', '1y')
      const periodMatch = period.match(/^(\d+)([dmy])$/);
      if (periodMatch) {
        const value = parseInt(periodMatch[1]);
        const unit = periodMatch[2];

        if (unit === 'd') {
          start.setDate(start.getDate() - value);
        } else if (unit === 'm') {
          start.setMonth(start.getMonth() - value);
        } else if (unit === 'y') {
          start.setFullYear(start.getFullYear() - value);
        }
      } else {
        start.setDate(start.getDate() - 30); // Default to 30 days
      }
    }

    // Get subscription counts by plan
    const subscriptionCounts = await prisma.user.groupBy({
      by: ['subscriptionPlan'],
      _count: {
        subscriptionPlan: true,
      },
      where: {
        role: 'PROPERTY_MANAGER',
        subscriptionStatus: {
          in: ['ACTIVE', 'TRIAL'],
        },
      },
    });

    // Get cancellations in period
    const cancellations = await prisma.subscription.count({
      where: {
        status: 'CANCELLED',
        cancelledAt: {
          gte: start,
          lte: end,
        },
      },
    });

    // Get cancellations by plan
    const cancellationsByPlan = await prisma.subscription.groupBy({
      by: ['planName'],
      _count: {
        planName: true,
      },
      where: {
        status: 'CANCELLED',
        cancelledAt: {
          gte: start,
          lte: end,
        },
      },
    });

    // Get new subscriptions in period
    const newSubscriptions = await prisma.subscription.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: {
          in: ['ACTIVE', 'TRIAL'],
        },
      },
    });

    // Get reactivations (users who were cancelled and then became active again)
    const reactivations = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        updatedAt: {
          gte: start,
          lte: end,
        },
        user: {
          subscriptions: {
            some: {
              status: 'CANCELLED',
              cancelledAt: {
                lt: start,
              },
            },
          },
        },
      },
    });

    // Calculate MRR (Monthly Recurring Revenue) estimates
    // Basic = $29, Professional = $79, Enterprise = $149
    const planPrices = {
      BASIC: 29,
      PROFESSIONAL: 79,
      ENTERPRISE: 149,
    };

    let currentMRR = 0;
    const mrrByPlan = {};

    for (const count of subscriptionCounts) {
      const plan = count.subscriptionPlan;
      const price = planPrices[plan] || 0;
      const revenue = price * count._count.subscriptionPlan;

      mrrByPlan[plan] = {
        count: count._count.subscriptionPlan,
        price,
        revenue,
      };

      currentMRR += revenue;
    }

    // Calculate churned MRR
    let churnedMRR = 0;
    for (const cancellation of cancellationsByPlan) {
      const plan = cancellation.planName;
      const price = planPrices[plan] || 0;
      churnedMRR += price * cancellation._count.planName;
    }

    // Calculate churn rate
    const totalActive = subscriptionCounts.reduce((sum, c) => sum + c._count.subscriptionPlan, 0);
    const churnRate = totalActive > 0 ? (cancellations / totalActive) * 100 : 0;

    // Get suspended subscriptions (payment failures)
    const suspended = await prisma.user.count({
      where: {
        role: 'PROPERTY_MANAGER',
        subscriptionStatus: 'SUSPENDED',
      },
    });

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        currentActiveSubscriptions: totalActive,
        newSubscriptions,
        cancellations,
        reactivations,
        suspended,
        netChange: newSubscriptions - cancellations + reactivations,
        churnRate: churnRate.toFixed(2) + '%',
      },
      mrr: {
        current: currentMRR,
        churned: churnedMRR,
        netChange: currentMRR - churnedMRR,
        byPlan: mrrByPlan,
      },
      cancellationsByPlan: cancellationsByPlan.map(c => ({
        plan: c.planName,
        count: c._count.planName,
      })),
      subscriptionCountsByPlan: subscriptionCounts.map(c => ({
        plan: c.subscriptionPlan,
        count: c._count.subscriptionPlan,
      })),
    });
  } catch (error) {
    console.error('Error fetching churn analysis:', error);
    return sendError(res, 500, 'Failed to fetch churn analysis', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
