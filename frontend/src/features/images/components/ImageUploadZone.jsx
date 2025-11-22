import React, { useRef, useState, useCallback } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';

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
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  /**
   * Handle file selection
   */
  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const limitedFiles = multiple ? fileArray.slice(0, maxFiles) : [fileArray[0]];

    console.log(`[ImageUploadZone] Selected ${limitedFiles.length} files`);

    if (onFilesSelected) {
      onFilesSelected(limitedFiles);
    }
  }, [onFilesSelected, multiple, maxFiles]);

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
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
        capture="environment"
        style={{ display: 'none' }}
        aria-hidden="true"
      />

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
              Drag & drop images here
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or
            </Typography>
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
            <Typography variant="caption" color="text.secondary">
              Supports: JPEG, PNG, GIF, WebP, SVG
              <br />
              Max {maxFiles} files, 10MB each
              <br />
              Tip: You can also paste images from clipboard
            </Typography>
          </>
        )}
      </Box>
    </Paper>
  );
}
