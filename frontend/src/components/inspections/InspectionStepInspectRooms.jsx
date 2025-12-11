import React, { useState, useRef } from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Collapse,
  Alert,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Badge,
  Fab,
  Zoom,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AutoAwesome as AutoAwesomeIcon,
  CameraAlt as CameraIcon,
  Photo as PhotoIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Room as RoomIcon,
  ReportProblem as IssueIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../utils/queryKeys';
import { compressImage } from '../../features/images/utils/imageCompression';

const ROOM_TYPES = [
  { value: 'BEDROOM', label: 'Bedroom' },
  { value: 'BATHROOM', label: 'Bathroom' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'LIVING_ROOM', label: 'Living Room' },
  { value: 'DINING_ROOM', label: 'Dining Room' },
  { value: 'HALLWAY', label: 'Hallway' },
  { value: 'LAUNDRY_ROOM', label: 'Laundry Room' },
  { value: 'GARAGE', label: 'Garage' },
  { value: 'BASEMENT', label: 'Basement' },
  { value: 'ATTIC', label: 'Attic' },
  { value: 'BALCONY', label: 'Balcony' },
  { value: 'PATIO', label: 'Patio' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'OTHER', label: 'Other' },
];

const SEVERITY_CONFIG = {
  CRITICAL: { color: 'error', label: 'Critical' },
  HIGH: { color: 'error', label: 'High' },
  MEDIUM: { color: 'warning', label: 'Medium' },
  LOW: { color: 'info', label: 'Low' },
};

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

/**
 * Parse priority from the notes field which contains "Category: X, Priority: Y"
 */
function parsePriorityFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return 'MEDIUM';
  const match = notes.match(/Priority:\s*(LOW|MEDIUM|HIGH|CRITICAL|URGENT)/i);
  if (match) {
    const priority = match[1].toUpperCase();
    return priority === 'URGENT' ? 'CRITICAL' : priority;
  }
  return 'MEDIUM';
}

/**
 * Parse category from the notes field
 */
function parseCategoryFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const match = notes.match(/Category:\s*([A-Z_]+)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Get the effective priority/severity for an issue
 */
function getIssuePriority(issue) {
  // If severity is explicitly set, use it
  if (issue.severity && SEVERITY_CONFIG[issue.severity]) {
    return issue.severity;
  }
  // Otherwise parse from notes
  return parsePriorityFromNotes(issue.notes);
}

function IssuePhotoUpload({ inspectionId, roomId, checklistItemId, photos = [], onUploadComplete, isMobile }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploading(true);

    try {
      // Compress images
      const compressedFiles = await Promise.all(
        files.map(async (file) => {
          if (file.size > 500 * 1024) {
            try {
              return await compressImage(file, {
                maxSizeMB: 1,
                maxWidthOrHeight: 2000,
                useWebWorker: true,
              });
            } catch {
              return file;
            }
          }
          return file;
        })
      );

      // Upload to storage
      const formData = new FormData();
      compressedFiles.forEach((file) => {
        formData.append('photos', file);
      });

      const uploadRes = await apiClient.post('/uploads/inspection-photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      let uploadedUrls = [];
      if (uploadRes.data?.files?.length > 0) {
        uploadedUrls = uploadRes.data.files.map((f) => f.url);
      } else if (uploadRes.data?.urls?.length > 0) {
        uploadedUrls = uploadRes.data.urls;
      }

      if (!uploadRes.data.success || uploadedUrls.length === 0) {
        throw new Error('Failed to upload photos');
      }

      // Link photos to the room (checklist items don't have direct photo relations)
      // We store the checklistItemId in the caption for reference
      await Promise.all(
        uploadedUrls.map((url) =>
          apiClient.post(`/inspections/${inspectionId}/photos`, {
            roomId,
            url,
            caption: checklistItemId ? `Issue: ${checklistItemId}` : undefined,
          })
        )
      );

      toast.success(`${uploadedUrls.length} photo(s) added`);
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspectionId) });
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error(err.response?.data?.message || 'Failed to upload photos');
    } finally {
      setUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
        disabled={uploading}
      />
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {photos.map((photo, idx) => (
          <CardMedia
            key={photo.id || idx}
            component="img"
            image={photo.url || photo.imageUrl}
            alt={`Issue photo ${idx + 1}`}
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1,
              objectFit: 'cover',
              border: '2px solid',
              borderColor: 'divider',
            }}
          />
        ))}
        <IconButton
          size="small"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          sx={{
            width: 48,
            height: 48,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.lighter' },
          }}
        >
          {uploading ? <CircularProgress size={20} /> : <CameraIcon />}
        </IconButton>
      </Stack>
    </Box>
  );
}

function IssueCard({ issue, inspectionId, roomId, roomPhotos = [], onUpdate, onEdit, onDelete, isMobile }) {
  const [expanded, setExpanded] = useState(false);
  // Get priority from severity field or parse from notes
  const priority = getIssuePriority(issue);
  const priorityConfig = SEVERITY_CONFIG[priority] || SEVERITY_CONFIG.MEDIUM;
  const category = parseCategoryFromNotes(issue.notes);
  // Filter room photos that belong to this checklist item (stored in caption)
  const photos = roomPhotos.filter((p) => p.caption?.includes(issue.id)) || [];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: expanded ? 'action.hover' : 'background.paper',
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="flex-start"
        onClick={() => setExpanded(!expanded)}
        sx={{ cursor: 'pointer' }}
      >
        <Badge
          badgeContent={photos.length}
          color="primary"
          invisible={photos.length === 0}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: issue.status === 'FAILED' ? 'error.lighter' : issue.status === 'PASSED' ? 'success.lighter' : 'grey.100',
              color: issue.status === 'FAILED' ? 'error.main' : issue.status === 'PASSED' ? 'success.main' : 'grey.600',
            }}
          >
            <IssueIcon fontSize="small" />
          </Avatar>
        </Badge>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
              {issue.description || issue.title}
            </Typography>
            <Chip
              label={priorityConfig.label}
              size="small"
              color={priorityConfig.color}
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </Stack>
          {category && (
            <Typography variant="caption" color="text.secondary" noWrap>
              Category: {category}, Priority: {priority}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(issue);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(issue.id);
            }}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <CameraIcon color={photos.length > 0 ? 'primary' : 'action'} />}
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Attach photos to this issue:
          </Typography>
          <IssuePhotoUpload
            inspectionId={inspectionId}
            roomId={roomId}
            checklistItemId={issue.id}
            photos={photos}
            onUploadComplete={onUpdate}
            isMobile={isMobile}
          />
        </Box>
      </Collapse>
    </Paper>
  );
}

function RoomInspectionCard({ room, inspection, onUpdate, isMobile }) {
  const [expanded, setExpanded] = useState(true);
  const [description, setDescription] = useState(room.notes || '');
  const [generating, setGenerating] = useState(false);
  const [descriptionSaved, setDescriptionSaved] = useState(!!room.notes);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [issueForm, setIssueForm] = useState({ description: '', priority: 'MEDIUM', notes: '' });
  const queryClient = useQueryClient();

  const issues = room.checklistItems || room.InspectionChecklistItem || [];
  const photos = room.photos || room.InspectionPhoto || [];
  const totalPhotos = photos.length;

  const saveDescriptionMutation = useMutation({
    mutationFn: async (notes) => {
      await apiClient.patch(`/inspections/${inspection.id}/rooms/${room.id}`, { notes });
    },
    onSuccess: () => {
      setDescriptionSaved(true);
      toast.success('Description saved');
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
    },
    onError: () => {
      toast.error('Failed to save description');
    },
  });

  const generateIssuesMutation = useMutation({
    mutationFn: async () => {
      // First save the description if changed
      if (description !== room.notes) {
        await apiClient.patch(`/inspections/${inspection.id}/rooms/${room.id}`, { notes: description });
      }
      // Then generate issues
      const response = await apiClient.post(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist/generate`
      );
      return response.data;
    },
    onMutate: () => {
      setGenerating(true);
    },
    onSuccess: (data) => {
      setGenerating(false);
      setDescriptionSaved(true);
      toast.success(`Generated ${data.count || 0} issues`);
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      setGenerating(false);
      toast.error(error.response?.data?.message || 'Failed to generate issues');
    },
  });

  // Add issue mutation
  const addIssueMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Issue added');
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
      setIssueDialogOpen(false);
      setIssueForm({ description: '', priority: 'MEDIUM', notes: '' });
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add issue');
    },
  });

  // Update issue mutation
  const updateIssueMutation = useMutation({
    mutationFn: async ({ itemId, data }) => {
      const response = await apiClient.patch(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist/${itemId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Issue updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
      setIssueDialogOpen(false);
      setEditingIssue(null);
      setIssueForm({ description: '', priority: 'MEDIUM', notes: '' });
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update issue');
    },
  });

  // Delete issue mutation
  const deleteIssueMutation = useMutation({
    mutationFn: async (itemId) => {
      await apiClient.delete(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist/${itemId}`
      );
    },
    onSuccess: () => {
      toast.success('Issue deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete issue');
    },
  });

  const handleSaveDescription = () => {
    if (description.trim()) {
      saveDescriptionMutation.mutate(description);
    }
  };

  const handleGenerateIssues = () => {
    if (!description.trim()) {
      toast.error('Please enter a description of your findings first');
      return;
    }
    generateIssuesMutation.mutate();
  };

  const handleOpenAddIssue = () => {
    setEditingIssue(null);
    setIssueForm({ description: '', priority: 'MEDIUM', notes: '' });
    setIssueDialogOpen(true);
  };

  const handleOpenEditIssue = (issue) => {
    setEditingIssue(issue);
    const priority = getIssuePriority(issue);
    const category = parseCategoryFromNotes(issue.notes);
    setIssueForm({
      description: issue.description || '',
      priority: priority,
      category: category || '',
      notes: issue.notes || '',
    });
    setIssueDialogOpen(true);
  };

  const handleSaveIssue = () => {
    if (!issueForm.description.trim()) {
      toast.error('Please enter an issue description');
      return;
    }
    // Build the notes field with category and priority
    const category = issueForm.category || 'GENERAL';
    const notesWithMeta = `Category: ${category}, Priority: ${issueForm.priority}`;
    
    const dataToSave = {
      description: issueForm.description,
      notes: notesWithMeta,
      status: 'PENDING', // All issues are pending by default
    };
    
    if (editingIssue) {
      updateIssueMutation.mutate({ itemId: editingIssue.id, data: dataToSave });
    } else {
      addIssueMutation.mutate(dataToSave);
    }
  };

  const handleDeleteIssue = (itemId) => {
    if (window.confirm('Are you sure you want to delete this issue?')) {
      deleteIssueMutation.mutate(itemId);
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ p: isMobile ? 2 : 2.5 }}>
        {/* Room Header */}
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          onClick={() => setExpanded(!expanded)}
          sx={{ cursor: 'pointer', mb: expanded ? 2 : 0 }}
        >
          <Avatar sx={{ bgcolor: 'primary.lighter', color: 'primary.main' }}>
            <RoomIcon />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {room.name}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={ROOM_TYPES.find((rt) => rt.value === room.roomType)?.label || room.roomType}
                size="small"
                variant="outlined"
              />
              {issues.length > 0 && (
                <Chip
                  icon={<IssueIcon />}
                  label={`${issues.length} issue${issues.length !== 1 ? 's' : ''}`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
              {totalPhotos > 0 && (
                <Chip
                  icon={<PhotoIcon />}
                  label={totalPhotos}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>

        <Collapse in={expanded}>
          <Divider sx={{ mb: 2 }} />

          {/* Step 1: Description */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              1. Describe your findings
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Walk through the room and describe what you see. Be specific about any damage, wear, or issues.
            </Typography>
            <TextField
              multiline
              rows={isMobile ? 3 : 4}
              fullWidth
              placeholder="e.g., The walls have minor scuff marks near the door. The ceiling has a small water stain in the corner. The flooring shows normal wear. The window lock is loose and needs tightening..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDescriptionSaved(false);
              }}
              sx={{ mb: 1 }}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {description && !descriptionSaved && (
                <Button
                  size="small"
                  onClick={handleSaveDescription}
                  disabled={saveDescriptionMutation.isPending}
                >
                  Save Draft
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                onClick={handleGenerateIssues}
                disabled={generating || !description.trim()}
              >
                {generating ? 'Generating...' : 'Generate Issues List'}
              </Button>
            </Stack>
          </Box>

          {/* Step 2: Issues List */}
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">
                2. Review issues & attach photos
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleOpenAddIssue}
              >
                Add Issue
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
              {issues.length > 0
                ? 'Click on each issue to attach photos. Use edit/delete buttons to modify.'
                : 'Add issues manually or generate them from your description above.'}
            </Typography>
            {issues.length > 0 && (
              <Stack spacing={1}>
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    inspectionId={inspection.id}
                    roomId={room.id}
                    roomPhotos={photos}
                    onUpdate={onUpdate}
                    onEdit={handleOpenEditIssue}
                    onDelete={handleDeleteIssue}
                    isMobile={isMobile}
                  />
                ))}
              </Stack>
            )}
          </Box>

          {/* Completion indicator */}
          {issues.length > 0 && (
            <Alert
              severity={totalPhotos > 0 ? 'success' : 'info'}
              icon={totalPhotos > 0 ? <CheckCircleIcon /> : undefined}
              sx={{ mt: 2 }}
            >
              {totalPhotos > 0
                ? `Room complete: ${issues.length} issues documented with ${totalPhotos} photos`
                : 'Tip: Add photos to issues for better documentation'}
            </Alert>
          )}
        </Collapse>
      </CardContent>

      {/* Add/Edit Issue Dialog */}
      <Dialog
        open={issueDialogOpen}
        onClose={() => setIssueDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {editingIssue ? 'Edit Issue' : 'Add Issue'}
            </Typography>
            {isMobile && (
              <IconButton onClick={() => setIssueDialogOpen(false)}>
                <CloseIcon />
              </IconButton>
            )}
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Issue Description"
              value={issueForm.description}
              onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
              fullWidth
              required
              multiline
              rows={2}
              placeholder="Describe the issue found..."
            />
            <TextField
              select
              label="Priority"
              value={issueForm.priority}
              onChange={(e) => setIssueForm({ ...issueForm, priority: e.target.value })}
              fullWidth
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Category"
              value={issueForm.category || 'GENERAL'}
              onChange={(e) => setIssueForm({ ...issueForm, category: e.target.value })}
              fullWidth
            >
              <MenuItem value="GENERAL">General</MenuItem>
              <MenuItem value="SAFETY">Safety</MenuItem>
              <MenuItem value="STRUCTURAL">Structural</MenuItem>
              <MenuItem value="ELECTRICAL">Electrical</MenuItem>
              <MenuItem value="PLUMBING">Plumbing</MenuItem>
              <MenuItem value="COSMETIC">Cosmetic</MenuItem>
              <MenuItem value="INTERIOR_FINISH">Interior Finish</MenuItem>
              <MenuItem value="EXTERIOR">Exterior</MenuItem>
              <MenuItem value="APPLIANCE">Appliance</MenuItem>
              <MenuItem value="FINISH">Finish</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: isMobile ? 2 : undefined }}>
          {!isMobile && (
            <Button onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
          )}
          <Button
            onClick={handleSaveIssue}
            variant="contained"
            disabled={!issueForm.description.trim() || addIssueMutation.isPending || updateIssueMutation.isPending}
            fullWidth={isMobile}
            sx={{ minHeight: isMobile ? 44 : undefined }}
          >
            {addIssueMutation.isPending || updateIssueMutation.isPending
              ? 'Saving...'
              : editingIssue
              ? 'Update Issue'
              : 'Add Issue'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export const InspectionStepInspectRooms = ({ inspection, rooms, actions, lastSaved, isMobile = false }) => {
  const [addRoomDialogOpen, setAddRoomDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', roomType: '', notes: '' });

  const handleRoomTypeChange = (newType) => {
    const selectedRoom = ROOM_TYPES.find((rt) => rt.value === newType);
    setFormData((prev) => ({
      ...prev,
      roomType: newType,
      name: newType === 'OTHER' ? prev.name : selectedRoom?.label || '',
    }));
  };

  const handleAddRoom = () => {
    if (!formData.roomType) return;
    if (formData.roomType === 'OTHER' && !formData.name) return;

    const dataToSave = {
      ...formData,
      name: formData.name || ROOM_TYPES.find((rt) => rt.value === formData.roomType)?.label || 'Unnamed Room',
    };

    actions.addRoom(dataToSave);
    setAddRoomDialogOpen(false);
    setFormData({ name: '', roomType: '', notes: '' });
  };

  const formatLastSaved = (date) => {
    if (!date) return null;
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 10) return 'Saved just now';
    if (diffSec < 60) return `Saved ${diffSec}s ago`;
    if (diffMin < 60) return `Saved ${diffMin}m ago`;
    return `Saved at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const totalIssues = rooms.reduce((sum, r) => sum + (r.checklistItems?.length || 0), 0);
  const totalPhotos = rooms.reduce((sum, r) => {
    const roomPhotos = r.photos?.length || 0;
    const issuePhotos = (r.checklistItems || []).reduce((s, i) => s + (i.photos?.length || 0), 0);
    return sum + roomPhotos + issuePhotos;
  }, 0);

  return (
    <Box>
      {/* Header */}
      <Stack
        direction={isMobile ? 'column' : 'row'}
        justifyContent="space-between"
        alignItems={isMobile ? 'stretch' : 'center'}
        spacing={isMobile ? 2 : 0}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant={isMobile ? 'subtitle1' : 'h6'}>Inspect Rooms</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {rooms.length} room{rooms.length !== 1 ? 's' : ''} • {totalIssues} issue{totalIssues !== 1 ? 's' : ''} • {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
            </Typography>
            {lastSaved && (
              <Typography variant="caption" color="success.main">
                {formatLastSaved(lastSaved)}
              </Typography>
            )}
          </Stack>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddRoomDialogOpen(true)}
          fullWidth={isMobile}
          sx={{ minHeight: isMobile ? 44 : undefined }}
        >
          Add Room
        </Button>
      </Stack>

      {/* Instructions */}
      {rooms.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            How to inspect:
          </Typography>
          <Typography variant="body2">
            1. Add each room you're inspecting<br />
            2. Walk through and describe what you see<br />
            3. Click "Generate Issues" to create an issues list<br />
            4. Tap each issue to attach photos
          </Typography>
        </Alert>
      )}

      {/* Room Cards */}
      {rooms.map((room) => (
        <RoomInspectionCard
          key={room.id}
          room={room}
          inspection={inspection}
          onUpdate={actions.refetchRooms}
          isMobile={isMobile}
        />
      ))}

      {/* Floating Add Room Button (mobile) */}
      {isMobile && rooms.length > 0 && (
        <Zoom in>
          <Fab
            color="primary"
            onClick={() => setAddRoomDialogOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 80,
              right: 16,
              zIndex: 1000,
            }}
          >
            <AddIcon />
          </Fab>
        </Zoom>
      )}

      {/* Add Room Dialog */}
      <Dialog
        open={addRoomDialogOpen}
        onClose={() => setAddRoomDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Add Room</Typography>
            {isMobile && (
              <IconButton onClick={() => setAddRoomDialogOpen(false)}>
                <CloseIcon />
              </IconButton>
            )}
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Room Type"
              value={formData.roomType}
              onChange={(e) => handleRoomTypeChange(e.target.value)}
              fullWidth
              required
            >
              {ROOM_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>
            {formData.roomType === 'OTHER' && (
              <TextField
                label="Custom Room Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
                autoFocus
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: isMobile ? 2 : undefined }}>
          {!isMobile && <Button onClick={() => setAddRoomDialogOpen(false)}>Cancel</Button>}
          <Button
            onClick={handleAddRoom}
            variant="contained"
            disabled={!formData.roomType || (formData.roomType === 'OTHER' && !formData.name)}
            fullWidth={isMobile}
            sx={{ minHeight: isMobile ? 44 : undefined }}
          >
            Add Room
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
