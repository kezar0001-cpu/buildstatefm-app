import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Grid,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FormTextField,
  FormSelect,
  FormAreaField,
} from './FormFields';
import UnitImageManager from './UnitImageManager';
import apiClient from '../api/client';

const unitSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  status: z.enum(['VACANT', 'OCCUPIED', 'MAINTENANCE']),
  floor: z.coerce.number().optional(),
  bedrooms: z.coerce.number().min(0, 'Bedrooms must be positive'),
  bathrooms: z.coerce.number().min(0, 'Bathrooms must be positive'),
  area: z.coerce.number().min(0, 'Area must be positive').optional(),
  areaUnit: z.enum(['SQ_FT', 'SQ_M']).default('SQ_FT'),
  rentAmount: z.coerce.number().min(0, 'Rent must be positive').optional(),
  description: z.string().optional(),
});

const UNIT_STATUSES = [
  { value: 'VACANT', label: 'Vacant' },
  { value: 'OCCUPIED', label: 'Occupied' },
  { value: 'MAINTENANCE', label: 'Under Maintenance' },
];

export default function UnitForm({ open, onClose, propertyId, unit, onSuccess }) {
  const isEdit = !!unit;
  const theme = useTheme();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [uploadedImages, setUploadedImages] = useState([]);
  const [coverImageUrl, setCoverImageUrl] = useState(unit?.imageUrl || null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      unitNumber: '',
      status: 'VACANT',
      floor: '',
      bedrooms: 0,
      bathrooms: 1,
      area: '',
      areaUnit: 'SQ_FT',
      rentAmount: '',
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (unit) {
        reset({
          unitNumber: unit.unitNumber,
          status: unit.status,
          floor: unit.floor,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          area: unit.area,
          areaUnit: unit.areaUnit || 'SQ_FT',
          rentAmount: unit.rentAmount,
          description: unit.description,
        });
        setUploadedImages(unit.images || []);
        setCoverImageUrl(unit.imageUrl);
      } else {
        reset({
          unitNumber: '',
          status: 'VACANT',
          floor: '',
          bedrooms: 0,
          bathrooms: 1,
          area: '',
          areaUnit: 'SQ_FT',
          rentAmount: '',
          description: '',
        });
        setUploadedImages([]);
        setCoverImageUrl(null);
      }
    }
  }, [open, unit, reset]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        propertyId: propertyId ? parseInt(propertyId) : undefined,
        images: uploadedImages,
        imageUrl: coverImageUrl,
      };

      if (isEdit) {
        return apiClient.patch(`/units/${unit.id}`, payload);
      } else {
        return apiClient.post('/units', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['units', propertyId]);
      queryClient.invalidateQueries(['properties', propertyId]);
      onSuccess?.();
      onClose();
    },
  });

  const onSubmit = (data) => {
    if (isUploadingImages) return;
    mutation.mutate(data);
  };

  const handleUploadedImagesChange = (newImages) => {
    setUploadedImages(newImages);
    // If we have images but no cover image, default to the first one
    if (newImages.length > 0 && !coverImageUrl) {
      const firstImg = newImages[0];
      setCoverImageUrl(firstImg.url || firstImg.imageUrl);
    }
  };

  const handleUploadingStateChange = (isUploading) => {
    setIsUploadingImages(isUploading);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile} aria-labelledby="unit-form-dialog">
      <DialogTitle id="unit-form-dialog">
        {isEdit ? 'Edit Unit' : 'Add New Unit'}
      </DialogTitle>

      <DialogContent>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
          {mutation.isError && (
            <Alert severity="error" sx={{ mb: 3 }} role="alert">
              {mutation.error?.response?.data?.message || mutation.error?.message || 'Failed to save unit'}
            </Alert>
          )}

          <Grid container spacing={2}>
            {/* Unit Number */}
            <Grid item xs={12} sm={6}>
              <FormTextField
                name="unitNumber"
                control={control}
                label="Unit Number"
                required
                helperText="e.g., 101, A1, Suite 205"
              />
            </Grid>

            {/* Status */}
            <Grid item xs={12} sm={6}>
              <FormSelect
                name="status"
                control={control}
                label="Status"
                options={UNIT_STATUSES}
              />
            </Grid>

            {/* Floor */}
            <Grid item xs={12} sm={4}>
              <FormTextField
                name="floor"
                control={control}
                label="Floor"
                type="number"
              />
            </Grid>

            {/* Bedrooms */}
            <Grid item xs={12} sm={4}>
              <FormTextField
                name="bedrooms"
                control={control}
                label="Bedrooms"
                type="number"
              />
            </Grid>

            {/* Bathrooms */}
            <Grid item xs={12} sm={4}>
              <FormTextField
                name="bathrooms"
                control={control}
                label="Bathrooms"
                type="number"
                inputProps={{ step: 0.5 }}
              />
            </Grid>

            {/* Area */}
            <Grid
              item
              xs={12}
              sm={6}
            >
              <FormAreaField
                name="area"
                unitName="areaUnit"
                control={control}
                label="Area"
              />
            </Grid>

            {/* Rent Amount */}
            <Grid
              item
              xs={12}
              sm={6}
            >
              <FormTextField
                name="rentAmount"
                control={control}
                label="Monthly Rent ($)"
                type="number"
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <FormTextField
                name="description"
                control={control}
                label="Description"
                multiline
                rows={3}
                helperText="Additional details about the unit"
              />
            </Grid>

            {/* Image Upload */}
            <Grid item xs={12}>
              <UnitImageManager
                images={uploadedImages}
                coverImageUrl={coverImageUrl}
                unitName={'Unit ' + (unit?.unitNumber || 'New')}
                onChange={handleUploadedImagesChange}
                onUploadingChange={handleUploadingStateChange}
                allowCaptions={true}
              />

              {isUploadingImages && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Images are uploading... Please wait before saving.
                </Alert>
              )}
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2,
          flexDirection: isMobile ? 'column-reverse' : 'row',
          gap: isMobile ? 1 : 0
        }}
      >
        <Button
          onClick={onClose}
          disabled={isSubmitting || mutation.isPending || isUploadingImages}
          fullWidth={isMobile}
          variant={isMobile ? 'outlined' : 'text'}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting || mutation.isPending || isUploadingImages}
          fullWidth={isMobile}
        >
          {mutation.isPending
            ? 'Saving...'
            : isUploadingImages
              ? 'Uploading images...'
              : isEdit
                ? 'Update Unit'
                : 'Create Unit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
