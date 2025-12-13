import express from 'express';
import { getDashboardSummary, getRecentActivity } from '../../controllers/dashboardController.js';
import { requireAuth, requireActiveSubscription } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errorHandler.js';
import prisma from '../config/prismaClient.js';
import { cacheMiddleware } from '../utils/cache.js';

const router = express.Router();

/**
 * All routes below are protected by JWT authentication.
 * The requireAuth middleware verifies the token,
 * attaches the user to req.user, and proceeds if valid.
 */
router.use(requireAuth);

// GET /api/dashboard/summary - Returns dashboard summary data (cached for 5 minutes)
router.get('/summary', cacheMiddleware({ ttl: 300 }), asyncHandler(async (req, res) => {
  const data = await getDashboardSummary(req, res);
  return data;
}));

// GET /api/dashboard/activity - Returns recent activity data
router.get('/activity', asyncHandler(async (req, res) => {
  const data = await getRecentActivity(req, res);
  return data;
}));

// GET /api/dashboard/analytics - Returns detailed analytics with time-series data
router.get('/analytics', requireActiveSubscription, asyncHandler(async (req, res) => {
  const { startDate, endDate, propertyId, months = 6 } = req.query;

  if (!['ADMIN', 'PROPERTY_MANAGER', 'OWNER'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // Default to last 6 months if no date range specified
  const endDateObj = endDate ? new Date(endDate) : new Date();
  const monthsToFetch = parseInt(months) || 6;
  const startDateObj = startDate ? new Date(startDate) : new Date(endDateObj.getFullYear(), endDateObj.getMonth() - monthsToFetch, 1);

  const dateFilter = {
    gte: startDateObj,
    lte: endDateObj
  };

  // Build property filter based on user role
  let propertyIds = [];
  if (req.user.role === 'ADMIN') {
    propertyIds = null;
  } else if (req.user.role === 'PROPERTY_MANAGER') {
    const properties = await prisma.property.findMany({
      where: { managerId: req.user.id },
      select: { id: true }
    });
    propertyIds = properties.map(p => p.id);
  } else if (req.user.role === 'OWNER') {
    const ownerships = await prisma.propertyOwner.findMany({
      where: { ownerId: req.user.id },
      select: { propertyId: true }
    });
    propertyIds = ownerships.map(o => o.propertyId);
  }

  // If specific property requested, filter to just that one
  if (propertyId) {
    if (Array.isArray(propertyIds) && !propertyIds.includes(propertyId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    propertyIds = [propertyId];
  }

  const propertyFilter = Array.isArray(propertyIds) ? { propertyId: { in: propertyIds } } : {};

  // Helper function to generate month labels
  const generateMonthLabels = (start, end) => {
    const labels = [];
    const current = new Date(start);
    while (current <= end) {
      labels.push({
        month: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
        label: current.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      });
      current.setMonth(current.getMonth() + 1);
    }
    return labels;
  };

  const monthLabels = generateMonthLabels(startDateObj, endDateObj);

  // Fetch jobs completed over time (aggregated by month)
  const completedJobsData = await prisma.job.findMany({
    where: {
      ...propertyFilter,
      status: 'COMPLETED',
      completedDate: dateFilter
    },
    select: {
      completedDate: true,
      priority: true
    }
  });

  // Aggregate jobs by month
  const jobsByMonth = {};
  const jobsByPriority = { HIGH: 0, MEDIUM: 0, LOW: 0 };

  completedJobsData.forEach(job => {
    if (job.completedDate) {
      const monthKey = `${job.completedDate.getFullYear()}-${String(job.completedDate.getMonth() + 1).padStart(2, '0')}`;
      jobsByMonth[monthKey] = (jobsByMonth[monthKey] || 0) + 1;
      jobsByPriority[job.priority] = (jobsByPriority[job.priority] || 0) + 1;
    }
  });

  const jobsCompletedTimeSeries = monthLabels.map(({ month, label }) => ({
    month: label,
    count: jobsByMonth[month] || 0
  }));

  // Fetch inspections data for completion rate
  const inspectionsData = await prisma.inspection.findMany({
    where: {
      property: Array.isArray(propertyIds) ? { id: { in: propertyIds } } : undefined,
      createdAt: dateFilter
    },
    select: {
      createdAt: true,
      completedDate: true,
      status: true
    }
  });

  // Calculate inspection completion rate by month
  const inspectionsByMonth = {};
  inspectionsData.forEach(inspection => {
    const monthKey = `${inspection.createdAt.getFullYear()}-${String(inspection.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (!inspectionsByMonth[monthKey]) {
      inspectionsByMonth[monthKey] = { total: 0, completed: 0 };
    }
    inspectionsByMonth[monthKey].total += 1;
    if (inspection.status === 'COMPLETED' && inspection.completedDate) {
      inspectionsByMonth[monthKey].completed += 1;
    }
  });

  const inspectionCompletionTimeSeries = monthLabels.map(({ month, label }) => ({
    month: label,
    rate: inspectionsByMonth[month]
      ? Math.round((inspectionsByMonth[month].completed / inspectionsByMonth[month].total) * 100)
      : 0
  }));

  // Fetch service requests by category
  const serviceRequests = await prisma.serviceRequest.findMany({
    where: {
      ...propertyFilter,
      createdAt: dateFilter
    },
    select: {
      category: true,
      priority: true
    }
  });

  const serviceRequestsByCategory = {};
  serviceRequests.forEach(sr => {
    const category = sr.category || 'OTHER';
    serviceRequestsByCategory[category] = (serviceRequestsByCategory[category] || 0) + 1;
  });

  const serviceRequestCategories = Object.entries(serviceRequestsByCategory).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value
  }));

  // Calculate this month vs last month comparison
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const [thisMonthJobs, lastMonthJobs, thisMonthInspections, lastMonthInspections] = await Promise.all([
    prisma.job.count({
      where: {
        ...propertyFilter,
        status: 'COMPLETED',
        completedDate: { gte: thisMonthStart }
      }
    }),
    prisma.job.count({
      where: {
        ...propertyFilter,
        status: 'COMPLETED',
        completedDate: { gte: lastMonthStart, lte: lastMonthEnd }
      }
    }),
    prisma.inspection.count({
      where: {
        property: Array.isArray(propertyIds) ? { id: { in: propertyIds } } : undefined,
        status: 'COMPLETED',
        completedDate: { gte: thisMonthStart }
      }
    }),
    prisma.inspection.count({
      where: {
        property: Array.isArray(propertyIds) ? { id: { in: propertyIds } } : undefined,
        status: 'COMPLETED',
        completedDate: { gte: lastMonthStart, lte: lastMonthEnd }
      }
    })
  ]);

  const jobsChange = lastMonthJobs > 0
    ? Math.round(((thisMonthJobs - lastMonthJobs) / lastMonthJobs) * 100)
    : 0;
  const inspectionsChange = lastMonthInspections > 0
    ? Math.round(((thisMonthInspections - lastMonthInspections) / lastMonthInspections) * 100)
    : 0;

  const analytics = {
    // Time-series data
    jobsCompletedOverTime: jobsCompletedTimeSeries,
    inspectionCompletionRate: inspectionCompletionTimeSeries,

    // Pie chart data
    jobsByPriority: [
      { name: 'High', value: jobsByPriority.HIGH },
      { name: 'Medium', value: jobsByPriority.MEDIUM },
      { name: 'Low', value: jobsByPriority.LOW }
    ].filter(item => item.value > 0),
    serviceRequestCategories,

    // Comparison metrics
    comparison: {
      thisMonth: {
        jobs: thisMonthJobs,
        inspections: thisMonthInspections
      },
      lastMonth: {
        jobs: lastMonthJobs,
        inspections: lastMonthInspections
      },
      changes: {
        jobs: jobsChange,
        inspections: inspectionsChange
      }
    },

    // Summary stats
    totalJobsCompleted: completedJobsData.length,
    totalInspections: inspectionsData.length,
    completedInspections: inspectionsData.filter(i => i.status === 'COMPLETED').length,
    totalServiceRequests: serviceRequests.length
  };

  res.json({ success: true, data: analytics });
}));

export default router;