// frontend/src/hooks/usePropertyImages.js
import { useQuery } from '@tanstack/react-query';
import useApiMutation from './useApiMutation.js';
import { queryKeys } from '../utils/queryKeys.js';
import { apiClient } from '../api/client.js';

/**
 * Hook to fetch property images
 * Migrated to React Query for better caching and state management
 * @param {string} propertyId - Property ID
 * @param {boolean} enabled - Whether to enable the query
 */
export function usePropertyImages(propertyId, enabled = true) {
  return useQuery({
    queryKey: ['propertyImages', propertyId],
    queryFn: async () => {
      const response = await apiClient.get(`/properties/${propertyId}/images`);
      return response.data;
    },
    enabled: enabled && !!propertyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to add a property image
 * Bug Fix: Added invalidateKeys to automatically refresh data after mutation
 * This prevents stale cache data and eliminates need for manual refetch()
 * @param {string} propertyId - Property ID
 * @param {function} onSuccess - Success callback
 */
export function useAddPropertyImage(propertyId, onSuccess) {
  return useApiMutation({
    url: `/properties/${propertyId}/images`,
    method: 'post',
    invalidateKeys: [
      ['propertyImages', propertyId],
      queryKeys.properties.detail(propertyId),
      queryKeys.properties.all(),
    ],
    onSuccess,
  });
}

/**
 * Hook to update a property image
 * Bug Fix: Added invalidateKeys to automatically refresh data after mutation
 * @param {string} propertyId - Property ID
 * @param {function} onSuccess - Success callback
 */
export function useUpdatePropertyImage(propertyId, onSuccess) {
  return useApiMutation({
    url: `/properties/${propertyId}/images`,
    method: 'patch',
    invalidateKeys: [
      ['propertyImages', propertyId],
      queryKeys.properties.detail(propertyId),
      queryKeys.properties.all(),
    ],
    onSuccess,
  });
}

/**
 * Hook to delete a property image
 * Bug Fix: Added invalidateKeys to automatically refresh data after mutation
 * @param {string} propertyId - Property ID
 * @param {function} onSuccess - Success callback
 */
export function useDeletePropertyImage(propertyId, onSuccess) {
  return useApiMutation({
    url: `/properties/${propertyId}/images`,
    method: 'delete',
    invalidateKeys: [
      ['propertyImages', propertyId],
      queryKeys.properties.detail(propertyId),
      queryKeys.properties.all(),
    ],
    onSuccess,
  });
}

/**
 * Hook to reorder property images
 * Bug Fix: Added invalidateKeys to automatically refresh data after mutation
 * @param {string} propertyId - Property ID
 * @param {function} onSuccess - Success callback
 */
export function useReorderPropertyImages(propertyId, onSuccess) {
  return useApiMutation({
    url: `/properties/${propertyId}/images/reorder`,
    method: 'post',
    invalidateKeys: [
      ['propertyImages', propertyId],
      queryKeys.properties.detail(propertyId),
    ],
    onSuccess,
  });
}
