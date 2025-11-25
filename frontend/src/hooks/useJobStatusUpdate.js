import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import toast from 'react-hot-toast';
import {
  canTransition,
  requiresStatusConfirmation,
} from '../constants/jobStatuses.js';
import {
  applyJobUpdateToQueries,
  restoreJobQueries,
  snapshotJobQueries,
} from '../utils/jobCache.js';

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

  // Mutation for updating job status
  const mutation = useMutation({
    mutationFn: async ({ jobId, status }) => {
      const response = await apiClient.patch(`/jobs/${jobId}/status`, { status });
      return response.data;
    },
    onMutate: async ({ jobId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.jobs.all() });

      const previousJobs = snapshotJobQueries(queryClient);

      applyJobUpdateToQueries(queryClient, {
        id: jobId,
        status,
        updatedAt: new Date().toISOString(),
      });

      return { previousJobs };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      restoreJobQueries(queryClient, context?.previousJobs);

      const errorMessage = error.response?.data?.message || 'Failed to update job status';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables) => {
      toast.success('Job status updated successfully');

      const normalizedJob = data?.job || data;
      if (normalizedJob?.id) {
        applyJobUpdateToQueries(queryClient, normalizedJob);
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(variables.jobId) });
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
    if (requiresStatusConfirmation(currentStatus, newStatus)) {
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
