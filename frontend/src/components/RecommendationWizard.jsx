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
  useMediaQuery,
  useTheme,
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

const getInitialState = (initialPropertyId, initialInspectionId) => ({
  propertyId: initialPropertyId || '',
  inspectionId: initialInspectionId || '',
  title: '',
  description: '',
  priority: 'MEDIUM',
  estimatedCost: '',
});

const getErrorMessage = (error) => {
  if (!error) return 'Something went wrong while creating the recommendation.';
  
  // Handle axios error response
  if (error?.response?.data) {
    const errorData = error.response.data;
    // Backend uses standardized error format: { success: false, message: "...", code: "..." }
    if (errorData.message) {
      return errorData.message;
    }
    // Fallback for other error formats
    if (errorData.error) {
      return errorData.error;
    }
  }
  
  // Handle network errors or other error types
  if (error?.message) {
    return error.message;
  }
  
  return 'Something went wrong while creating the recommendation.';
};

export default function RecommendationWizard({ open, onClose, initialPropertyId, initialInspectionId }) {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeStep, setActiveStep] = useState(0);
  const [formState, setFormState] = useState(() => getInitialState(initialPropertyId, initialInspectionId));
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
      setFormState(getInitialState(initialPropertyId, initialInspectionId));
      setErrors({});
      setIsSubmitting(false);
    } else if (initialPropertyId) {
      // If property is pre-selected, skip to step 1
      setFormState(prev => ({ ...prev, propertyId: initialPropertyId, inspectionId: initialInspectionId || '' }));
      setActiveStep(1);
    }
  }, [open, initialPropertyId, initialInspectionId]);

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

      const payload = {
        propertyId: formState.propertyId,
        title: formState.title.trim(),
        description: formState.description.trim(),
        priority: formState.priority,
        estimatedCost: formState.estimatedCost ? parseFloat(formState.estimatedCost) : null,
      };

      // Include inspectionId if provided
      if (formState.inspectionId) {
        payload.inspectionId = formState.inspectionId;
      }

      console.log('[RecommendationWizard] Creating recommendation with payload:', payload);
      
      const response = await createRecommendationMutation.mutateAsync({
        url: '/recommendations',
        method: 'post',
        data: payload,
      });

      console.log('[RecommendationWizard] Recommendation created successfully:', response?.data);
      
      toast.success('Recommendation created successfully!');
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all() });
      
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('[RecommendationWizard] Error creating recommendation:', {
        error,
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
      });
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
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
      fullScreen={isMobile}
      disableEnforceFocus
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
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

      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        <Stepper 
          activeStep={activeStep} 
          orientation={isMobile ? 'vertical' : 'horizontal'}
          sx={{ 
            mb: { xs: 3, sm: 4 }, 
            mt: { xs: 1, sm: 2 },
            '& .MuiStepLabel-root': {
              '& .MuiStepLabel-label': {
                fontSize: { xs: '0.875rem', sm: '1rem' },
              },
            },
          }}
        >
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="body2" fontWeight={500} sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                  {step.label}
                </Typography>
                {!isMobile && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {step.description}
                  </Typography>
                )}
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
            <FormControl fullWidth error={!!errors.propertyId} required>
              <InputLabel>Property</InputLabel>
              <Select
                value={formState.propertyId}
                label="Property"
                onChange={handleChange('propertyId')}
                disabled={loadingProperties || isSubmitting || !!initialPropertyId}
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
              {initialPropertyId && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                  Property is pre-selected from inspection
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
              label="Title"
              value={formState.title}
              onChange={handleChange('title')}
              error={!!errors.title}
              helperText={errors.title || 'Enter a clear title for this recommendation'}
              disabled={isSubmitting}
              required
            />

            <TextField
              fullWidth
              label="Description"
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
              <FormControl fullWidth error={!!errors.priority} required>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formState.priority}
                  label="Priority"
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

      <DialogActions 
        sx={{ 
          p: { xs: 2, sm: 2.5 }, 
          borderTop: '1px solid', 
          borderColor: 'divider',
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          gap: { xs: 1, sm: 0 },
        }}
      >
        <Button
          onClick={handleCancel}
          disabled={isSubmitting || createRecommendationMutation.isPending}
          fullWidth={isMobile}
          sx={{ m: 0 }}
        >
          Cancel
        </Button>
        <Box sx={{ flex: { xs: 0, sm: 1 } }} />
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={1} 
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {activeStep > 0 && (
            <Button 
              onClick={handleBack} 
              disabled={isSubmitting || createRecommendationMutation.isPending}
              fullWidth={isMobile}
              variant={isMobile ? 'outlined' : 'text'}
            >
              Back
            </Button>
          )}
          {activeStep < steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={isSubmitting || createRecommendationMutation.isPending}
              fullWidth={isMobile}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleFinish}
              disabled={isSubmitting || createRecommendationMutation.isPending}
              fullWidth={isMobile}
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
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

