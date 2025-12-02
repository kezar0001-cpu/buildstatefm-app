/**
 * Standardized mutation hook with automatic cache invalidation
 * Ensures consistent cache management across all mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseApiResponse, parseErrorResponse } from '../utils/apiResponseParser';
import {
  invalidatePropertyQueries,
  invalidateUnitQueries,
  invalidateJobQueries,
  invalidateServiceRequestQueries,
  invalidateInspectionQueries,
  invalidateTenantQueries,
  invalidateNotificationQueries,
  invalidateDashboardQueries,
  invalidateUserQueries,
} from '../utils/cacheInvalidation';

/**
 * Get invalidation function based on entity type
 */
function getInvalidationFunction(entityType) {
  const invalidationMap = {
    property: invalidatePropertyQueries,
    properties: invalidatePropertyQueries,
    unit: invalidateUnitQueries,
    units: invalidateUnitQueries,
    job: invalidateJobQueries,
    jobs: invalidateJobQueries,
    serviceRequest: invalidateServiceRequestQueries,
    serviceRequests: invalidateServiceRequestQueries,
    inspection: invalidateInspectionQueries,
    inspections: invalidateInspectionQueries,
    tenant: invalidateTenantQueries,
    tenants: invalidateTenantQueries,
    notification: invalidateNotificationQueries,
    notifications: invalidateNotificationQueries,
    dashboard: invalidateDashboardQueries,
    user: invalidateUserQueries,
    users: invalidateUserQueries,
  };

  return invalidationMap[entityType?.toLowerCase()] || null;
}

/**
 * Standardized mutation hook
 * @param {Object} options - Mutation options
 * @param {Function} options.mutationFn - Mutation function
 * @param {string|string[]} options.invalidate - Entity types to invalidate (e.g., 'property', ['property', 'dashboard'])
 * @param {Function} options.onSuccess - Custom success handler
 * @param {Function} options.onError - Custom error handler
 * @param {Object} options.invalidationParams - Parameters to pass to invalidation functions
 * @param {boolean} options.parseResponse - Whether to parse response (default: true)
 * @param {string|string[]} options.dataPath - Path to data in response
 * @returns {Object} Mutation object
 */
export function useStandardMutation(options = {}) {
  const {
    mutationFn,
    invalidate = [],
    onSuccess,
    onError,
    invalidationParams = {},
    parseResponse = true,
    dataPath = 'data',
    ...restOptions
  } = options;

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables) => {
      const response = await mutationFn(variables);
      if (parseResponse) {
        return parseApiResponse(response, { dataPath });
      }
      return response;
    },
    onSuccess: async (data, variables, context) => {
      // Invalidate cache for specified entities
      const entitiesToInvalidate = Array.isArray(invalidate) ? invalidate : [invalidate];
      
      for (const entityType of entitiesToInvalidate) {
        if (!entityType) continue;
        
        const invalidationFn = getInvalidationFunction(entityType);
        if (invalidationFn) {
          // Extract relevant IDs from response or variables
          const entityId = data?.id || data?._id || variables?.id || variables?._id || invalidationParams[`${entityType}Id`];
          const propertyId = data?.propertyId || variables?.propertyId || invalidationParams.propertyId;
          const unitId = data?.unitId || variables?.unitId || invalidationParams.unitId;

          // Call invalidation function with appropriate parameters
          if (entityType === 'property' || entityType === 'properties') {
            invalidationFn(queryClient, entityId);
          } else if (entityType === 'unit' || entityType === 'units') {
            invalidationFn(queryClient, entityId, propertyId);
          } else if (entityType === 'job' || entityType === 'jobs') {
            invalidationFn(queryClient, entityId, propertyId, unitId);
          } else if (entityType === 'inspection' || entityType === 'inspections') {
            invalidationFn(queryClient, entityId, propertyId, unitId);
          } else if (entityType === 'serviceRequest' || entityType === 'serviceRequests') {
            invalidationFn(queryClient, entityId);
          } else if (entityType === 'tenant' || entityType === 'tenants') {
            invalidationFn(queryClient, entityId, unitId);
          } else if (entityType === 'notification' || entityType === 'notifications') {
            invalidationFn(queryClient);
          } else if (entityType === 'dashboard') {
            invalidationFn(queryClient);
          } else if (entityType === 'user' || entityType === 'users') {
            invalidationFn(queryClient, entityId);
          }
        }
      }

      // Call custom success handler if provided
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Parse error for better error handling
      const parsedError = parseErrorResponse(error);
      
      if (onError) {
        onError(parsedError, variables, context);
      } else {
        console.error('[useStandardMutation] Error:', parsedError);
      }
    },
    ...restOptions,
  });
}

export default useStandardMutation;

