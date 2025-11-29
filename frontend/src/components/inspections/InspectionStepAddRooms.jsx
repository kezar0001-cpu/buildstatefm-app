import React, { useState } from 'react';
import {
  Box, Stack, Typography, Button, Alert, Grid, Card, CardContent,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, CircularProgress
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

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
  { value: 'OTHER', label: 'Other' }
];

// Hardcoded for now, but ideally fetched from backend
const CHECKLIST_TEMPLATES = {
  ROUTINE: [
    'Walls and ceiling condition', 'Floor condition', 'Windows and doors functioning',
    'Light fixtures working', 'Smoke detectors functioning', 'HVAC vents clean',
    'Electrical outlets working'
  ],
  MOVE_IN: [
    'Walls, ceiling, and paint condition', 'Flooring condition', 'Windows and locks functioning',
    'Doors and handles working', 'Light fixtures and switches', 'Smoke/CO detectors',
    'Outlets and fixtures', 'Cleanliness and hygiene'
  ],
  MOVE_OUT: [
    'Walls and paint damage', 'Floor damage or stains', 'Window condition',
    'Door damage', 'Light fixtures condition', 'Smoke detector functionality',
    'Cleanliness and sanitation', 'Keys returned'
  ],
  EMERGENCY: [
    'Safety hazards present', 'Structural damage', 'Water or fire damage',
    'Gas or electrical issues', 'Emergency repairs needed'
  ],
  COMPLIANCE: [
    'Fire safety equipment', 'Emergency exits clear', 'Building codes compliance',
    'Safety regulations met', 'Required permits displayed'
  ]
};

const ROOM_SPECIFIC_ITEMS = {
  BATHROOM: ['Toilet functioning', 'Sink and faucet', 'Shower/tub condition', 'Ventilation fan', 'Grout and caulking'],
  KITCHEN: ['Appliances functioning', 'Cabinets and drawers', 'Countertops condition', 'Sink and faucet', 'Ventilation'],
};

export const InspectionStepAddRooms = ({ inspection, rooms, actions }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState({ name: '', roomType: '', notes: '' });
  const [generatingMap, setGeneratingMap] = useState({});

  const handleOpenDialog = (room = null) => {
    if (room) {
      setEditingRoom(room);
      setFormData({ name: room.name, roomType: room.roomType || '', notes: room.notes || '' });
    } else {
      setEditingRoom(null);
      setFormData({ name: '', roomType: '', notes: '' });
    }
    setDialogOpen(true);
  };

  const handleRoomTypeChange = (newType) => {
    const selectedRoom = ROOM_TYPES.find(rt => rt.value === newType);
    setFormData(prev => ({
      ...prev,
      roomType: newType,
      // Auto-populate name if not 'OTHER', keep existing name if editing
      name: newType === 'OTHER' ? prev.name : (editingRoom ? prev.name : selectedRoom?.label || '')
    }));
  };

  const handleSave = () => {
    // Require room type
    if (!formData.roomType) return;
    // Require name only if 'OTHER' is selected
    if (formData.roomType === 'OTHER' && !formData.name) return;

    const dataToSave = {
      ...formData,
      // Use room type label as name if not OTHER and name is not custom
      name: formData.name || ROOM_TYPES.find(rt => rt.value === formData.roomType)?.label || 'Unnamed Room'
    };

    if (editingRoom) {
      actions.updateRoom({ roomId: editingRoom.id, data: dataToSave });
    } else {
      actions.addRoom(dataToSave);
    }
    setDialogOpen(false);
  };

  // Generate AI Checklist Mutation
  const generateChecklistMutation = useMutation({
    mutationFn: async (room) => {
      // Use AI endpoint to generate checklist
      const response = await apiClient.post(
        `/inspections/${inspection.id}/rooms/${room.id}/checklist/generate`
      );
      return response.data;
    },
    onMutate: (room) => {
      setGeneratingMap(prev => ({ ...prev, [room.id]: true }));
    },
    onSuccess: (data, room) => {
      setGeneratingMap(prev => ({ ...prev, [room.id]: false }));
      // Trigger refetch to update the checklist items count
      if (actions.refetchRooms) {
        actions.refetchRooms();
      }
    },
    onError: (error, room) => {
      setGeneratingMap(prev => ({ ...prev, [room.id]: false }));
      const errorMessage = error.response?.data?.message || 'Failed to generate checklist. Please try again.';
      console.error('Failed to generate AI checklist:', error);
      alert(errorMessage);
    }
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">Add Rooms to Inspect</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add Room
        </Button>
      </Stack>

      {rooms.length === 0 ? (
        <Alert severity="info">
          No rooms added yet. Click "Add Room" to start adding rooms to inspect.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {rooms.map((room) => (
            <Grid item xs={12} sm={6} md={4} key={room.id}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="h6" gutterBottom>{room.name}</Typography>
                    <IconButton size="small" onClick={() => handleOpenDialog(room)} sx={{ mt: -0.5 }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Chip
                    label={ROOM_TYPES.find(rt => rt.value === room.roomType)?.label || 'Not specified'}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {room.checklistItems?.length || 0} checklist items
                  </Typography>
                  <Button
                    size="small"
                    variant={room.checklistItems?.length > 0 ? 'outlined' : 'contained'}
                    onClick={() => generateChecklistMutation.mutate(room)}
                    sx={{ mt: 1 }}
                    disabled={generatingMap[room.id] || (room.checklistItems?.length > 0)}
                    startIcon={generatingMap[room.id] ? <CircularProgress size={16} /> : null}
                  >
                    {generatingMap[room.id] ? 'Generating AI Checklist...' :
                     room.checklistItems?.length > 0 ? 'Checklist Generated' : 'Generate AI Checklist'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRoom ? 'Edit Room' : 'Add Room'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Room Type"
              value={formData.roomType}
              onChange={(e) => handleRoomTypeChange(e.target.value)}
              fullWidth
              required
              helperText="Select the type of room to inspect"
            >
              {ROOM_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
              ))}
            </TextField>
            {formData.roomType === 'OTHER' && (
              <TextField
                label="Custom Room Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
                helperText="Enter a custom name for this room"
                autoFocus
              />
            )}
            <TextField
              label="Notes (optional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={3}
              helperText="Add any specific details about this room that will help generate a better checklist"
              placeholder="e.g., Recently painted, has water damage on ceiling, newly renovated kitchen with stainless steel appliances"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.roomType || (formData.roomType === 'OTHER' && !formData.name)}
          >
            {editingRoom ? 'Update Room' : 'Add Room'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
