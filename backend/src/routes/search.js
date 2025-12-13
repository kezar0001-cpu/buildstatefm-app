import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, sendError, ErrorCodes } from '../utils/errorHandler.js';
import prisma from '../config/prismaClient.js';

const router = express.Router();

/**
 * Global search endpoint
 * Searches across properties, jobs, inspections, service requests, and maintenance plans
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { q, limit = 20 } = req.query;

  if (!q || q.trim().length === 0) {
    return res.json({ success: true, results: [] });
  }

  const searchTerm = q.trim();
  const searchLimit = Math.min(parseInt(limit, 10) || 20, 50);

  const perEntityTake = Math.max(1, Math.ceil(searchLimit / 6));

  const normalizedTerm = searchTerm.trim().toUpperCase();

  console.log(`[GlobalSearch] Searching for "${searchTerm}" by user ${req.user.id} (${req.user.role})`);

  // Build search filters based on user role
  let propertyFilter = {};
  let accessiblePropertyIds = null;

  if (req.user.role === 'PROPERTY_MANAGER') {
    const managedProperties = await prisma.property.findMany({
      where: { managerId: req.user.id },
      select: { id: true }
    });
    accessiblePropertyIds = managedProperties.map(property => property.id);

    if (accessiblePropertyIds.length === 0) {
      return res.json({ success: true, results: [], total: 0 });
    }

    propertyFilter = { id: { in: accessiblePropertyIds } };
  } else if (req.user.role === 'OWNER') {
    // Get properties owned by this user
    const ownerships = await prisma.propertyOwner.findMany({
      where: { ownerId: req.user.id },
      select: { propertyId: true }
    });
    accessiblePropertyIds = ownerships.map(o => o.propertyId);

    if (accessiblePropertyIds.length === 0) {
      return res.json({ success: true, results: [], total: 0 });
    }

    propertyFilter = { id: { in: accessiblePropertyIds } };
  } else if (req.user.role === 'TENANT') {
    // Get properties where user is a tenant
    const tenancies = await prisma.unitTenant.findMany({
      where: { tenantId: req.user.id, isActive: true },
      select: { unit: { select: { propertyId: true } } },
    });

    accessiblePropertyIds = tenancies
      .map((t) => t.unit?.propertyId)
      .filter(Boolean);

    if (accessiblePropertyIds.length === 0) {
      return res.json({ success: true, results: [], total: 0 });
    }

    propertyFilter = { id: { in: accessiblePropertyIds } };
  } else if (req.user.role === 'TECHNICIAN') {
    // Technicians can only search jobs assigned to them
    const jobs = await prisma.job.findMany({
      where: {
        assignedToId: req.user.id,
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      take: searchLimit,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        property: {
          select: {
            name: true,
            address: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      results: jobs.map(job => ({
        id: job.id,
        type: 'job',
        title: job.title,
        description: job.description,
        subtitle: `${job.property.name} - ${job.status}`,
        status: job.status,
        priority: job.priority,
        link: `/jobs`
      }))
    });
  } else if (req.user.role === 'ADMIN') {
    // Admins can search across all records
  } else {
    return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
  }

  // Search properties
  const properties = await prisma.property.findMany({
    where: {
      ...propertyFilter,
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { address: { contains: searchTerm, mode: 'insensitive' } },
      ]
    },
    take: perEntityTake,
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      status: true
    },
    orderBy: { name: 'asc' }
  });
  const relatedPropertyIds = Array.isArray(accessiblePropertyIds) ? accessiblePropertyIds : null;

  // Search jobs
  const jobs = await prisma.job.findMany({
    where: {
      ...(Array.isArray(relatedPropertyIds) ? { propertyId: { in: relatedPropertyIds } } : {}),
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { notes: { contains: searchTerm, mode: 'insensitive' } },
        { technicianNotes: { contains: searchTerm, mode: 'insensitive' } },
      ]
    },
    take: perEntityTake,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      property: {
        select: {
          name: true,
          address: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Search inspections
  const inspections = await prisma.inspection.findMany({
    where: {
      ...(Array.isArray(relatedPropertyIds) ? { propertyId: { in: relatedPropertyIds } } : {}),
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { notes: { contains: searchTerm, mode: 'insensitive' } },
        { findings: { contains: searchTerm, mode: 'insensitive' } },
      ]
    },
    take: perEntityTake,
    select: {
      id: true,
      title: true,
      type: true,
      notes: true,
      status: true,
      scheduledDate: true,
      property: {
        select: {
          name: true,
          address: true
        }
      }
    },
    orderBy: { scheduledDate: 'desc' }
  });

  // Search service requests (property managers, owners, and tenants)
  let serviceRequests = [];
  if (req.user.role === 'PROPERTY_MANAGER' || req.user.role === 'OWNER' || req.user.role === 'TENANT') {
    const serviceRequestFilter = req.user.role === 'TENANT'
      ? { requestedById: req.user.id }
      : req.user.role === 'OWNER'
        ? {
          property: {
            owners: {
              some: { ownerId: req.user.id },
            },
          },
        }
        : Array.isArray(relatedPropertyIds)
          ? { propertyId: { in: relatedPropertyIds } }
          : {};

    serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        ...serviceRequestFilter,
        // Exclude archived items from search results
        status: { not: 'ARCHIVED' },
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { reviewNotes: { contains: searchTerm, mode: 'insensitive' } },
          { rejectionReason: { contains: searchTerm, mode: 'insensitive' } },
        ]
      },
      take: perEntityTake,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        category: true,
        rejectionReason: true,
        property: {
          select: {
            name: true,
            address: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Search maintenance plans (property managers only)
  let maintenancePlans = [];
  if (req.user.role === 'PROPERTY_MANAGER' || req.user.role === 'ADMIN') {
    maintenancePlans = await prisma.maintenancePlan.findMany({
      where: {
        ...(Array.isArray(relatedPropertyIds) ? { propertyId: { in: relatedPropertyIds } } : {}),
        archivedAt: null,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { frequency: { contains: searchTerm, mode: 'insensitive' } },
        ]
      },
      take: perEntityTake,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        frequency: true,
        property: {
          select: {
            name: true,
            address: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Search recommendations (property managers, owners, technicians)
  let recommendations = [];
  if (req.user.role === 'PROPERTY_MANAGER' || req.user.role === 'OWNER' || req.user.role === 'TECHNICIAN' || req.user.role === 'ADMIN') {
    const recommendationRoleWhere = {};

    if (req.user.role === 'PROPERTY_MANAGER') {
      recommendationRoleWhere.property = { managerId: req.user.id };
    } else if (req.user.role === 'OWNER') {
      recommendationRoleWhere.property = {
        owners: {
          some: { ownerId: req.user.id },
        },
      };
    } else if (req.user.role === 'TECHNICIAN') {
      recommendationRoleWhere.OR = [
        { createdById: req.user.id },
        { report: { is: { inspection: { is: { assignedToId: req.user.id } } } } },
      ];
    }

    recommendations = await prisma.recommendation.findMany({
      where: {
        ...recommendationRoleWhere,
        ...(Array.isArray(relatedPropertyIds) ? { propertyId: { in: relatedPropertyIds } } : {}),
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { rejectionReason: { contains: searchTerm, mode: 'insensitive' } },
          { managerResponse: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: perEntityTake,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        property: {
          select: {
            name: true,
            address: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Format results
  const maybeJobStatus = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(normalizedTerm)
    ? normalizedTerm
    : null;
  const maybeInspectionStatus = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(normalizedTerm)
    ? normalizedTerm
    : null;
  const maybeInspectionType = ['MOVE_IN', 'MOVE_OUT', 'ROUTINE', 'EMERGENCY'].includes(normalizedTerm)
    ? normalizedTerm
    : null;
  const maybeServiceRequestStatus = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CONVERTED_TO_JOB', 'REJECTED', 'COMPLETED', 'PENDING_MANAGER_REVIEW', 'PENDING_OWNER_APPROVAL', 'APPROVED_BY_OWNER', 'REJECTED_BY_OWNER', 'ARCHIVED'].includes(normalizedTerm)
    ? normalizedTerm
    : null;
  const maybeServiceRequestCategory = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'STRUCTURAL', 'PEST_CONTROL', 'LANDSCAPING', 'GENERAL', 'OTHER'].includes(normalizedTerm)
    ? normalizedTerm
    : null;
  const maybeRecommendationStatus = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTED', 'ARCHIVED'].includes(normalizedTerm)
    ? normalizedTerm
    : null;
  const maybePlanActive = normalizedTerm === 'ACTIVE'
    ? true
    : normalizedTerm === 'INACTIVE'
      ? false
      : null;

  // If the term is an exact status/category/etc, do a second-pass filter in-memory.
  // This avoids widening the DB query with relational match conditions.
  const filteredJobs = maybeJobStatus ? jobs.filter((j) => j.status === maybeJobStatus) : jobs;
  const filteredInspections = inspections
    .filter((i) => (maybeInspectionStatus ? i.status === maybeInspectionStatus : true))
    .filter((i) => (maybeInspectionType ? i.type === maybeInspectionType : true));
  const filteredServiceRequests = serviceRequests
    .filter((sr) => (maybeServiceRequestStatus ? sr.status === maybeServiceRequestStatus : true))
    .filter((sr) => (maybeServiceRequestCategory ? sr.category === maybeServiceRequestCategory : true));
  const filteredRecommendations = maybeRecommendationStatus ? recommendations.filter((r) => r.status === maybeRecommendationStatus) : recommendations;
  const filteredPlans = typeof maybePlanActive === 'boolean'
    ? maintenancePlans.filter((p) => p.isActive === maybePlanActive)
    : maintenancePlans;

  const results = [
    ...properties.map(property => ({
      id: property.id,
      type: 'property',
      title: property.name,
      description: property.address,
      subtitle: `${property.city}, ${property.state} - ${property.status}`,
      status: property.status,
      link: `/properties/${property.id}`
    })),
    ...filteredJobs.map(job => ({
      id: job.id,
      type: 'job',
      title: job.title,
      description: job.description,
      subtitle: `${job.property.name} - ${job.status}`,
      status: job.status,
      priority: job.priority,
      link: `/jobs/${job.id}`
    })),
    ...filteredInspections.map(inspection => ({
      id: inspection.id,
      type: 'inspection',
      title: inspection.title,
      description: inspection.notes || 'No notes',
      subtitle: `${inspection.property.name} - ${inspection.status}`,
      status: inspection.status,
      scheduledDate: inspection.scheduledDate,
      link: `/inspections/${inspection.id}`
    })),
    ...filteredServiceRequests.map(request => ({
      id: request.id,
      type: 'service_request',
      title: request.title,
      description: request.description,
      subtitle: `${request.property.name} - ${request.status}`,
      status: request.status,
      priority: request.priority,
      link: `/service-requests`
    })),
    ...filteredRecommendations.map(rec => ({
      id: rec.id,
      type: 'recommendation',
      title: rec.title,
      description: rec.description,
      subtitle: `${rec.property.name} - ${rec.status}`,
      status: rec.status,
      priority: rec.priority,
      link: `/recommendations`
    })),
    ...filteredPlans.map(plan => ({
      id: plan.id,
      type: 'plan',
      title: plan.name,
      description: plan.description || 'No description',
      subtitle: `${plan.property.name} - ${plan.frequency}`,
      status: plan.isActive ? 'ACTIVE' : 'INACTIVE',
      link: `/plans`
    }))
  ];

  console.log(`[GlobalSearch] Found ${results.length} results (${properties.length} properties, ${jobs.length} jobs, ${inspections.length} inspections, ${serviceRequests.length} service requests, ${recommendations.length} recommendations, ${maintenancePlans.length} plans)`);
  
  res.json({ success: true, results, total: results.length });
}));

export default router;
