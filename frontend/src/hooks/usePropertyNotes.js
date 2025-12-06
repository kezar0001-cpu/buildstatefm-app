// frontend/src/hooks/usePropertyNotes.js
import { useQuery } from '@tanstack/react-query';
import useApiMutation from './useApiMutation.js';
import { queryKeys } from '../utils/queryKeys.js';
import { apiClient } from '../api/client.js';

/**
 * Hook to fetch property notes
 * Migrated to React Query for better caching and state management
 * @param {string} propertyId - Property ID
 * @param {boolean} enabled - Whether to enable the query
 */
export function usePropertyNotes(propertyId, enabled = true) {
  return useQuery({
    queryKey: ['propertyNotes', propertyId],
    queryFn: async () => {
      const response = await apiClient.get(`/properties/${propertyId}/notes`);
      return response.data;
    },
    enabled: enabled && !!propertyId,
    staleTime: 2 * 60 * 1000, // 2 minutes (notes change more frequently)
  });
}

/**
 * Hook to add a property note
 * Bug Fix: Added invalidateKeys to automatically refresh data after mutation
 * This prevents stale cache data and eliminates need for manual refetch()
 * @param {string} propertyId - Property ID
 * @param {function} onSuccess - Success callback
 */
export function useAddPropertyNote(propertyId, onSuccess) {
  return useApiMutation({
    url: `/properties/${propertyId}/notes`,
    method: 'post',
    invalidateKeys: [
      ['propertyNotes', propertyId],
      queryKeys.properties.detail(propertyId),
      queryKeys.properties.activity(propertyId),
    ],
    onSuccess,
  });
}

/**
 * Hook to update a property note
 * Bug Fix: Added invalidateKeys to automatically refresh data after mutation
 * @param {string} propertyId - Property ID
 * @param {function} onSuccess - Success callback
 */
export function useUpdatePropertyNote(propertyId, onSuccess) {
  return useApiMutation({
    url: `/properties/${propertyId}/notes`,
    method: 'patch',
    invalidateKeys: [
      ['propertyNotes', propertyId],
      queryKeys.properties.detail(propertyId),
      queryKeys.properties.activity(propertyId),
    ],
    onSuccess,
  });
}

/**
 * Hook to delete a property note
 * Bug Fix: Added invalidateKeys to automatically refresh data after mutation
 * @param {string} propertyId - Property ID
 * @param {function} onSuccess - Success callback
 */
export function useDeletePropertyNote(propertyId, onSuccess) {
  return useApiMutation({
    url: `/properties/${propertyId}/notes`,
    method: 'delete',
    invalidateKeys: [
      ['propertyNotes', propertyId],
      queryKeys.properties.detail(propertyId),
      queryKeys.properties.activity(propertyId),
    ],
    onSuccess,
  });
}
