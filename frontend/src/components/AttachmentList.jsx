
import React from 'react';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  Grid,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import AttachmentPreview from './AttachmentPreview';
import { formatDateTime } from '../utils/date';
import { resolveFileUrl } from '../utils/fileUtils';

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return 'Unknown size';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const AttachmentList = ({ attachments, canEdit, annotationDrafts, onAnnotationChange, onAnnotationSave, onDelete, isUpdating, isDeleting }) => (
  <Stack spacing={3}>
    {attachments.images.length > 0 && (
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Photos
        </Typography>
        <Grid container spacing={2}>
          {attachments.images.map((attachment) => (
            <Grid item xs={12} sm={6} md={4} key={attachment.id}>
              <Card variant="outlined">
                <AttachmentPreview attachment={attachment} />
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    {attachment.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(attachment.size)} • Uploaded{' '}
                    {attachment.createdAt ? formatDateTime(attachment.createdAt) : 'recently'}
                  </Typography>
                  <TextField
                    label="Annotation"
                    size="small"
                    margin="dense"
                    value={annotationDrafts[attachment.id] ?? ''}
                    onChange={(event) => onAnnotationChange(attachment.id, event.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                    disabled={!canEdit}
                  />
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between' }}>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Preview">
                      <IconButton component="a" href={resolveFileUrl(attachment.url)} target="_blank" rel="noopener">
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    {canEdit && (
                      <Tooltip title="Save annotation">
                        <span>
                          <IconButton
                            onClick={() => onAnnotationSave(attachment.id)}
                            disabled={isUpdating}
                          >
                            <SaveIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </Stack>
                  {canEdit && (
                    <Tooltip title="Delete attachment">
                      <span>
                        <IconButton
                          color="error"
                          onClick={() => onDelete(attachment.id)}
                          disabled={isDeleting}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    )}
    {/* Similar structure for videos and documents */}
  </Stack>
);

export default AttachmentList;
