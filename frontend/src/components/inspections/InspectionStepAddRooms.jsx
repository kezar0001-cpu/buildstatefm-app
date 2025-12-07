import React, { useState } from 'react';
import {
  Box, Stack, Typography, Button, Alert, Grid, Card, CardContent,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, CircularProgress, Collapse
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';
import { ChecklistManager } from './ChecklistManager';

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

export const InspectionStepAddRooms = ({ inspection, rooms, actions, isMobile = false }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState({ name: '', roomType: '', notes: '' });
  const [generatingMap, setGeneratingMap] = useState({});
  const [expandedRooms, setExpandedRooms] = useState({});

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
      toast.success(`Generated ${data.count || 0} checklist items`);
      // Trigger refetch to update the checklist items count
      if (actions.refetchRooms) {
        actions.refetchRooms();
      }
    },
    onError: (error, room) => {
      setGeneratingMap(prev => ({ ...prev, [room.id]: false }));
      const errorMessage = error.response?.data?.message || 'Failed to generate checklist. Please try again.';
      console.error('Failed to generate AI checklist:', error);
      toast.error(errorMessage);
    }
  });

  const handleToggleExpand = (roomId) => {
    setExpandedRooms(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  return (
    <Box>
      <Stack 
        direction={isMobile ? 'column' : 'row'} 
        justifyContent="space-between" 
        alignItems={isMobile ? 'stretch' : 'center'} 
        spacing={isMobile ? 2 : 0}
        sx={{ mb: isMobile ? 2 : 3 }}
      >
        <Typography variant={isMobile ? 'subtitle1' : 'h6'}>Add Rooms to Inspect</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => handleOpenDialog()}
          fullWidth={isMobile}
          sx={{
            minHeight: isMobile ? 44 : undefined,
          }}
        >
          Add Room
        </Button>
      </Stack>

      {rooms.length === 0 ? (
        <Alert severity="info">
          No rooms added yet. Click "Add Room" to start adding rooms to inspect.
        </Alert>
      ) : (
        <Grid container spacing={isMobile ? 2 : 2}>
          {rooms.map((room) => (
            <Grid item xs={12} sm={isMobile ? 12 : 6} md={isMobile ? 12 : 6} key={room.id}>
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
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {room.checklistItems?.length || 0} checklist items
                    </Typography>
                    {room.checklistItems && room.checklistItems.length > 0 && (
                      <IconButton
                        size="small"
                        onClick={() => handleToggleExpand(room.id)}
                        sx={{ ml: 'auto' }}
                      >
                        {expandedRooms[room.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => generateChecklistMutation.mutate(room)}
                      disabled={generatingMap[room.id]}
                      startIcon={generatingMap[room.id] ? <CircularProgress size={16} /> : null}
                      sx={{ flex: 1 }}
                    >
                      {generatingMap[room.id] ? 'Generating...' : 'Generate AI Checklist'}
                    </Button>
                    {room.checklistItems && room.checklistItems.length > 0 && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleToggleExpand(room.id)}
                        startIcon={expandedRooms[room.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      >
                        {expandedRooms[room.id] ? 'Hide' : 'Manage'}
                      </Button>
                    )}
                  </Stack>
                  <Collapse in={expandedRooms[room.id]}>
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <ChecklistManager
                        inspection={inspection}
                        room={room}
                        onUpdate={() => {
                          if (actions.refetchRooms) {
                            actions.refetchRooms();
                          }
                        }}
                        isMobile={isMobile}
                      />
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
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
