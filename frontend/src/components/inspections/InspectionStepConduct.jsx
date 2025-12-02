import React, { useState } from 'react';
import {
  Box, Stack, Typography, Button, Card, CardContent, Divider,
  List, ListItem, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../utils/queryKeys';
import { InspectionPhotoUpload } from './InspectionPhotoUpload';

export const InspectionStepConduct = ({ inspection, rooms, actions, lastSaved }) => {
  const queryClient = useQueryClient();
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [newIssue, setNewIssue] = useState({ roomId: '', title: '', description: '', severity: 'MEDIUM' });

  const formatLastSaved = (date) => {
    if (!date) return null;
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 10) return 'Last saved just now';
    if (diffSec < 60) return `Last saved ${diffSec} seconds ago`;
    if (diffMin < 60) return `Last saved ${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;

    return `Last saved at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Issue creation mutation with optimistic updates and automatic rollback on error
  const addIssueMutation = useMutation({
    mutationFn: (issueData) => apiClient.post(`/inspections/${inspection.id}/issues`, issueData),
    onMutate: async (issueData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.inspections.issues(inspection.id) });

      // Snapshot the previous value for rollback
      const previousIssues = queryClient.getQueryData(queryKeys.inspections.issues(inspection.id));

      // Create optimistic issue with temporary ID
      const optimisticIssue = {
        id: `temp-${Date.now()}`,
        ...issueData,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        photos: [],
        room: issueData.roomId ? rooms.find(r => r.id === issueData.roomId) : null,
      };

      // Optimistically update the UI
      queryClient.setQueryData(queryKeys.inspections.issues(inspection.id), (old) => ({
        ...old,
        issues: [optimisticIssue, ...(old?.issues || [])],
      }));

      return { previousIssues };
    },
    onError: (_err, _issueData, context) => {
      // Rollback to previous state on error
      if (context?.previousIssues) {
        queryClient.setQueryData(queryKeys.inspections.issues(inspection.id), context.previousIssues);
      }
      toast.error('Failed to add issue. Please try again.');
    },
    onSuccess: () => {
      // Trigger refresh to get the real data from server
      if (actions.refetchIssues) {
        actions.refetchIssues();
      }
      setIssueDialogOpen(false);
      setNewIssue({ roomId: '', title: '', description: '', severity: 'MEDIUM' });
    },
  });

  const handleAddIssue = () => {
    if (!newIssue.title) return;
    addIssueMutation.mutate(newIssue);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h6">Conduct Inspection</Typography>
          {lastSaved && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              {formatLastSaved(lastSaved)}
            </Typography>
          )}
        </Box>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setIssueDialogOpen(true)}>
          Add Issue
        </Button>
      </Stack>

      {rooms.map((room) => (
        <Card key={room.id} sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">{room.name}</Typography>
              <Chip label={room.roomType || 'Not specified'} size="small" />
            </Stack>
            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Inspection Checklist
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                Mark each item as passed or failed. Failed items will become repair recommendations.
              </Typography>
            </Typography>
            <List>
              {room.checklistItems?.map((item) => (
                <ListItem key={item.id} disablePadding sx={{ py: 1 }}>
                  <Box sx={{ width: '100%' }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" sx={{ flex: 1 }}>{item.description}</Typography>
                      <Stack direction="row" spacing={1}>
                        {['PASSED', 'FAILED', 'NA'].map((status) => (
                          <Button
                            key={status}
                            size="small"
                            variant={item.status === status ? 'contained' : 'outlined'}
                            color={status === 'PASSED' ? 'success' : status === 'FAILED' ? 'error' : 'inherit'}
                            onClick={() => actions.updateChecklistItem(room.id, item.id, status, item.notes)}
                          >
                            {status === 'NA' ? 'N/A' : status.charAt(0) + status.slice(1).toLowerCase()}
                          </Button>
                        ))}
                      </Stack>
                    </Stack>
                    {item.status === 'FAILED' && (
                      <Typography variant="caption" color="error" sx={{ ml: 2, mt: 0.5, display: 'block' }}>
                        This will be added to recommendations for the property owner
                      </Typography>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 2 }} />
            <InspectionPhotoUpload
              inspectionId={inspection.id}
              roomId={room.id}
              onUploadComplete={actions.refetchRooms}
            />
          </CardContent>
        </Card>
      ))}

      <Dialog open={issueDialogOpen} onClose={() => setIssueDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Issue</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Room"
              value={newIssue.roomId}
              onChange={(e) => setNewIssue({ ...newIssue, roomId: e.target.value })}
              fullWidth
            >
              <MenuItem value="">General</MenuItem>
              {rooms.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </TextField>
            <TextField
              label="Issue Title"
              value={newIssue.title}
              onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={newIssue.description}
              onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
             <TextField
                select
                label="Severity"
                value={newIssue.severity}
                onChange={(e) => setNewIssue({ ...newIssue, severity: e.target.value })}
                fullWidth
              >
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddIssue} variant="contained">Add Issue</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
