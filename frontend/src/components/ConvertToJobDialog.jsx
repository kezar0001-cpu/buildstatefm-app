import { useState, useEffect } from 'react';
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
  Typography,
  Stack,
  Alert,
  Box,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  WorkOutline as WorkOutlineIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import toast from 'react-hot-toast';
import ensureArray from '../utils/ensureArray';

export default function ConvertToJobDialog({
  open,
  onClose,
  recommendation,
  onConvert
}) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [notes, setNotes] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  // Fetch technicians
  const { data: techniciansData, isLoading: loadingTechnicians } = useQuery({
    queryKey: queryKeys.technicians.all(),
    queryFn: async () => {
      const response = await apiClient.get('/users?role=TECHNICIAN');
      return response.data;
    },
    enabled: open,
  });

  const technicians = ensureArray(techniciansData, ['users', 'data', 'items', 'results']);

  // Initialize form when dialog opens
  useEffect(() => {
    if (open && recommendation) {
      setScheduledDate('');
      setAssignedToId('');
      setEstimatedCost(recommendation.estimatedCost ? String(recommendation.estimatedCost) : '');
      setNotes(`Converted from recommendation: "${recommendation.title}"`);
    }
  }, [open, recommendation]);

  const handleClose = () => {
    if (isConverting) return;
    onClose();
  };

  const handleConvert = async () => {
    if (!recommendation) return;

    setIsConverting(true);
    try {
      const payload = {
        scheduledDate: scheduledDate || undefined,
        assignedToId: assignedToId || undefined,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        notes: notes || undefined,
      };

      const response = await apiClient.post(
        `/recommendations/${recommendation.id}/convert`,
        payload
      );

      toast.success('Recommendation converted to job successfully');
      onConvert(response.data);
      onClose();
    } catch (error) {
      console.error('Error converting recommendation:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to convert recommendation to job';
      toast.error(errorMessage);
    } finally {
      setIsConverting(false);
    }
  };

  if (!recommendation) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WorkOutlineIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Convert to Job
            </Typography>
          </Box>
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleClose}
            aria-label="close"
            disabled={isConverting}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          <Alert severity="info" sx={{ mb: 1 }}>
            You are converting the recommendation "{recommendation.title}" into a job.
            Fill in the details below to schedule and assign the job.
          </Alert>

          {/* Recommendation Details Summary */}
          <Box
            sx={{
              p: 2,
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Recommendation Details
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Title:</strong> {recommendation.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Priority:</strong> {recommendation.priority}
            </Typography>
            {recommendation.estimatedCost && (
              <Typography variant="body2" color="text.secondary">
                <strong>Estimated Cost:</strong> ${recommendation.estimatedCost.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </Typography>
            )}
          </Box>

          {/* Scheduled Date */}
          <TextField
            fullWidth
            label="Scheduled Date"
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            helperText="Optional: When should this job be scheduled?"
            disabled={isConverting}
          />

          {/* Assign Technician */}
          <FormControl fullWidth disabled={isConverting || loadingTechnicians}>
            <InputLabel>Assign Technician</InputLabel>
            <Select
              value={assignedToId}
              label="Assign Technician"
              onChange={(e) => setAssignedToId(e.target.value)}
            >
              <MenuItem value="">
                <em>Unassigned</em>
              </MenuItem>
              {technicians.map((tech) => (
                <MenuItem key={tech.id} value={tech.id}>
                  {tech.firstName} {tech.lastName}
                  {tech.email && ` (${tech.email})`}
                </MenuItem>
              ))}
            </Select>
            {!loadingTechnicians && technicians.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                No technicians available
              </Typography>
            )}
          </FormControl>

          {/* Estimated Cost */}
          <TextField
            fullWidth
            label="Estimated Cost"
            type="number"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            helperText="Optional: Update the estimated cost for this job"
            disabled={isConverting}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
            }}
            inputProps={{
              min: 0,
              step: 0.01,
            }}
          />

          {/* Notes */}
          <TextField
            fullWidth
            label="Job Notes"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            helperText="Optional: Add any additional notes for this job"
            disabled={isConverting}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          disabled={isConverting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConvert}
          variant="contained"
          color="primary"
          disabled={isConverting}
          startIcon={isConverting ? <CircularProgress size={16} /> : <WorkOutlineIcon />}
        >
          {isConverting ? 'Converting...' : 'Convert to Job'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
