import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
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
} from '@mui/material';
import { apiClient } from '../api/client';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';
import { invalidateJobQueries, invalidateDashboardQueries } from '../utils/cacheInvalidation.js';
import { jobSchema, jobDefaultValues } from '../schemas/jobSchema';
import { FormTextField, FormSelect } from './form';
import JobSchedule from './forms/JobSchedule';
import JobAssignment from './forms/JobAssignment';
import JobCostEstimate from './forms/JobCostEstimate';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const JobForm = ({ job, onSuccess, onCancel }) => {
  const isEditing = !!job;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(jobSchema),
    defaultValues: jobDefaultValues,
    mode: 'onBlur',
  });

  const propertyId = watch('propertyId');

  // Fetch properties
  const { data: properties = [], isLoading: loadingProperties } = useQuery({
    queryKey: queryKeys.properties.selectOptions(),
    queryFn: async () => {
      const response = await apiClient.get('/properties');
      return ensureArray(response.data, ['properties', 'data', 'items', 'results']);
    },
  });

  // Fetch units for selected property
  const { data: units = [] } = useQuery({
    queryKey: queryKeys.properties.units(propertyId),
    queryFn: async () => {
      if (!propertyId) return [];
      const response = await apiClient.get(`/units?propertyId=${propertyId}`);
      return ensureArray(response.data, ['units', 'data', 'items', 'results']);
    },
    enabled: !!propertyId,
  });

  // Fetch technicians
  const { data: technicians = [] } = useQuery({
    queryKey: queryKeys.technicians.all(),
    queryFn: async () => {
      const response = await apiClient.get('/users?role=TECHNICIAN');
      return ensureArray(response.data, ['users', 'data', 'items', 'results']);
    },
  });

  // Reset unitId when propertyId changes
  useEffect(() => {
    setValue('unitId', '');
  }, [propertyId, setValue]);

  // Initialize form with job data if editing
  useEffect(() => {
    if (job) {
      reset({
        title: job.title || '',
        description: job.description || '',
        priority: job.priority || 'MEDIUM',
        status: job.status || 'OPEN',
        propertyId: job.propertyId || '',
        unitId: job.unitId || '',
        assignedToId: job.assignedToId || '',
        scheduledDate: job.scheduledDate
          ? new Date(job.scheduledDate).toISOString().slice(0, 16)
          : '',
        estimatedCost: job.estimatedCost || '',
        notes: job.notes || '',
      });
    } else {
      reset(jobDefaultValues);
    }
  }, [job, reset]);

  // Auto-focus on first error field
  useEffect(() => {
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      setFocus(firstErrorField);
    }
  }, [errors, setFocus]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/jobs', data);
      return response.data;
    },
    onSuccess: async (createdJob, variables) => {
      const jobId = createdJob?.job?.id ?? createdJob?.id;
      invalidateJobQueries(queryClient, jobId, variables.propertyId, variables.unitId);
      invalidateDashboardQueries(queryClient);
      onSuccess();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.patch(`/jobs/${job.id}`, data);
      return response.data;
    },
    onSuccess: async (_data, variables) => {
      invalidateJobQueries(queryClient, job.id, variables.propertyId || job.propertyId, variables.unitId || job.unitId);
      invalidateDashboardQueries(queryClient);
      onSuccess();
    },
  });

  const onSubmit = async (data) => {
    const payload = {
      title: data.title,
      description: data.description,
      priority: data.priority,
      propertyId: data.propertyId,
      unitId: data.unitId || undefined,
      assignedToId: data.assignedToId || undefined,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate).toISOString() : undefined,
      estimatedCost: data.estimatedCost ?? undefined,
      notes: data.notes || undefined,
    };

    // Only send status if editing
    if (isEditing) {
      payload.status = data.status;
    }

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const submitError = createMutation.error || updateMutation.error;

  const propertyOptions = ensureArray(properties).map((property) => ({
    value: property.id,
    label: property.name,
  }));

  const unitOptions = [
    { value: '', label: 'No specific unit' },
    ...ensureArray(units).map((unit) => ({
      value: unit.id,
      label: `Unit ${unit.unitNumber}`,
    })),
  ];

  const technicianOptions = [
    { value: '', label: 'Unassigned' },
    ...ensureArray(technicians).map((tech) => ({
      value: tech.id,
      label: `${tech.firstName} ${tech.lastName} (${tech.email})`,
    })),
  ];

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <DialogTitle>
        {isEditing ? 'Edit Job' : 'Create Job'}
      </DialogTitle>

      <DialogContent dividers>
        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {submitError?.response?.data?.error || 'Failed to save job'}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormTextField
              name="title"
              control={control}
              label="Title"
              required
              inputProps={{ placeholder: 'e.g., Fix HVAC System' }}
            />
          </Grid>

          <Grid item xs={12}>
            <FormTextField
              name="description"
              control={control}
              label="Description"
              required
              multiline
              rows={3}
              inputProps={{ placeholder: 'Describe the job in detail...' }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormSelect
              name="priority"
              control={control}
              label="Priority"
              options={PRIORITY_OPTIONS}
              required
            />
          </Grid>

          {isEditing && (
            <Grid item xs={12} sm={6}>
              <FormSelect
                name="status"
                control={control}
                label="Status"
                options={STATUS_OPTIONS}
                required
              />
            </Grid>
          )}

          <Grid item xs={12} sm={6}>
            <FormSelect
              name="propertyId"
              control={control}
              label="Property"
              options={propertyOptions}
              required
              disabled={loadingProperties}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormSelect
              name="unitId"
              control={control}
              label="Unit (Optional)"
              options={unitOptions}
              disabled={!propertyId || !units?.length}
            />
          </Grid>

          <JobAssignment control={control} technicianOptions={technicianOptions} />

          <JobSchedule control={control} />

          <JobCostEstimate control={control} />

          <Grid item xs={12}>
            <FormTextField
              name="notes"
              control={control}
              label="Notes (Optional)"
              multiline
              rows={2}
              inputProps={{ placeholder: 'Add any additional notes...' }}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions
        sx={{
          px: { xs: 2, md: 3 },
          pb: { xs: 2, md: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}
      >
        <Button
          onClick={onCancel}
          disabled={isLoading || isSubmitting}
          fullWidth={isMobile}
          sx={{ minHeight: { xs: 48, md: 36 } }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isLoading || isSubmitting}
          startIcon={isLoading && <CircularProgress size={16} />}
          fullWidth={isMobile}
          sx={{ minHeight: { xs: 48, md: 36 } }}
        >
          {isEditing ? 'Update' : 'Create'} Job
        </Button>
      </DialogActions>
    </Box>
  );
};

export default JobForm;
