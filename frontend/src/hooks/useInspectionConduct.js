import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';

export function useInspectionConduct(inspection, onComplete) {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [stepError, setStepError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Room Dialog State
  const [roomDialog, setRoomDialog] = useState({ open: false, editingRoom: null });
  
  // Debounce Refs
  const debounceTimers = useRef({});

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
    onError: (err, variables, context) => {
       queryClient.setQueryData(queryKeys.inspections.rooms(inspection.id), context.previousData);
       setSnackbar({ open: true, message: 'Failed to update item', severity: 'error' });
    },
    onSettled: () => {
      // We don't refetch immediately to avoid jitter, relying on the optimistic update
      // But we might want to refetch eventually
    }
  });

  // Debounced update wrapper
  const updateChecklistItem = useCallback((roomId, itemId, status, notes) => {
    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    // Immediate optimistic update in UI handled by the mutation's onMutate? 
    // Actually onMutate is instant. We just need to throttle the network requests if user clicks rapidly.
    // But for a status toggle, user usually clicks once.
    // If we use debounce, we delay the network call.
    
    debounceTimers.current[itemId] = setTimeout(() => {
      updateChecklistItemMutation.mutate({ roomId, itemId, status, notes });
    }, 300);
  }, [updateChecklistItemMutation]);

  const completeInspectionMutation = useMutation({
    mutationFn: async (payload) => {
      return apiClient.post(`/inspections/${inspection.id}/complete`, payload);
    },
    onSuccess: () => {
      onComplete();
    }
  });

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(t => clearTimeout(t));
    };
  }, []);

  return {
    activeStep,
    setActiveStep,
    completedSteps,
    setCompletedSteps,
    stepError,
    setStepError,
    snackbar,
    setSnackbar,
    
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
      isCompleting: completeInspectionMutation.isLoading
    }
  };
}
