import React, { useState, useEffect } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, Grid, Card, CardMedia,
  Collapse, LinearProgress, Alert, List, ListItem, ListItemText, ListItemAvatar,
  Avatar, Chip
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Compress as CompressIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../utils/queryKeys';
import { compressImage } from '../../features/images/utils/imageCompression';

/**
 * Enhanced photo upload component for inspections
 * Features:
 * - Minimized by default, expands when adding photos
 * - Image compression before upload using browser-image-compression
 * - Upload queue with progress tracking
 * - Immediate thumbnail preview using blob URLs
 * - Direct integration with inspection photo API
 * - Loads existing photos from the room
 */
export const InspectionPhotoUpload = ({ inspectionId, roomId, checklistItemId, onUploadComplete }) => {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);
  const [uploadQueue, setUploadQueue] = useState([]); // Track all uploads in queue
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
    mutationFn: async ({ file, queueId }) => {
      // Update queue status to compressing
      setUploadQueue(prev => prev.map(item =>
        item.id === queueId ? { ...item, status: 'compressing' } : item
      ));

      // Compress image before upload
      let fileToUpload = file;
      const originalSize = file.size / 1024 / 1024;

      if (originalSize > 0.5) { // Compress if larger than 500KB
        try {
          fileToUpload = await compressImage(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 2000,
            useWebWorker: true,
          });

          const compressedSize = fileToUpload.size / 1024 / 1024;
          const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(0);

          // Update queue with compression info
          setUploadQueue(prev => prev.map(item =>
            item.id === queueId ? {
              ...item,
              compressed: true,
              compressionRatio: `${reduction}%`,
              status: 'uploading'
            } : item
          ));
        } catch (compressionError) {
          console.warn('Compression failed, uploading original:', compressionError);
          setUploadQueue(prev => prev.map(item =>
            item.id === queueId ? { ...item, status: 'uploading' } : item
          ));
        }
      } else {
        setUploadQueue(prev => prev.map(item =>
          item.id === queueId ? { ...item, status: 'uploading' } : item
        ));
      }

      try {
        // Step 1: Upload to storage
        const formData = new FormData();
        formData.append('photos', fileToUpload);

        const uploadRes = await apiClient.post('/uploads/inspection-photos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            const progress = Math.round((e.loaded * 100) / e.total);
            setUploadQueue(prev => prev.map(item =>
              item.id === queueId ? { ...item, progress } : item
            ));
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

        return { photo: linkRes.data.photo, queueId, originalFile: file };
      } catch (err) {
        setUploadQueue(prev => prev.map(item =>
          item.id === queueId ? { ...item, status: 'error', error: err.message } : item
        ));
        throw err;
      }
    },
    onMutate: async ({ file, queueId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.inspections.rooms(inspectionId) });

      // Snapshot the previous value for rollback
      const previousRooms = queryClient.getQueryData(queryKeys.inspections.rooms(inspectionId));

      // Create optimistic photo with temporary ID and blob URL for immediate preview
      const optimisticPhoto = {
        id: `temp-${queueId}`,
        url: URL.createObjectURL(file),
        roomId,
        issueId: checklistItemId,
        caption: null,
        order: photos.length,
        uploadedAt: new Date().toISOString(),
        _isOptimistic: true,
        _queueId: queueId,
      };

      // Optimistically update the UI with thumbnail preview
      queryClient.setQueryData(queryKeys.inspections.rooms(inspectionId), (old) => {
        if (!old?.rooms) return old;
        return {
          ...old,
          rooms: old.rooms.map(room =>
            room.id === roomId
              ? { ...room, photos: [...(room.photos || []), optimisticPhoto] }
              : room
          ),
        };
      });

      return { previousRooms, optimisticPhoto };
    },
    onError: (err, { queueId }, context) => {
      // Rollback to previous state on error
      if (context?.previousRooms) {
        queryClient.setQueryData(queryKeys.inspections.rooms(inspectionId), context.previousRooms);
      }
      // Revoke the blob URL to prevent memory leaks
      if (context?.optimisticPhoto?._isOptimistic) {
        URL.revokeObjectURL(context.optimisticPhoto.url);
      }
      console.error('Photo upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload photo. Please try again.');
    },
    onSuccess: ({ photo, queueId, originalFile }, _, context) => {
      // Revoke the blob URL after successful upload
      if (context?.optimisticPhoto?._isOptimistic) {
        URL.revokeObjectURL(context.optimisticPhoto.url);
      }

      // Update queue status to completed
      setUploadQueue(prev => prev.map(item =>
        item.id === queueId ? { ...item, status: 'completed', progress: 100 } : item
      ));

      // Remove from queue after 2 seconds
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(item => item.id !== queueId));
      }, 2000);

      queryClient.invalidateQueries(queryKeys.inspections.rooms(inspectionId));
      if (onUploadComplete) {
        onUploadComplete(photo);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId) => {
      await apiClient.delete(`/inspections/${inspectionId}/photos/${photoId}`);
    },
    onMutate: async (photoId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inspections.rooms(inspectionId) });
      const previousRooms = queryClient.getQueryData(queryKeys.inspections.rooms(inspectionId));

      queryClient.setQueryData(queryKeys.inspections.rooms(inspectionId), (old) => {
        if (!old?.rooms) return old;
        return {
          ...old,
          rooms: old.rooms.map(room =>
            room.id === roomId
              ? { ...room, photos: room.photos.filter(p => p.id !== photoId) }
              : room
          ),
        };
      });

      return { previousRooms };
    },
    onError: (_err, _photoId, context) => {
      if (context?.previousRooms) {
        queryClient.setQueryData(queryKeys.inspections.rooms(inspectionId), context.previousRooms);
      }
      setError('Failed to delete photo. Please try again.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(queryKeys.inspections.rooms(inspectionId));
    },
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

      // Add files to upload queue
      const newQueueItems = validFiles.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2),
        preview: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
        compressed: false,
        compressionRatio: null,
      }));

      setUploadQueue(prev => [...prev, ...newQueueItems]);

      // Start uploading files
      validFiles.forEach((file, index) => {
        uploadMutation.mutate({
          file,
          queueId: newQueueItems[index].id
        });
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

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      uploadQueue.forEach(item => {
        if (item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [uploadQueue]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'error':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'compressing':
        return <CompressIcon color="primary" fontSize="small" />;
      default:
        return <ImageIcon color="action" fontSize="small" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'compressing':
        return 'Compressing...';
      case 'uploading':
        return 'Uploading...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Failed';
      default:
        return status;
    }
  };

  const hasActiveUploads = uploadQueue.some(item =>
    ['pending', 'compressing', 'uploading'].includes(item.status)
  );

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
            disabled={hasActiveUploads}
          />
          <label htmlFor={`photo-upload-${roomId || 'general'}`}>
            <Button
              component="span"
              startIcon={<CloudUploadIcon />}
              size="small"
              variant="outlined"
              disabled={hasActiveUploads}
            >
              {hasActiveUploads ? 'Uploading...' : 'Add Photos'}
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

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Upload Queue ({uploadQueue.length} {uploadQueue.length === 1 ? 'item' : 'items'})
          </Typography>
          <List dense sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            {uploadQueue.map((item) => (
              <ListItem key={item.id}>
                <ListItemAvatar>
                  <Avatar
                    src={item.preview}
                    variant="rounded"
                    sx={{ width: 48, height: 48 }}
                  >
                    <ImageIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                        {item.name}
                      </Typography>
                      {item.compressed && item.compressionRatio && (
                        <Chip
                          label={`-${item.compressionRatio}`}
                          size="small"
                          color="success"
                          variant="outlined"
                          icon={<CompressIcon />}
                        />
                      )}
                      <Chip
                        label={getStatusText(item.status)}
                        size="small"
                        color={item.status === 'completed' ? 'success' : item.status === 'error' ? 'error' : 'default'}
                        icon={getStatusIcon(item.status)}
                      />
                    </Stack>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {item.size} MB
                      </Typography>
                      {item.status === 'uploading' && (
                        <LinearProgress
                          variant="determinate"
                          value={item.progress}
                          sx={{ mt: 0.5 }}
                        />
                      )}
                      {item.status === 'error' && item.error && (
                        <Typography variant="caption" color="error">
                          {item.error}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
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
                    sx={{
                      objectFit: 'cover',
                      opacity: photo._isOptimistic ? 0.6 : 1,
                    }}
                  />
                  {!photo._isOptimistic && (
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
                  )}
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
