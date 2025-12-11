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
      // Invalidate inspection queries to refresh status everywhere (list, kanban, detail views)
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(inspection.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.batchedDetail(inspection.id) });
      setActiveStep(1);
      setCompletedSteps(prev => new Set([...prev, 0]));
    },
  });

  const addRoomMutation = useMutation({
    mutationFn: (data) => apiClient.post(`/inspections/${inspection.id}/rooms`, data),
    onMutate: async (newRoom) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });

      // Snapshot the previous value for rollback
      const previousRooms = queryClient.getQueryData(queryKeys.inspections.rooms(inspection.id));

      // Create optimistic room with temporary ID
      const optimisticRoom = {
        id: `temp-${Date.now()}`,
        ...newRoom,
        checklistItems: [],
        issues: [],
        photos: [],
        order: previousRooms?.rooms?.length || 0,
      };

      // Optimistically update the UI
      queryClient.setQueryData(queryKeys.inspections.rooms(inspection.id), (old) => ({
        ...old,
        rooms: [...(old?.rooms || []), optimisticRoom],
      }));

      return { previousRooms };
    },
    onError: (_err, _newRoom, context) => {
      // Rollback to previous state on error
      if (context?.previousRooms) {
        queryClient.setQueryData(queryKeys.inspections.rooms(inspection.id), context.previousRooms);
      }
      setSnackbar({ open: true, message: 'Failed to add room', severity: 'error' });
    },
    onSuccess: () => {
      refetchRooms();
      setRoomDialog({ open: false, editingRoom: null });
      setSnackbar({ open: true, message: 'Room added', severity: 'success' });
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ roomId, data }) => apiClient.patch(`/inspections/${inspection.id}/rooms/${roomId}`, data),
    onMutate: async ({ roomId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });

      // Snapshot the previous value
      const previousRooms = queryClient.getQueryData(queryKeys.inspections.rooms(inspection.id));

      // Optimistically update the room
      queryClient.setQueryData(queryKeys.inspections.rooms(inspection.id), (old) => {
        if (!old?.rooms) return old;
        return {
          ...old,
          rooms: old.rooms.map(room =>
            room.id === roomId ? { ...room, ...data } : room
          ),
        };
      });

      return { previousRooms };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousRooms) {
        queryClient.setQueryData(queryKeys.inspections.rooms(inspection.id), context.previousRooms);
      }
      setSnackbar({ open: true, message: 'Failed to update room', severity: 'error' });
    },
    onSuccess: () => {
      refetchRooms();
      setRoomDialog({ open: false, editingRoom: null });
      setSnackbar({ open: true, message: 'Room updated', severity: 'success' });
    },
  });

  const updateChecklistItemMutation = useMutation({
    mutationFn: ({ roomId, itemId, notes }) =>
      apiClient.patch(`/inspections/${inspection.id}/rooms/${roomId}/checklist/${itemId}`, { notes }),
    onMutate: async ({ roomId, itemId, notes }) => {
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
                item.id === itemId ? { ...item, notes } : item
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

  // Update issue notes (no status updates - issues are issues)
  const updateChecklistItem = useCallback((roomId, itemId, notes) => {
    updateChecklistItemMutation.mutate({ roomId, itemId, notes });
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

  // Transform rooms data to use camelCase for checklistItems
  const transformedRooms = (roomsData?.rooms || []).map(room => ({
    ...room,
    checklistItems: room.InspectionChecklistItem || room.checklistItems || [],
    InspectionIssue: room.InspectionIssue || room.issues || [],
    InspectionPhoto: room.InspectionPhoto || room.photos || [],
  }));

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

    rooms: transformedRooms,
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
