import prisma from '../src/config/prismaClient.js';
import { get, set, invalidate } from '../src/utils/cache.js';

// ============================================
// DASHBOARD CONTROLLER
// ============================================

/**
 * GET /api/dashboard/summary
 * Role-aware, aggregated snapshot for the signed-in user.
 * Cached for 5 minutes to improve performance.
 */
export const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    
    // Generate cache key
    const cacheKey = `cache:/api/dashboard/summary:user:${userId}:role:${role}`;
    
    // Try to get from cache
    const cached = await get(cacheKey);
    if (cached) {
      return res.json({ success: true, summary: cached, cached: true });
    }

    const summary = {
      properties: { total: 0, active: 0, inactive: 0, underMaintenance: 0 },
      units:      { total: 0, occupied: 0, available: 0, maintenance: 0 },
      jobs:       { total: 0, open: 0, assigned: 0, inProgress: 0, completed: 0, overdue: 0 },
      inspections:{ total: 0, scheduled: 0, inProgress: 0, completed: 0, upcoming: 0 },
      serviceRequests: { total: 0, submitted: 0, underReview: 0, approved: 0, converted: 0, completed: 0 },
      alerts: [],
    };

    // ---------- Role scoping
    let propertyFilter = {};
    let jobFilter = {};
    let inspectionFilter = {};
    let serviceRequestWhere = {};
    let tenantPropertyIds = null;

    if (role === 'PROPERTY_MANAGER') {
      propertyFilter = { managerId: userId };
      jobFilter = { property: { managerId: userId } };
      inspectionFilter = { property: { managerId: userId } };
      serviceRequestWhere = { property: { managerId: userId } };
    } else if (role === 'OWNER') {
      propertyFilter = { owners: { some: { ownerId: userId } } };
      jobFilter = { property: { owners: { some: { ownerId: userId } } } };
      inspectionFilter = { property: { owners: { some: { ownerId: userId } } } };
      serviceRequestWhere = { property: { owners: { some: { ownerId: userId } } } };
    } else if (role === 'TENANT') {
      // Tenant: get properties via active unit tenancies
      // Optimization: Use a single query with direct propertyId selection
      const tenantUnits = await prisma.unitTenant.findMany({
        where: { tenantId: userId, isActive: true },
        select: { unit: { select: { propertyId: true } } },
        // Add index hint: ensure unitTenant has index on (tenantId, isActive)
      });
      const propertyIds = [...new Set(
        tenantUnits
          .map((ut) => ut.unit?.propertyId)
          .filter((value) => typeof value === 'string' && value.length > 0)
      )];

      tenantPropertyIds = propertyIds;

      if (propertyIds.length > 0) {
        propertyFilter = { id: { in: propertyIds } };
        jobFilter = { propertyId: { in: propertyIds } };
        inspectionFilter = { propertyId: { in: propertyIds } };
      } else {
        // Explicitly restrict filters when tenant has no linked properties to avoid falling back to global data
        propertyFilter = { id: { in: [] } };
        jobFilter = { propertyId: { in: [] } };
        inspectionFilter = { propertyId: { in: [] } };
      }

      // Service requests created by the tenant
      serviceRequestWhere = { requestedById: userId };
    } else if (role === 'TECHNICIAN') {
      jobFilter = { assignedToId: userId };
      inspectionFilter = { assignedToId: userId };
      // Tech sees SRs only if linked to their jobs (not counted in summary buckets here)
      serviceRequestWhere = { jobs: { some: { assignedToId: userId } } };
    }

    // ---------- Properties (not relevant for pure technician view)
    const tenantHasAccessibleProperties = Array.isArray(tenantPropertyIds) && tenantPropertyIds.length > 0;
    if (role !== 'TECHNICIAN' && (role !== 'TENANT' || tenantHasAccessibleProperties)) {
      const byStatus = await prisma.property.groupBy({
        by: ['status'],
        where: propertyFilter,
        _count: { _all: true },
      });
      summary.properties.total = byStatus.reduce((n, r) => n + r._count._all, 0);
      for (const r of byStatus) {
        if (r.status === 'ACTIVE') summary.properties.active = r._count._all;
        if (r.status === 'INACTIVE') summary.properties.inactive = r._count._all;
        if (r.status === 'UNDER_MAINTENANCE') summary.properties.underMaintenance = r._count._all;
      }
    }

    // ---------- Units (also scoped by properties)
    // Optimization: Use a single query with property relation filter instead of fetching property IDs first
    if (role !== 'TECHNICIAN' && (role !== 'TENANT' || tenantHasAccessibleProperties)) {
      const byStatus = await prisma.unit.groupBy({
        by: ['status'],
        where: {
          property: propertyFilter, // Direct relation filter - more efficient than fetching IDs first
        },
        _count: { _all: true },
      });
      summary.units.total = byStatus.reduce((n, r) => n + r._count._all, 0);
      for (const r of byStatus) {
        if (r.status === 'OCCUPIED') summary.units.occupied = r._count._all;
        if (r.status === 'AVAILABLE') summary.units.available = r._count._all;
        if (r.status === 'MAINTENANCE') summary.units.maintenance = r._count._all;
      }
    }

    // ---------- Jobs
    if (role !== 'TENANT' || tenantHasAccessibleProperties) {
      const byStatus = await prisma.job.groupBy({
        by: ['status'],
        where: jobFilter,
        _count: { _all: true },
      });
      summary.jobs.total = byStatus.reduce((n, r) => n + r._count._all, 0);
      for (const r of byStatus) {
        if (r.status === 'OPEN')        summary.jobs.open = r._count._all;
        if (r.status === 'ASSIGNED')    summary.jobs.assigned = r._count._all;
        if (r.status === 'IN_PROGRESS') summary.jobs.inProgress = r._count._all;
        if (r.status === 'COMPLETED')   summary.jobs.completed = r._count._all;
      }

      const overdueJobs = await prisma.job.count({
        where: {
          ...jobFilter,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
          scheduledDate: { lt: new Date() },
        },
      });
      summary.jobs.overdue = overdueJobs;
    }

    // ---------- Inspections
    if (role !== 'TENANT' || tenantHasAccessibleProperties) {
      const inspectionWhere = { ...inspectionFilter, archivedAt: null };

      const byStatus = await prisma.inspection.groupBy({
        by: ['status'],
        where: inspectionWhere,
        _count: { _all: true },
      });
      summary.inspections.total = byStatus.reduce((n, r) => n + r._count._all, 0);
      for (const r of byStatus) {
        if (r.status === 'SCHEDULED')   summary.inspections.scheduled = r._count._all;
        if (r.status === 'IN_PROGRESS') summary.inspections.inProgress = r._count._all;
        if (r.status === 'COMPLETED')   summary.inspections.completed = r._count._all;
      }

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      summary.inspections.upcoming = await prisma.inspection.count({
        where: {
          ...inspectionWhere,
          status: 'SCHEDULED',
          scheduledDate: { gte: new Date(), lte: nextWeek },
        },
      });
    }

    // ---------- Service Requests (only surfaced for PM & Owner in the buckets)
    // Preserves history by including converted and completed requests
    if (role === 'PROPERTY_MANAGER' || role === 'OWNER') {
      const byStatus = await prisma.serviceRequest.groupBy({
        by: ['status'],
        where: serviceRequestWhere,
        _count: { _all: true },
      });
      summary.serviceRequests.total = byStatus.reduce((n, r) => n + r._count._all, 0);
      for (const r of byStatus) {
        if (r.status === 'SUBMITTED')        summary.serviceRequests.submitted = r._count._all;
        if (r.status === 'UNDER_REVIEW')     summary.serviceRequests.underReview = r._count._all;
        if (r.status === 'APPROVED')         summary.serviceRequests.approved = r._count._all;
        if (r.status === 'CONVERTED_TO_JOB') summary.serviceRequests.converted = r._count._all;
        if (r.status === 'COMPLETED')        summary.serviceRequests.completed = r._count._all;
      }
    }

    // ---------- Alerts
    const alerts = [];
    if (role === 'PROPERTY_MANAGER') {
      // Optimization: Use user's subscriptionStatus and trialEndDate from req.user instead of querying
      // This assumes the user object is populated with subscription data in the auth middleware
      const subscriptionStatus = req.user?.subscriptionStatus;
      const trialEndDate = req.user?.trialEndDate;
      const stripeCurrentPeriodEnd = req.user?.stripeCurrentPeriodEnd;
      
      // Fallback to database query if user object doesn't have subscription data
      let subscription = null;
      if (!subscriptionStatus) {
        subscription = await prisma.subscription.findFirst({
          where: { userId, status: { in: ['TRIAL', 'ACTIVE'] } },
          orderBy: { createdAt: 'desc' },
          select: {
            status: true,
            trialEndDate: true,
            stripeCurrentPeriodEnd: true,
          },
        });
      } else {
        // Use data from req.user
        subscription = {
          status: subscriptionStatus,
          trialEndDate,
          stripeCurrentPeriodEnd,
        };
      }
      if (subscription) {
        if (subscription.status === 'TRIAL' && subscription.trialEndDate) {
          const daysLeft = Math.ceil((new Date(subscription.trialEndDate) - new Date()) / 86400000);
          if (daysLeft <= 3 && daysLeft > 0) {
            alerts.push({
              id: 'trial_ending',
              type: 'warning',
              title: 'Trial Ending Soon',
              message: `Your trial ends in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`,
              action: { label: 'Subscribe Now', link: '/subscriptions' },
            });
          } else if (daysLeft <= 0) {
            alerts.push({
              id: 'trial_expired',
              type: 'error',
              title: 'Trial Expired',
              message: 'Your trial has expired.',
              action: { label: 'Subscribe Now', link: '/subscriptions' },
            });
          }
        }
        if (subscription.status === 'ACTIVE' && subscription.stripeCurrentPeriodEnd) {
          const daysLeft = Math.ceil(
            (new Date(subscription.stripeCurrentPeriodEnd) - new Date()) / 86400000
          );
          if (daysLeft <= 3 && daysLeft > 0) {
            alerts.push({
              id: 'renewal_soon',
              type: 'info',
              title: 'Subscription Renewal',
              message: `Your subscription renews in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`,
              action: { label: 'Manage Subscription', link: '/subscriptions' },
            });
          }
        }
      } else {
        alerts.push({
          id: 'no_subscription',
          type: 'error',
          title: 'No Active Subscription',
          message: 'You need an active subscription to access all features.',
          action: { label: 'Subscribe Now', link: '/subscriptions' },
        });
      }
    }
    if (summary.jobs.overdue > 0) {
      alerts.push({
        id: 'overdue_jobs',
        type: 'warning',
        title: 'Overdue Jobs',
        message: `You have ${summary.jobs.overdue} overdue job${summary.jobs.overdue > 1 ? 's' : ''}.`,
        action: { label: 'View Jobs', link: '/jobs?filter=overdue' },
      });
    }
    if (summary.inspections.upcoming > 0) {
      alerts.push({
        id: 'upcoming_inspections',
        type: 'info',
        title: 'Upcoming Inspections',
        message: `You have ${summary.inspections.upcoming} inspection${summary.inspections.upcoming > 1 ? 's' : ''} in the next 7 days.`,
        action: { label: 'View Inspections', link: '/inspections' },
      });
    }
    if (role === 'PROPERTY_MANAGER' && summary.serviceRequests.submitted > 0) {
      alerts.push({
        id: 'pending_requests',
        type: 'info',
        title: 'New Service Requests',
        message: `You have ${summary.serviceRequests.submitted} new service request${summary.serviceRequests.submitted > 1 ? 's' : ''}.`,
        action: { label: 'Review Requests', link: '/service-requests' },
      });
    }

    summary.alerts = alerts;

    // Cache the result for 5 minutes (300 seconds)
    await set(cacheKey, summary, 300);

    return res.json({ success: true, summary, cached: false });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard summary' });
  }
};

/**
 * GET /api/dashboard/activity
 * Recent activity feed for the signed-in user.
 */
export const getRecentActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const limitNumber = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const activities = [];

    let tenantPropertyIds = null;
    if (role === 'TENANT') {
      const tenancies = await prisma.unitTenant.findMany({
        where: { tenantId: userId, isActive: true },
        select: { unit: { select: { propertyId: true } } },
      });

      tenantPropertyIds = Array.from(
        new Set(tenancies.map(t => t.unit?.propertyId).filter((value) => typeof value === 'string' && value.length > 0))
      );
    }

    const propertyScope =
      role === 'PROPERTY_MANAGER'
        ? { managerId: userId }
        : role === 'OWNER'
        ? { owners: { some: { ownerId: userId } } }
        : undefined;

    const inspectionWhere =
      role === 'TECHNICIAN'
        ? { assignedToId: userId }
        : role === 'TENANT'
        ? Array.isArray(tenantPropertyIds) && tenantPropertyIds.length > 0
          ? { propertyId: { in: tenantPropertyIds } }
          : { propertyId: { in: [] } }
        : propertyScope
        ? { property: propertyScope }
        : {};

    const jobWhere =
      role === 'TECHNICIAN'
        ? { assignedToId: userId }
        : propertyScope
        ? { property: propertyScope }
        : role === 'TENANT'
        ? { serviceRequest: { requestedById: userId } }
        : {};

    const unitWhere =
      role === 'TECHNICIAN'
        ? { jobs: { some: { assignedToId: userId } } }
        : propertyScope
        ? { property: propertyScope }
        : role === 'TENANT'
        ? { tenants: { some: { tenantId: userId, isActive: true } } }
        : {};

    const serviceRequestWhere =
      role === 'PROPERTY_MANAGER'
        ? { property: { managerId: userId } }
        : role === 'OWNER'
        ? { property: { owners: { some: { ownerId: userId } } } }
        : role === 'TENANT'
        ? { requestedById: userId }
        : role === 'TECHNICIAN'
        ? { jobs: { some: { assignedToId: userId } } }
        : {};

    const [inspections, jobs, serviceRequests, properties, units, notifications] = await Promise.all([
      prisma.inspection.findMany({
        where: inspectionWhere,
        orderBy: { updatedAt: 'desc' },
        take: limitNumber,
        select: {
          id: true, title: true, status: true, scheduledDate: true, updatedAt: true,
          property: { select: { name: true, id: true } },
        },
      }),
      prisma.job.findMany({
        where: jobWhere,
        orderBy: { updatedAt: 'desc' },
        take: limitNumber,
        select: {
          id: true, title: true, status: true, priority: true, updatedAt: true,
          property: { select: { name: true, id: true } },
        },
      }),
      prisma.serviceRequest.findMany({
        where: serviceRequestWhere,
        orderBy: { updatedAt: 'desc' },
        take: limitNumber,
        select: {
          id: true, title: true, status: true, priority: true, updatedAt: true,
          property: { select: { name: true, id: true } },
          requestedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.property.findMany({
        where: propertyScope,
        orderBy: { updatedAt: 'desc' },
        take: limitNumber,
        select: { id: true, name: true, status: true, updatedAt: true },
      }),
      prisma.unit.findMany({
        where: unitWhere,
        orderBy: { updatedAt: 'desc' },
        take: limitNumber,
        select: {
          id: true, unitNumber: true, status: true, updatedAt: true,
          property: { select: { id: true, name: true } },
        },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limitNumber,
        select: {
          id: true, title: true, message: true, type: true,
          entityType: true, entityId: true, createdAt: true,
        },
      }),
    ]);

    inspections.forEach((i) => {
      activities.push({
        type: 'inspection',
        id: i.id,
        title: i.title,
        description: i.property?.name ? `Inspection at ${i.property.name}` : 'Inspection update',
        status: i.status,
        date: i.updatedAt,
        link: '/inspections',
      });
    });

    jobs.forEach((j) => {
      activities.push({
        type: 'job',
        id: j.id,
        title: j.title,
        description: j.property?.name ? `Job at ${j.property.name}` : 'Job update',
        status: j.status,
        priority: j.priority,
        date: j.updatedAt,
        link: '/jobs',
      });
    });

    serviceRequests.forEach((sr) => {
      const requesterName = sr.requestedBy
        ? `${sr.requestedBy.firstName} ${sr.requestedBy.lastName}`.trim()
        : null;
      const statusLabel = sr.status ? sr.status.replace(/_/g, ' ').toLowerCase() : 'updated';

      activities.push({
        type: 'service_request',
        id: sr.id,
        title: sr.title,
        description: `${sr.property?.name ? `${sr.property.name} · ` : ''}${statusLabel}${
          requesterName ? ` by ${requesterName}` : ''
        }`,
        status: sr.status,
        priority: sr.priority,
        date: sr.updatedAt,
        link: '/service-requests',
      });
    });

    properties.forEach((p) => {
      const statusLabel = p.status ? p.status.replace(/_/g, ' ').toLowerCase() : 'updated';
      activities.push({
        type: 'property',
        id: p.id,
        title: p.name,
        description: `Property status updated to ${statusLabel}`,
        status: p.status,
        date: p.updatedAt,
        link: `/properties/${p.id}`,
      });
    });

    units.forEach((u) => {
      activities.push({
        type: 'unit',
        id: u.id,
        title: `Unit ${u.unitNumber}`,
        description: u.property?.name ? `Unit at ${u.property.name} updated` : 'Unit update',
        status: u.status,
        date: u.updatedAt,
        link: u.property ? `/properties/${u.property.id}` : undefined,
      });
    });

    notifications.forEach((n) => {
      activities.push({
        type: n.entityType || 'notification',
        id: n.entityId || n.id,
        title: n.title,
        description: n.message,
        status: n.type,
        date: n.createdAt,
        link:
          n.entityType === 'inspection'
            ? '/inspections'
            : n.entityType === 'job'
            ? '/jobs'
            : n.entityType === 'service_request'
            ? '/service-requests'
            : undefined,
      });
    });

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.json({ success: true, items: activities.slice(0, limitNumber) });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch recent activity' });
  }
};
