// frontend/src/components/PropertyNotesSection.jsx
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  StickyNote2 as NoteIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import {
  usePropertyNotes,
  useAddPropertyNote,
  useUpdatePropertyNote,
  useDeletePropertyNote,
} from '../hooks/usePropertyNotes';
import { getCurrentUser } from '../lib/auth';
import useNotification from '../hooks/useNotification';

/**
 * PropertyNotesSection component for managing property notes
 * @param {string} propertyId - Property ID
 * @param {boolean} canEdit - Whether user can add notes
 */
const PropertyNotesSection = ({ propertyId, canEdit = false }) => {
  const user = getCurrentUser();
  const { showNotification } = useNotification();

  // Query for notes
  const {
    data: notesData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePropertyNotes(propertyId);

  // Bug Fix: Removed manual refetch() calls - mutations now auto-invalidate via invalidateKeys
  // Mutations
  const { mutateAsync: addNote, isPending: isAdding } = useAddPropertyNote(
    propertyId,
    () => {
      showNotification('Note added successfully', 'success');
    }
  );

  const { mutateAsync: updateNote, isPending: isUpdating } =
    useUpdatePropertyNote(propertyId, () => {
      showNotification('Note updated successfully', 'success');
    });

  const { mutateAsync: deleteNote, isPending: isDeleting } =
    useDeletePropertyNote(propertyId, () => {
      showNotification('Note deleted successfully', 'success');
    });

  // Local state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);

  const notes = notesData?.data || notesData?.notes || [];

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) {
      showNotification('Note content cannot be empty', 'error');
      return;
    }

    try {
      await addNote({
        data: {
          content: newNoteContent.trim(),
        },
      });
      setNewNoteContent('');
    } catch (error) {
      console.error('Error adding note:', error);
      showNotification(
        error.response?.data?.message || 'Failed to add note',
        'error'
      );
    }
  };

  const handleStartEdit = (note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (noteId) => {
    if (!editContent.trim()) {
      showNotification('Note content cannot be empty', 'error');
      return;
    }

    try {
      await updateNote({
        url: `/properties/${propertyId}/notes/${noteId}`,
        data: {
          content: editContent.trim(),
        },
      });
      setEditingNoteId(null);
      setEditContent('');
    } catch (error) {
      console.error('Error updating note:', error);
      showNotification(
        error.response?.data?.message || 'Failed to update note',
        'error'
      );
    }
  };

  const handleDeleteClick = (note) => {
    setNoteToDelete(note);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;

    try {
      await deleteNote({
        url: `/properties/${propertyId}/notes/${noteToDelete.id}`,
        method: 'delete',
      });
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    } catch (error) {
      console.error('Error deleting note:', error);
      showNotification(
        error.response?.data?.message || 'Failed to delete note',
        'error'
      );
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setNoteToDelete(null);
  };

  const canEditNote = (note) => {
    if (!user) return false;
    // User can edit their own notes
    return note.authorId === user.id;
  };

  const getAuthorInitials = (authorName) => {
    if (!authorName) return '?';
    const names = authorName.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return authorName[0].toUpperCase();
  };

  const formatDate = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Unknown date';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box p={3}>
        <Alert
          severity="error"
          action={(
            <Button
              color="inherit"
              size="small"
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
            >
              Retry
            </Button>
          )}
        >
          {error?.response?.data?.message || 'Failed to load property notes'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Add New Note Section */}
      {canEdit && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <NoteIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Add Note</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Add a note about this property (visible to property managers and owners)"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            disabled={isAdding}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={isAdding ? <CircularProgress size={20} /> : <AddIcon />}
              onClick={handleAddNote}
              disabled={isAdding || !newNoteContent.trim()}
            >
              Add Note
            </Button>
          </Box>
        </Paper>
      )}

      {/* Notes List */}
      <Box>
        {notes.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: 'center',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <NoteIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Notes Yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {canEdit
                ? 'Add the first note to start documenting information about this property.'
                : 'Notes will appear here when added by property managers or owners.'}
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {notes.map((note) => (
              <Card
                key={note.id}
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <CardContent>
                  {/* Note Header */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      mb: 2,
                    }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: 'primary.main',
                        width: 40,
                        height: 40,
                        mr: 2,
                      }}
                    >
                      {getAuthorInitials(note.author?.name || 'Unknown')}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {note.author?.name || 'Unknown User'}
                      </Typography>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Chip
                          label={note.author?.role || 'Unknown'}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(note.createdAt)}
                        </Typography>
                        {note.updatedAt !== note.createdAt && (
                          <Chip
                            label="Edited"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* Note Content */}
                  {editingNoteId === note.id ? (
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      disabled={isUpdating}
                      autoFocus
                    />
                  ) : (
                    <Typography
                      variant="body1"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        pl: 7,
                      }}
                    >
                      {note.content}
                    </Typography>
                  )}
                </CardContent>

                {/* Note Actions */}
                {canEditNote(note) && (
                  <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                    {editingNoteId === note.id ? (
                      <>
                        <Button
                          size="small"
                          startIcon={<CancelIcon />}
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={
                            isUpdating ? (
                              <CircularProgress size={16} />
                            ) : (
                              <SaveIcon />
                            )
                          }
                          onClick={() => handleSaveEdit(note.id)}
                          disabled={isUpdating || !editContent.trim()}
                        >
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Tooltip title="Edit note">
                          <IconButton
                            size="small"
                            onClick={() => handleStartEdit(note)}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete note">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(note)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </CardActions>
                )}
              </Card>
            ))}
          </Box>
        )}
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Note</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this note? This action cannot be
            undone.
          </Typography>
          {noteToDelete && (
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 2,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Note Preview:
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {noteToDelete.content.substring(0, 150)}
                {noteToDelete.content.length > 150 ? '...' : ''}
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={isDeleting}
            startIcon={
              isDeleting ? <CircularProgress size={20} /> : <DeleteIcon />
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertyNotesSection;
