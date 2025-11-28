import React, { useMemo, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';
import { inspectionSchema, inspectionDefaultValues } from '../schemas/inspectionSchema';
import { FormTextField, FormSelect } from './form';
import { formatDateTimeForInput, toISOString } from '../utils/date';
import InspectionTemplatePreview from './InspectionTemplatePreview';

const INSPECTION_TYPE_OPTIONS = [
  { value: 'ROUTINE', label: 'Routine' },
  { value: 'MOVE_IN', label: 'Move-in' },
  { value: 'MOVE_OUT', label: 'Move-out' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'COMPLIANCE', label: 'Compliance' },
];

const InspectionForm = ({ inspection, onSuccess, onCancel }) => {
  const isEditing = Boolean(inspection);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(inspectionSchema),
    defaultValues: inspectionDefaultValues,
    mode: 'onBlur',
  });

  const propertyId = watch('propertyId');
  const inspectionType = watch('type');
  const templateId = watch('templateId');

  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const { data: propertiesData, isLoading: loadingProperties } = useQuery({
    queryKey: queryKeys.properties.all(),
    queryFn: async () => {
      const response = await apiClient.get('/properties');
      return response.data;
    },
  });

  const properties = ensureArray(propertiesData, ['properties', 'data', 'items', 'results']);

  const { data: unitsData } = useQuery({
    queryKey: queryKeys.units.list(propertyId),
    queryFn: async () => {
      if (!propertyId) return [];
      const response = await apiClient.get('/units', { params: { propertyId } });
      return response.data;
    },
    enabled: Boolean(propertyId),
  });

  const units = ensureArray(unitsData, ['units', 'data', 'items', 'results']);

  const { data: inspectorData = { inspectors: [] } } = useQuery({
    queryKey: queryKeys.users.list({ role: 'TECHNICIAN' }),
    queryFn: async () => {
      const response = await apiClient.get('/inspections/inspectors');
      return response.data;
    },
  });

  const inspectorOptions = useMemo(() => inspectorData.inspectors || [], [inspectorData.inspectors]);

  const { data: tagData = { tags: [] } } = useQuery({
    queryKey: queryKeys.inspections.tags(),
    queryFn: async () => {
      const response = await apiClient.get('/inspections/tags');
      return response.data;
    },
  });

  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['inspection-templates', inspectionType, propertyId],
    queryFn: async () => {
      const params = {
        type: inspectionType,
        isActive: true,
      };
      if (propertyId) {
        params.propertyId = propertyId;
      }
      const response = await apiClient.get('/inspection-templates', { params });
      return response.data;
    },
    enabled: Boolean(inspectionType),
  });

  const templates = ensureArray(templatesData, ['templates', 'data', 'items', 'results']);

  // Update selected template when templateId changes
  useEffect(() => {
    if (templateId && templates.length > 0) {
      const template = templates.find((t) => t.id === templateId);
      setSelectedTemplate(template || null);
    } else {
      setSelectedTemplate(null);
    }
  }, [templateId, templates]);

  // Reset unitId when propertyId changes
  useEffect(() => {
    setValue('unitId', '');
  }, [propertyId, setValue]);

  // Reset templateId when type or property changes
  useEffect(() => {
    setValue('templateId', '');
  }, [inspectionType, propertyId, setValue]);

  // Initialize form with inspection data if editing
  useEffect(() => {
    if (inspection) {
      reset({
        title: inspection.title || '',
        type: inspection.type || 'ROUTINE',
        scheduledDate: inspection.scheduledDate
          ? formatDateTimeForInput(inspection.scheduledDate)
          : '',
        propertyId: inspection.propertyId || '',
        unitId: inspection.unitId || '',
        assignedToId: inspection.assignedToId || '',
        notes: inspection.notes || '',
        tags: inspection.tags || [],
        templateId: inspection.templateId || '',
      });
    } else {
      reset(inspectionDefaultValues);
    }
  }, [inspection, reset]);

  // Auto-focus on first error field
  useEffect(() => {
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      setFocus(firstErrorField);
    }
  }, [errors, setFocus]);

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/inspections', payload);
      return response.data;
    },
    onSuccess,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.patch(`/inspections/${inspection.id}`, payload);
      return response.data;
    },
    onSuccess,
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const submitError = createMutation.error || updateMutation.error;

  const onSubmit = async (data) => {
    const payload = {
      title: data.title,
      type: data.type,
      scheduledDate: toISOString(data.scheduledDate),
      propertyId: data.propertyId,
      unitId: data.unitId || undefined,
      assignedToId: data.assignedToId || undefined,
      notes: data.notes || undefined,
      tags: data.tags,
      templateId: data.templateId || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const propertyOptions = properties.map((property) => ({
    value: property.id,
    label: property.name,
  }));

  const unitOptions = [
    { value: '', label: 'Common areas' },
    ...units.map((unit) => ({
      value: unit.id,
      label: `Unit ${unit.unitNumber}`,
    })),
  ];

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <DialogTitle>{isEditing ? 'Edit inspection' : 'Schedule inspection'}</DialogTitle>
      <DialogContent dividers>
        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {submitError?.response?.data?.message || 'Failed to save inspection'}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormTextField
              name="title"
              control={control}
              label="Title"
              required
              inputProps={{ placeholder: 'e.g. Quarterly fire safety inspection' }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormSelect
              name="type"
              control={control}
              label="Inspection type"
              options={INSPECTION_TYPE_OPTIONS}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="scheduledDate"
              control={control}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  fullWidth
                  type="datetime-local"
                  label="Scheduled date and time"
                  required
                  error={!!error}
                  helperText={error?.message}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{
                    'aria-invalid': !!error,
                    'aria-describedby': error ? 'scheduledDate-error' : undefined,
                  }}
                  FormHelperTextProps={{
                    id: error ? 'scheduledDate-error' : undefined,
                    role: error ? 'alert' : undefined,
                    'aria-live': error ? 'polite' : undefined,
                  }}
                />
              )}
            />
          </Grid>

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
              label="Unit (optional)"
              options={unitOptions}
              disabled={!propertyId || !units.length}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="templateId"
              control={control}
              render={({ field: { value, onChange }, fieldState: { error } }) => (
                <Autocomplete
                  size="small"
                  options={templates}
                  value={templates.find((option) => option.id === value) || null}
                  onChange={(_event, newValue) => onChange(newValue?.id || '')}
                  getOptionLabel={(option) => option.name || ''}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Template (optional)"
                      helperText={error?.message || 'Select a template to auto-populate rooms and checklist items'}
                      error={!!error}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingTemplates ? <CircularProgress size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                      inputProps={{
                        ...params.inputProps,
                        'aria-invalid': !!error,
                        'aria-describedby': error ? 'templateId-error' : undefined,
                      }}
                      FormHelperTextProps={{
                        id: error ? 'templateId-error' : undefined,
                        role: error ? 'alert' : undefined,
                        'aria-live': error ? 'polite' : undefined,
                      }}
                    />
                  )}
                  disabled={!inspectionType || loadingTemplates}
                  noOptionsText={
                    !inspectionType
                      ? 'Select inspection type first'
                      : 'No templates available'
                  }
                />
              )}
            />
          </Grid>

          {selectedTemplate && (
            <Grid item xs={12}>
              <InspectionTemplatePreview template={selectedTemplate} />
            </Grid>
          )}

          <Grid item xs={12} sm={6}>
            <Controller
              name="assignedToId"
              control={control}
              render={({ field: { value, onChange }, fieldState: { error } }) => (
                <Autocomplete
                  size="small"
                  options={inspectorOptions}
                  value={inspectorOptions.find((option) => option.id === value) || null}
                  onChange={(_event, newValue) => onChange(newValue?.id || '')}
                  getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Assign to"
                      helperText={error?.message || 'Leave blank to assign later'}
                      error={!!error}
                      inputProps={{
                        ...params.inputProps,
                        'aria-invalid': !!error,
                        'aria-describedby': error ? 'assignedToId-error' : undefined,
                      }}
                      FormHelperTextProps={{
                        id: error ? 'assignedToId-error' : undefined,
                        role: error ? 'alert' : undefined,
                        'aria-live': error ? 'polite' : undefined,
                      }}
                    />
                  )}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <FormTextField
              name="notes"
              control={control}
              label="Notes"
              multiline
              rows={3}
              inputProps={{ placeholder: 'Add specific instructions or context for the inspector' }}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="tags"
              control={control}
              render={({ field: { value, onChange }, fieldState: { error } }) => (
                <Autocomplete
                  multiple
                  freeSolo
                  size="small"
                  options={tagData.tags || []}
                  value={value}
                  onChange={(_event, newValue) => onChange(newValue)}
                  renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => (
                      <Chip {...getTagProps({ index })} label={option} key={option} size="small" />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tags"
                      placeholder="Add tags such as safety, compliance, urgent"
                      error={!!error}
                      helperText={error?.message}
                      inputProps={{
                        ...params.inputProps,
                        'aria-invalid': !!error,
                        'aria-describedby': error ? 'tags-error' : undefined,
                      }}
                      FormHelperTextProps={{
                        id: error ? 'tags-error' : undefined,
                        role: error ? 'alert' : undefined,
                        'aria-live': error ? 'polite' : undefined,
                      }}
                    />
                  )}
                />
              )}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onCancel} disabled={isSaving || isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSaving || isSubmitting}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          {isEditing ? 'Update inspection' : 'Schedule inspection'}
        </Button>
      </DialogActions>
    </Box>
  );
};

export default InspectionForm;
