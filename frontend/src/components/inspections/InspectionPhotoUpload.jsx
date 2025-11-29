import React, { useState, useEffect } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, Grid, Card, CardMedia,
  Collapse, LinearProgress, Alert
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../utils/queryKeys';

/**
 * Improved photo upload component for inspections
 * Features:
 * - Minimized by default, expands when adding photos
 * - Simplified UI without category filters
 * - Direct integration with inspection photo API
 * - Loads existing photos from the room
 */
export const InspectionPhotoUpload = ({ inspectionId, roomId, checklistItemId, onUploadComplete }) => {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  // Fetch room data to get photos
  const { data: roomsData } = useQuery({
    queryKey: queryKeys.inspections.rooms(inspectionId),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${inspectionId}/rooms`);
      return response.data;
    },
    enabled: !!inspectionId,
  });

  // Get photos for this specific room
  const currentRoom = roomsData?.rooms?.find(r => r.id === roomId);
  const photos = currentRoom?.photos || [];

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        // Step 1: Upload to storage
        const formData = new FormData();
        formData.append('photos', file);

        const uploadRes = await apiClient.post('/uploads/inspection-photos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            setUploadProgress(Math.round((e.loaded * 100) / e.total));
          },
        });

        if (!uploadRes.data.success || !uploadRes.data.urls?.length) {
          throw new Error('Failed to upload photo');
        }

        // Step 2: Link to inspection
        const linkRes = await apiClient.post(`/inspections/${inspectionId}/photos`, {
          roomId,
          issueId: checklistItemId,
          url: uploadRes.data.urls[0],
        });

        return linkRes.data.photo;
      } finally {
        setUploading(false);
      }
    },
    onSuccess: (photo) => {
      setUploadProgress(0);
      queryClient.invalidateQueries(queryKeys.inspections.rooms(inspectionId));
      if (onUploadComplete) {
        onUploadComplete(photo);
      }
    },
    onError: (err) => {
      console.error('Photo upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload photo. Please try again.');
      setUploadProgress(0);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId) => {
      await apiClient.delete(`/inspections/${inspectionId}/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(queryKeys.inspections.rooms(inspectionId));
    }
  });

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    // Validate file type and size
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError('Please select image files only');
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setExpanded(true);
      // Upload files sequentially
      validFiles.forEach(file => {
        uploadMutation.mutate(file);
      });
    }

    // Reset input
    event.target.value = '';
  };

  const handleDelete = (photoId) => {
    if (window.confirm('Are you sure you want to delete this photo?')) {
      deleteMutation.mutate(photoId);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">
          Inspection Photos
          <Typography variant="caption" display="block" color="text.secondary">
            Document the condition with photos
          </Typography>
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <input
            accept="image/*"
            style={{ display: 'none' }}
            id={`photo-upload-${roomId || 'general'}`}
            type="file"
            multiple
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <label htmlFor={`photo-upload-${roomId || 'general'}`}>
            <Button
              component="span"
              startIcon={<CloudUploadIcon />}
              size="small"
              variant="outlined"
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Add Photos'}
            </Button>
          </label>
          {photos.length > 0 && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s'
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          )}
        </Stack>
      </Stack>

      {uploading && (
        <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 1 }} />
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Collapse in={expanded || photos.length === 0}>
        {photos.length > 0 ? (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {photos.map((photo) => (
              <Grid item xs={6} sm={4} md={3} key={photo.id}>
                <Card sx={{ position: 'relative' }}>
                  <CardMedia
                    component="img"
                    height="120"
                    image={photo.url}
                    alt="Inspection photo"
                    sx={{ objectFit: 'cover' }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(photo.id)}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,1)',
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ mt: 1, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No photos added yet. Click "Add Photos" to document the inspection.
            </Typography>
          </Box>
        )}
      </Collapse>
    </Box>
  );
};
