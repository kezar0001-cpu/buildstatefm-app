import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  Button,
  Grid,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  useMediaQuery,
  useTheme,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';
import { FormTextField, FormSelect, FormDatePicker } from './form';
import { toISOString } from '../utils/date';
import toast from 'react-hot-toast';

const FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMIANNUALLY', label: 'Semi-annually' },
  { value: 'ANNUALLY', label: 'Annually' },
];

const planSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  propertyId: z.string().min(1, 'Property is required'),
  assignedToId: z.string().optional(),
  frequency: z.string().min(1, 'Frequency is required'),
  description: z.string().optional(),
  nextDueDate: z.date().optional(),
  autoCreateJobs: z.boolean(),
  isActive: z.boolean(),
});

const planDefaultValues = {
  name: '',
  propertyId: '',
  assignedToId: '',
  frequency: 'MONTHLY',
  description: '',
  nextDueDate: new Date(),
  autoCreateJobs: false,
  isActive: true,
};

const MaintenancePlanForm = ({ plan, onSuccess, onCancel }) => {
  const isEditing = !!plan;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(planSchema),
    defaultValues: planDefaultValues,
    mode: 'onBlur',
  });

  // Fetch properties
  const { data: properties = [], isLoading: loadingProperties } = useQuery({
    queryKey: queryKeys.properties.selectOptions(),
    queryFn: async () => {
      const response = await apiClient.get('/properties');
      return ensureArray(response.data, ['properties', 'data', 'items', 'results']);
    },
  });

  const { data: technicians = [], isLoading: loadingTechnicians } = useQuery({
    queryKey: queryKeys.users.list({ role: 'TECHNICIAN' }),
    queryFn: async () => {
      const response = await apiClient.get('/users?role=TECHNICIAN');
      return ensureArray(response.data, ['users', 'data', 'items', 'results']);
    },
  });

  // Initialize form with plan data if editing
  useEffect(() => {
    if (plan) {
      reset({
        name: plan.name || '',
        propertyId: plan.propertyId || '',
        assignedToId: plan.assignedToId || plan.assignedTo?.id || '',
        frequency: plan.frequency || 'MONTHLY',
        description: plan.description || '',
        nextDueDate: plan.nextDueDate ? new Date(plan.nextDueDate) : new Date(),
        autoCreateJobs: plan.autoCreateJobs ?? false,
        isActive: plan.isActive ?? true,
      });
    }
  }, [plan, reset]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        assignedToId: data.assignedToId || null,
        nextDueDate: toISOString(data.nextDueDate),
      };

      if (isEditing) {
        await apiClient.patch(`/plans/${plan.id}`, payload);
      } else {
        await apiClient.post('/plans', payload);
      }

      onSuccess?.();
    } catch (error) {
      console.error('Error saving maintenance plan:', error);

      // Display user-friendly error message
      const errorMessage = error?.response?.data?.message || 'Failed to save maintenance plan';
      const statusCode = error?.response?.status;

      if (statusCode === 403) {
        const errorMessage = error?.response?.data?.message || 'You can only create maintenance plans for properties you manage. Please select a property where you are assigned as the property manager.';
        toast.error(errorMessage);
      } else if (statusCode === 404) {
        toast.error('The selected property was not found. Please select a valid property.');
      } else {
        toast.error(errorMessage);
      }

      throw error;
    }
  };

  const autoCreateJobs = watch('autoCreateJobs');
  const isActive = watch('isActive');
  const technicianOptions = [
    { value: '', label: 'Unassigned' },
    ...ensureArray(technicians).map((tech) => ({
      value: tech.id,
      label: `${tech.firstName} ${tech.lastName} (${tech.email})`,
    })),
  ];

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <DialogTitle>
        {isEditing ? 'Edit Maintenance Plan' : 'Create Maintenance Plan'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormTextField
                name="name"
                control={control}
                label="Plan Name"
                required
                placeholder="e.g., HVAC Filter Replacement"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormSelect
                name="propertyId"
                control={control}
                label="Property"
                required
                disabled={isEditing} // Cannot change property after creation
                options={properties.map((p) => ({
                  value: p.id,
                  label: `${p.name} - ${p.address}`,
                }))}
                loading={loadingProperties}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormSelect
                name="frequency"
                control={control}
                label="Frequency"
                required
                options={FREQUENCY_OPTIONS}
              />
            </Grid>

            <Grid item xs={12}>
              <FormSelect
                name="assignedToId"
                control={control}
                label="Assign to Technician (Optional)"
                options={technicianOptions}
                disabled={loadingTechnicians}
                helperText={loadingTechnicians ? 'Loading technicians...' : undefined}
              />
            </Grid>

            <Grid item xs={12}>
              <FormDatePicker
                name="nextDueDate"
                control={control}
                label="Next Due Date"
                helperText="When should the next maintenance be scheduled?"
              />
            </Grid>

            <Grid item xs={12}>
              <FormTextField
                name="description"
                control={control}
                label="Description"
                multiline
                rows={3}
                placeholder="Describe what maintenance tasks should be performed..."
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="autoCreateJobs"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Auto-create Jobs"
                  />
                )}
              />
              <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                Automatically create maintenance jobs based on this schedule
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Active"
                  />
                )}
              />
              <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                Inactive plans will not create new jobs
              </Box>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting && <CircularProgress size={16} />}
        >
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Plan' : 'Create Plan'}
        </Button>
      </DialogActions>
    </Box>
  );
};

export default MaintenancePlanForm;
