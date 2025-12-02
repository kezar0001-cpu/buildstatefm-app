/**
 * Centralized cache invalidation utilities for React Query.
 * Use these functions to ensure consistent cache management across the app.
 */

import { queryKeys } from './queryKeys';

/**
 * Invalidate all property-related queries
 * Use after creating, updating, or deleting a property
 */
export function invalidatePropertyQueries(queryClient, propertyId = null) {
  // Always invalidate the properties list
  queryClient.invalidateQueries({ queryKey: queryKeys.properties.all() });
  queryClient.invalidateQueries({ queryKey: ['properties', 'list'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.properties.selectOptions() });
  
  // Invalidate dashboard as property counts may have changed
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
  
  // If a specific property was modified, invalidate its detail and related queries
  if (propertyId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.properties.detail(propertyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.properties.units(propertyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.properties.activity(propertyId) });
  }
}

/**
 * Invalidate all unit-related queries
 * Use after creating, updating, or deleting a unit
 */
export function invalidateUnitQueries(queryClient, unitId = null, propertyId = null) {
  // Invalidate unit lists
  queryClient.invalidateQueries({ queryKey: queryKeys.units.all() });
  
  // If we know the property, invalidate its units list
  if (propertyId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.units.list(propertyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.units.listByProperty(propertyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.properties.units(propertyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.properties.detail(propertyId) });
  }
  
  // If a specific unit was modified
  if (unitId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.units.detail(unitId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.units.tenants(unitId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.units.jobs(unitId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.units.inspections(unitId) });
  }
  
  // Dashboard may show unit stats
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
}

/**
 * Invalidate all job-related queries
 * Use after creating, updating, or deleting a job
 */
export function invalidateJobQueries(queryClient, jobId = null, propertyId = null, unitId = null) {
  // Invalidate all job lists
  queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
  queryClient.invalidateQueries({ queryKey: ['jobs', 'list'] });
  queryClient.invalidateQueries({ queryKey: ['jobs', 'filtered'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.jobs.technician() });
  queryClient.invalidateQueries({ queryKey: queryKeys.jobs.owner() });
  
  // If a specific job was modified
  if (jobId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.comments(jobId) });
  }
  
  // If we know the unit, invalidate its jobs
  if (unitId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.units.jobs(unitId) });
  }
  
  // Dashboard shows job stats
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.technician() });
}

/**
 * Invalidate all service request-related queries
 * Use after creating, updating, or deleting a service request
 */
export function invalidateServiceRequestQueries(queryClient, requestId = null) {
  // Invalidate all service request lists
  queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });
  queryClient.invalidateQueries({ queryKey: ['serviceRequests', 'list'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.tenant() });
  
  // If a specific request was modified
  if (requestId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.detail(requestId) });
  }
  
  // Dashboard shows service request stats
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.tenant() });
}

/**
 * Invalidate all inspection-related queries
 * Use after creating, updating, or deleting an inspection
 */
export function invalidateInspectionQueries(queryClient, inspectionId = null, propertyId = null, unitId = null) {
  // Invalidate all inspection lists
  queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() });
  queryClient.invalidateQueries({ queryKey: ['inspections', 'list'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.inspections.overdue() });
  queryClient.invalidateQueries({ queryKey: queryKeys.inspections.owner() });
  
  // If a specific inspection was modified
  if (inspectionId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(inspectionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.batchedDetail(inspectionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspectionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.issues(inspectionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.photos(inspectionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.audit(inspectionId) });
  }
  
  // If we know the unit, invalidate its inspections
  if (unitId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.units.inspections(unitId) });
  }
  
  // Dashboard shows inspection stats
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() });
}

/**
 * Invalidate all tenant-related queries
 * Use after creating, updating, or deleting a tenant
 */
export function invalidateTenantQueries(queryClient, tenantId = null, unitId = null) {
  // Invalidate tenant lists
  queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all() });
  
  // If we know the unit
  if (unitId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tenants.list(unitId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.units.tenants(unitId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.units.detail(unitId) });
  }
  
  // If a specific tenant was modified
  if (tenantId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tenants.detail(tenantId) });
  }
}

/**
 * Invalidate all notification queries
 * Use after marking notifications as read or receiving new ones
 */
export function invalidateNotificationQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.count() });
}

/**
 * Invalidate dashboard queries
 * Use when any data that affects the dashboard has changed
 */
export function invalidateDashboardQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.analytics() });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.alerts() });
}

/**
 * Invalidate user-related queries
 * Use after updating user profile or team changes
 */
export function invalidateUserQueries(queryClient, userId = null) {
  queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
  queryClient.invalidateQueries({ queryKey: queryKeys.users.technicians() });
  queryClient.invalidateQueries({ queryKey: queryKeys.technicians.all() });
  
  if (userId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile(userId) });
  }
}

/**
 * Helper to create mutation options with automatic cache invalidation
 * @param {function} invalidateFn - The invalidation function to call
 * @param {object} options - Additional options (propertyId, unitId, etc.)
 */
export function withCacheInvalidation(invalidateFn, options = {}) {
  return {
    onSuccess: (data, variables, context) => {
      const { queryClient, ...rest } = options;
      if (queryClient) {
        invalidateFn(queryClient, ...Object.values(rest));
      }
    },
  };
}

export default {
  invalidatePropertyQueries,
  invalidateUnitQueries,
  invalidateJobQueries,
  invalidateServiceRequestQueries,
  invalidateInspectionQueries,
  invalidateTenantQueries,
  invalidateNotificationQueries,
  invalidateDashboardQueries,
  invalidateUserQueries,
  withCacheInvalidation,
};

