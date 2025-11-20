import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Description as DescriptionIcon,
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Article as ArticleIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  usePropertyDocuments,
  useAddPropertyDocument,
  useDeletePropertyDocument,
} from '../hooks/usePropertyDocuments.js';
import { useNotification } from '../hooks/useNotification.js';
import { DOCUMENT_CATEGORIES, DOCUMENT_ACCESS_LEVELS } from '../schemas/propertySchema.js';
import {
  downloadFile,
  buildDocumentPreviewUrl,
  buildDocumentDownloadUrl,
} from '../utils/fileUtils.js';

const getDocumentIcon = (mimeType) => {
  const type = mimeType || '';
  if (type.includes('pdf')) return <PdfIcon />;
  if (type.includes('image')) return <ImageIcon />;
  if (type.includes('text')) return <ArticleIcon />;
  return <FileIcon />;
};

const getAccessLevelColor = (level) => {
  switch (level) {
    case 'PUBLIC':
      return 'success';
    case 'TENANT':
      return 'info';
    case 'OWNER':
      return 'warning';
    case 'PROPERTY_MANAGER':
      return 'error';
    default:
      return 'default';
  }
};

const PropertyDocumentManager = ({ propertyId, canEdit = false }) => {
  const { showSuccess, showError } = useNotification();
  const { data: documentsData, isLoading, isError, error, refetch } = usePropertyDocuments(propertyId);

  // Add success callbacks that refetch the document list
  const addDocumentMutation = useAddPropertyDocument(propertyId, () => {
    showSuccess('Document added successfully');
    refetch(); // Manually refetch to update the list
  });
  const deleteDocumentMutation = useDeletePropertyDocument(propertyId, () => {
    showSuccess('Document deleted successfully');
    refetch(); // Manually refetch to update the list
  });

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    category: 'OTHER',
    description: '',
    accessLevel: 'PROPERTY_MANAGER',
  });
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const documents = documentsData?.documents || [];

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        setUploadError('File too large. Maximum size is 50MB.');
        return;
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];

      if (!allowedTypes.includes(file.type)) {
        setUploadError('Invalid file type. Allowed: PDF, Word, Excel, images, text files.');
        return;
      }

      setSelectedFile(file);
      setUploadError('');
    }
  };

  const handleAddDocument = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file to upload');
      return;
    }

    try {
      setUploadError('');
      setUploadProgress(0);

      // Create FormData for file upload
      const uploadData = new FormData();
      uploadData.append('file', selectedFile);
      uploadData.append('category', formData.category);
      uploadData.append('accessLevel', formData.accessLevel);
      if (formData.description.trim()) {
        uploadData.append('description', formData.description.trim());
      }

      await addDocumentMutation.mutateAsync({
        data: uploadData,
      });

      setUploadDialogOpen(false);
      setSelectedFile(null);
      setFormData({
        category: 'OTHER',
        description: '',
        accessLevel: 'PROPERTY_MANAGER',
      });
      setUploadProgress(0);
    } catch (error) {
      setUploadError(error.response?.data?.message || 'Failed to upload document');
      setUploadProgress(0);
    }
  };

  const handleCloseDialog = () => {
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setUploadError('');
    setUploadProgress(0);
    setFormData({
      category: 'OTHER',
      description: '',
      accessLevel: 'PROPERTY_MANAGER',
    });
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocument) return;

    try {
      await deleteDocumentMutation.mutateAsync({
        url: `/properties/${propertyId}/documents/${selectedDocument.id}`,
      });
      setDeleteDialogOpen(false);
      setSelectedDocument(null);
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to delete document');
    }
  };

  const handleDownload = (document) => {
    const downloadUrl = buildDocumentDownloadUrl(document);
    if (!downloadUrl) {
      showError('Download link is unavailable for this document');
      return;
    }

    // Use the dedicated download endpoint (or Cloudinary flag) without mutating the URL again
    downloadFile(downloadUrl, document.fileName, { skipDownloadTransform: true });
  };

  const handlePreview = (document) => {
    const previewUrl = buildDocumentPreviewUrl(document);

    if (!previewUrl) {
      showError('Preview is unavailable for this document');
      return;
    }

    setPreviewError('');
    setPreviewDocument({ ...document, resolvedPreviewUrl: previewUrl });
    setPreviewDialogOpen(true);

    // Always open in a new tab/window for consistent preview behaviour
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleClosePreview = () => {
    setPreviewDialogOpen(false);
    setPreviewDocument(null);
    setPreviewError('');
  };

  const openDeleteDialog = (document) => {
    setSelectedDocument(document);
    setDeleteDialogOpen(true);
  };

  const canPreviewInline = (mimeType) => {
    return (
      mimeType?.includes('pdf') ||
      mimeType?.includes('image') ||
      mimeType?.includes('text/plain')
    );
  };

  const getPreviewContent = (document) => {
    if (!document) return null;

    const { mimeType, fileName, resolvedPreviewUrl } = document;
    const resolvedUrl = resolvedPreviewUrl || buildDocumentPreviewUrl(document);
    const previewSrc = document.cloudinarySecureUrl || document.rawPreviewUrl || resolvedUrl;

    if (!previewSrc) {
      return (
        <Alert severity="warning">
          Preview is not available for this document type.
        </Alert>
      );
    }

    const handlePreviewError = () => {
      setPreviewError('Failed to load the Cloudinary preview. Try opening in a new tab or downloading the file.');
    };

    const renderPreviewError = previewError ? (
      <Alert severity="error" sx={{ mt: 2 }}>
        {previewError}
      </Alert>
    ) : null;

    // PDF preview
    if (mimeType?.includes('pdf')) {
      return (
        <Box sx={{ width: '100%', height: '70vh' }}>
          <iframe
            src={previewSrc}
            title={fileName}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            onLoad={() => setPreviewError('')}
            onError={handlePreviewError}
          />
          {renderPreviewError}
        </Box>
      );
    }

    // Image preview
    if (mimeType?.includes('image')) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
          <img
            src={previewSrc}
            alt={fileName}
            style={{
              maxWidth: '100%',
              maxHeight: '70vh',
              objectFit: 'contain',
            }}
            onLoad={() => setPreviewError('')}
            onError={handlePreviewError}
          />
          {renderPreviewError}
        </Box>
      );
    }

    // Text file preview
    if (mimeType?.includes('text/plain')) {
      return (
        <Box sx={{ p: 2, maxHeight: '70vh', overflow: 'auto' }}>
          <iframe
            src={previewSrc}
            title={fileName}
            style={{
              width: '100%',
              minHeight: '60vh',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
            onLoad={() => setPreviewError('')}
            onError={handlePreviewError}
          />
          {renderPreviewError}
        </Box>
      );
    }

    // For other file types, show download message
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Preview not available
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          This file type cannot be previewed in the browser.
        </Typography>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={() => handleDownload(document)}
        >
          Download to View
        </Button>
      </Box>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getCategoryLabel = (value) => {
    const category = DOCUMENT_CATEGORIES.find((cat) => cat.value === value);
    return category ? category.label : value;
  };

  const getAccessLevelLabel = (value) => {
    const level = DOCUMENT_ACCESS_LEVELS.find((lvl) => lvl.value === value);
    return level ? level.label : value;
  };

  if (isError) {
    return (
      <Box p={3}>
        <Alert
          severity="error"
          action={(
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          )}
        >
          {error?.response?.data?.message || 'Failed to load property documents'}
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {canEdit && (
        <Box mb={2}>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => setUploadDialogOpen(true)}
          >
            Add Document
          </Button>
        </Box>
      )}

      {documents.length === 0 ? (
        <Alert severity="info">No documents uploaded yet</Alert>
      ) : (
        <List>
          {documents.map((document) => (
            <ListItem
              key={document.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
              }}
            >
              <ListItemIcon>{getDocumentIcon(document.mimeType)}</ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body1">{document.fileName}</Typography>
                    <Chip
                      label={getCategoryLabel(document.category)}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={getAccessLevelLabel(document.accessLevel)}
                      size="small"
                      color={getAccessLevelColor(document.accessLevel)}
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    {document.description && (
                      <Typography variant="body2" color="text.secondary">
                        {document.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(document.fileSize)} • Uploaded by{' '}
                      {document.uploader?.firstName} {document.uploader?.lastName} •{' '}
                      {new Date(document.uploadedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => handlePreview(document)}
                  title="View/Preview"
                  color="primary"
                  disabled={!buildDocumentPreviewUrl(document)}
                >
                  <VisibilityIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => handleDownload(document)}
                  title="Download"
                  disabled={!buildDocumentDownloadUrl(document)}
                >
                  <DownloadIcon />
                </IconButton>
                {canEdit && (
                  <IconButton
                    edge="end"
                    onClick={() => openDeleteDialog(document)}
                    color="error"
                    title="Delete"
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add Property Document
          <IconButton
            onClick={handleCloseDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}

          {/* File Upload Section */}
          <Box sx={{ mt: 2, mb: 2 }}>
            <input
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
              style={{ display: 'none' }}
              id="document-file-upload"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="document-file-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                fullWidth
                sx={{ py: 2 }}
              >
                {selectedFile ? selectedFile.name : 'Choose File to Upload'}
              </Button>
            </label>
            {selectedFile && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  File: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </Typography>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Allowed: PDF, Word, Excel, images, text files (Max 50MB)
            </Typography>
          </Box>

          <FormControl fullWidth margin="dense">
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.category}
              onChange={(e) => handleFormChange('category', e.target.value)}
              label="Category"
            >
              {DOCUMENT_CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Access Level</InputLabel>
            <Select
              value={formData.accessLevel}
              onChange={(e) => handleFormChange('accessLevel', e.target.value)}
              label="Access Level"
            >
              {DOCUMENT_ACCESS_LEVELS.map((level) => (
                <MenuItem key={level.value} value={level.value}>
                  {level.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Description (Optional)"
            type="text"
            fullWidth
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) => handleFormChange('description', e.target.value)}
          />

          {/* Upload Progress */}
          {addDocumentMutation.isPending && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Uploading...
              </Typography>
              <CircularProgress size={20} sx={{ ml: 1 }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleAddDocument}
            variant="contained"
            disabled={addDocumentMutation.isPending || !selectedFile}
          >
            {addDocumentMutation.isPending ? 'Uploading...' : 'Upload Document'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Document</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedDocument?.fileName}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteDocument}
            color="error"
            variant="contained"
            disabled={deleteDocumentMutation.isPending}
          >
            {deleteDocumentMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            minHeight: '80vh',
          },
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {previewDocument && getDocumentIcon(previewDocument.mimeType)}
            <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
              {previewDocument?.fileName}
            </Typography>
            <IconButton onClick={handleClosePreview} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {previewDocument && (
            <Box>
              {/* Document metadata */}
              <Box sx={{ mb: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
                  <Chip
                    label={getCategoryLabel(previewDocument.category)}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={getAccessLevelLabel(previewDocument.accessLevel)}
                    size="small"
                    color={getAccessLevelColor(previewDocument.accessLevel)}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(previewDocument.fileSize)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Uploaded {new Date(previewDocument.uploadedAt).toLocaleDateString()}
                  </Typography>
                </Box>
                {previewDocument.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {previewDocument.description}
                  </Typography>
                )}
              </Box>

              {/* Preview content */}
              {getPreviewContent(previewDocument)}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              const newTabUrl = previewDocument ? buildDocumentPreviewUrl(previewDocument) : '';
              if (newTabUrl) {
                window.open(newTabUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            disabled={!previewDocument || !buildDocumentPreviewUrl(previewDocument)}
          >
            Open in New Tab
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => previewDocument && handleDownload(previewDocument)}
          >
            Download
          </Button>
          <Button onClick={handleClosePreview}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertyDocumentManager;
