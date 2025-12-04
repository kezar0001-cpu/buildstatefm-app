/**
 * Usage Tracking Utilities
 *
 * Calculates current usage for a user/organization across all usage dimensions
 * in the subscription system.
 */

import { prisma } from '../config/prismaClient.js';

/**
 * Get current property count for a property manager
 * @param {string} userId - Property manager user ID
 * @returns {Promise<number>} Number of active properties
 */
export async function getPropertyCount(userId) {
  return await prisma.property.count({
    where: {
      managerId: userId,
      status: 'ACTIVE',
    },
  });
}

/**
 * Get current team member count for a property manager's organization
 * Counts all users (except the manager) who belong to the same org or are invited
 * @param {string} userId - Property manager user ID
 * @returns {Promise<number>} Number of team members
 */
export async function getTeamMemberCount(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { orgId: true },
  });

  if (!user?.orgId) {
    // No org yet, count is 0
    return 0;
  }

  // Count all users in the org except the owner
  const count = await prisma.user.count({
    where: {
      orgId: user.orgId,
      id: { not: userId },
      isActive: true,
    },
  });

  return count;
}

/**
 * Get inspection count for current month
 * @param {string} userId - Property manager user ID
 * @returns {Promise<number>} Number of inspections this month
 */
export async function getInspectionsThisMonth(userId) {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    return await prisma.inspection.count({
      where: {
        property: {
          managerId: userId,
        },
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    });
  } catch (error) {
    console.error('Error getting inspections this month:', error);
    return 0; // Return 0 on error to prevent request failure
  }
}

/**
 * Get active recurring inspection count
 * @param {string} userId - Property manager user ID
 * @returns {Promise<number>} Number of active recurring inspections
 */
export async function getRecurringInspectionCount(userId) {
  try {
    return await prisma.recurringInspection.count({
      where: {
        Property: {
          managerId: userId,
        },
        isActive: true,
      },
    });
  } catch (error) {
    console.error('Error getting recurring inspection count:', error);
    return 0; // Return 0 on error to prevent request failure
  }
}

/**
 * Get custom template count
 * @param {string} userId - Property manager user ID
 * @returns {Promise<number>} Number of custom templates
 */
export async function getCustomTemplateCount(userId) {
  return await prisma.inspectionTemplate.count({
    where: {
      createdById: userId,
      isActive: true,
    },
  });
}

/**
 * Get active maintenance plan count
 * @param {string} userId - Property manager user ID
 * @returns {Promise<number>} Number of active maintenance plans
 */
export async function getMaintenancePlanCount(userId) {
  return await prisma.maintenancePlan.count({
    where: {
      property: {
        managerId: userId,
      },
      isActive: true,
    },
  });
}

/**
 * Get job count for current month
 * @param {string} userId - Property manager user ID
 * @returns {Promise<number>} Number of jobs this month
 */
export async function getJobsThisMonth(userId) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);

  return await prisma.job.count({
    where: {
      property: {
        managerId: userId,
      },
      createdAt: {
        gte: startOfMonth,
        lt: endOfMonth,
      },
    },
  });
}

/**
 * Get document upload count for current month
 * @param {string} userId - Property manager user ID
 * @returns {Promise<number>} Number of documents uploaded this month
 */
export async function getDocumentUploadsThisMonth(userId) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);

  return await prisma.propertyDocument.count({
    where: {
      uploaderId: userId,
      uploadedAt: {
        gte: startOfMonth,
        lt: endOfMonth,
      },
    },
  });
}

/**
 * Get comprehensive usage stats for a user
 * @param {string} userId - User ID
 * @param {string} subscriptionPlan - User's subscription plan
 * @returns {Promise<object>} Complete usage statistics
 */
export async function getUserUsageStats(userId, subscriptionPlan) {
  const [
    properties,
    teamMembers,
    inspectionsPerMonth,
    recurringInspections,
    customTemplates,
    maintenancePlansActive,
    jobsPerMonth,
    documentUploadsPerMonth,
  ] = await Promise.all([
    getPropertyCount(userId),
    getTeamMemberCount(userId),
    getInspectionsThisMonth(userId),
    getRecurringInspectionCount(userId),
    getCustomTemplateCount(userId),
    getMaintenancePlanCount(userId),
    getJobsThisMonth(userId),
    getDocumentUploadsThisMonth(userId),
  ]);

  return {
    plan: subscriptionPlan,
    usage: {
      properties,
      teamMembers,
      inspectionsPerMonth,
      recurringInspections,
      customTemplates,
      maintenancePlansActive,
      jobsPerMonth,
      documentUploadsPerMonth,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get usage stats for the property manager associated with a user
 * (For non-property managers, this gets their property manager's usage)
 * @param {object} user - User object with role and id
 * @param {string} propertyId - Optional property ID to determine the manager
 * @returns {Promise<object>} Usage statistics for the property manager
 */
export async function getPropertyManagerUsageStats(user, propertyId = null) {
  let propertyManagerId = user.id;
  let subscriptionPlan = user.subscriptionPlan;

  // If user is not a property manager, find their property manager
  if (user.role !== 'PROPERTY_MANAGER') {
    if (!propertyId) {
      throw new Error('Property ID required for non-property manager users');
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        managerId: true,
        manager: {
          select: {
            subscriptionPlan: true,
          },
        },
      },
    });

    if (!property) {
      throw new Error('Property not found');
    }

    propertyManagerId = property.managerId;
    subscriptionPlan = property.manager.subscriptionPlan;
  }

  return await getUserUsageStats(propertyManagerId, subscriptionPlan);
}
