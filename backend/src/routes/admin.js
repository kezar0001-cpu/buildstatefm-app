import express from 'express';
import crypto from 'crypto';
import prisma from '../config/prismaClient.js';
import { requireAdmin, logAdminAction } from '../middleware/adminAuth.js';
import { getApiTelemetrySnapshot } from '../middleware/logger.js';
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
      revenueStats,
      recentActivity
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
      }),

      (async () => {
        const now = Date.now();
        const windowStart = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const [recentUsers, recentBlogPosts, recentSubscriptions] = await Promise.all([
          prisma.user.findMany({
            where: {
              createdAt: { gte: windowStart },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              email: true,
              role: true,
              createdAt: true,
            },
          }),
          prisma.blogPost.findMany({
            where: {
              status: 'PUBLISHED',
              publishedAt: { not: null, gte: windowStart },
            },
            orderBy: { publishedAt: 'desc' },
            take: 10,
            select: {
              title: true,
              publishedAt: true,
            },
          }),
          prisma.subscription.findMany({
            where: {
              updatedAt: { gte: windowStart },
            },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: {
              status: true,
              planName: true,
              createdAt: true,
              updatedAt: true,
              cancelledAt: true,
              user: {
                select: { email: true },
              },
            },
          }),
        ]);

        const activity = [];

        recentUsers.forEach((u) => {
          activity.push({
            type: 'USER_REGISTERED',
            title: 'New user registered',
            description: `${u.email || 'Unknown'} signed up as ${String(u.role || 'USER').replace('_', ' ')}`,
            createdAt: u.createdAt,
          });
        });

        recentBlogPosts.forEach((p) => {
          activity.push({
            type: 'BLOG_PUBLISHED',
            title: 'Blog post published',
            description: `New post: "${p.title || 'Untitled'}"`,
            createdAt: p.publishedAt,
          });
        });

        recentSubscriptions.forEach((s) => {
          const status = String(s.status || 'UNKNOWN');
          const plan = String(s.planName || 'UNKNOWN');
          const email = s.user?.email || 'Unknown user';

          let title = 'Subscription updated';
          if (status === 'CANCELLED') title = 'Subscription cancelled';
          if (status === 'SUSPENDED') title = 'Subscription suspended';
          if (status === 'ACTIVE' && s.createdAt && s.updatedAt && s.createdAt.getTime() === s.updatedAt.getTime()) {
            title = 'Subscription started';
          }

          activity.push({
            type: 'SUBSCRIPTION_UPDATED',
            title,
            description: `${email} → ${plan} (${status})`,
            createdAt: s.cancelledAt || s.updatedAt || s.createdAt,
          });
        });

        return activity
          .filter((row) => row.createdAt)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10);
      })(),
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

    const normalizeGroupCount = (value) => {
      if (typeof value === 'number') return value;
      if (value && typeof value === 'object') {
        if (typeof value._all === 'number') return value._all;
        const first = Object.values(value).find((v) => typeof v === 'number');
        if (typeof first === 'number') return first;
      }
      return 0;
    };

    const normalizedSubscriptionStats = (Array.isArray(subscriptionStats) ? subscriptionStats : []).map((row) => ({
      ...row,
      _count: normalizeGroupCount(row?._count),
    }));

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
        subscriptions: normalizedSubscriptionStats,
        revenue: revenueStats,
        recentActivity,
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

    const dateKey = (value) => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // User growth over time (avoid raw SQL to prevent column naming mismatches)
    const userGrowthRows = await prisma.user.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        role: true,
      },
    });

    const growthMap = new Map();
    userGrowthRows.forEach((row) => {
      const key = dateKey(row.createdAt);
      if (!key) return;
      const role = row.role || 'UNKNOWN';
      const mapKey = `${key}:${role}`;
      growthMap.set(mapKey, (growthMap.get(mapKey) || 0) + 1);
    });

    const userGrowth = Array.from(growthMap.entries())
      .map(([mapKey, count]) => {
        const [date, role] = mapKey.split(':');
        return { date, role, count };
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.role).localeCompare(String(b.role)));

    // User activity metrics (DateTime cannot be averaged; provide counts + most recent login)
    const activityMetrics = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
      _max: { lastLoginAt: true },
      where: {
        lastLoginAt: {
          gte: startDate,
        },
      },
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

    const normalizeGroupCount = (value) => {
      if (typeof value === 'number') return value;
      if (value && typeof value === 'object') {
        if (typeof value._all === 'number') return value._all;
        const first = Object.values(value).find((v) => typeof v === 'number');
        if (typeof first === 'number') return first;
      }
      return 0;
    };

    const normalizedDistribution = (Array.isArray(subscriptionDistribution) ? subscriptionDistribution : []).map((row) => ({
      ...row,
      _count: normalizeGroupCount(row?._count),
    }));

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
        subscriptionStatus: 'CANCELLED',
        role: 'PROPERTY_MANAGER'
      }
    });

    res.json({
      success: true,
      data: {
        distribution: normalizedDistribution,
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

router.get('/analytics/product', requireAdmin, logAdminAction('view_product_analytics'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

    const now = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const startOfWeekKey = (value) => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const propertyManagers = await prisma.user.findMany({
      where: { role: 'PROPERTY_MANAGER' },
      select: { id: true },
    });
    const propertyManagerIds = propertyManagers.map((u) => u.id);

    const newPropertyManagers = await prisma.user.findMany({
      where: {
        role: 'PROPERTY_MANAGER',
        createdAt: { gte: startDate },
      },
      select: { id: true, createdAt: true },
    });
    const newPropertyManagerIds = newPropertyManagers.map((u) => u.id);

    const [
      propertiesByNewPms,
      unitsByNewPms,
      inspectionsByNewPms,
      jobsByNewPms,
      completedJobsByNewPms,
      completedInspectionsByNewPms,
    ] = await Promise.all([
      prisma.property.findMany({
        where: { managerId: { in: newPropertyManagerIds }, createdAt: { gte: startDate } },
        select: { managerId: true, createdAt: true },
      }),
      prisma.unit.findMany({
        where: { createdAt: { gte: startDate }, property: { managerId: { in: newPropertyManagerIds } } },
        select: { createdAt: true, property: { select: { managerId: true } } },
      }),
      prisma.inspection.findMany({
        where: { createdAt: { gte: startDate }, property: { managerId: { in: newPropertyManagerIds } } },
        select: { createdAt: true, property: { select: { managerId: true } } },
      }),
      prisma.job.findMany({
        where: { createdAt: { gte: startDate }, createdById: { in: newPropertyManagerIds } },
        select: { createdAt: true, createdById: true },
      }),
      prisma.job.findMany({
        where: {
          status: 'COMPLETED',
          completedDate: { gte: startDate },
          createdById: { in: newPropertyManagerIds },
        },
        select: { completedDate: true, createdById: true },
      }),
      prisma.inspection.findMany({
        where: {
          status: 'COMPLETED',
          completedDate: { gte: startDate },
          property: { managerId: { in: newPropertyManagerIds } },
        },
        select: { completedDate: true, property: { select: { managerId: true } } },
      }),
    ]);

    const createdPropertyManagers = new Set(propertiesByNewPms.map((p) => p.managerId).filter(Boolean));
    const createdUnitManagers = new Set(unitsByNewPms.map((u) => u.property?.managerId).filter(Boolean));
    const createdInspectionManagers = new Set(inspectionsByNewPms.map((i) => i.property?.managerId).filter(Boolean));
    const createdJobManagers = new Set(jobsByNewPms.map((j) => j.createdById).filter(Boolean));
    const completedWorkflowManagers = new Set([
      ...completedJobsByNewPms.map((j) => j.createdById).filter(Boolean),
      ...completedInspectionsByNewPms.map((i) => i.property?.managerId).filter(Boolean),
    ]);

    const funnelSteps = [
      { key: 'signed_up', label: 'Signed up', count: newPropertyManagerIds.length },
      { key: 'created_property', label: 'Created property', count: createdPropertyManagers.size },
      { key: 'created_unit', label: 'Created unit', count: createdUnitManagers.size },
      { key: 'scheduled_inspection', label: 'Scheduled inspection', count: createdInspectionManagers.size },
      { key: 'created_job', label: 'Created job', count: createdJobManagers.size },
      { key: 'completed_workflow', label: 'Completed job/inspection', count: completedWorkflowManagers.size },
    ];

    const weeksToShow = period === '7d' ? 4 : period === '90d' ? 14 : 8;
    const retentionStart = new Date(now);
    retentionStart.setDate(retentionStart.getDate() - weeksToShow * 7);

    const [propertiesForRetention, unitsForRetention, inspectionsForRetention, jobsForRetention] = await Promise.all([
      prisma.property.findMany({
        where: { createdAt: { gte: retentionStart }, managerId: { in: propertyManagerIds } },
        select: { managerId: true, createdAt: true },
      }),
      prisma.unit.findMany({
        where: { createdAt: { gte: retentionStart } },
        select: { createdAt: true, property: { select: { managerId: true } } },
      }),
      prisma.inspection.findMany({
        where: { createdAt: { gte: retentionStart } },
        select: { createdAt: true, property: { select: { managerId: true } } },
      }),
      prisma.job.findMany({
        where: { createdAt: { gte: retentionStart }, createdById: { in: propertyManagerIds } },
        select: { createdById: true, createdAt: true },
      }),
    ]);

    const weekLabels = (() => {
      const labels = [];
      const cursor = new Date(retentionStart);
      cursor.setHours(0, 0, 0, 0);
      const day = cursor.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      cursor.setDate(cursor.getDate() + diff);

      const endCursor = new Date(now);
      endCursor.setHours(0, 0, 0, 0);

      while (cursor <= endCursor) {
        const key = startOfWeekKey(cursor);
        if (key) labels.push(key);
        cursor.setDate(cursor.getDate() + 7);
      }
      return labels;
    })();

    const activeManagersByWeek = new Map();
    weekLabels.forEach((label) => activeManagersByWeek.set(label, new Set()));

    propertiesForRetention.forEach((row) => {
      const key = startOfWeekKey(row.createdAt);
      if (!key || !activeManagersByWeek.has(key) || !row.managerId) return;
      activeManagersByWeek.get(key).add(row.managerId);
    });

    unitsForRetention.forEach((row) => {
      const managerId = row.property?.managerId;
      const key = startOfWeekKey(row.createdAt);
      if (!key || !activeManagersByWeek.has(key) || !managerId) return;
      activeManagersByWeek.get(key).add(managerId);
    });

    inspectionsForRetention.forEach((row) => {
      const managerId = row.property?.managerId;
      const key = startOfWeekKey(row.createdAt);
      if (!key || !activeManagersByWeek.has(key) || !managerId) return;
      activeManagersByWeek.get(key).add(managerId);
    });

    jobsForRetention.forEach((row) => {
      const key = startOfWeekKey(row.createdAt);
      if (!key || !activeManagersByWeek.has(key) || !row.createdById) return;
      activeManagersByWeek.get(key).add(row.createdById);
    });

    const retentionSeries = weekLabels.map((label) => ({
      week: label,
      activePropertyManagers: activeManagersByWeek.get(label)?.size || 0,
    }));

    res.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        funnel: {
          cohortNewPropertyManagers: newPropertyManagerIds.length,
          steps: funnelSteps,
        },
        retention: {
          series: retentionSeries,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Admin] Product analytics error:', error);
    return sendError(res, 500, 'Failed to load product analytics', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.get('/analytics/revenue', requireAdmin, logAdminAction('view_revenue_analytics'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

    const now = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const planPrices = {
      STARTER: 29,
      BASIC: 29,
      PROFESSIONAL: 79,
      ENTERPRISE: 149,
      FREE_TRIAL: 0,
    };

    const normalisePlan = (value) => {
      if (!value) return null;
      const upper = String(value).trim().toUpperCase();
      if (upper === 'BASIC') return 'STARTER';
      return upper;
    };

    const dateKey = (value) => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const dayLabels = (() => {
      const labels = [];
      const cursor = new Date(now);
      cursor.setHours(0, 0, 0, 0);
      cursor.setDate(cursor.getDate() - (days - 1));
      for (let i = 0; i < days; i += 1) {
        const key = dateKey(cursor);
        if (key) labels.push(key);
        cursor.setDate(cursor.getDate() + 1);
      }
      return labels;
    })();

    const [
      activePlanCounts,
      activePaidCount,
      trialCount,
      suspendedCount,
      cancelledCount,
      cancellationsInPeriod,
      cancellationsByPlanInPeriod,
      newSubscriptionsInPeriod,
      reactivationsInPeriod,
      createdSubsRows,
      cancelledSubsRows,
    ] = await Promise.all([
      prisma.user.groupBy({
        by: ['subscriptionPlan'],
        _count: true,
        where: {
          role: 'PROPERTY_MANAGER',
          subscriptionStatus: 'ACTIVE',
        },
      }),
      prisma.user.count({
        where: {
          role: 'PROPERTY_MANAGER',
          subscriptionStatus: 'ACTIVE',
          subscriptionPlan: { not: 'FREE_TRIAL' },
        },
      }),
      prisma.user.count({
        where: {
          role: 'PROPERTY_MANAGER',
          subscriptionStatus: 'TRIAL',
        },
      }),
      prisma.user.count({
        where: {
          role: 'PROPERTY_MANAGER',
          subscriptionStatus: 'SUSPENDED',
        },
      }),
      prisma.user.count({
        where: {
          role: 'PROPERTY_MANAGER',
          subscriptionStatus: 'CANCELLED',
        },
      }),
      prisma.subscription.count({
        where: {
          status: 'CANCELLED',
          cancelledAt: {
            gte: startDate,
            lte: now,
          },
        },
      }),
      prisma.subscription.groupBy({
        by: ['planName'],
        _count: { planName: true },
        where: {
          status: 'CANCELLED',
          cancelledAt: {
            gte: startDate,
            lte: now,
          },
        },
      }),
      prisma.subscription.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: now,
          },
          status: { in: ['ACTIVE', 'TRIAL'] },
        },
      }),
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          updatedAt: {
            gte: startDate,
            lte: now,
          },
          user: {
            subscriptions: {
              some: {
                status: 'CANCELLED',
                cancelledAt: { lt: startDate },
              },
            },
          },
        },
      }),
      prisma.subscription.findMany({
        where: {
          createdAt: { gte: startDate, lte: now },
          status: { in: ['ACTIVE', 'TRIAL'] },
        },
        select: {
          createdAt: true,
          planName: true,
          status: true,
        },
      }),
      prisma.subscription.findMany({
        where: {
          status: 'CANCELLED',
          cancelledAt: { gte: startDate, lte: now },
        },
        select: {
          cancelledAt: true,
          planName: true,
        },
      }),
    ]);

    let currentMRR = 0;
    const mrrByPlan = {};
    activePlanCounts.forEach((row) => {
      const plan = normalisePlan(row.subscriptionPlan) || 'UNKNOWN';
      const count = (() => {
        const value = row?._count;
        if (typeof value === 'number') return value;
        if (value && typeof value === 'object') {
          if (typeof value._all === 'number') return value._all;
          if (typeof value.subscriptionPlan === 'number') return value.subscriptionPlan;
          const first = Object.values(value).find((v) => typeof v === 'number');
          if (typeof first === 'number') return first;
        }
        return 0;
      })();
      const price = planPrices[plan] || 0;
      const revenue = price * count;
      mrrByPlan[plan] = { count, price, revenue };
      currentMRR += revenue;
    });

    const churnedMRRInPeriod = cancellationsByPlanInPeriod.reduce((acc, row) => {
      const plan = normalisePlan(row.planName) || 'UNKNOWN';
      const price = planPrices[plan] || 0;
      return acc + price * (Number(row._count?.planName) || 0);
    }, 0);

    const totalActiveOrTrial = await prisma.user.count({
      where: {
        role: 'PROPERTY_MANAGER',
        subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] },
      },
    });

    const churnRate = totalActiveOrTrial > 0 ? (cancellationsInPeriod / totalActiveOrTrial) * 100 : 0;

    const seriesMap = new Map();
    dayLabels.forEach((label) => {
      seriesMap.set(label, {
        date: label,
        newSubscriptions: 0,
        cancellations: 0,
        newMRR: 0,
        churnedMRR: 0,
        netMRR: 0,
      });
    });

    createdSubsRows.forEach((row) => {
      const key = dateKey(row.createdAt);
      if (!key || !seriesMap.has(key)) return;
      const entry = seriesMap.get(key);
      entry.newSubscriptions += 1;
      const plan = normalisePlan(row.planName);
      const price = planPrices[plan] || 0;
      if (String(row.status) === 'ACTIVE') entry.newMRR += price;
    });

    cancelledSubsRows.forEach((row) => {
      const key = dateKey(row.cancelledAt);
      if (!key || !seriesMap.has(key)) return;
      const entry = seriesMap.get(key);
      entry.cancellations += 1;
      const plan = normalisePlan(row.planName);
      const price = planPrices[plan] || 0;
      entry.churnedMRR += price;
    });

    Array.from(seriesMap.values()).forEach((row) => {
      row.netMRR = row.newMRR - row.churnedMRR;
    });

    res.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        timeSeries: Array.from(seriesMap.values()),
        summary: {
          currentMRR,
          arr: currentMRR * 12,
          activePaidCount,
          trialCount,
          suspendedCount,
          cancelledCount,
          newSubscriptionsInPeriod,
          cancellationsInPeriod,
          reactivationsInPeriod,
          churnRate: Number(churnRate.toFixed(2)),
          churnedMRRInPeriod,
        },
        mrrByPlan,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Admin] Revenue analytics error:', error);
    return sendError(res, 500, 'Failed to load revenue analytics', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

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

router.get('/analytics/operations', requireAdmin, logAdminAction('view_operations_analytics'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

    const now = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const dateKey = (value) => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const dayLabels = (() => {
      const labels = [];
      const cursor = new Date(now);
      cursor.setHours(0, 0, 0, 0);
      cursor.setDate(cursor.getDate() - (days - 1));
      for (let i = 0; i < days; i += 1) {
        const key = dateKey(cursor);
        if (key) labels.push(key);
        cursor.setDate(cursor.getDate() + 1);
      }
      return labels;
    })();

    const summarizeDurationsHours = (values) => {
      const clean = (Array.isArray(values) ? values : [])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v >= 0);

      const count = clean.length;
      if (count === 0) return { count: 0 };

      clean.sort((a, b) => a - b);
      const sum = clean.reduce((acc, v) => acc + v, 0);
      const avgHours = sum / count;
      const medianHours = count % 2 === 1
        ? clean[(count - 1) / 2]
        : (clean[count / 2 - 1] + clean[count / 2]) / 2;
      const p90Idx = Math.max(0, Math.ceil(0.9 * count) - 1);
      const p90Hours = clean[p90Idx];

      return {
        count,
        avgHours: Number(avgHours.toFixed(2)),
        medianHours: Number(medianHours.toFixed(2)),
        p90Hours: Number(p90Hours.toFixed(2)),
      };
    };

    const diffHours = (start, end) => {
      if (!start || !end) return null;
      const s = new Date(start);
      const e = new Date(end);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
      return (e.getTime() - s.getTime()) / (1000 * 60 * 60);
    };

    const [
      jobsCreatedRows,
      jobsCompletedRows,
      inspectionsCreatedRows,
      inspectionsCompletedRows,
      serviceRequestsRows,
      conversionJobRows,
      openJobs,
      unassignedJobs,
      overdueJobs,
      pendingInspections,
      serviceRequestsBacklog,
    ] = await Promise.all([
      prisma.job.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      prisma.job.findMany({
        where: { status: 'COMPLETED', completedDate: { gte: startDate } },
        select: { createdAt: true, completedDate: true },
      }),
      prisma.inspection.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      prisma.inspection.findMany({
        where: { status: 'COMPLETED', completedDate: { gte: startDate } },
        select: { createdAt: true, completedDate: true },
      }),
      prisma.serviceRequest.findMany({
        where: { createdAt: { gte: startDate } },
        select: { id: true, createdAt: true, approvedAt: true },
      }),
      prisma.job.findMany({
        where: { serviceRequestId: { not: null }, createdAt: { gte: startDate } },
        select: { createdAt: true, serviceRequestId: true },
      }),
      prisma.job.count({
        where: { archivedAt: null, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
      }),
      prisma.job.count({
        where: { archivedAt: null, status: 'OPEN', assignedToId: null },
      }),
      prisma.job.count({
        where: {
          archivedAt: null,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
          scheduledDate: { lt: now },
        },
      }),
      prisma.inspection.count({
        where: { archivedAt: null, status: { in: ['SCHEDULED', 'IN_PROGRESS', 'PENDING_APPROVAL'] } },
      }),
      prisma.serviceRequest.count({
        where: {
          archivedAt: null,
          status: {
            in: [
              'SUBMITTED',
              'UNDER_REVIEW',
              'PENDING_MANAGER_REVIEW',
              'PENDING_OWNER_APPROVAL',
              'APPROVED',
              'APPROVED_BY_OWNER',
            ],
          },
        },
      }),
    ]);

    const seriesMap = new Map();
    dayLabels.forEach((label) => {
      seriesMap.set(label, {
        date: label,
        jobsCreated: 0,
        jobsCompleted: 0,
        inspectionsCreated: 0,
        inspectionsCompleted: 0,
        serviceRequestsCreated: 0,
        serviceRequestsConverted: 0,
      });
    });

    jobsCreatedRows.forEach((row) => {
      const key = dateKey(row.createdAt);
      if (!key || !seriesMap.has(key)) return;
      seriesMap.get(key).jobsCreated += 1;
    });

    jobsCompletedRows.forEach((row) => {
      const key = dateKey(row.completedDate);
      if (!key || !seriesMap.has(key)) return;
      seriesMap.get(key).jobsCompleted += 1;
    });

    inspectionsCreatedRows.forEach((row) => {
      const key = dateKey(row.createdAt);
      if (!key || !seriesMap.has(key)) return;
      seriesMap.get(key).inspectionsCreated += 1;
    });

    inspectionsCompletedRows.forEach((row) => {
      const key = dateKey(row.completedDate);
      if (!key || !seriesMap.has(key)) return;
      seriesMap.get(key).inspectionsCompleted += 1;
    });

    serviceRequestsRows.forEach((row) => {
      const key = dateKey(row.createdAt);
      if (!key || !seriesMap.has(key)) return;
      seriesMap.get(key).serviceRequestsCreated += 1;
    });

    conversionJobRows.forEach((row) => {
      const key = dateKey(row.createdAt);
      if (!key || !seriesMap.has(key)) return;
      seriesMap.get(key).serviceRequestsConverted += 1;
    });

    const jobCycleHours = jobsCompletedRows
      .map((row) => diffHours(row.createdAt, row.completedDate))
      .filter((v) => Number.isFinite(v));

    const inspectionCycleHours = inspectionsCompletedRows
      .map((row) => diffHours(row.createdAt, row.completedDate))
      .filter((v) => Number.isFinite(v));

    const serviceRequestApprovalHours = serviceRequestsRows
      .filter((row) => row.approvedAt && new Date(row.approvedAt) >= startDate)
      .map((row) => diffHours(row.createdAt, row.approvedAt))
      .filter((v) => Number.isFinite(v));

    const srCreatedMap = new Map(serviceRequestsRows.map((sr) => [sr.id, sr.createdAt]));
    const serviceRequestConversionHours = conversionJobRows
      .map((job) => diffHours(srCreatedMap.get(job.serviceRequestId), job.createdAt))
      .filter((v) => Number.isFinite(v));

    res.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        timeSeries: Array.from(seriesMap.values()),
        backlog: {
          openJobs,
          unassignedJobs,
          overdueJobs,
          pendingInspections,
          serviceRequestsBacklog,
        },
        cycleTimes: {
          jobCompletion: summarizeDurationsHours(jobCycleHours),
          inspectionCompletion: summarizeDurationsHours(inspectionCycleHours),
          serviceRequestApproval: summarizeDurationsHours(serviceRequestApprovalHours),
          serviceRequestConversion: summarizeDurationsHours(serviceRequestConversionHours),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Admin] Operations analytics error:', error);
    return sendError(res, 500, 'Failed to load operations analytics', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

router.get('/observability', requireAdmin, logAdminAction('view_observability'), async (req, res) => {
  try {
    const windowMsRaw = Number(req.query.windowMs);
    const windowMs = Number.isFinite(windowMsRaw) && windowMsRaw > 0 ? windowMsRaw : 15 * 60 * 1000;

    const telemetry = getApiTelemetrySnapshot({ windowMs });

    const [unprocessedStripeWebhooks, oldestUnprocessedWebhook, propertyManagers] = await Promise.all([
      prisma.stripeWebhookEvent.count({ where: { processed: false } }),
      prisma.stripeWebhookEvent.findFirst({
        where: { processed: false },
        orderBy: { createdAt: 'asc' },
        select: { eventType: true, createdAt: true },
      }),
      prisma.user.findMany({
        where: { role: 'PROPERTY_MANAGER' },
        select: {
          id: true,
          email: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true, planName: true, updatedAt: true, createdAt: true },
          },
        },
      }),
    ]);

    let missingSubscriptionCount = 0;
    let mismatchCount = 0;
    const mismatchExamples = [];

    const normalise = (value) => {
      if (!value) return null;
      return String(value).trim().toUpperCase();
    };

    propertyManagers.forEach((pm) => {
      const latest = Array.isArray(pm.subscriptions) ? pm.subscriptions[0] : null;
      if (!latest) {
        missingSubscriptionCount += 1;
        if (mismatchExamples.length < 10) {
          mismatchExamples.push({
            userId: pm.id,
            email: pm.email,
            user: { status: pm.subscriptionStatus, plan: pm.subscriptionPlan },
            subscription: null,
          });
        }
        return;
      }

      const userStatus = normalise(pm.subscriptionStatus);
      const subStatus = normalise(latest.status);
      const userPlan = normalise(pm.subscriptionPlan);
      const subPlan = normalise(latest.planName);

      const isMismatch = (userStatus && subStatus && userStatus !== subStatus) || (userPlan && subPlan && userPlan !== subPlan);
      if (!isMismatch) return;

      mismatchCount += 1;
      if (mismatchExamples.length < 10) {
        mismatchExamples.push({
          userId: pm.id,
          email: pm.email,
          user: { status: pm.subscriptionStatus, plan: pm.subscriptionPlan },
          subscription: { status: latest.status, plan: latest.planName, updatedAt: latest.updatedAt, createdAt: latest.createdAt },
        });
      }
    });

    const oldestCreatedAt = oldestUnprocessedWebhook?.createdAt ? new Date(oldestUnprocessedWebhook.createdAt) : null;
    const oldestAgeMinutes = oldestCreatedAt ? Math.round((Date.now() - oldestCreatedAt.getTime()) / (60 * 1000)) : null;

    res.json({
      success: true,
      data: {
        telemetry,
        stripeWebhooks: {
          unprocessedCount: unprocessedStripeWebhooks,
          oldestUnprocessed: oldestUnprocessedWebhook
            ? {
                eventType: oldestUnprocessedWebhook.eventType,
                createdAt: oldestUnprocessedWebhook.createdAt,
                ageMinutes: oldestAgeMinutes,
              }
            : null,
        },
        dataQuality: {
          subscriptionConsistency: {
            propertyManagers: propertyManagers.length,
            missingSubscriptionCount,
            mismatchCount,
            examples: mismatchExamples,
          },
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Admin] Observability error:', error);
    return sendError(res, 500, 'Failed to load observability', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

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
