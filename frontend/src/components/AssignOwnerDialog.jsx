import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import apiClient from '../utils/apiClient';

export default function AssignOwnerDialog({ open, onClose, propertyId }) {
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [ownershipPercentage, setOwnershipPercentage] = useState(100);
  const queryClient = useQueryClient();

  // Fetch all users with OWNER role
  const { data: owners = [], isLoading: loadingOwners } = useQuery({
    queryKey: ['users', 'role', 'OWNER'],
    queryFn: async () => {
      const response = await apiClient.get('/users?role=OWNER');
      return response.data?.users || response.data?.items || [];
    },
    enabled: open,
  });

  // Fetch existing property owners to filter them out
  const { data: property } = useQuery({
    queryKey: ['properties', propertyId],
    queryFn: async () => {
      const response = await apiClient.get(`/properties/${propertyId}`);
      return response.data?.property || response.data;
    },
    enabled: open && !!propertyId,
  });

  const assignOwnerMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post(`/properties/${propertyId}/owners`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', propertyId] });
      toast.success('Owner assigned successfully');
      handleClose();
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to assign owner';
      toast.error(message);
    },
  });

  const handleClose = () => {
    setSelectedOwnerId('');
    setOwnershipPercentage(100);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedOwnerId) {
      toast.error('Please select an owner');
      return;
    }
    assignOwnerMutation.mutate({
      ownerId: selectedOwnerId,
      ownershipPercentage: parseFloat(ownershipPercentage),
    });
  };

  // Filter out owners already assigned to this property
  const existingOwnerIds = property?.owners?.map((o) => o.ownerId) || [];
  const availableOwners = owners.filter((owner) => !existingOwnerIds.includes(owner.id));

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Assign Existing Owner</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {loadingOwners ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : availableOwners.length === 0 ? (
              <Alert severity="info">
                No available owners to assign. All owners in the system are already assigned to this
                property, or there are no owners registered.
              </Alert>
            ) : (
              <>
                <FormControl fullWidth required>
                  <InputLabel>Select Owner</InputLabel>
                  <Select
                    value={selectedOwnerId}
                    onChange={(e) => setSelectedOwnerId(e.target.value)}
                    label="Select Owner"
                  >
                    {availableOwners.map((owner) => (
                      <MenuItem key={owner.id} value={owner.id}>
                        {owner.firstName} {owner.lastName} ({owner.email})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Ownership Percentage"
                  type="number"
                  value={ownershipPercentage}
                  onChange={(e) => setOwnershipPercentage(e.target.value)}
                  inputProps={{ min: 0, max: 100, step: 0.01 }}
                  helperText="Enter the ownership percentage (0-100)"
                  required
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={assignOwnerMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              assignOwnerMutation.isPending || !selectedOwnerId || availableOwners.length === 0
            }
          >
            {assignOwnerMutation.isPending ? 'Assigning...' : 'Assign Owner'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
