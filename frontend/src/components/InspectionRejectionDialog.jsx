import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import useApiMutation from '../hooks/useApiMutation.js';
import useApiQuery from '../hooks/useApiQuery.js';
import { queryKeys } from '../utils/queryKeys';

export default function InspectionRejectionDialog({ open, onClose, inspection }) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [reassignToId, setReassignToId] = useState('');
  const [error, setError] = useState('');

  // Fetch available technicians for reassignment
  const { data: inspectorsData } = useApiQuery({
    queryKey: ['inspectors'],
    url: '/inspections/inspectors',
    enabled: open,
  });

  const technicians = inspectorsData?.inspectors || [];

  const rejectMutation = useApiMutation({
    method: 'POST',
    invalidateKeys: [
      queryKeys.inspections.list(),
      queryKeys.inspections.detail(inspection?.id),
    ],
  });

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        url: `/inspections/${inspection.id}/reject`,
        data: {
          rejectionReason: rejectionReason,
          reassignToId: reassignToId || undefined,
        },
      });
      onClose();
      setRejectionReason('');
      setReassignToId('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject inspection');
    }
  };

  const handleClose = () => {
    if (!rejectMutation.isPending) {
      onClose();
      setRejectionReason('');
      setReassignToId('');
      setError('');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reject Inspection</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            Please provide a reason for rejecting this inspection. The assigned
            technician will be notified.
          </Typography>

          <TextField
            label="Rejection Reason"
            multiline
            rows={4}
            fullWidth
            required
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Describe what needs to be corrected or improved..."
            error={!rejectionReason.trim() && error}
          />

          <FormControl fullWidth>
            <InputLabel>Reassign To (Optional)</InputLabel>
            <Select
              value={reassignToId}
              onChange={(e) => setReassignToId(e.target.value)}
              label="Reassign To (Optional)"
            >
              <MenuItem value="">
                <em>Keep current assignment</em>
              </MenuItem>
              {technicians
                .filter((tech) => tech.id !== inspection?.assignedToId)
                .map((tech) => (
                  <MenuItem key={tech.id} value={tech.id}>
                    {tech.firstName} {tech.lastName}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {reassignToId && (
            <Alert severity="info">
              This inspection will be reassigned to the selected technician.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={rejectMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleReject}
          color="error"
          variant="contained"
          disabled={rejectMutation.isPending || !rejectionReason.trim()}
        >
          {rejectMutation.isPending ? 'Rejecting...' : 'Reject Inspection'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
