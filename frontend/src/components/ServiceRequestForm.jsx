import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Grid,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Typography,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  PhotoCamera as CameraIcon,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';

const ServiceRequestForm = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'MEDIUM',
    propertyId: '',
    unitId: '',
    photos: [],
  });

  const [errors, setErrors] = useState({});
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Fetch properties
  const { data: properties = [], isLoading: loadingProperties } = useQuery({
    queryKey: queryKeys.properties.selectOptions(),
    queryFn: async () => {
      const response = await apiClient.get('/properties');
      return ensureArray(response.data, ['items', 'data.items', 'properties']);
    },
  });

  // Fetch units for selected property
  const { data: units = [] } = useQuery({
    queryKey: queryKeys.properties.units(formData.propertyId),
    queryFn: async () => {
      if (!formData.propertyId) return [];
      const response = await apiClient.get(`/units?propertyId=${formData.propertyId}`);
      return ensureArray(response.data, ['items', 'data.items', 'units']);
    },
    enabled: !!formData.propertyId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/service-requests', data);
      return response.data;
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error) => {
      setErrors({ submit: error.response?.data?.error || 'Failed to submit service request' });
    },
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear unit if property changes
    if (field === 'propertyId') {
      setFormData((prev) => ({ ...prev, unitId: '' }));
    }
    
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.propertyId) {
      newErrors.propertyId = 'Property is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Create preview URLs
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setPhotoFiles(prev => [...prev, ...files]);
    setPhotoPreviewUrls(prev => [...prev, ...newPreviewUrls]);
  };

  const handleRemovePhoto = (index) => {
    // Revoke the preview URL to free memory
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async () => {
    if (photoFiles.length === 0) return [];

    setUploadingPhotos(true);
    try {
      const formData = new FormData();
      photoFiles.forEach(file => {
        formData.append('photos', file);
      });

      const response = await apiClient.post('/uploads/multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Response should contain array of uploaded file URLs
      return response.data.files?.map(f => f.url) || [];
    } catch (error) {
      console.error('Error uploading photos:', error);
      setErrors(prev => ({ ...prev, photos: 'Failed to upload photos' }));
      return [];
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Upload photos first if there are any
    let photoUrls = [];
    if (photoFiles.length > 0) {
      photoUrls = await uploadPhotos();
      if (photoUrls.length === 0 && photoFiles.length > 0) {
        // Upload failed
        return;
      }
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      priority: formData.priority,
      propertyId: formData.propertyId,
      unitId: formData.unitId || undefined,
      photos: photoUrls.length > 0 ? photoUrls : undefined,
    };

    createMutation.mutate(payload);
  };

  const isLoading = createMutation.isPending;

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <DialogTitle>
        Submit Service Request
      </DialogTitle>

      <DialogContent dividers>
        {errors.submit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.submit}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          Please provide detailed information about your maintenance request. A property manager will review it shortly.
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              id="service-request-form-title"
              name="title"
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              error={!!errors.title}
              helperText={errors.title}
              required
              placeholder="e.g., Leaking Faucet in Kitchen"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              id="service-request-form-description"
              name="description"
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              error={!!errors.description}
              helperText={errors.description}
              required
              multiline
              rows={4}
              placeholder="Please describe the issue in detail. Include when it started, how often it occurs, and any other relevant information..."
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              id="service-request-form-category"
              name="category"
              select
              fullWidth
              label="Category"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              error={!!errors.category}
              helperText={errors.category}
              required
            >
              <MenuItem value="PLUMBING">Plumbing</MenuItem>
              <MenuItem value="ELECTRICAL">Electrical</MenuItem>
              <MenuItem value="HVAC">HVAC (Heating/Cooling)</MenuItem>
              <MenuItem value="APPLIANCE">Appliance</MenuItem>
              <MenuItem value="STRUCTURAL">Structural</MenuItem>
              <MenuItem value="PEST_CONTROL">Pest Control</MenuItem>
              <MenuItem value="LANDSCAPING">Landscaping</MenuItem>
              <MenuItem value="GENERAL">General Maintenance</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              id="service-request-form-priority"
              name="priority"
              select
              fullWidth
              label="Priority"
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              required
            >
              <MenuItem value="LOW">Low - Can wait a few days</MenuItem>
              <MenuItem value="MEDIUM">Medium - Normal priority</MenuItem>
              <MenuItem value="HIGH">High - Needs attention soon</MenuItem>
              <MenuItem value="URGENT">Urgent - Immediate attention needed</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              id="service-request-form-property"
              name="propertyId"
              select
              fullWidth
              label="Property"
              value={formData.propertyId}
              onChange={(e) => handleChange('propertyId', e.target.value)}
              error={!!errors.propertyId}
              helperText={errors.propertyId}
              required
              disabled={loadingProperties}
            >
              {properties.map((property) => (
                <MenuItem key={property.id} value={property.id}>
                  {property.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              id="service-request-form-unit"
              name="unitId"
              select
              fullWidth
              label="Unit"
              value={formData.unitId}
              onChange={(e) => handleChange('unitId', e.target.value)}
              disabled={!formData.propertyId || !units.length}
              required={units.length > 0}
            >
              {units.length === 0 && (
                <MenuItem value="">No units available</MenuItem>
              )}
              {units.map((unit) => (
                <MenuItem key={unit.id} value={unit.id}>
                  Unit {unit.unitNumber}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.primary" gutterBottom>
              Photos (Optional)
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block" sx={{ mb: 1 }}>
              Add photos to help describe the issue. You can upload multiple images.
            </Typography>

            {errors.photos && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.photos}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                disabled={uploadingPhotos || isLoading}
              >
                Choose Photos
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                />
              </Button>

              {/* Mobile: Camera capture */}
              <Button
                variant="outlined"
                component="label"
                startIcon={<CameraIcon />}
                disabled={uploadingPhotos || isLoading}
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
              >
                Camera
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                />
              </Button>
            </Box>

            {photoPreviewUrls.length > 0 && (
              <ImageList sx={{ width: '100%', maxHeight: 300 }} cols={3} rowHeight={164}>
                {photoPreviewUrls.map((url, index) => (
                  <ImageListItem key={index}>
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      loading="lazy"
                      style={{ height: '164px', objectFit: 'cover' }}
                    />
                    <ImageListItemBar
                      actionIcon={
                        <IconButton
                          sx={{ color: 'rgba(255, 255, 255, 0.9)' }}
                          onClick={() => handleRemovePhoto(index)}
                          disabled={uploadingPhotos || isLoading}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            )}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={isLoading || uploadingPhotos}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isLoading || uploadingPhotos}
          startIcon={(isLoading || uploadingPhotos) && <CircularProgress size={16} />}
        >
          {uploadingPhotos ? 'Uploading Photos...' : isLoading ? 'Submitting...' : 'Submit Request'}
        </Button>
      </DialogActions>
    </Box>
  );
};

export default ServiceRequestForm;
