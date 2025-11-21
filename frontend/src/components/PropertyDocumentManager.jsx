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
import { useNotification } from '../hooks/useNotification.js';
import { DOCUMENT_CATEGORIES, DOCUMENT_ACCESS_LEVELS } from '../schemas/propertySchema.js';
import { downloadFile, buildDocumentDownloadUrl } from '../utils/fileUtils.js';

// ===== FIXED: Token retrieval (works with Zustand OR localStorage) =====
const useAuthToken = () => {
  try {
    const store = require('@/stores/authStore');
    return store.useAuthStore.getState().token || localStorage.getItem('token') || '';
  } catch {
    return localStorage.getItem('token') || '';
  }
};

// ===== Helpers (these were missing in my last version) =====
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

  const token = useAuthToken();

  // Build preview URL with token for new tabs
  const buildPreviewUrlWithToken = (docId) => {
    const base = `/api/documents/${docId}/preview`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  };

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

  // ... all your existing handlers (upload, delete, etc.) remain unchanged ...
  // I'm keeping them short here for brevity – they are exactly as you had them

  const handlePreview = (document) => {
    const previewUrl = buildPreviewUrlWithToken(document.id);

    setPreviewError('');
    setPreviewDocument({ ...document, resolvedPreviewUrl: previewUrl });
    setPreviewDialogOpen(true);
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = (document) => {
    const url = buildDocumentDownloadUrl(document);
    if (url) downloadFile(url, document.fileName, { skipDownloadTransform: true });
    else showError('Download unavailable');
  };

  if (isError) return <Alert severity="error">Failed to load documents</Alert>;
  if (isLoading) return <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>;

  return (
    <Box>
      {/* Add Document button, list, dialogs – all exactly as you had */}
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
          {previewDocument && (
            <iframe
              src={buildPreviewUrlWithToken(previewDocument.id)}
              title={previewDocument.fileName}
              style={{ width: '100%', height: '80vh', border: 'none' }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => window.open(buildPreviewUrlWithToken(previewDocument?.id), '_blank')}>
            Open in New Tab
          </Button>
          <Button startIcon={<DownloadIcon />} onClick={() => handleDownload(previewDocument)}>
            Download
          </Button>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Your upload & delete dialogs stay exactly the same – omitted here for brevity */}
    </Box>
  );
};

export default PropertyDocumentManager;