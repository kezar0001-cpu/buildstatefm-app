import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import toast from 'react-hot-toast';

/**
 * Custom hook for updating inspection status
 * Handles API calls, optimistic updates, and error handling
 */
export const useInspectionStatusUpdate = () => {
  const queryClient = useQueryClient();

  // Mutation for updating inspection status
  const mutation = useMutation({
    mutationFn: async ({ inspectionId, status }) => {
      const response = await apiClient.patch(`/inspections/${inspectionId}`, { status });
      return response.data;
    },
    onMutate: async ({ inspectionId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.inspections.all() });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.inspections.all() });

      // Optimistically update the inspection status in all queries
      queryClient.setQueriesData({ queryKey: queryKeys.inspections.all() }, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            items: page.items?.map(inspection =>
              inspection.id === inspectionId
                ? { ...inspection, status, updatedAt: new Date().toISOString() }
                : inspection
            ) || [],
          })),
        };
      });

      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const statusCode = error?.response?.status;
      const errorMessage =
        statusCode === 401 || statusCode === 403
          ? 'You do not have permission to update inspection statuses. Reverting change.'
          : error.response?.data?.message || 'Failed to update inspection status';

      toast.error(errorMessage);

      // Invalidate to ensure we have the correct data
      if (variables?.inspectionId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() });
      }
    },
    onSuccess: (data, variables) => {
      toast.success('Inspection status updated successfully');

      // Ensure the data is fresh
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() });
    },
  });

  /**
   * Update inspection status
   * @param {string} inspectionId - Inspection ID
   * @param {string} newStatus - New status
   */
  const updateStatus = (inspectionId, newStatus) => {
    mutation.mutate({ inspectionId, status: newStatus });
  };

  return {
    updateStatus,
    isUpdating: mutation.isPending,
  };
};
