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
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  WorkOutline as WorkOutlineIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import toast from 'react-hot-toast';
import ensureArray from '../utils/ensureArray';

const getStatusColor = (status) => {
  const colors = {
    SUBMITTED: 'warning',
    UNDER_REVIEW: 'info',
    PENDING_MANAGER_REVIEW: 'info',
    PENDING_OWNER_APPROVAL: 'warning',
    APPROVED: 'success',
    APPROVED_BY_OWNER: 'success',
    REJECTED: 'error',
    REJECTED_BY_OWNER: 'error',
    CONVERTED_TO_JOB: 'primary',
    COMPLETED: 'success',
    ARCHIVED: 'default',
  };
  return colors[status] || 'default';
};

const getPriorityColor = (priority) => {
  const colors = {
    LOW: 'info',
    MEDIUM: 'warning',
    HIGH: 'error',
    URGENT: 'error',
  };
  return colors[priority] || 'default';
};

export default function ConvertServiceRequestToJobDialog({
  open,
  onClose,
  serviceRequest,
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
    if (open && serviceRequest) {
      setScheduledDate('');
      setAssignedToId('');
      
      // Pre-fill estimated cost from service request
      const cost = serviceRequest.approvedBudget || 
                   serviceRequest.managerEstimatedCost || 
                   serviceRequest.estimatedCost;
      setEstimatedCost(cost ? String(cost) : '');
      
      // Pre-fill notes with service request context
      const contextNotes = [
        `Converted from service request: "${serviceRequest.title}"`,
        serviceRequest.category ? `Category: ${serviceRequest.category}` : '',
        serviceRequest.description ? `Original description: ${serviceRequest.description}` : '',
      ].filter(Boolean).join('\n');
      
      setNotes(contextNotes);
    }
  }, [open, serviceRequest]);

  const handleClose = () => {
    if (isConverting) return;
    onClose();
  };

  const handleConvert = async () => {
    if (!serviceRequest) return;

    setIsConverting(true);
    try {
      const payload = {
        scheduledDate: scheduledDate || undefined,
        assignedToId: assignedToId || undefined,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        notes: notes || undefined,
      };

      const response = await apiClient.post(
        `/service-requests/${serviceRequest.id}/convert-to-job`,
        payload
      );

      toast.success('Service request converted to job successfully');
      if (onConvert) {
        onConvert(response.data);
      }
      onClose();
    } catch (error) {
      console.error('Error converting service request:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to convert service request to job';
      toast.error(errorMessage);
    } finally {
      setIsConverting(false);
    }
  };

  if (!serviceRequest) return null;

  // Check if request can be converted
  const canConvert = serviceRequest.status === 'APPROVED_BY_OWNER';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
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
              Convert Service Request to Job
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
          {!canConvert && (
            <Alert severity="error">
              This service request cannot be converted to a job. 
              {serviceRequest.status === 'CONVERTED_TO_JOB' && ' It has already been converted.'}
              {serviceRequest.status === 'ARCHIVED' && ' Archived requests cannot be converted.'}
              {(serviceRequest.status === 'PENDING_MANAGER_REVIEW' || serviceRequest.status === 'PENDING_OWNER_APPROVAL') && 
                ' Requests pending approval cannot be converted yet.'}
            </Alert>
          )}

          {canConvert && (
            <Alert severity="info" icon={<CheckCircleIcon />}>
              Converting this service request will create a new job with all the details pre-filled.
              The service request status will be updated to "Converted to Job".
            </Alert>
          )}

          {/* Service Request Details Summary */}
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
              Service Request Details
            </Typography>
            
            <Stack spacing={1}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  <strong>Title:</strong> {serviceRequest.title}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip 
                  label={serviceRequest.status?.replace(/_/g, ' ')} 
                  color={getStatusColor(serviceRequest.status)}
                  size="small"
                />
                <Chip 
                  label={serviceRequest.priority} 
                  color={getPriorityColor(serviceRequest.priority)}
                  size="small"
                />
                {serviceRequest.category && (
                  <Chip 
                    label={serviceRequest.category} 
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>

              {serviceRequest.description && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Description:</strong> {serviceRequest.description}
                </Typography>
              )}

              {serviceRequest.property && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Property:</strong> {serviceRequest.property.name}
                  {serviceRequest.property.address && ` - ${serviceRequest.property.address}`}
                </Typography>
              )}

              {serviceRequest.unit && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Unit:</strong> {serviceRequest.unit.unitNumber}
                </Typography>
              )}

              {(serviceRequest.approvedBudget || serviceRequest.managerEstimatedCost) && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Estimated Cost:</strong> ${(serviceRequest.approvedBudget || serviceRequest.managerEstimatedCost).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </Typography>
              )}
            </Stack>
          </Box>

          {/* Job Details Form */}
          {canConvert && (
            <>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2 }}>
                Job Details
              </Typography>

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
                    <em>Unassigned (will be OPEN status)</em>
                  </MenuItem>
                  {technicians.map((tech) => (
                    <MenuItem key={tech.id} value={tech.id}>
                      {tech.firstName} {tech.lastName}
                      {tech.email && ` (${tech.email})`}
                    </MenuItem>
                  ))}
                </Select>
                {loadingTechnicians && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                    Loading technicians...
                  </Typography>
                )}
                {!loadingTechnicians && technicians.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                    No technicians available. Job will be created as OPEN.
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
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                helperText="Optional: Add any additional notes for this job"
                disabled={isConverting}
              />
            </>
          )}
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
          disabled={isConverting || !canConvert}
          startIcon={isConverting ? <CircularProgress size={16} /> : <WorkOutlineIcon />}
        >
          {isConverting ? 'Converting...' : 'Convert to Job'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
