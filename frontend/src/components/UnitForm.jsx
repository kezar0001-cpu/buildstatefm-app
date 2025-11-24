import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Alert,
  Box,
} from '@mui/material';
import toast from 'react-hot-toast';
import useApiMutation from '../hooks/useApiMutation';
import { queryKeys } from '../utils/queryKeys.js';
import { unitSchema, unitDefaultValues } from '../schemas/unitSchema';
import { FormTextField, FormSelect, FormAreaField } from './form';
import { UnitImageManager } from '../features/images';

const UNIT_STATUSES = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'OCCUPIED', label: 'Occupied' },
  { value: 'MAINTENANCE', label: 'Under Maintenance' },
  { value: 'VACANT', label: 'Vacant' },
];

export default function UnitForm({ open, onClose, propertyId, unit, onSuccess }) {
  const isEdit = !!unit;
  const [uploadedImages, setUploadedImages] = useState([]);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(unitSchema),
    defaultValues: unitDefaultValues,
    mode: 'onBlur',
  });

  // Create/Update mutation
  const mutation = useApiMutation({
    url: isEdit ? `/units/${unit?.id}` : '/units',
    method: isEdit ? 'patch' : 'post',
    invalidateKeys: [queryKeys.properties.units(propertyId)],
  });

  // Initialize form with unit data if editing
  useEffect(() => {
    // Only reset when dialog opens (not on every render)
    if (!open) {
      return;
    }

    if (unit) {
      console.log('[UnitForm] Resetting form with unit data:', {
        id: unit.id,
        unitNumber: unit.unitNumber,
        floor: unit.floor,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        area: unit.area,
        rentAmount: unit.rentAmount,
        status: unit.status,
        images: unit.images,
      });

      const formValues = {
        unitNumber: unit.unitNumber || '',
        floor: unit.floor != null ? unit.floor.toString() : '',
        bedrooms: unit.bedrooms != null ? unit.bedrooms.toString() : '',
        bathrooms: unit.bathrooms != null ? unit.bathrooms.toString() : '',
        area: unit.area != null ? unit.area.toString() : '',
        rentAmount: unit.rentAmount != null ? unit.rentAmount.toString() : '',
        status: unit.status || 'AVAILABLE',
        description: unit.description || '',
        imageUrl: unit.imageUrl || '',
      };

      console.log('[UnitForm] Form values being set:', formValues);

      // Reset with keepDefaultValues: false to ensure values are properly set
      reset(formValues, {
        keepDefaultValues: false,
        keepErrors: false,
        keepDirty: false,
        keepIsSubmitted: false,
        keepTouched: false,
        keepIsValid: false,
        keepSubmitCount: false,
      });

      // Initialize images from unit data
      if (unit.images && Array.isArray(unit.images) && unit.images.length > 0) {
        // Format images to match what UnitImageManager/useImageUpload expects
        const formattedImages = unit.images.map((img, index) => ({
          id: img.id || `existing-${index}`,
          url: img.imageUrl || img.url,
          imageUrl: img.imageUrl || img.url,
          altText: img.caption || img.altText || '',
          caption: img.caption || img.altText || '',
          isPrimary: img.isPrimary || false,
          displayOrder: img.displayOrder ?? index,
        }));

        // Find the primary image's URL, or use the first image as fallback
        const primaryImage = formattedImages.find(img => img.isPrimary);
        const primaryImageUrl = primaryImage?.imageUrl || formattedImages[0]?.imageUrl || '';

        console.log('[UnitForm] Setting images:', {
          count: formattedImages.length,
          primaryImageUrl: primaryImageUrl ? primaryImageUrl.substring(0, 60) + '...' : 'none',
          images: formattedImages.map(img => ({
            id: img.id,
            isPrimary: img.isPrimary,
            url: img.imageUrl?.substring(0, 40) + '...'
          }))
        });

        setUploadedImages(formattedImages);
        setCoverImageUrl(primaryImageUrl);
      } else {
        setUploadedImages([]);
        setCoverImageUrl(unit.imageUrl || '');
      }
    } else {
      console.log('[UnitForm] Resetting form to default values (create mode)');
      reset(unitDefaultValues);
      setUploadedImages([]);
      setCoverImageUrl('');
    }
    // Note: reset function is stable and doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, open]);

  // Auto-focus on first error field
  useEffect(() => {
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      setFocus(firstErrorField);
    }
  }, [errors, setFocus]);

  // Handle image upload changes
  const handleUploadedImagesChange = (nextImages = [], nextCover = '') => {
    // Keep all properties from the image manager, ensuring consistent format
    const transformedImages = nextImages.map((img, index) => ({
      id: img.id || img.imageId || `img-${index}`,
      url: img.imageUrl || img.url || img.remoteUrl,
      imageUrl: img.imageUrl || img.url || img.remoteUrl,
      altText: img.caption || img.altText || '',
      caption: img.caption || img.altText || '',
      isPrimary: img.isPrimary || false,
      displayOrder: img.displayOrder ?? img.order ?? index,
    }));

    console.log('[UnitForm] handleUploadedImagesChange:', {
      imageCount: transformedImages.length,
      nextCover: nextCover ? nextCover.substring(0, 60) + '...' : 'none',
    });

    setUploadedImages(transformedImages);
    setCoverImageUrl(nextCover || transformedImages[0]?.imageUrl || '');
  };

  // Handle upload state changes
  const handleUploadingStateChange = (isUploading) => {
    setIsUploadingImages(isUploading);
  };

  const onSubmit = async (data) => {
    // Prevent submission if images are still uploading
    if (isUploadingImages) {
      toast.error('Please wait for images to finish uploading');
      return;
    }

    const payload = {
      unitNumber: data.unitNumber,
      floor: data.floor,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      area: data.area,
      rentAmount: data.rentAmount,
      status: data.status,
      description: data.description || null,
      imageUrl: coverImageUrl || null,
    };

    // Add images array if there are uploaded images
    if (uploadedImages.length > 0) {
      payload.images = uploadedImages.map((image, index) => ({
        imageUrl: image.url,
        caption: image.altText || null,
        isPrimary: coverImageUrl ? image.url === coverImageUrl : index === 0,
      }));
    }

    // Add propertyId only for creation
    if (!isEdit) {
      payload.propertyId = propertyId;
    }

    try {
      await mutation.mutateAsync({ data: payload });
      onSuccess();
    } catch (error) {
      // Error is shown via mutation.error
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEdit ? 'Edit Unit' : 'Add New Unit'}
      </DialogTitle>

      <DialogContent>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
          {mutation.isError && (
            <Alert severity="error" sx={{ mb: 3 }} role="alert">
              {mutation.error?.message || 'Failed to save unit'}
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

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting || mutation.isPending || isUploadingImages}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting || mutation.isPending || isUploadingImages}
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
