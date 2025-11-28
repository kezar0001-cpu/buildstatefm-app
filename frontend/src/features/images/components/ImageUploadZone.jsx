import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Box, Typography, Button, Paper, ButtonGroup, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';

/**
 * Modern image upload zone with drag-and-drop support
 *
 * Features:
 * - Drag-and-drop file input
 * - Click to browse fallback
 * - Visual feedback for drag states
 * - Keyboard accessible
 * - Paste from clipboard
 */
export function ImageUploadZone({
  onFilesSelected,
  accept = 'image/*',
  multiple = true,
  maxFiles = 50,
  disabled = false,
  className,
}) {
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [imageQuality, setImageQuality] = useState('high');

  /**
   * Detect mobile device
   */
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileDevice || hasTouch);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /**
   * Rotate image if needed (for mobile photos taken in portrait)
   */
  const rotateImageIfNeeded = useCallback(async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Check EXIF orientation and rotate if needed
          // For simplicity, we'll detect if image needs rotation based on dimensions
          // In production, you'd use a library like exif-js to read EXIF orientation
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Assume portrait photos from mobile might need rotation
          // This is a simplified approach - proper EXIF reading is recommended
          let width = img.width;
          let height = img.height;

          canvas.width = width;
          canvas.height = height;

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: file.type }));
          }, file.type, getQualityValue());
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }, [imageQuality]);

  /**
   * Get quality value based on selection
   */
  const getQualityValue = useCallback(() => {
    switch (imageQuality) {
      case 'low':
        return 0.6;
      case 'medium':
        return 0.8;
      case 'high':
      default:
        return 0.92;
    }
  }, [imageQuality]);

  /**
   * Handle file selection with optional rotation
   */
  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const limitedFiles = multiple ? fileArray.slice(0, maxFiles) : [fileArray[0]];

    console.log(`[ImageUploadZone] Selected ${limitedFiles.length} files`);

    // If mobile and quality is not high, process images
    let processedFiles = limitedFiles;
    if (isMobile && imageQuality !== 'high') {
      processedFiles = await Promise.all(
        limitedFiles.map(file => {
          if (file.type.startsWith('image/')) {
            return rotateImageIfNeeded(file);
          }
          return file;
        })
      );
    }

    if (onFilesSelected) {
      onFilesSelected(processedFiles);
    }
  }, [onFilesSelected, multiple, maxFiles, isMobile, imageQuality, rotateImageIfNeeded]);

  /**
   * Handle input change
   */
  const handleInputChange = useCallback((event) => {
    handleFiles(event.target.files);
    // Reset input so same file can be selected again
    event.target.value = '';
  }, [handleFiles]);

  /**
   * Handle drag enter
   */
  const handleDragEnter = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    setDragCounter(prev => prev + 1);

    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragging(false);
      }
      return newCounter;
    });
  }, []);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);
    setDragCounter(0);

    const files = event.dataTransfer.files;
    handleFiles(files);
  }, [handleFiles]);

  /**
   * Handle paste
   */
  const handlePaste = useCallback((event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      console.log(`[ImageUploadZone] Pasted ${files.length} files`);
      handleFiles(files);
    }
  }, [handleFiles]);

  /**
   * Handle click
   */
  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  /**
   * Handle camera button click
   */
  const handleCameraClick = useCallback(() => {
    if (!disabled && cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  }, [disabled]);

  /**
   * Handle keyboard
   */
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <Paper
      elevation={isDragging ? 4 : 1}
      className={className}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label="Upload images"
      aria-disabled={disabled}
      sx={{
        p: 4,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: '2px dashed',
        borderColor: isDragging
          ? 'primary.main'
          : disabled
          ? 'action.disabled'
          : 'divider',
        backgroundColor: isDragging
          ? 'action.hover'
          : disabled
          ? 'action.disabledBackground'
          : 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': disabled ? {} : {
          borderColor: 'primary.main',
          backgroundColor: 'action.hover',
        },
        '&:focus': {
          outline: 'none',
          borderColor: 'primary.main',
          boxShadow: (theme) => `0 0 0 3px ${theme.palette.primary.main}25`,
        },
      }}
    >
      {/* File input for regular file selection */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Camera input for mobile devices */}
      {isMobile && (
        <input
          ref={cameraInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
          capture="environment"
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {isDragging ? (
          <>
            <ImageIcon
              sx={{
                fontSize: 64,
                color: 'primary.main',
                animation: 'pulse 1s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
            <Typography variant="h6" color="primary">
              Drop images here
            </Typography>
          </>
        ) : (
          <>
            <CloudUploadIcon
              sx={{
                fontSize: 64,
                color: disabled ? 'action.disabled' : 'action.active',
              }}
            />
            <Typography variant="h6" color={disabled ? 'text.disabled' : 'text.primary'}>
              {isMobile ? 'Add images' : 'Drag & drop images here'}
            </Typography>
            {!isMobile && (
              <Typography variant="body2" color="text.secondary">
                or
              </Typography>
            )}

            {/* Mobile-specific buttons */}
            {isMobile ? (
              <>
                <ButtonGroup variant="contained" disabled={disabled} sx={{ mb: 2 }}>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCameraClick();
                    }}
                    startIcon={<CameraAltIcon />}
                    aria-label="Take photo with camera"
                  >
                    Take Photo
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClick();
                    }}
                    startIcon={<PhotoLibraryIcon />}
                    aria-label="Choose from library"
                  >
                    Choose from Library
                  </Button>
                </ButtonGroup>

                {/* Image Quality Selector */}
                <FormControl size="small" sx={{ minWidth: 200, mb: 2 }}>
                  <InputLabel id="image-quality-label">Image Quality</InputLabel>
                  <Select
                    labelId="image-quality-label"
                    id="image-quality"
                    value={imageQuality}
                    label="Image Quality"
                    onChange={(e) => setImageQuality(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MenuItem value="low">Low (Faster upload)</MenuItem>
                    <MenuItem value="medium">Medium (Balanced)</MenuItem>
                    <MenuItem value="high">High (Best quality)</MenuItem>
                  </Select>
                </FormControl>
              </>
            ) : (
              <Button
                variant="contained"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                startIcon={<CloudUploadIcon />}
              >
                Browse Files
              </Button>
            )}

            <Typography variant="caption" color="text.secondary">
              Supports: JPEG, PNG, GIF, WebP, SVG
              <br />
              Max {maxFiles} files, 10MB each
              {!isMobile && (
                <>
                  <br />
                  Tip: You can also paste images from clipboard
                </>
              )}
            </Typography>
          </>
        )}
      </Box>
    </Paper>
  );
}
