import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  IconButton,
  TextField,
  Chip,
  Box,
  CircularProgress,
  Tooltip,
  LinearProgress,
  Typography,
  alpha,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ArticleIcon from '@mui/icons-material/Article';
import TableChartIcon from '@mui/icons-material/TableChart';
import ImageIcon from '@mui/icons-material/Image';
import { formatFileSize } from '../utils/documentValidation';

/**
 * Get document icon based on MIME type
 */
const getDocumentIcon = (mimeType) => {
  if (!mimeType) return <DescriptionIcon sx={{ fontSize: 48 }} />;

  if (mimeType === 'application/pdf') {
    return <PictureAsPdfIcon sx={{ fontSize: 48, color: 'error.main' }} />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <ArticleIcon sx={{ fontSize: 48, color: 'info.main' }} />;
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType === 'text/csv') {
    return <TableChartIcon sx={{ fontSize: 48, color: 'success.main' }} />;
  }
  if (mimeType.startsWith('image/')) {
    return <ImageIcon sx={{ fontSize: 48, color: 'warning.main' }} />;
  }

  return <DescriptionIcon sx={{ fontSize: 48 }} />;
};

/**
 * Individual document card with actions and status
 *
 * Features:
 * - Document icon based on type
 * - Upload progress indicator
 * - Error state with retry
 * - Description editing
 * - Delete action
 */
export function DocumentCard({
  document,
  onDelete,
  onRetry,
  onUpdateMetadata,
  allowDescription = true,
}) {
  const [description, setDescription] = useState(document.description || '');
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);

  const {
    id,
    fileName,
    fileSize,
    mimeType,
    status,
    progress,
    error,
    category,
  } = document;

  const isUploading = status === 'uploading';
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const isPending = status === 'pending';

  /**
   * Handle description blur
   */
  const handleDescriptionBlur = () => {
    setIsDescriptionFocused(false);
    if (onUpdateMetadata && description !== document.description) {
      onUpdateMetadata(id, { description });
    }
  };

  /**
   * Handle description key press
   */
  const handleDescriptionKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  /**
   * Get status indicator
   */
  const renderStatusIndicator = () => {
    if (isUploading) {
      return (
        <Chip
          size="small"
          icon={<CircularProgress size={14} sx={{ color: 'white' }} />}
          label={`${progress}%`}
          color="primary"
          sx={{ position: 'absolute', top: 8, right: 8 }}
        />
      );
    }

    if (isComplete) {
      return (
        <Chip
          size="small"
          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
          label="Uploaded"
          color="success"
          sx={{ position: 'absolute', top: 8, right: 8 }}
        />
      );
    }

    if (isError) {
      return (
        <Chip
          size="small"
          icon={<ErrorOutlineIcon sx={{ fontSize: 14 }} />}
          label="Failed"
          color="error"
          sx={{ position: 'absolute', top: 8, right: 8 }}
        />
      );
    }

    if (isPending) {
      return (
        <Chip
          size="small"
          label="Pending"
          color="default"
          sx={{ position: 'absolute', top: 8, right: 8 }}
        />
      );
    }

    return null;
  };

  return (
    <Card
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: isUploading || isPending ? 0.7 : 1,
        transition: 'opacity 0.3s, box-shadow 0.3s',
        '&:hover': {
          boxShadow: 4,
        },
      }}
    >
      {/* Progress bar */}
      {isUploading && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
          }}
        />
      )}

      {/* Status indicator */}
      {renderStatusIndicator()}

      {/* Document icon */}
      <Box
        sx={{
          p: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
          minHeight: 120,
        }}
      >
        {getDocumentIcon(mimeType)}
      </Box>

      {/* Content */}
      <CardContent sx={{ flexGrow: 1, pt: 2 }}>
        {/* File name */}
        <Tooltip title={fileName} arrow>
          <Typography
            variant="subtitle2"
            noWrap
            sx={{
              fontWeight: 600,
              mb: 0.5,
            }}
          >
            {fileName}
          </Typography>
        </Tooltip>

        {/* File size and category */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Chip
            label={formatFileSize(fileSize)}
            size="small"
            variant="outlined"
          />
          <Chip label={category} size="small" color="primary" variant="outlined" />
        </Box>

        {/* Error message */}
        {isError && error && (
          <Typography
            variant="caption"
            color="error"
            sx={{
              display: 'block',
              mb: 1,
            }}
          >
            {error}
          </Typography>
        )}

        {/* Description field */}
        {allowDescription && (isComplete || isError) && (
          <TextField
            fullWidth
            size="small"
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            onFocus={() => setIsDescriptionFocused(true)}
            onKeyPress={handleDescriptionKeyPress}
            multiline
            maxRows={2}
            disabled={isUploading || isPending}
            sx={{ mt: 1 }}
          />
        )}
      </CardContent>

      {/* Actions */}
      <CardActions
        sx={{
          justifyContent: 'flex-end',
          p: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Retry button */}
        {isError && onRetry && (
          <Tooltip title="Retry upload" arrow>
            <IconButton
              size="small"
              color="primary"
              onClick={() => onRetry(id)}
              aria-label="retry upload"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Delete button */}
        {onDelete && (
          <Tooltip title="Delete" arrow>
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(id)}
              disabled={isUploading}
              aria-label="delete document"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
}
