import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import toast from 'react-hot-toast';
import { canTransition } from '../constants/jobStatuses.js';

/**
 * Custom hook for updating job status
 * Handles API calls, optimistic updates, and confirmation logic
 */
export const useJobStatusUpdate = () => {
  const queryClient = useQueryClient();
  const [confirmDialogState, setConfirmDialogState] = useState({
    open: false,
    jobId: null,
    currentStatus: null,
    newStatus: null,
    jobTitle: '',
  });

  // Determine if a status transition requires confirmation
  const requiresConfirmation = (fromStatus, toStatus) => {
    // Status transitions that send notifications
    const notifyingTransitions = [
      { from: 'OPEN', to: 'ASSIGNED' },
      { from: 'ASSIGNED', to: 'IN_PROGRESS' },
      { from: 'IN_PROGRESS', to: 'COMPLETED' },
      { from: 'OPEN', to: 'CANCELLED' },
      { from: 'ASSIGNED', to: 'CANCELLED' },
      { from: 'IN_PROGRESS', to: 'CANCELLED' },
      { from: 'ASSIGNED', to: 'OPEN' },
      { from: 'IN_PROGRESS', to: 'ASSIGNED' },
    ];

    return notifyingTransitions.some((transition) =>
      transition.from === fromStatus && transition.to === toStatus && canTransition(fromStatus, toStatus)
    );
  };

  // Mutation for updating job status
  const mutation = useMutation({
    mutationFn: async ({ jobId, status }) => {
      const response = await apiClient.patch(`/jobs/${jobId}/status`, { status });
      return response.data;
    },
    onMutate: async ({ jobId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.jobs.all() });

      // Snapshot previous value for rollback
      const previousJobs = queryClient.getQueriesData({ queryKey: queryKeys.jobs.all() });

      // Optimistically update job status in all queries
      queryClient.setQueriesData({ queryKey: queryKeys.jobs.all() }, (old) => {
        if (!old) return old;

        // Handle infinite query structure
        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              items: page.items.map(job =>
                job.id === jobId
                  ? { ...job, status, updatedAt: new Date().toISOString() }
                  : job
              )
            }))
          };
        }

        // Handle regular array
        if (Array.isArray(old)) {
          return old.map(job =>
            job.id === jobId
              ? { ...job, status, updatedAt: new Date().toISOString() }
              : job
          );
        }

        return old;
      });

      return { previousJobs };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousJobs) {
        context.previousJobs.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const errorMessage = error.response?.data?.message || 'Failed to update job status';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables) => {
      toast.success('Job status updated successfully');

      // Invalidate and refetch job queries
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    },
  });

  /**
   * Update job status with optional confirmation
   * @param {string} jobId - Job ID
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - New status
   * @param {string} jobTitle - Job title (for confirmation dialog)
   */
  const updateStatus = (jobId, currentStatus, newStatus, jobTitle = '') => {
    if (!canTransition(currentStatus, newStatus)) {
      toast.error('This status change is not allowed.');
      return;
    }

    // Check if confirmation is needed
    if (requiresConfirmation(currentStatus, newStatus)) {
      setConfirmDialogState({
        open: true,
        jobId,
        currentStatus,
        newStatus,
        jobTitle,
      });
    } else {
      // Update immediately without confirmation
      mutation.mutate({ jobId, status: newStatus });
    }
  };

  /**
   * Confirm the status update from the dialog
   */
  const confirmStatusUpdate = () => {
    const { jobId, newStatus } = confirmDialogState;
    mutation.mutate({ jobId, status: newStatus });
    closeConfirmDialog();
  };

  /**
   * Close the confirmation dialog
   */
  const closeConfirmDialog = () => {
    setConfirmDialogState({
      open: false,
      jobId: null,
      currentStatus: null,
      newStatus: null,
      jobTitle: '',
    });
  };

  return {
    updateStatus,
    confirmStatusUpdate,
    closeConfirmDialog,
    confirmDialogState,
    isUpdating: mutation.isPending,
  };
};
