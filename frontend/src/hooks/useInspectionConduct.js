import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';

export function useInspectionConduct(inspection, onComplete) {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [stepError, setStepError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [lastSaved, setLastSaved] = useState(null);

  // Room Dialog State
  const [roomDialog, setRoomDialog] = useState({ open: false, editingRoom: null });

  // --- Queries ---
  
  const { data: roomsData, refetch: refetchRooms } = useQuery({
    queryKey: queryKeys.inspections.rooms(inspection.id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${inspection.id}/rooms`);
      return response.data;
    },
    enabled: !!inspection?.id,
  });

  const { data: issuesData, refetch: refetchIssues } = useQuery({
    queryKey: queryKeys.inspections.issues(inspection.id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${inspection.id}/issues`);
      return response.data;
    },
    enabled: !!inspection?.id,
  });

  // --- Mutations ---

  const startInspectionMutation = useMutation({
    mutationFn: async () => {
      return apiClient.patch(`/inspections/${inspection.id}`, { status: 'IN_PROGRESS' });
    },
    onSuccess: () => {
      // Invalidate inspection queries to refresh status
      queryClient.invalidateQueries(queryKeys.inspections.detail(inspection.id));
      queryClient.invalidateQueries(queryKeys.inspections.list());
      setActiveStep(1);
      setCompletedSteps(prev => new Set([...prev, 0]));
    },
  });

  const addRoomMutation = useMutation({
    mutationFn: (data) => apiClient.post(`/inspections/${inspection.id}/rooms`, data),
    onSuccess: () => {
      refetchRooms();
      setRoomDialog({ open: false, editingRoom: null });
      setSnackbar({ open: true, message: 'Room added', severity: 'success' });
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ roomId, data }) => apiClient.patch(`/inspections/${inspection.id}/rooms/${roomId}`, data),
    onSuccess: () => {
      refetchRooms();
      setRoomDialog({ open: false, editingRoom: null });
      setSnackbar({ open: true, message: 'Room updated', severity: 'success' });
    },
  });

  const updateChecklistItemMutation = useMutation({
    mutationFn: ({ roomId, itemId, status, notes }) =>
      apiClient.patch(`/inspections/${inspection.id}/rooms/${roomId}/checklist/${itemId}`, { status, notes }),
    onMutate: async ({ roomId, itemId, status, notes }) => {
      await queryClient.cancelQueries(queryKeys.inspections.rooms(inspection.id));
      const previousData = queryClient.getQueryData(queryKeys.inspections.rooms(inspection.id));

      // Optimistically update
      queryClient.setQueryData(queryKeys.inspections.rooms(inspection.id), old => {
        if (!old?.rooms) return old;
        return {
          ...old,
          rooms: old.rooms.map(room => {
            if (room.id !== roomId) return room;
            return {
              ...room,
              checklistItems: room.checklistItems.map(item =>
                item.id === itemId ? { ...item, status, notes } : item
              )
            };
          })
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      setLastSaved(new Date());
    },
    onError: (err, variables, context) => {
       queryClient.setQueryData(queryKeys.inspections.rooms(inspection.id), context.previousData);
       setSnackbar({ open: true, message: 'Failed to save changes', severity: 'error' });
    },
    onSettled: () => {
      // We don't refetch immediately to avoid jitter, relying on the optimistic update
    }
  });

  // Immediate update (no debounce)
  const updateChecklistItem = useCallback((roomId, itemId, status, notes) => {
    updateChecklistItemMutation.mutate({ roomId, itemId, status, notes });
  }, [updateChecklistItemMutation]);

  const completeInspectionMutation = useMutation({
    mutationFn: async (payload) => {
      return apiClient.post(`/inspections/${inspection.id}/complete`, payload);
    },
    onSuccess: () => {
      // Invalidate inspection queries to refresh status
      queryClient.invalidateQueries(queryKeys.inspections.detail(inspection.id));
      queryClient.invalidateQueries(queryKeys.inspections.list());
      onComplete();
    }
  });

  return {
    activeStep,
    setActiveStep,
    completedSteps,
    setCompletedSteps,
    stepError,
    setStepError,
    snackbar,
    setSnackbar,
    lastSaved,

    rooms: roomsData?.rooms || [],
    issues: issuesData?.issues || [],

    roomDialog,
    setRoomDialog,

    actions: {
      startInspection: startInspectionMutation.mutate,
      addRoom: addRoomMutation.mutate,
      updateRoom: updateRoomMutation.mutate,
      updateChecklistItem,
      completeInspection: completeInspectionMutation.mutate,
      isCompleting: completeInspectionMutation.isLoading,
      refetchRooms,
      refetchIssues
    }
  };
}
