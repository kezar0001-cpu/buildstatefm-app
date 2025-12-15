import { useState, useEffect } from 'react';
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
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import useApiMutation from '../hooks/useApiMutation.js';
import { queryKeys } from '../utils/queryKeys.js';
import ensureArray from '../utils/ensureArray';
import { ServiceRequestImageManager } from '../features/images';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low - Can wait a few days' },
  { value: 'MEDIUM', label: 'Medium - Normal priority' },
  { value: 'HIGH', label: 'High - Needs attention soon' },
  { value: 'URGENT', label: 'Urgent - Immediate attention needed' },
];

const CATEGORY_OPTIONS = [
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'HVAC', label: 'HVAC (Heating/Cooling)' },
  { value: 'APPLIANCE', label: 'Appliance' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'PEST_CONTROL', label: 'Pest Control' },
  { value: 'LANDSCAPING', label: 'Landscaping' },
  { value: 'GENERAL', label: 'General Maintenance' },
  { value: 'OTHER', label: 'Other' },
];

const steps = [
  { label: 'Property & Unit', description: 'Select the property and unit for this service request.' },
  { label: 'Request Details', description: 'Provide details about your maintenance request.' },
  { label: 'Photos', description: 'Add photos to help describe the issue (optional).' },
];

const initialState = {
  propertyId: '',
  unitId: '',
  title: '',
  description: '',
  category: '',
  priority: 'MEDIUM',
  photos: [],
};

const getErrorMessage = (error) => {
  if (!error) return 'Something went wrong while creating the service request.';

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

  return 'Something went wrong while creating the service request.';
};

export default function ServiceRequestWizard({
  open,
  onClose,
  onSuccess,
  initialPropertyId,
  initialUnitId,
  availableProperties,
  availableUnits
}) {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeStep, setActiveStep] = useState(0);
  const [formState, setFormState] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Fetch properties (if not provided)
  const { data: propertiesData, isLoading: loadingProperties } = useQuery({
    queryKey: queryKeys.properties.selectOptions(),
    queryFn: async () => {
      const response = await apiClient.get('/properties');
      return ensureArray(response.data, ['items', 'data.items', 'properties']);
    },
    enabled: !availableProperties,
  });

  const properties = availableProperties || propertiesData || [];

  // Fetch units for selected property
  const { data: unitsData = [] } = useQuery({
    queryKey: queryKeys.properties.units(formState.propertyId),
    queryFn: async () => {
      if (!formState.propertyId) return [];
      const response = await apiClient.get(`/units?propertyId=${formState.propertyId}`);
      return ensureArray(response.data, ['items', 'data.items', 'units']);
    },
    enabled: !!formState.propertyId && !availableUnits,
  });

  const units = availableUnits
    ? availableUnits.filter(u => u.propertyId === formState.propertyId)
    : (unitsData || []);

  const createServiceRequestMutation = useApiMutation({
    url: '/service-requests',
    method: 'post',
    invalidateKeys: [queryKeys.serviceRequests.all()],
  });

  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setFormState({
        ...initialState,
        propertyId: initialPropertyId || '',
        unitId: initialUnitId || '',
      });
      setErrors({});
      setIsSubmitting(false);
      setUploadedImages([]);
      setIsUploadingImages(false);
    }
  }, [open, initialPropertyId, initialUnitId]);

  const handleChange = (field) => (event) => {
    const { value } = event.target;
    setFormState((prev) => {
      const newState = { ...prev, [field]: value };
      // Clear unit if property changes
      if (field === 'propertyId') {
        newState.unitId = '';
      }
      return newState;
    });
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
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
      if (!formState.category) {
        newErrors.category = 'Category is required';
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
    if (isSubmitting || createServiceRequestMutation.isPending) return;
    if (isUploadingImages) return;
    if (onClose) onClose();
  };

  const handleFinish = async () => {
    if (isSubmitting || createServiceRequestMutation.isPending) {
      return;
    }

    if (isUploadingImages) {
      toast.error('Please wait for images to finish uploading');
      return;
    }

    if (!validateStep(1)) {
      setActiveStep(1);
      return;
    }

    setIsSubmitting(true);

    try {
      const photoUrls = uploadedImages
        .map((img) => img.imageUrl || img.url)
        .filter(Boolean);

      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim(),
        category: formState.category,
        priority: formState.priority,
        propertyId: formState.propertyId,
        unitId: formState.unitId || undefined,
        photos: photoUrls.length > 0 ? photoUrls : undefined,
      };

      console.log('[ServiceRequestWizard] Creating service request with payload:', payload);

      await createServiceRequestMutation.mutateAsync({
        url: '/service-requests',
        method: 'post',
        data: payload,
      });

      console.log('[ServiceRequestWizard] Service request created successfully');

      toast.success('Service request submitted successfully!');
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all() });

      if (onSuccess) {
        onSuccess();
      }
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('[ServiceRequestWizard] Error creating service request:', {
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
  const isLoading = createServiceRequestMutation.isPending || isSubmitting;

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
            Submit Service Request
          </Typography>
          <IconButton
            onClick={handleCancel}
            disabled={isLoading || isUploadingImages}
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

        {createServiceRequestMutation.isError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {getErrorMessage(createServiceRequestMutation.error)}
          </Alert>
        )}

        {/* Step 0: Property & Unit */}
        {activeStep === 0 && (
          <Stack spacing={3}>
            <FormControl fullWidth error={!!errors.propertyId} required>
              <InputLabel>Property</InputLabel>
              <Select
                value={formState.propertyId}
                label="Property"
                onChange={handleChange('propertyId')}
                disabled={loadingProperties || isLoading}
              >
                {properties.map((property) => (
                  <MenuItem key={property.id} value={property.id}>
                    {property.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.propertyId && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {errors.propertyId}
                </Typography>
              )}
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Unit</InputLabel>
              <Select
                value={formState.unitId}
                label="Unit"
                onChange={handleChange('unitId')}
                displayEmpty
                renderValue={(value) => {
                  if (!value) return 'Property-wide';
                  const selected = units.find((u) => u.id === value);
                  return selected ? `Unit ${selected.unitNumber}` : 'Property-wide';
                }}
                disabled={!formState.propertyId || isLoading}
              >
                {units.length === 0 ? (
                  <MenuItem value="">Property-wide (no units)</MenuItem>
                ) : (
                  <>
                    <MenuItem value="">Property-wide</MenuItem>
                    {units.map((unit) => (
                      <MenuItem key={unit.id} value={unit.id}>
                        Unit {unit.unitNumber}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Select>
              {formState.propertyId && units.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                  This property has no units - request will be property-wide
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
              </Paper>
            )}
          </Stack>
        )}

        {/* Step 1: Request Details */}
        {activeStep === 1 && (
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Title"
              value={formState.title}
              onChange={handleChange('title')}
              error={!!errors.title}
              helperText={errors.title || 'e.g., Leaking Faucet in Kitchen'}
              disabled={isLoading}
              required
              placeholder="e.g., Leaking Faucet in Kitchen"
            />

            <TextField
              fullWidth
              label="Description"
              value={formState.description}
              onChange={handleChange('description')}
              error={!!errors.description}
              helperText={errors.description || 'Please describe the issue in detail. Include when it started, how often it occurs, and any other relevant information...'}
              disabled={isLoading}
              required
              multiline
              rows={4}
              placeholder="Please describe the issue in detail. Include when it started, how often it occurs, and any other relevant information..."
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth error={!!errors.category} required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formState.category}
                  label="Category"
                  onChange={handleChange('category')}
                  disabled={isLoading}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.category && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {errors.category}
                  </Typography>
                )}
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formState.priority}
                  label="Priority"
                  onChange={handleChange('priority')}
                  disabled={isLoading}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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

        {/* Step 2: Photos */}
        {activeStep === 2 && (
          <ServiceRequestImageManager
            images={uploadedImages}
            onChange={(nextImages) => setUploadedImages(nextImages)}
            onUploadingChange={setIsUploadingImages}
            requestKey={formState.propertyId || 'new'}
            disabled={isLoading}
          />
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
          disabled={isLoading || isUploadingImages}
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
              disabled={isLoading || isUploadingImages}
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
              disabled={isLoading || isUploadingImages}
              fullWidth={isMobile}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleFinish}
              disabled={isLoading || isUploadingImages}
              fullWidth={isMobile}
              startIcon={
                isLoading || isUploadingImages ? (
                  <CircularProgress size={16} />
                ) : (
                  <CheckCircleIcon />
                )
              }
            >
              {isUploadingImages ? 'Uploading Photos...' : isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
