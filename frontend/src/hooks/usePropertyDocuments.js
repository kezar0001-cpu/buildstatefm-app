// frontend/src/hooks/usePropertyDocuments.js
import { useQuery } from '@tanstack/react-query';
import useApiMutation from './useApiMutation.js';
import { queryKeys } from '../utils/queryKeys.js';
import { apiClient } from '../api/client.js';

/**
 * Hook to fetch property documents
 * Migrated to React Query for better caching and state management
 * @param {string} propertyId - Property ID
 * @param {boolean} enabled - Whether to enable the query
 */
export function usePropertyDocuments(propertyId, enabled = true) {
  return useQuery({
    queryKey: ['propertyDocuments', propertyId],
    queryFn: async () => {
      const response = await apiClient.get(`/properties/${propertyId}/documents`);
      return response.data;
    },
    enabled: enabled && !!propertyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single property document
 * Migrated to React Query for better caching and state management
 * @param {string} propertyId - Property ID
 * @param {string} documentId - Document ID
 * @param {boolean} enabled - Whether to enable the query
 */
export function usePropertyDocument(propertyId, documentId, enabled = true) {
  return useQuery({
    queryKey: ['propertyDocument', propertyId, documentId],
    queryFn: async () => {
      const response = await apiClient.get(`/properties/${propertyId}/documents/${documentId}`);
      return response.data;
    },
    enabled: enabled && !!propertyId && !!documentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to add a property document
 * Bug Fix: Added invalidateKeys to automatically refresh data after mutation
 * This prevents stale cache data and eliminates need for manual refetch()
 * @param {string} propertyId - Property ID
 * @param {function} onSuccess - Success callback
 */
export function useAddPropertyDocument(propertyId, onSuccess) {
  return useApiMutation({
    url: `/properties/${propertyId}/documents`,
    method: 'post',
    invalidateKeys: [
      ['propertyDocuments', propertyId],
      queryKeys.properties.detail(propertyId),
    ],
    onSuccess,
  });
}

/**
 * Hook to delete a property document
 * Bug Fix: Added invalidateKeys to automatically refresh data after mutation
 * Note: The url parameter in mutateAsync should include the full path with documentId
 * @param {string} propertyId - Property ID
 * @param {function} onSuccess - Success callback
 */
export function useDeletePropertyDocument(propertyId, onSuccess) {
  return useApiMutation({
    url: `/properties/${propertyId}/documents`, // Base URL, documentId appended in mutateAsync call
    method: 'delete',
    invalidateKeys: [
      ['propertyDocuments', propertyId],
      queryKeys.properties.detail(propertyId),
    ],
    onSuccess,
  });
}
