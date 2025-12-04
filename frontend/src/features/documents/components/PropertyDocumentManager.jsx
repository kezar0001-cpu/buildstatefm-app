import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
  Alert,
} from '@mui/material';
import { DocumentUploadZone } from './DocumentUploadZone';
import { DocumentGallery } from './DocumentGallery';
import { useDocumentUpload } from '../hooks/useDocumentUpload';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_ACCESS_LEVELS,
} from '../../../schemas/propertySchema';

/**
 * Property Document Manager
 *
 * Features:
 * - Unit assignment (property or specific unit)
 * - Document category selection
 * - Access level selection
 * - Drag-and-drop upload
 * - Document gallery with status tracking
 * - Optimistic UI
 *
 * @param {Object} props
 * @param {string} props.propertyId - Property ID
 * @param {Array} props.units - Array of units for this property
 * @param {Function} props.onChange - Called when documents change
 * @param {Array} props.initialDocuments - Existing documents (for edit mode)
 * @param {boolean} props.disabled - Disable uploads
 */
export function PropertyDocumentManager({
  propertyId,
  units = [],
  onChange,
  initialDocuments = [],
  disabled = false,
}) {
  // Form state
  const [selectedUnitId, setSelectedUnitId] = useState(null); // null = property level
  const [category, setCategory] = useState('OTHER');
  const [accessLevel, setAccessLevel] = useState('PUBLIC');

  // Document upload hook
  const {
    documents,
    isUploading,
    error,
    uploadFiles,
    removeDocument,
    retryUpload,
    updateMetadata,
    clearAll,
    getCompletedDocuments,
    hasDocuments,
    completedCount,
  } = useDocumentUpload({
    endpoint: '/uploads/documents',
    initialDocuments,
    onSuccess: (completedDocs) => {
      console.log('[PropertyDocumentManager] All uploads complete:', completedDocs);
    },
    onError: (err) => {
      console.error('[PropertyDocumentManager] Upload error:', err);
    },
  });

  /**
   * Handle file selection
   */
  const handleFilesSelected = useCallback(
    (files) => {
      if (!files || files.length === 0) return;

      console.log(
        `[PropertyDocumentManager] Uploading ${files.length} files with metadata:`,
        {
          unitId: selectedUnitId,
          category,
          accessLevel,
        }
      );

      uploadFiles(files, {
        unitId: selectedUnitId,
        category,
        accessLevel,
      });
    },
    [uploadFiles, selectedUnitId, category, accessLevel]
  );

  /**
   * Notify parent of document changes
   */
  useEffect(() => {
    if (onChange) {
      const completedDocs = getCompletedDocuments();
      onChange(completedDocs);
    }
  }, [documents, onChange, getCompletedDocuments]);

  /**
   * Handle unit selection change
   */
  const handleUnitChange = (event) => {
    const value = event.target.value;
    setSelectedUnitId(value === 'property' ? null : value);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Typography variant="h6" gutterBottom>
        Property Documents
      </Typography>

      {/* Upload configuration */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Upload Configuration
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 2,
            mt: 2,
          }}
        >
          {/* Unit selection */}
          <FormControl fullWidth size="small">
            <InputLabel>Assign to</InputLabel>
            <Select
              value={selectedUnitId || 'property'}
              onChange={handleUnitChange}
              label="Assign to"
              disabled={disabled || isUploading}
            >
              <MenuItem value="property">
                <Box>
                  <Typography variant="body2" fontWeight="600">
                    Property Level
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Document applies to entire property
                  </Typography>
                </Box>
              </MenuItem>

              {units.length > 0 && <Divider />}

              {units.map((unit) => (
                <MenuItem key={unit.id} value={unit.id}>
                  <Box>
                    <Typography variant="body2" fontWeight="600">
                      Unit {unit.unitNumber}
                    </Typography>
                    {unit.description && (
                      <Typography variant="caption" color="text.secondary">
                        {unit.description}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Category selection */}
          <FormControl fullWidth size="small">
            <InputLabel>Category</InputLabel>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              label="Category"
              disabled={disabled || isUploading}
            >
              {DOCUMENT_CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Access level selection */}
          <FormControl fullWidth size="small">
            <InputLabel>Access Level</InputLabel>
            <Select
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value)}
              label="Access Level"
              disabled={disabled || isUploading}
            >
              {DOCUMENT_ACCESS_LEVELS.map((level) => (
                <MenuItem key={level.value} value={level.value}>
                  {level.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Info alert */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="caption">
            Select a unit to assign documents to specific units, or keep it at
            "Property Level" for documents that apply to the entire property.
            You can upload multiple documents at once - they will all use the
            same settings above.
          </Typography>
        </Alert>
      </Paper>

      {/* Upload zone */}
      <Box sx={{ mb: 3 }}>
        <DocumentUploadZone
          onFilesSelected={handleFilesSelected}
          disabled={disabled || isUploading}
          multiple={true}
          maxFiles={20}
        />
      </Box>

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Document gallery */}
      {hasDocuments && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Uploaded Documents ({completedCount} / {documents.length})
          </Typography>
          <DocumentGallery
            documents={documents}
            onDelete={removeDocument}
            onRetry={retryUpload}
            onUpdateMetadata={updateMetadata}
            onClearAll={clearAll}
            allowDescription={true}
          />
        </Box>
      )}

      {/* No documents message */}
      {!hasDocuments && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          No documents uploaded yet. Use the upload zone above to add documents.
        </Typography>
      )}
    </Box>
  );
}
