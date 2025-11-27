
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Stack,
  Typography,
  IconButton,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';

const AttachmentUploader = ({ pendingFiles, onFileChange, onUpload, isUploading }) => {
  const [filePreviews, setFilePreviews] = useState([]);

  // Generate previews when pendingFiles changes
  useEffect(() => {
    if (!pendingFiles || pendingFiles.length === 0) {
      setFilePreviews([]);
      return;
    }

    const previews = [];
    const promises = [];

    pendingFiles.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        // Generate image preview using FileReader
        const promise = new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            previews[index] = {
              id: `${file.name}-${file.size}-${index}`,
              name: file.name,
              size: file.size,
              type: file.type,
              preview: reader.result,
              isImage: true,
            };
            resolve();
          };
          reader.readAsDataURL(file);
        });
        promises.push(promise);
      } else {
        // For non-image files, just store file info
        previews[index] = {
          id: `${file.name}-${file.size}-${index}`,
          name: file.name,
          size: file.size,
          type: file.type,
          preview: null,
          isImage: false,
        };
      }
    });

    Promise.all(promises).then(() => {
      setFilePreviews(previews.filter(Boolean));
    });
  }, [pendingFiles]);

  // Handle removing a file from the preview
  const handleRemoveFile = (index) => {
    // Create a new FileList without the removed file
    const dt = new DataTransfer();
    pendingFiles.forEach((file, i) => {
      if (i !== index) {
        dt.items.add(file);
      }
    });

    // Trigger the file change with the new FileList
    const event = {
      target: {
        files: dt.files,
      },
    };
    onFileChange(event);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button
            component="label"
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            disabled={isUploading}
          >
            Select Files
            <input
              type="file"
              hidden
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={onFileChange}
            />
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            Upload inspection photos, videos, or documents. Each file is limited to 10MB.
          </Typography>
          <Button
            variant="contained"
            onClick={onUpload}
            disabled={!pendingFiles.length || isUploading}
          >
            {isUploading ? 'Uploading…' : pendingFiles.length > 0 ? `Upload (${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''})` : 'Upload'}
          </Button>
        </Stack>

        {/* Preview Thumbnails */}
        {filePreviews.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Selected Files
            </Typography>
            <Grid container spacing={2}>
              {filePreviews.map((filePreview, index) => (
                <Grid item xs={6} sm={4} md={3} lg={2} key={filePreview.id}>
                  <Card
                    sx={{
                      position: 'relative',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Remove Button */}
                    <Tooltip title="Remove file">
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveFile(index)}
                        disabled={isUploading}
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          zIndex: 10,
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 1)',
                          },
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {/* Preview */}
                    <Box
                      sx={{
                        position: 'relative',
                        paddingTop: '75%', // 4:3 aspect ratio
                        overflow: 'hidden',
                        backgroundColor: 'grey.100',
                      }}
                    >
                      {filePreview.isImage ? (
                        <CardMedia
                          component="img"
                          image={filePreview.preview}
                          alt={filePreview.name}
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <FileIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                        </Box>
                      )}
                    </Box>

                    {/* File Info */}
                    <CardContent sx={{ p: 1, flexGrow: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={filePreview.name}
                      >
                        {filePreview.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(filePreview.size)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AttachmentUploader;
