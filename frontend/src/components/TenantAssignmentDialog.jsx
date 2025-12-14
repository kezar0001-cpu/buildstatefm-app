import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import { queryKeys } from '../utils/queryKeys.js';
import { toISOString } from '../utils/date';

export default function TenantAssignmentDialog({ open, onClose, unitId, tenant }) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(tenant);

  const [formData, setFormData] = useState({
    tenantId: '',
    leaseStart: null,
    leaseEnd: null,
    rentAmount: '',
    depositAmount: '',
  });

  const [errors, setErrors] = useState({});

  // Fetch available tenants (users with TENANT role)
  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: queryKeys.users.list({ role: 'TENANT' }),
    queryFn: async () => {
      const response = await apiClient.get('/users?role=TENANT');
      return response.data?.users || response.data || [];
    },
    enabled: open && !isEditing,
  });

  const availableTenants = tenantsData || [];

  // Pre-fill form when editing
  useEffect(() => {
    if (tenant) {
      setFormData({
        tenantId: tenant.tenantId || '',
        leaseStart: tenant.leaseStart ? new Date(tenant.leaseStart) : null,
        leaseEnd: tenant.leaseEnd ? new Date(tenant.leaseEnd) : null,
        rentAmount: tenant.rentAmount?.toString() || '',
        depositAmount: tenant.depositAmount?.toString() || '',
      });
    } else {
      setFormData({
        tenantId: '',
        leaseStart: null,
        leaseEnd: null,
        rentAmount: '',
        depositAmount: '',
      });
    }
    setErrors({});
  }, [tenant, open]);

  // Assign/Update tenant mutation
  const assignMutation = useMutation({
    mutationFn: async (data) => {
      if (isEditing) {
        const response = await apiClient.patch(
          `/units/${unitId}/tenants/${tenant.tenantId}`,
          data
        );
        return response.data;
      } else {
        const response = await apiClient.post(`/units/${unitId}/tenants`, data);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.detail(unitId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.units.detail(unitId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all() });
      toast.success(isEditing ? 'Tenant assignment updated' : 'Tenant assigned successfully');
      onClose();
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to assign tenant';
      toast.error(message);
    },
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!isEditing && !formData.tenantId) {
      newErrors.tenantId = 'Please select a tenant';
    }

    if (!formData.leaseStart) {
      newErrors.leaseStart = 'Please enter lease start date';
    }

    if (!formData.leaseEnd) {
      newErrors.leaseEnd = 'Please enter lease end date';
    }

    if (formData.leaseStart && formData.leaseEnd) {
      if (formData.leaseEnd <= formData.leaseStart) {
        newErrors.leaseEnd = 'Lease end date must be after start date';
      }
    }

    if (!formData.rentAmount || parseFloat(formData.rentAmount) <= 0) {
      newErrors.rentAmount = 'Please enter a valid rent amount';
    }

    if (formData.depositAmount && parseFloat(formData.depositAmount) < 0) {
      newErrors.depositAmount = 'Deposit amount cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    }

    const payload = {
      leaseStart: toISOString(formData.leaseStart),
      leaseEnd: toISOString(formData.leaseEnd),
      rentAmount: parseFloat(formData.rentAmount),
      depositAmount: formData.depositAmount ? parseFloat(formData.depositAmount) : undefined,
    };

    if (!isEditing) {
      payload.tenantId = formData.tenantId;
    }

    assignMutation.mutate(payload);
  };

  const handleClose = () => {
    if (!assignMutation.isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEditing ? 'Edit Tenant Assignment' : 'Assign Tenant to Unit'}
      </DialogTitle>

      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {/* Tenant Selection (only when creating) */}
            {!isEditing && (
              <Box>
                <TextField
                  select
                  fullWidth
                  label="Tenant"
                  value={formData.tenantId}
                  onChange={(e) => handleChange('tenantId', e.target.value)}
                  error={Boolean(errors.tenantId)}
                  helperText={errors.tenantId}
                  required
                  disabled={tenantsLoading || assignMutation.isLoading}
                >
                  {tenantsLoading ? (
                    <MenuItem disabled>Loading tenants...</MenuItem>
                  ) : availableTenants.length === 0 ? (
                    <MenuItem disabled>No tenants available</MenuItem>
                  ) : (
                    availableTenants.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} ({t.email})
                      </MenuItem>
                    ))
                  )}
                </TextField>

                {!tenantsLoading && availableTenants.length === 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    No tenants available. Please invite tenants through the Team Management page
                    first.
                  </Alert>
                )}
              </Box>
            )}

            {/* Editing existing tenant */}
            {isEditing && tenant && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Tenant
                </Typography>
                <Typography variant="body1">
                  {tenant.tenant?.firstName} {tenant.tenant?.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tenant.tenant?.email}
                </Typography>
              </Box>
            )}

            {/* Lease Start Date */}
            <DatePicker
              label="Lease Start Date"
              value={formData.leaseStart}
              onChange={(date) => handleChange('leaseStart', date)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  error: Boolean(errors.leaseStart),
                  helperText: errors.leaseStart,
                  disabled: assignMutation.isLoading,
                },
              }}
            />

            {/* Lease End Date */}
            <DatePicker
              label="Lease End Date"
              value={formData.leaseEnd}
              onChange={(date) => handleChange('leaseEnd', date)}
              minDate={formData.leaseStart || undefined}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  error: Boolean(errors.leaseEnd),
                  helperText: errors.leaseEnd,
                  disabled: assignMutation.isLoading,
                },
              }}
            />

            {/* Monthly Rent */}
            <TextField
              fullWidth
              label="Monthly Rent"
              type="number"
              value={formData.rentAmount}
              onChange={(e) => handleChange('rentAmount', e.target.value)}
              error={Boolean(errors.rentAmount)}
              helperText={errors.rentAmount}
              required
              disabled={assignMutation.isLoading}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
              inputProps={{
                min: 0,
                step: 0.01,
              }}
            />

            {/* Security Deposit */}
            <TextField
              fullWidth
              label="Security Deposit (Optional)"
              type="number"
              value={formData.depositAmount}
              onChange={(e) => handleChange('depositAmount', e.target.value)}
              error={Boolean(errors.depositAmount)}
              helperText={errors.depositAmount}
              disabled={assignMutation.isLoading}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
              inputProps={{
                min: 0,
                step: 0.01,
              }}
            />


          </Stack>
        </LocalizationProvider>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={assignMutation.isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={assignMutation.isLoading || (!isEditing && availableTenants.length === 0)}
        >
          {assignMutation.isLoading
            ? 'Saving...'
            : isEditing
            ? 'Update Assignment'
            : 'Assign Tenant'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
