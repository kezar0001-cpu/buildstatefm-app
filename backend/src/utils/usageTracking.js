/**
 * Usage Tracking - Real-time usage calculation
 * 
 * Tracks usage against subscription limits for property manager-scoped subscriptions.
 * For owners/tenants/technicians, usage is tracked against their property manager's subscription.
 */

import prisma from '../config/prismaClient.js';

/**
 * Get property manager ID for a user
 * For property managers, returns their own ID
 * For team members, finds their property manager
 */
async function getPropertyManagerId(userId, userRole) {
  if (userRole === 'PROPERTY_MANAGER') {
    return userId;
  }

  // For team members, find their property manager
  // This assumes team members are linked via properties or invites
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      receivedInvite: {
        include: {
          invitedBy: true,
        },
      },
      tenantUnits: {
        include: {
          unit: {
            include: {
              property: {
                include: {
                  manager: true,
                },
              },
            },
          },
        },
      },
      ownedProperties: {
        include: {
          property: {
            include: {
              manager: true,
            },
          },
        },
      },
      assignedJobs: {
        include: {
          property: {
            include: {
              manager: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Try to find property manager from various relationships
  if (user.receivedInvite?.invitedBy?.role === 'PROPERTY_MANAGER') {
    return user.receivedInvite.invitedBy.id;
  }

  // From tenant units
  const tenantUnit = user.tenantUnits?.[0];
  if (tenantUnit?.unit?.property?.manager?.id) {
    return tenantUnit.unit.property.manager.id;
  }

  // From owned properties
  const ownedProperty = user.ownedProperties?.[0];
  if (ownedProperty?.property?.manager?.id) {
    return ownedProperty.property.manager.id;
  }

  // From assigned jobs
  const assignedJob = user.assignedJobs?.[0];
  if (assignedJob?.property?.manager?.id) {
    return assignedJob.property.manager.id;
  }

  return null;
}

/**
 * Get property count for a property manager
 */
export async function getPropertyCount(propertyManagerId) {
  const count = await prisma.property.count({
    where: {
      managerId: propertyManagerId,
    },
  });

  return count;
}

/**
 * Get team member count for a property manager
 * Includes all users linked via invites, properties, etc.
 */
export async function getTeamMemberCount(propertyManagerId) {
  // Count all users who are linked to this property manager
  // via invites, properties, or other relationships
  const manager = await prisma.user.findUnique({
    where: { id: propertyManagerId },
    include: {
      sentInvites: {
        where: {
          status: 'ACCEPTED',
        },
      },
      managedProperties: {
        include: {
          owners: {
            include: {
              owner: true,
            },
          },
          units: {
            include: {
              tenants: {
                include: {
                  tenant: true,
                },
              },
            },
          },
          jobs: {
            include: {
              assignedTechnician: true,
            },
          },
        },
      },
    },
  });

  if (!manager) {
    return 0;
  }

  // Collect unique user IDs
  const userIds = new Set();

  // From invites
  manager.sentInvites.forEach(invite => {
    if (invite.invitedUserId) {
      userIds.add(invite.invitedUserId);
    }
  });

  // From property owners
  manager.managedProperties.forEach(property => {
    property.owners.forEach(po => {
      userIds.add(po.ownerId);
    });
  });

  // From unit tenants
  manager.managedProperties.forEach(property => {
    property.units.forEach(unit => {
      unit.tenants.forEach(ut => {
        if (ut.isActive) {
          userIds.add(ut.tenantId);
        }
      });
    });
  });

  // From assigned technicians
  manager.managedProperties.forEach(property => {
    property.jobs.forEach(job => {
      if (job.assignedTechnicianId) {
        userIds.add(job.assignedTechnicianId);
      }
    });
  });

  // Exclude the property manager themselves
  userIds.delete(propertyManagerId);

  return userIds.size;
}

/**
 * Get inspections count for current month
 */
export async function getInspectionsThisMonth(propertyManagerId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const count = await prisma.inspection.count({
    where: {
      property: {
        managerId: propertyManagerId,
      },
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  return count;
}

/**
 * Get recurring inspections count
 */
export async function getRecurringInspectionsCount(propertyManagerId) {
  const count = await prisma.recurringInspection.count({
    where: {
      property: {
        managerId: propertyManagerId,
      },
    },
  });

  return count;
}

/**
 * Get custom templates count
 */
export async function getCustomTemplatesCount(propertyManagerId) {
  const count = await prisma.inspectionTemplate.count({
    where: {
      property: {
        managerId: propertyManagerId,
      },
    },
  });

  return count;
}

/**
 * Get maintenance plans count
 */
export async function getMaintenancePlansCount(propertyManagerId) {
  const count = await prisma.maintenancePlan.count({
    where: {
      property: {
        managerId: propertyManagerId,
      },
    },
  });

  return count;
}

/**
 * Get jobs count for current month
 */
export async function getJobsThisMonth(propertyManagerId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const count = await prisma.job.count({
    where: {
      property: {
        managerId: propertyManagerId,
      },
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  return count;
}

/**
 * Get document uploads count for current month
 */
export async function getDocumentUploadsThisMonth(propertyManagerId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const count = await prisma.propertyDocument.count({
    where: {
      property: {
        managerId: propertyManagerId,
      },
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  return count;
}

/**
 * Get comprehensive usage stats for a user
 * Automatically resolves property manager for team members
 */
export async function getUsageStats(userId, userRole) {
  const propertyManagerId = await getPropertyManagerId(userId, userRole);

  if (!propertyManagerId) {
    // Return zero usage if no property manager found
    return {
      properties: 0,
      teamMembers: 0,
      inspectionsThisMonth: 0,
      recurringInspections: 0,
      customTemplates: 0,
      maintenancePlans: 0,
      jobsThisMonth: 0,
      documentUploadsThisMonth: 0,
    };
  }

  // Get property manager's subscription
  const propertyManager = await prisma.user.findUnique({
    where: { id: propertyManagerId },
    include: {
      subscriptions: {
        where: {
          status: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const plan = propertyManager?.subscriptionPlan || 'FREE_TRIAL';
  const customLimits = propertyManager?.subscriptions?.[0]?.customLimits || null;

  // Calculate all usage metrics
  const [
    properties,
    teamMembers,
    inspectionsThisMonth,
    recurringInspections,
    customTemplates,
    maintenancePlans,
    jobsThisMonth,
    documentUploadsThisMonth,
  ] = await Promise.all([
    getPropertyCount(propertyManagerId),
    getTeamMemberCount(propertyManagerId),
    getInspectionsThisMonth(propertyManagerId),
    getRecurringInspectionsCount(propertyManagerId),
    getCustomTemplatesCount(propertyManagerId),
    getMaintenancePlansCount(propertyManagerId),
    getJobsThisMonth(propertyManagerId),
    getDocumentUploadsThisMonth(propertyManagerId),
  ]);

  return {
    properties,
    teamMembers,
    inspectionsThisMonth,
    recurringInspections,
    customTemplates,
    maintenancePlans,
    jobsThisMonth,
    documentUploadsThisMonth,
    plan,
    customLimits,
    propertyManagerId,
  };
}

