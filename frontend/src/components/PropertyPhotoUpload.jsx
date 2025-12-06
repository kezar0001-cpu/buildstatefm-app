import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  Paper,
  IconButton,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material';
// Drag and drop will be implemented with native HTML5 drag and drop API

// Placeholder card component with gradient background
const PlaceholderCard = ({ gradient }) => (
  <Card
    sx={{
      width: '100%',
      aspectRatio: '1',
      borderRadius: 2,
      background: gradient,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    }}
  >
    <CardContent sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <HomeIcon sx={{ fontSize: 40, color: 'rgba(255, 255, 255, 0.9)' }} />
    </CardContent>
  </Card>
);

// Photo card component with drag support
const PhotoCard = ({ photo, index, onRemove, onDragStart, onDragOver, onDrop, disabled, isDragging }) => {
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);

  return (
    <Box
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', index);
        onDragStart(e, index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
        onDragOver(e, index);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        onDrop(e, index);
      }}
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        borderRadius: 2,
        overflow: 'hidden',
        border: '2px solid',
        borderColor: isDraggingOver ? 'error.main' : isDragging ? 'error.light' : 'divider',
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 4,
          left: 4,
          zIndex: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: 1,
          p: 0.5,
          cursor: disabled ? 'default' : 'grab',
          '&:active': {
            cursor: 'grabbing',
          },
        }}
      >
        <DragIndicatorIcon fontSize="small" color="action" />
      </Box>
      <Box
        component="img"
        src={photo.preview || photo.url}
        alt={`Photo ${index + 1}`}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
        }}
      />
      <IconButton
        size="small"
        onClick={() => onRemove(index)}
        disabled={disabled}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 1)',
          },
        }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

// Tip card component
const TipCard = ({ currentTip, totalTips, onPrevious, onNext }) => {
  const tips = [
    { title: 'Drag to Reorder', description: 'Click and drag images to rearrange their order' },
    { title: 'Multiple Uploads', description: 'You can upload up to 50 images at once' },
    { title: 'File Formats', description: 'Supports JPEG, PNG, GIF, and WebP formats' },
    { title: 'File Size', description: 'Each image can be up to 10MB in size' },
    { title: 'Best Practices', description: 'Use clear, well-lit photos for best results' },
  ];

  const tip = tips[currentTip] || tips[0];

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        maxWidth: 400,
        mx: 'auto',
      }}
    >
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        Tip {currentTip + 1}: {tip.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tip.description}
      </Typography>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={onPrevious}
          disabled={currentTip === 0}
          sx={{ color: 'error.main', minWidth: 'auto' }}
        >
          BACK
        </Button>
        <Stack direction="row" spacing={0.5}>
          {Array.from({ length: totalTips }).map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: i === currentTip ? 'error.main' : 'action.disabledBackground',
              }}
            />
          ))}
        </Stack>
        <Button
          size="small"
          endIcon={<ArrowForwardIcon />}
          onClick={onNext}
          disabled={currentTip === totalTips - 1}
          sx={{ color: 'error.main', minWidth: 'auto' }}
        >
          NEXT
        </Button>
      </Stack>
    </Paper>
  );
};

const PropertyPhotoUpload = ({
  photos = [],
  onPhotosChange,
  maxFiles = 50,
  maxSizeMB = 10,
  disabled = false,
  uploading = false,
}) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [currentTip, setCurrentTip] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const totalTips = 5;

  const handleFileSelect = useCallback(
    (files) => {
      const fileArray = Array.from(files);
      setError('');

      // Validate file count
      if (photos.length + fileArray.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed. You can add ${maxFiles - photos.length} more.`);
        return;
      }

      // Validate and process files
      const validFiles = [];
      const invalidFiles = [];

      fileArray.forEach((file) => {
        // Check file type
        if (!file.type.startsWith('image/')) {
          invalidFiles.push(`${file.name}: Not an image file`);
          return;
        }

        // Check file size
        if (file.size > maxSizeMB * 1024 * 1024) {
          invalidFiles.push(`${file.name}: File size exceeds ${maxSizeMB}MB`);
          return;
        }

        validFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          preview: URL.createObjectURL(file),
        });
      });

      if (invalidFiles.length > 0) {
        setError(`Some files were rejected:\n${invalidFiles.join('\n')}`);
      }

      if (validFiles.length > 0) {
        onPhotosChange([...photos, ...validFiles]);
      }
    },
    [photos, maxFiles, maxSizeMB, onPhotosChange]
  );

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
    // Reset input
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || uploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleRemovePhoto = (index) => {
    const photo = photos[index];
    if (photo.preview) {
      URL.revokeObjectURL(photo.preview);
    }
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  const handlePhotoDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePhotoDragOver = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePhotoDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newPhotos = [...photos];
    const [removed] = newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(dropIndex, 0, removed);
    onPhotosChange(newPhotos);
    setDraggedIndex(null);
  };

  const handleChooseFiles = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handlePreviousTip = () => {
    setCurrentTip((prev) => Math.max(0, prev - 1));
  };

  const handleNextTip = () => {
    setCurrentTip((prev) => Math.min(totalTips - 1, prev + 1));
  };

  const placeholderGradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  ];

  const showPlaceholders = photos.length === 0;
  const displayPhotos = photos.slice(0, 4);

  return (
    <Box>
      <Box
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          border: '2px dashed',
          borderColor: isDragging ? 'error.main' : 'error.light',
          borderRadius: 3,
          p: 3,
          bgcolor: isDragging ? 'action.hover' : 'background.default',
          transition: 'all 0.3s ease',
          position: 'relative',
        }}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {/* Placeholder cards or photo previews */}
        {showPlaceholders ? (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {placeholderGradients.map((gradient, index) => (
              <Grid item xs={6} sm={3} key={index}>
                <PlaceholderCard gradient={gradient} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              {displayPhotos.map((photo, index) => (
                <Grid item xs={6} sm={3} key={photo.id || index}>
                  <PhotoCard
                    photo={photo}
                    index={index}
                    onRemove={handleRemovePhoto}
                    onDragStart={handlePhotoDragStart}
                    onDragOver={handlePhotoDragOver}
                    onDrop={handlePhotoDrop}
                    disabled={disabled || uploading}
                    isDragging={draggedIndex === index}
                  />
                </Grid>
              ))}
            </Grid>
            {photos.length > 4 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                +{photos.length - 4} more photo{photos.length - 4 !== 1 ? 's' : ''}
              </Typography>
            )}
          </Box>
        )}

        {/* Heading and subtitle */}
        <Stack spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={600} color="text.primary">
            Add Your Property Photos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Showcase your property with stunning images
          </Typography>
        </Stack>

        {/* Choose Files Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={handleChooseFiles}
            disabled={disabled || uploading || photos.length >= maxFiles}
            sx={{
              bgcolor: 'error.main',
              background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)',
              color: 'white',
              px: 4,
              py: 1.5,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'uppercase',
              boxShadow: '0 4px 12px rgba(185, 28, 28, 0.3)',
              '&:hover': {
                bgcolor: 'error.dark',
                background: 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)',
                boxShadow: '0 6px 16px rgba(185, 28, 28, 0.4)',
              },
              '&:disabled': {
                bgcolor: 'action.disabledBackground',
                background: 'none',
              },
            }}
          >
            Choose Files
          </Button>
        </Box>

        {/* Drag and drop instruction */}
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
          or drag and drop your images anywhere in this area
        </Typography>

        {/* Tip Card */}
        <TipCard currentTip={currentTip} totalTips={totalTips} onPrevious={handlePreviousTip} onNext={handleNextTip} />

        {/* Supported files info */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
          Supports: JPEG, PNG, GIF, WebP • Max {maxFiles} files • {maxSizeMB}MB each
        </Typography>

        {/* Uploading indicator */}
        {uploading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Uploading photos...
            </Typography>
          </Box>
        )}

        {/* Error message */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
      </Box>
    </Box>
  );
};

export default PropertyPhotoUpload;

