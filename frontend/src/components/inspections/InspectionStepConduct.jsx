import React, { useState } from 'react';
import {
  Box, Stack, Typography, Button, Card, CardContent, Divider,
  List, ListItem, Chip, CircularProgress, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, LinearProgress
} from '@mui/material';
import { Add as AddIcon, CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

const PhotoUpload = ({ inspectionId, roomId, issueId, onUploadComplete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState(null);

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('photos', file);

      const uploadRes = await apiClient.post('/uploads/inspection-photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total)),
      });

      if (uploadRes.data.success && uploadRes.data.urls?.length) {
        // Link photo to inspection
        await apiClient.post(`/inspections/${inspectionId}/photos`, {
          roomId,
          issueId,
          url: uploadRes.data.urls[0],
        });
        onUploadComplete();
        setPreview(null);
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      alert('Failed to upload photo');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <input
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          id={`photo-upload-${roomId || issueId || 'general'}`}
          type="file"
          onChange={handleUpload}
          disabled={isUploading}
        />
        <label htmlFor={`photo-upload-${roomId || issueId || 'general'}`}>
          <Button
            component="span"
            startIcon={isUploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
            size="small"
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Add Photo'}
          </Button>
        </label>
      </Stack>
      {isUploading && <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 1 }} />}
    </Box>
  );
};

export const InspectionStepConduct = ({ inspection, rooms, actions, lastSaved }) => {
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [newIssue, setNewIssue] = useState({ roomId: '', title: '', description: '', severity: 'MEDIUM' });

  const formatLastSaved = (date) => {
    if (!date) return null;
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 10) return 'Last saved just now';
    if (diffSec < 60) return `Last saved ${diffSec} seconds ago`;
    if (diffMin < 60) return `Last saved ${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;

    return `Last saved at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleAddIssue = async () => {
    if (!newIssue.title) return;
    try {
      await apiClient.post(`/inspections/${inspection.id}/issues`, newIssue);
      setIssueDialogOpen(false);
      setNewIssue({ roomId: '', title: '', description: '', severity: 'MEDIUM' });
      // Trigger refresh? ideally passed via actions or handled by invalidation
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h6">Conduct Inspection</Typography>
          {lastSaved && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              {formatLastSaved(lastSaved)}
            </Typography>
          )}
        </Box>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setIssueDialogOpen(true)}>
          Add Issue
        </Button>
      </Stack>

      {rooms.map((room) => (
        <Card key={room.id} sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">{room.name}</Typography>
              <Chip label={room.roomType || 'Not specified'} size="small" />
            </Stack>
            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Checklist Items:</Typography>
            <List>
              {room.checklistItems?.map((item) => (
                <ListItem key={item.id} disablePadding sx={{ py: 1 }}>
                  <Box sx={{ width: '100%' }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" sx={{ flex: 1 }}>{item.description}</Typography>
                      <Stack direction="row" spacing={1}>
                        {['PASSED', 'FAILED', 'NA'].map((status) => (
                          <Button
                            key={status}
                            size="small"
                            variant={item.status === status ? 'contained' : 'outlined'}
                            color={status === 'PASSED' ? 'success' : status === 'FAILED' ? 'error' : 'inherit'}
                            onClick={() => actions.updateChecklistItem(room.id, item.id, status, item.notes)}
                          >
                            {status === 'NA' ? 'N/A' : status.charAt(0) + status.slice(1).toLowerCase()}
                          </Button>
                        ))}
                      </Stack>
                    </Stack>
                  </Box>
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 2 }} />
            <Stack spacing={2}>
              <PhotoUpload
                inspectionId={inspection.id}
                roomId={room.id}
                onUploadComplete={() => {}} // Ideally refetch
              />
              {room.photos?.length > 0 && (
                <Grid container spacing={1}>
                  {room.photos.map((photo) => (
                    <Grid item xs={4} key={photo.id}>
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Room photo'}
                        style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4 }}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Dialog open={issueDialogOpen} onClose={() => setIssueDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Issue</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Room"
              value={newIssue.roomId}
              onChange={(e) => setNewIssue({ ...newIssue, roomId: e.target.value })}
              fullWidth
            >
              <MenuItem value="">General</MenuItem>
              {rooms.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </TextField>
            <TextField
              label="Issue Title"
              value={newIssue.title}
              onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={newIssue.description}
              onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
             <TextField
                select
                label="Severity"
                value={newIssue.severity}
                onChange={(e) => setNewIssue({ ...newIssue, severity: e.target.value })}
                fullWidth
              >
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddIssue} variant="contained">Add Issue</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
