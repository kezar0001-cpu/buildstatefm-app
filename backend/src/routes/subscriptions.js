import express from 'express';
import { z } from 'zod';
import validate from '../middleware/validate.js';
import { prisma } from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { getUsageStats } from '../utils/usageTracking.js';
import {
  getUsageLimits,
  getRemainingUsage,
  getUsagePercentage,
  getApproachingLimits,
} from '../utils/subscriptionLimits.js';

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

// GET /api/subscriptions/usage - Get comprehensive usage stats
router.get('/usage', requireAuth, async (req, res) => {
  try {
    // Get usage stats (automatically resolves property manager for team members)
    const usageStats = await getUsageStats(req.user.id, req.user.role);
    const plan = usageStats.plan || 'FREE_TRIAL';
    const customLimits = usageStats.customLimits;

    // Get limits for the plan
    const limits = getUsageLimits(plan, customLimits);

    // Build usage response with detailed stats
    const usage = {
      properties: {
        current: usageStats.properties,
        limit: limits.properties === Infinity ? 'Unlimited' : limits.properties,
        remaining: getRemainingUsage(plan, 'properties', usageStats.properties, customLimits),
        percentage: getUsagePercentage(plan, 'properties', usageStats.properties, customLimits),
        isApproachingLimit: false,
        hasReachedLimit: false,
      },
      teamMembers: {
        current: usageStats.teamMembers,
        limit: limits.teamMembers === Infinity ? 'Unlimited' : limits.teamMembers,
        remaining: getRemainingUsage(plan, 'teamMembers', usageStats.teamMembers, customLimits),
        percentage: getUsagePercentage(plan, 'teamMembers', usageStats.teamMembers, customLimits),
        isApproachingLimit: false,
        hasReachedLimit: false,
      },
      inspectionsPerMonth: {
        current: usageStats.inspectionsThisMonth,
        limit: limits.inspectionsPerMonth === Infinity ? 'Unlimited' : limits.inspectionsPerMonth,
        remaining: getRemainingUsage(plan, 'inspectionsPerMonth', usageStats.inspectionsThisMonth, customLimits),
        percentage: getUsagePercentage(plan, 'inspectionsPerMonth', usageStats.inspectionsThisMonth, customLimits),
        isApproachingLimit: false,
        hasReachedLimit: false,
      },
      recurringInspections: {
        current: usageStats.recurringInspections,
        limit: limits.recurringInspections === Infinity ? 'Unlimited' : limits.recurringInspections,
        remaining: getRemainingUsage(plan, 'recurringInspections', usageStats.recurringInspections, customLimits),
        percentage: getUsagePercentage(plan, 'recurringInspections', usageStats.recurringInspections, customLimits),
        isApproachingLimit: false,
        hasReachedLimit: false,
      },
      customTemplates: {
        current: usageStats.customTemplates,
        limit: limits.customTemplates === Infinity ? 'Unlimited' : limits.customTemplates,
        remaining: getRemainingUsage(plan, 'customTemplates', usageStats.customTemplates, customLimits),
        percentage: getUsagePercentage(plan, 'customTemplates', usageStats.customTemplates, customLimits),
        isApproachingLimit: false,
        hasReachedLimit: false,
      },
      maintenancePlans: {
        current: usageStats.maintenancePlans,
        limit: limits.maintenancePlans === Infinity ? 'Unlimited' : limits.maintenancePlans,
        remaining: getRemainingUsage(plan, 'maintenancePlans', usageStats.maintenancePlans, customLimits),
        percentage: getUsagePercentage(plan, 'maintenancePlans', usageStats.maintenancePlans, customLimits),
        isApproachingLimit: false,
        hasReachedLimit: false,
      },
      jobsPerMonth: {
        current: usageStats.jobsThisMonth,
        limit: limits.jobsPerMonth === Infinity ? 'Unlimited' : limits.jobsPerMonth,
        remaining: getRemainingUsage(plan, 'jobsPerMonth', usageStats.jobsThisMonth, customLimits),
        percentage: getUsagePercentage(plan, 'jobsPerMonth', usageStats.jobsThisMonth, customLimits),
        isApproachingLimit: false,
        hasReachedLimit: false,
      },
      documentUploadsPerMonth: {
        current: usageStats.documentUploadsThisMonth,
        limit: limits.documentUploadsPerMonth === Infinity ? 'Unlimited' : limits.documentUploadsPerMonth,
        remaining: getRemainingUsage(plan, 'documentUploadsPerMonth', usageStats.documentUploadsThisMonth, customLimits),
        percentage: getUsagePercentage(plan, 'documentUploadsPerMonth', usageStats.documentUploadsThisMonth, customLimits),
        isApproachingLimit: false,
        hasReachedLimit: false,
      },
    };

    // Calculate approaching limits and reached limits
    const currentUsageObj = {
      properties: usageStats.properties,
      teamMembers: usageStats.teamMembers,
      inspectionsPerMonth: usageStats.inspectionsThisMonth,
      recurringInspections: usageStats.recurringInspections,
      customTemplates: usageStats.customTemplates,
      maintenancePlans: usageStats.maintenancePlans,
      jobsPerMonth: usageStats.jobsThisMonth,
      documentUploadsPerMonth: usageStats.documentUploadsThisMonth,
    };

    const approachingLimits = getApproachingLimits(plan, currentUsageObj, customLimits);
    const warnings = [];

    // Update usage objects with approaching/reached flags
    for (const [key, value] of Object.entries(usage)) {
      const approaching = approachingLimits.find(l => l.type === key);
      if (approaching) {
        value.isApproachingLimit = true;
        if (approaching.percentage >= 100) {
          value.hasReachedLimit = true;
          warnings.push({
            type: key,
            message: `You have reached your ${key} limit. Please upgrade to continue.`,
            severity: 'error',
          });
        } else {
          warnings.push({
            type: key,
            message: `You are using ${approaching.percentage}% of your ${key} limit. Consider upgrading soon.`,
            severity: 'warning',
          });
        }
      }
    }

    res.json({
      plan,
      usage,
      warnings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return sendError(res, 500, 'Failed to fetch usage stats', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /api/subscriptions/churn-analysis - Get churn analysis (admin only)
router.get('/churn-analysis', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all subscriptions
    const allSubscriptions = await prisma.subscription.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            subscriptionPlan: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate metrics
    const cancellations = allSubscriptions.filter(s => 
      s.status === 'CANCELLED' && s.cancelledAt && s.cancelledAt >= thirtyDaysAgo
    ).length;

    const newSubscriptions = allSubscriptions.filter(s => 
      s.status === 'ACTIVE' && s.createdAt >= thirtyDaysAgo
    ).length;

    const reactivations = allSubscriptions.filter(s => 
      s.status === 'ACTIVE' && s.cancelledAt && s.createdAt < s.cancelledAt && s.updatedAt >= thirtyDaysAgo
    ).length;

    const activeSubscriptions = allSubscriptions.filter(s => s.status === 'ACTIVE').length;
    const suspendedSubscriptions = allSubscriptions.filter(s => s.status === 'SUSPENDED').length;

    // Calculate MRR (Monthly Recurring Revenue)
    const planPrices = {
      BASIC: 29,
      PROFESSIONAL: 79,
      ENTERPRISE: 149,
    };

    let mrr = 0;
    const planBreakdown = {
      BASIC: { count: 0, revenue: 0 },
      PROFESSIONAL: { count: 0, revenue: 0 },
      ENTERPRISE: { count: 0, revenue: 0 },
    };

    allSubscriptions
      .filter(s => s.status === 'ACTIVE')
      .forEach(sub => {
        const plan = sub.user.subscriptionPlan || 'FREE_TRIAL';
        if (plan !== 'FREE_TRIAL' && planPrices[plan]) {
          const price = planPrices[plan];
          mrr += price;
          if (planBreakdown[plan]) {
            planBreakdown[plan].count++;
            planBreakdown[plan].revenue += price;
          }
        }
      });

    // Calculate churn rate
    const churnRate = activeSubscriptions > 0 
      ? (cancellations / activeSubscriptions) * 100 
      : 0;

    res.json({
      period: {
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString(),
        days: 30,
      },
      metrics: {
        cancellations,
        newSubscriptions,
        reactivations,
        activeSubscriptions,
        suspendedSubscriptions,
        churnRate: Math.round(churnRate * 100) / 100,
        mrr: Math.round(mrr * 100) / 100,
      },
      planBreakdown,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching churn analysis:', error);
    return sendError(res, 500, 'Failed to fetch churn analysis', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
