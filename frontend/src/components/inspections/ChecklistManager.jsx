import React, { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  Divider,
  Checkbox,
  Toolbar
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
  const [selectedItems, setSelectedItems] = useState(new Set());
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

  // Add issue mutation
  const addItemMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Issue added');
      handleCloseDialog();
      if (onUpdate) onUpdate();
      // Refetch rooms to update issues count
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || 'Failed to add issue';
      toast.error(errorMessage);
    }
  });

  // Update issue mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }) => {
      const response = await apiClient.patch(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist/${itemId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Issue updated');
      handleCloseDialog();
      if (onUpdate) onUpdate();
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || 'Failed to update issue';
      toast.error(errorMessage);
    }
  });

  // Delete issue mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId) => {
      await apiClient.delete(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist/${itemId}`
      );
      return itemId;
    },
    onSuccess: (itemId) => {
      toast.success('Issue deleted');
      // Remove from selection if it was selected
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      if (onUpdate) onUpdate();
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || 'Failed to delete issue';
      toast.error(errorMessage);
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds) => {
      // Delete all items in parallel
      const deletePromises = itemIds.map(itemId =>
        apiClient.delete(`/inspections/${inspection.id}/rooms/${room.id}/checklist/${itemId}`)
      );
      await Promise.all(deletePromises);
    },
    onSuccess: (_, itemIds) => {
      toast.success(`Deleted ${itemIds.length} issue(s)`);
      setSelectedItems(new Set());
      if (onUpdate) onUpdate();
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.rooms(inspection.id) });
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || 'Failed to delete issues';
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
    if (window.confirm('Are you sure you want to delete this issue?')) {
      deleteItemMutation.mutate(itemId);
    }
  };

  const handleToggleSelect = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedItems(new Set(sortedItems.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  // Handle both camelCase and PascalCase formats
  const checklistItems = room.checklistItems || room.InspectionChecklistItem || [];
  const sortedItems = [...checklistItems].sort((a, b) => (a.order || 0) - (b.order || 0));

  const handleBulkDelete = () => {
    if (selectedItems.size === 0) return;
    
    const count = selectedItems.size;
    if (window.confirm(`Are you sure you want to delete ${count} issue(s)? This action cannot be undone.`)) {
      bulkDeleteMutation.mutate(Array.from(selectedItems));
    }
  };

  const isAllSelected = sortedItems.length > 0 && selectedItems.size === sortedItems.length;
  const isIndeterminate = selectedItems.size > 0 && selectedItems.size < sortedItems.length;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1">
          Issues ({checklistItems.length})
        </Typography>
        <Stack direction="row" spacing={1}>
          {selectedItems.size > 0 && (
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isLoading}
            >
              Delete ({selectedItems.size})
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
          >
            Add Item
          </Button>
        </Stack>
      </Stack>

      {sortedItems.length > 0 && (
        <Toolbar
          variant="dense"
          sx={{
            minHeight: '48px !important',
            px: '8px !important',
            bgcolor: selectedItems.size > 0 ? 'action.selected' : 'transparent',
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'divider',
            mb: 1
          }}
        >
          <Checkbox
            checked={isAllSelected}
            indeterminate={isIndeterminate}
            onChange={handleSelectAll}
            size="small"
          />
          <Typography variant="body2" sx={{ ml: 1, flexGrow: 1 }}>
            {selectedItems.size > 0
              ? `${selectedItems.size} of ${sortedItems.length} selected`
              : 'Select issues to delete'}
          </Typography>
          {selectedItems.size > 0 && (
            <Button
              size="small"
              onClick={() => setSelectedItems(new Set())}
              sx={{ minWidth: 'auto' }}
            >
              Clear
            </Button>
          )}
        </Toolbar>
      )}

      {sortedItems.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No issues identified yet. Add issues manually or generate an AI list of issues.
        </Alert>
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          {sortedItems.map((item, index) => {
            const isSelected = selectedItems.has(item.id);
            return (
              <React.Fragment key={item.id}>
                <ListItem
                  sx={{
                    py: 1.5,
                    bgcolor: isSelected ? 'action.selected' : 'transparent',
                    '&:hover': {
                      bgcolor: isSelected ? 'action.selected' : 'action.hover'
                    }
                  }}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleOpenEditDialog(item)}
                        aria-label="edit"
                        disabled={isSelected}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleDelete(item.id)}
                        aria-label="delete"
                        color="error"
                        disabled={isSelected}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  }
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(item.id)}
                      tabIndex={-1}
                      disableRipple
                      size="small"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CheckCircleIcon fontSize="small" color="action" />
                        <Typography variant="body2">{item.description}</Typography>
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
            );
          })}
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
          {editingItem ? 'Edit Issue' : 'Add Issue'}
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
              helperText="Describe the issue that needs repair or attention"
              autoFocus
            />
            <TextField
              label="Notes (optional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={2}
              helperText="Additional notes or context for this issue"
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
            {editingItem ? 'Update Issue' : 'Add Issue'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

