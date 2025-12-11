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
      // Cancel any outgoing refetches for inspections so we don't race our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.inspections.all() });

      // Snapshot *all* matching inspection queries for rollback
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.inspections.all() });

      // Optimistically update any infinite list/kanban queries
      queryClient.setQueriesData({ queryKey: ['inspections', 'list'] }, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items?.map((inspection) =>
              inspection.id === inspectionId
                ? { ...inspection, status, updatedAt: new Date().toISOString() }
                : inspection
            ) || [],
          })),
        };
      });

      // Also optimistically update any simple detail queries
      queryClient.setQueryData(queryKeys.inspections.detail(inspectionId), (old) => {
        if (!old) return old;
        return { ...old, status, updatedAt: new Date().toISOString() };
      });

      // And the batched detail view, if present
      queryClient.setQueryData(queryKeys.inspections.batchedDetail(inspectionId), (old) => {
        if (!old?.inspection) return old;
        return {
          ...old,
          inspection: {
            ...old.inspection,
            status,
            updatedAt: new Date().toISOString(),
          },
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
      const inspectionId = variables?.inspectionId;

      // Ensure the data is fresh across all relevant inspection queries
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() });

      if (inspectionId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(inspectionId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.inspections.batchedDetail(inspectionId) });
      }
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
