import { useState } from 'react';
import {
  Box,
  Button,
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
import toast from 'react-hot-toast';
import LoadingButton from './LoadingButton';
import { useNotification } from '../hooks/useNotification.js';
import { DOCUMENT_CATEGORIES, DOCUMENT_ACCESS_LEVELS } from '../schemas/propertySchema.js';
import { downloadFile, buildDocumentDownloadUrl } from '../utils/fileUtils.js';
import { uploadPropertyDocument } from '../utils/uploadPropertyDocuments.js';

// ===== Helpers =====
const buildDirectPreviewUrl = (document) => {
  if (!document) return null;

  // Use fileUrl for S3-hosted files
  const url = document.fileUrl;
  if (!url) return null;

  return url;
};

// ===== Other Helpers =====
const getDocumentIcon = (mimeType) => {
  const type = mimeType || '';
  if (type.includes('pdf')) return <PdfIcon />;
  if (type.includes('image')) return <ImageIcon />;
  if (type.includes('text')) return <ArticleIcon />;
  return <FileIcon />;
};

const getAccessLevelColor = (level) => {
  switch (level) {
    case 'PUBLIC': return 'success';
    case 'TENANT': return 'info';
    case 'OWNER': return 'warning';
    case 'PROPERTY_MANAGER': return 'error';
    default: return 'default';
  }
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
};

const getCategoryLabel = (value) => {
  const cat = DOCUMENT_CATEGORIES.find(c => c.value === value);
  return cat ? cat.label : value;
};

const getAccessLevelLabel = (value) => {
  const lvl = DOCUMENT_ACCESS_LEVELS.find(l => l.value === value);
  return lvl ? lvl.label : value;
};

const PropertyDocumentManager = ({ propertyId, canEdit = false }) => {
  const { showSuccess, showError } = useNotification();
  const { data: documentsData, isLoading, isError, error, refetch } = usePropertyDocuments(propertyId);

  const addDocumentMutation = useAddPropertyDocument(propertyId, () => {
    showSuccess('Document added successfully');
    refetch();
  });
  const deleteDocumentMutation = useDeletePropertyDocument(propertyId, () => {
    showSuccess('Document deleted successfully');
    refetch();
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

  const documents = documentsData?.documents || [];

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Client-side validation before upload
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File too large. Maximum size is 50MB.');
      event.target.value = '';
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setUploadError('Invalid file type. Allowed: PDF, Word, Excel, CSV, TXT, images.');
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
    setUploadError('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file');
      return;
    }

    if (!formData.category) {
      setUploadError('Please select a category');
      return;
    }

    try {
      setUploadError('');

      const uploaded = await uploadPropertyDocument(selectedFile);
      if (!uploaded?.url) {
        throw new Error('Document upload failed. Please try again.');
      }

      await addDocumentMutation.mutateAsync({
        data: {
          fileName: uploaded.name || selectedFile.name,
          fileUrl: uploaded.url,
          fileSize: uploaded.size ?? selectedFile.size,
          mimeType: uploaded.mimeType || selectedFile.type || 'application/octet-stream',
          category: formData.category,
          description: formData.description?.trim() || null,
          accessLevel: formData.accessLevel,
        },
      });

      toast.success('Document uploaded successfully!');

      // Reset form and clear file input
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setFormData({
        category: 'OTHER',
        description: '',
        accessLevel: 'PROPERTY_MANAGER',
      });

      // Clear file input to allow re-uploading the same file
      const fileInput = document.querySelector('input[type="file"][accept*=".pdf"]');
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to upload document';
      setUploadError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocument) return;

    try {
      await deleteDocumentMutation.mutateAsync({
        url: `/properties/${propertyId}/documents/${selectedDocument.id}`,
      });
      toast.success('Document deleted successfully!');
      setDeleteDialogOpen(false);
      setSelectedDocument(null);
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to delete document';
      showError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handlePreview = (document) => {
    const previewUrl = buildDirectPreviewUrl(document);

    if (!previewUrl) {
      showError('Preview URL not available for this document');
      return;
    }

    setPreviewError('');
    setPreviewDocument({ ...document, resolvedPreviewUrl: previewUrl });
    setPreviewDialogOpen(true);
  };

  const handleDownload = async (document) => {
    const url = buildDocumentDownloadUrl(document);
    if (!url) {
      showError('Download unavailable');
      return;
    }

    try {
      await downloadFile(url, document.fileName);
    } catch (error) {
      console.error('Download failed:', error);
      showError(error.response?.data?.message || 'Failed to download document');
    }
  };

  if (isError) return <Alert severity="error">Failed to load documents</Alert>;
  if (isLoading) return <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>;

  return (
    <Box>
      {/* Add Document button, list, dialogs – all exactly as you had */}
      {canEdit && (
        <Box mb={2}>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={(event) => {
              event?.currentTarget?.blur?.();
              setUploadDialogOpen(true);
            }}
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
            <ListItem key={document.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}>
              <ListItemIcon>{getDocumentIcon(document.mimeType)}</ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body1">{document.fileName}</Typography>
                    <Chip label={getCategoryLabel(document.category)} size="small" variant="outlined" />
                    <Chip label={getAccessLevelLabel(document.accessLevel)} size="small" color={getAccessLevelColor(document.accessLevel)} />
                  </Box>
                }
                secondary={
                  <>
                    {document.description && <Typography variant="body2" color="text.secondary">{document.description}</Typography>}
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(document.fileSize)} • Uploaded by {document.uploader?.firstName || 'Unknown'} • {new Date(document.uploadedAt).toLocaleDateString()}
                    </Typography>
                  </>
                }
              />
              <ListItemSecondaryAction>
                <IconButton onClick={() => handlePreview(document)} color="primary">
                  <VisibilityIcon />
                </IconButton>
                <IconButton onClick={() => handleDownload(document)}>
                  <DownloadIcon />
                </IconButton>
                {canEdit && (
                  <IconButton onClick={() => { setSelectedDocument(document); setDeleteDialogOpen(true); }} color="error">
                    <DeleteIcon />
                  </IconButton>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {/* Preview Dialog – now uses tokenised URL */}
      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {previewDocument && getDocumentIcon(previewDocument.mimeType)}
            <Typography variant="h6">{previewDocument?.fileName}</Typography>
            <IconButton onClick={() => setPreviewDialogOpen(false)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {previewError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {previewError}
            </Alert>
          )}
          {previewDocument && (
            <iframe
              src={previewDocument.resolvedPreviewUrl || previewDocument.fileUrl}
              title={previewDocument.fileName}
              style={{ width: '100%', height: '80vh', border: 'none' }}
              onError={() => setPreviewError('Preview not available in modal. Opened in new tab instead.')}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            const url = buildDirectPreviewUrl(previewDocument);
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
          }}>
            Open in New Tab
          </Button>
          <Button startIcon={<DownloadIcon />} onClick={() => handleDownload(previewDocument)}>
            Download
          </Button>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Upload Document</Typography>
            <IconButton onClick={() => setUploadDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}

          <Box sx={{ mt: 2 }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{ mb: 2, py: 1.5 }}
            >
              {selectedFile ? selectedFile.name : 'Choose File'}
              <input
                type="file"
                hidden
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
                onChange={handleFileChange}
              />
            </Button>

            {selectedFile && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </Alert>
            )}

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Category *</InputLabel>
              <Select
                value={formData.category}
                label="Category *"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Access Level *</InputLabel>
              <Select
                value={formData.accessLevel}
                label="Access Level *"
                onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })}
              >
                {DOCUMENT_ACCESS_LEVELS.map((level) => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Description (optional)"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              helperText="Add a description to help identify this document"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <LoadingButton
            onClick={handleUpload}
            variant="contained"
            loading={addDocumentMutation.isPending}
            disabled={!selectedFile}
            startIcon={<CloudUploadIcon />}
          >
            Upload
          </LoadingButton>
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
          <LoadingButton
            onClick={handleDeleteDocument}
            color="error"
            variant="contained"
            loading={deleteDocumentMutation.isPending}
          >
            Delete
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertyDocumentManager;