import React, { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../utils/queryKeys';

export const ChecklistManager = ({ inspection, room, onUpdate, isMobile = false }) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ description: '', notes: '' });
  const queryClient = useQueryClient();

  const handleOpenAddDialog = () => {
    setEditingItem(null);
    setFormData({ description: '', notes: '' });
    setEditDialogOpen(true);
  };

  const handleOpenEditDialog = (item) => {
    setEditingItem(item);
    setFormData({ description: item.description || '', notes: item.notes || '' });
    setEditDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setEditDialogOpen(false);
    setEditingItem(null);
    setFormData({ description: '', notes: '' });
  };

  // Add checklist item mutation
  const addItemMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Checklist item added');
      handleCloseDialog();
      if (onUpdate) onUpdate();
      // Refetch rooms to update checklist count
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || 'Failed to add checklist item';
      toast.error(errorMessage);
    }
  });

  // Update checklist item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }) => {
      const response = await apiClient.patch(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist/${itemId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Checklist item updated');
      handleCloseDialog();
      if (onUpdate) onUpdate();
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || 'Failed to update checklist item';
      toast.error(errorMessage);
    }
  });

  // Delete checklist item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId) => {
      await apiClient.delete(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist/${itemId}`
      );
    },
    onSuccess: () => {
      toast.success('Checklist item deleted');
      if (onUpdate) onUpdate();
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || 'Failed to delete checklist item';
      toast.error(errorMessage);
    }
  });

  const handleSave = () => {
    if (!formData.description.trim()) {
      toast.error('Description is required');
      return;
    }

    if (editingItem) {
      updateItemMutation.mutate({
        itemId: editingItem.id,
        data: {
          description: formData.description.trim(),
          notes: formData.notes.trim() || null
        }
      });
    } else {
      addItemMutation.mutate({
        description: formData.description.trim(),
        notes: formData.notes.trim() || null,
        status: 'PENDING'
      });
    }
  };

  const handleDelete = (itemId) => {
    if (window.confirm('Are you sure you want to delete this checklist item?')) {
      deleteItemMutation.mutate(itemId);
    }
  };

  const checklistItems = room.checklistItems || [];
  const sortedItems = [...checklistItems].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1">
          Checklist Items ({checklistItems.length})
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
        >
          Add Item
        </Button>
      </Stack>

      {sortedItems.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No checklist items yet. Add items manually or generate an AI checklist.
        </Alert>
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          {sortedItems.map((item, index) => (
            <React.Fragment key={item.id}>
              <ListItem
                sx={{
                  py: 1.5,
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleOpenEditDialog(item)}
                      aria-label="edit"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDelete(item.id)}
                      aria-label="delete"
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircleIcon fontSize="small" color="action" />
                      <Typography variant="body2">{item.description}</Typography>
                      {item.status && item.status !== 'PENDING' && (
                        <Chip
                          label={item.status}
                          size="small"
                          color={item.status === 'PASSED' ? 'success' : item.status === 'FAILED' ? 'error' : 'default'}
                          sx={{ ml: 'auto' }}
                        />
                      )}
                    </Stack>
                  }
                  secondary={item.notes ? (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {item.notes}
                    </Typography>
                  ) : null}
                />
              </ListItem>
              {index < sortedItems.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingItem ? 'Edit Checklist Item' : 'Add Checklist Item'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              required
              multiline
              rows={2}
              helperText="Describe what needs to be checked"
              autoFocus
            />
            <TextField
              label="Notes (optional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={2}
              helperText="Additional notes or context for this item"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.description.trim() || addItemMutation.isLoading || updateItemMutation.isLoading}
          >
            {editingItem ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

