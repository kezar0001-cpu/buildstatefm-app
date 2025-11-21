import React from 'react';
import { Grid, Box, Typography, Button, Alert } from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { DocumentCard } from './DocumentCard';

/**
 * Document gallery with grid layout
 *
 * Features:
 * - Responsive grid layout (1-3 columns)
 * - Empty state
 * - Bulk actions
 * - Status summary
 */
export function DocumentGallery({
  documents = [],
  onDelete,
  onRetry,
  onUpdateMetadata,
  onClearAll,
  allowDescription = true,
}) {
  const hasDocuments = documents.length > 0;
  const hasErrors = documents.some((doc) => doc.status === 'error');
  const uploadingCount = documents.filter(
    (doc) => doc.status === 'uploading'
  ).length;
  const completedCount = documents.filter(
    (doc) => doc.status === 'complete'
  ).length;

  /**
   * Empty state
   */
  if (!hasDocuments) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: 'center',
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.default',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No documents uploaded yet
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Status summary */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {completedCount} of {documents.length} uploaded
          </Typography>
          {uploadingCount > 0 && (
            <Typography variant="body2" color="primary">
              {uploadingCount} uploading...
            </Typography>
          )}
        </Box>

        {/* Clear all button */}
        {onClearAll && hasDocuments && (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteSweepIcon />}
            onClick={onClearAll}
            disabled={uploadingCount > 0}
          >
            Clear All
          </Button>
        )}
      </Box>

      {/* Error alert */}
      {hasErrors && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Some documents failed to upload. You can retry them individually.
        </Alert>
      )}

      {/* Document grid */}
      <Grid container spacing={2}>
        {documents.map((document) => (
          <Grid item xs={12} sm={6} md={4} key={document.id}>
            <DocumentCard
              document={document}
              onDelete={onDelete}
              onRetry={onRetry}
              onUpdateMetadata={onUpdateMetadata}
              allowDescription={allowDescription}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
