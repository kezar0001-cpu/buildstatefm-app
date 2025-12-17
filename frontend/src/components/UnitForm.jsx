import { useTheme, useMediaQuery } from '@mui/material';

// ... imports

export default function UnitForm({ open, onClose, propertyId, unit, onSuccess }) {
  const isEdit = !!unit;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [uploadedImages, setUploadedImages] = useState([]);

  // ... (rest of the component logic)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle>
        {isEdit ? 'Edit Unit' : 'Add New Unit'}
      </DialogTitle>

      <DialogContent>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
          {/* ... (existing content) ... */}
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
