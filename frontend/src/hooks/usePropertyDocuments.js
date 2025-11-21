// frontend/src/hooks/usePropertyDocuments.js
import useApiQuery from './useApiQuery.js';
import useApiMutation from './useApiMutation.js';
import { queryKeys } from '../utils/queryKeys.js';

/**
 * Hook to fetch property documents
 * @param {string} propertyId - Property ID
 * @param {boolean} enabled - Whether to enable the query
 */
export function usePropertyDocuments(propertyId, enabled = true) {
  return useApiQuery({
    queryKey: ['propertyDocuments', propertyId],
    url: propertyId ? `/properties/${propertyId}/documents` : null,
    enabled: enabled && !!propertyId,
  });
}

/**
 * Hook to fetch a single property document
 * @param {string} propertyId - Property ID
 * @param {string} documentId - Document ID
 * @param {boolean} enabled - Whether to enable the query
 */
export function usePropertyDocument(propertyId, documentId, enabled = true) {
  return useApiQuery({
    queryKey: ['propertyDocument', propertyId, documentId],
    url: propertyId && documentId ? `/properties/${propertyId}/documents/${documentId}` : null,
    enabled: enabled && !!propertyId && !!documentId,
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
