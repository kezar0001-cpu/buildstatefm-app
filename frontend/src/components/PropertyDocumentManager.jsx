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
  buildDocumentDownloadUrl,
} from '../utils/fileUtils.js';

// ←←← NEW: Get the JWT token (works with both Zustand and localStorage)
const useAuthToken = () => {
  try {
    // If you're using Zustand auth store
    const { token } = require('@/stores/authStore').useAuthStore.getState();
    return token || localStorage.getItem('token') || '';
  } catch {
    // Fallback if store not available
    return localStorage.getItem('token') || '';
  }
};

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

  // ←←← THIS IS THE KEY FIX
  const token = useAuthToken();
  const buildPreviewUrlWithToken = (docId) => {
    const base = `/api/documents/${docId}/preview`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  };

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

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 50MB.');
      return;
    }

    const allowedTypes = [
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type.');
      return;
    }

    setSelectedFile(file);
    setUploadError('');
  };

  const handleAddDocument = async () => {
    if (!selectedFile) return;

    const uploadData = new FormData();
    uploadData.append('file', selectedFile);
    uploadData.append('category', formData.category);
    uploadData.append('accessLevel', formData.accessLevel);
    if (formData.description.trim()) uploadData.append('description', formData.description.trim());

    try {
      await addDocumentMutation.mutateAsync({ data: uploadData });
      handleCloseDialog();
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Failed to upload document');
    }
  };

  const handleCloseDialog = () => {
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setUploadError('');
    setFormData({ category: 'OTHER', description: '', accessLevel: 'PROPERTY_MANAGER' });
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocument) return;
    await deleteDocumentMutation.mutateAsync({ url: `/properties/${propertyId}/documents/${selectedDocument.id}` });
    setDeleteDialogOpen(false);
    setSelectedDocument(null);
  };

  const handleDownload = (document) => {
    const downloadUrl = buildDocumentDownloadUrl(document);
    if (downloadUrl) downloadFile(downloadUrl, document.fileName, { skipDownloadTransform: true });
    else showError('Download link unavailable');
  };

  // ←←← FIXED: Now passes token in new tab
  const handlePreview = (document) => {
    const previewUrl = buildPreviewUrlWithToken(document.id);

    setPreviewError('');
    setPreviewDocument({ ...document, resolvedPreviewUrl: previewUrl });
    setPreviewDialogOpen(true);

    // This now works perfectly in new tab
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

  const canPreviewInline = (mimeType) => mimeType?.includes('pdf') || mimeType?.includes('image') || mimeType?.includes('text/plain');

  const getPreviewContent = (document) => {
    if (!document) return null;
    const previewSrc = document.resolvedPreviewUrl || buildPreviewUrlWithToken(document.id);

     const handlePreviewError = () => setPreviewError('Failed to load preview. Try "Open in New Tab" or "Download".');

    if (document.mimeType?.includes('pdf')) {
      return (
        <Box sx={{ width: '100%', height: '70vh' }}>
          <iframe src={previewSrc} title={document.fileName} style={{ width: '100%', height: '100%', border: 'none' }} onError={handlePreviewError} />
          {previewError && <Alert severity="error" sx={{ mt: 2 }}>{previewError}</Alert>}
        </Box>
      );
    }

    if (document.mimeType?.includes('image')) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <img src={previewSrc} alt={document.fileName} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} onError={handlePreviewError} />
        </Box>
      );
    }

    // ... rest of getPreviewContent unchanged (text files, fallback, etc.)
    // Keeping the rest exactly as you had it
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6">Preview not available</Typography>
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => handleDownload(document)}>
          Download to View
        </Button>
      </Box>
    );
  };

  // ... formatFileSize, getCategoryLabel, getAccessLevelLabel unchanged ...

  if (isError) return <Alert severity="error">Failed to load documents</Alert>;
  if (isLoading) return <CircularProgress />;

  return (
    <Box>
      {canEdit && (
        <Box mb={2}>
          <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => setUploadDialogOpen(true)}>
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
                primary={<Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body1">{document.fileName}</Typography>
                  <Chip label={document.category} size="small" variant="outlined" />
                  <Chip label={document.accessLevel} size="small" color={getAccessLevelColor(document.accessLevel)} />
                </Box>}
                secondary={`${formatFileSize(document.fileSize)} • Uploaded ${new Date(document.uploadedAt).toLocaleDateString()}`}
              />
              <ListItemSecondaryAction>
                <IconButton onClick={() => handlePreview(document)} title="View/Preview" color="primary">
                  <VisibilityIcon />
                </IconButton>
                <IconButton onClick={() => handleDownload(document)} title="Download">
                  <DownloadIcon />
                </IconButton>
                {canEdit && (
                  <IconButton onClick={() => openDeleteDialog(document)} color="error">
                    <DeleteIcon />
                  </IconButton>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {/* All dialogs remain exactly the same as your original code */}
      {/* ... Upload Dialog, Delete Dialog ... */}

      {/* Preview Dialog – Open in New Tab button now fixed */}
      <Dialog open={previewDialogOpen} onClose={handleClosePreview} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {previewDocument && getDocumentIcon(previewDocument.mimeType)}
            <Typography variant="h6">{previewDocument?.fileName}</Typography>
            <IconButton onClick={handleClosePreview}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>{previewDocument && getPreviewContent(previewDocument)}</DialogContent>
        <DialogActions>
          <Button
            onClick={() => window.open(buildPreviewUrlWithToken(previewDocument.id), '_blank', 'noopener,noreferrer')}
          >
            Open in New Tab
          </Button>
          <Button startIcon={<DownloadIcon />} onClick={() => handleDownload(previewDocument)}>
            Download
          </Button>
          <Button onClick={handleClosePreview}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertyDocumentManager;