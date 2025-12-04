import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Button,
  Box,
  Stack,
  Typography,
  TextField,
  MenuItem,
  Paper,
  IconButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import useApiMutation from '../hooks/useApiMutation.js';
import { queryKeys } from '../utils/queryKeys.js';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const steps = [
  { label: 'Select Property', description: 'Choose the property for this recommendation.' },
  { label: 'Recommendation Details', description: 'Provide details about the job recommendation.' },
];

const initialState = {
  propertyId: '',
  title: '',
  description: '',
  priority: 'MEDIUM',
  estimatedCost: '',
};

const getErrorMessage = (error) => {
  if (!error) return '';
  return error?.response?.data?.message || error.message || 'Something went wrong while creating the recommendation.';
};

export default function RecommendationWizard({ open, onClose }) {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [formState, setFormState] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch properties
  const { data: propertiesData, isLoading: loadingProperties } = useQuery({
    queryKey: queryKeys.properties.all(),
    queryFn: async () => {
      const response = await apiClient.get('/properties?limit=100&offset=0');
      return response.data;
    },
  });

  const properties = propertiesData?.items || [];

  const createRecommendationMutation = useApiMutation({
    url: '/recommendations',
    method: 'post',
    invalidateKeys: [queryKeys.recommendations.all()],
  });

  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setFormState(initialState);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open]);

  const handleChange = (field) => (event) => {
    const { value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 0) {
      if (!formState.propertyId) {
        newErrors.propertyId = 'Please select a property';
      }
    } else if (step === 1) {
      if (!formState.title || formState.title.trim().length === 0) {
        newErrors.title = 'Title is required';
      }
      if (!formState.description || formState.description.trim().length === 0) {
        newErrors.description = 'Description is required';
      }
      if (formState.estimatedCost && isNaN(parseFloat(formState.estimatedCost))) {
        newErrors.estimatedCost = 'Estimated cost must be a valid number';
      }
      if (formState.estimatedCost && parseFloat(formState.estimatedCost) < 0) {
        newErrors.estimatedCost = 'Estimated cost cannot be negative';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(activeStep)) {
      return;
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleCancel = () => {
    if (isSubmitting || createRecommendationMutation.isPending) return;
    if (onClose) onClose();
  };

  const handleFinish = async () => {
    if (isSubmitting || createRecommendationMutation.isPending) {
      return;
    }

    if (!validateStep(1)) {
      setActiveStep(1);
      return;
    }

    setIsSubmitting(true);

    try {
      // Find the property to get its reportId (we need an inspection report)
      // For now, we'll create a recommendation without a reportId if needed
      // The backend should handle creating a report if one doesn't exist
      const property = properties.find((p) => p.id === formState.propertyId);
      
      if (!property) {
        toast.error('Selected property not found');
        setIsSubmitting(false);
        return;
      }

      // We need to find or create a report for this property
      // For simplicity, we'll require the user to have an inspection report
      // In a real scenario, we might create a report on the fly
      const payload = {
        propertyId: formState.propertyId,
        title: formState.title.trim(),
        description: formState.description.trim(),
        priority: formState.priority,
        estimatedCost: formState.estimatedCost ? parseFloat(formState.estimatedCost) : null,
      };

      await createRecommendationMutation.mutateAsync({
        url: '/recommendations',
        method: 'post',
        data: payload,
      });

      toast.success('Recommendation created successfully!');
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all() });
      
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error creating recommendation:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProperty = properties.find((p) => p.id === formState.propertyId);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      disableEnforceFocus
      PaperProps={{
        sx: {
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>
            Create Job Recommendation
          </Typography>
          <IconButton
            onClick={handleCancel}
            disabled={isSubmitting || createRecommendationMutation.isPending}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 2 }}>
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="body2" fontWeight={500}>
                  {step.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {step.description}
                </Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {createRecommendationMutation.isError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {getErrorMessage(createRecommendationMutation.error)}
          </Alert>
        )}

        {/* Step 0: Select Property */}
        {activeStep === 0 && (
          <Stack spacing={3}>
            <FormControl fullWidth error={!!errors.propertyId}>
              <InputLabel>Property *</InputLabel>
              <Select
                value={formState.propertyId}
                label="Property *"
                onChange={handleChange('propertyId')}
                disabled={loadingProperties || isSubmitting}
              >
                {properties.map((property) => (
                  <MenuItem key={property.id} value={property.id}>
                    {property.name} - {property.address}
                  </MenuItem>
                ))}
              </Select>
              {errors.propertyId && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {errors.propertyId}
                </Typography>
              )}
            </FormControl>

            {selectedProperty && (
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Selected Property
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedProperty.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedProperty.address}
                </Typography>
              </Paper>
            )}
          </Stack>
        )}

        {/* Step 1: Recommendation Details */}
        {activeStep === 1 && (
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Title *"
              value={formState.title}
              onChange={handleChange('title')}
              error={!!errors.title}
              helperText={errors.title || 'Enter a clear title for this recommendation'}
              disabled={isSubmitting}
              required
            />

            <TextField
              fullWidth
              label="Description *"
              value={formState.description}
              onChange={handleChange('description')}
              error={!!errors.description}
              helperText={errors.description || 'Describe the recommended work in detail'}
              disabled={isSubmitting}
              required
              multiline
              rows={4}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth error={!!errors.priority}>
                <InputLabel>Priority *</InputLabel>
                <Select
                  value={formState.priority}
                  label="Priority *"
                  onChange={handleChange('priority')}
                  disabled={isSubmitting}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Estimated Cost"
                type="number"
                value={formState.estimatedCost}
                onChange={handleChange('estimatedCost')}
                error={!!errors.estimatedCost}
                helperText={errors.estimatedCost || 'Optional: Estimated cost in dollars'}
                disabled={isSubmitting}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                }}
              />
            </Stack>

            {selectedProperty && (
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Property
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedProperty.name}
                </Typography>
              </Paper>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          onClick={handleCancel}
          disabled={isSubmitting || createRecommendationMutation.isPending}
        >
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={isSubmitting || createRecommendationMutation.isPending}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isSubmitting || createRecommendationMutation.isPending}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleFinish}
            disabled={isSubmitting || createRecommendationMutation.isPending}
            startIcon={
              isSubmitting || createRecommendationMutation.isPending ? (
                <CircularProgress size={16} />
              ) : (
                <CheckCircleIcon />
              )
            }
          >
            {isSubmitting || createRecommendationMutation.isPending ? 'Creating...' : 'Create Recommendation'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

