import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  TextField,
  MenuItem,
  IconButton,
  Card,
  CardContent,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Alert,
  LinearProgress,
  CircularProgress,
  Snackbar,
  StepButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Photo as PhotoIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import SignatureCapture from './SignatureCapture';

const ROOM_TYPES = [
  'BEDROOM',
  'BATHROOM',
  'KITCHEN',
  'LIVING_ROOM',
  'DINING_ROOM',
  'HALLWAY',
  'LAUNDRY_ROOM',
  'GARAGE',
  'BASEMENT',
  'ATTIC',
  'BALCONY',
  'PATIO',
  'STORAGE',
  'OFFICE',
  'OTHER',
];

const CHECKLIST_TEMPLATES = {
  ROUTINE: [
    'Walls and ceiling condition',
    'Floor condition',
    'Windows and doors functioning',
    'Light fixtures working',
    'Smoke detectors functioning',
    'HVAC vents clean',
    'Electrical outlets working',
  ],
  MOVE_IN: [
    'Walls, ceiling, and paint condition',
    'Flooring condition (carpets, tiles, hardwood)',
    'Windows and locks functioning',
    'Doors and handles working',
    'Light fixtures and switches',
    'Smoke and carbon monoxide detectors',
    'Outlets and fixtures',
    'Cleanliness and hygiene',
  ],
  MOVE_OUT: [
    'Walls and paint damage',
    'Floor damage or stains',
    'Window condition and cleanliness',
    'Door damage',
    'Light fixtures condition',
    'Smoke detector functionality',
    'Cleanliness and sanitation',
    'Keys and access devices returned',
  ],
  EMERGENCY: [
    'Safety hazards present',
    'Structural damage',
    'Water or fire damage',
    'Gas or electrical issues',
    'Emergency repairs needed',
  ],
  COMPLIANCE: [
    'Fire safety equipment',
    'Emergency exits clear',
    'Building codes compliance',
    'Safety regulations met',
    'Required permits displayed',
    'Accessibility requirements',
  ],
};

const ROOM_SPECIFIC_ITEMS = {
  BATHROOM: ['Toilet functioning', 'Sink and faucet', 'Shower/tub condition', 'Ventilation fan', 'Grout and caulking'],
  KITCHEN: ['Appliances functioning', 'Cabinets and drawers', 'Countertops condition', 'Sink and faucet', 'Ventilation'],
};

const InspectionConductForm = ({ inspection, onComplete, onCancel }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', roomType: '', notes: '' });
  const [editingRoom, setEditingRoom] = useState(null);
  const [newIssue, setNewIssue] = useState({
    roomId: '',
    checklistItemId: '',
    title: '',
    description: '',
    severity: 'MEDIUM',
  });
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [signatureBlob, setSignatureBlob] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [signatureRequired, setSignatureRequired] = useState(
    inspection.type === 'MOVE_IN' || inspection.type === 'MOVE_OUT'
  );

  // Optimistic updates and debouncing state
  const [localChecklistState, setLocalChecklistState] = useState({});
  const [savingItems, setSavingItems] = useState({});
  const debounceTimers = useRef({});
  const pendingUpdates = useRef({});

  // Room generation tracking
  const [generatingChecklists, setGeneratingChecklists] = useState({});
  const [generatedRooms, setGeneratedRooms] = useState(new Set());
  const [confirmDialog, setConfirmDialog] = useState({ open: false, room: null });

  // Step validation errors
  const [stepError, setStepError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Completed steps tracking
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const steps = ['Start Inspection', 'Add Rooms', 'Conduct Inspection', 'Review & Complete'];

  // Fetch existing rooms and data
  const { data: roomsData, refetch: refetchRooms } = useQuery({
    queryKey: queryKeys.inspections.rooms(inspection.id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${inspection.id}/rooms`);
      return response.data;
    },
    enabled: inspection?.id !== undefined,
  });

  const { data: issuesData, refetch: refetchIssues } = useQuery({
    queryKey: queryKeys.inspections.issues(inspection.id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${inspection.id}/issues`);
      return response.data;
    },
    enabled: inspection?.id !== undefined,
  });

  // Mutations
  const startInspectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.patch(`/inspections/${inspection.id}`, {
        status: 'IN_PROGRESS',
      });
      return response.data;
    },
    onSuccess: () => {
      setActiveStep(1);
    },
  });

  const addRoomMutation = useMutation({
    mutationFn: async (roomData) => {
      const response = await apiClient.post(`/inspections/${inspection.id}/rooms`, roomData);
      return response.data;
    },
    onSuccess: () => {
      refetchRooms();
      setRoomDialogOpen(false);
      setNewRoom({ name: '', roomType: '', notes: '' });
      setSnackbar({ open: true, message: 'Room added successfully', severity: 'success' });
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: async ({ roomId, roomData }) => {
      const response = await apiClient.patch(`/rooms/${roomId}`, roomData);
      return response.data;
    },
    onSuccess: () => {
      refetchRooms();
      setRoomDialogOpen(false);
      setEditingRoom(null);
      setNewRoom({ name: '', roomType: '', notes: '' });
      setSnackbar({ open: true, message: 'Room updated successfully', severity: 'success' });
    },
  });

  const addChecklistItemMutation = useMutation({
    mutationFn: async ({ roomId, description }) => {
      const response = await apiClient.post(
        `/inspections/${inspection.id}/rooms/${roomId}/checklist`,
        { description }
      );
      return response.data;
    },
    onSuccess: () => {
      refetchRooms();
    },
  });

  const updateChecklistItemMutation = useMutation({
    mutationFn: async ({ roomId, itemId, status, notes }) => {
      const response = await apiClient.patch(
        `/inspections/${inspection.id}/rooms/${roomId}/checklist/${itemId}`,
        { status, notes }
      );
      return response.data;
    },
    onSuccess: () => {
      refetchRooms();
    },
  });

  const addIssueMutation = useMutation({
    mutationFn: async (issueData) => {
      const response = await apiClient.post(`/inspections/${inspection.id}/issues`, issueData);
      return response.data;
    },
    onSuccess: () => {
      refetchIssues();
      setIssueDialogOpen(false);
      setNewIssue({
        roomId: '',
        checklistItemId: '',
        title: '',
        description: '',
        severity: 'MEDIUM',
      });
    },
  });

  const addPhotoMutation = useMutation({
    mutationFn: async ({ roomId, issueId, url, caption }) => {
      const response = await apiClient.post(`/inspections/${inspection.id}/photos`, {
        roomId,
        issueId,
        url,
        caption,
      });
      return response.data;
    },
    onSuccess: () => {
      refetchRooms();
      refetchIssues();
      setPhotoDialogOpen(false);
      setSelectedPhoto(null);
      setPhotoCaption('');
    },
  });

  const uploadSignatureMutation = useMutation({
    mutationFn: async (signatureBlob) => {
      const formData = new FormData();
      formData.append('signature', signatureBlob, 'signature.png');
      const response = await apiClient.post(`/inspections/${inspection.id}/signature`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
  });

  const completeInspectionMutation = useMutation({
    mutationFn: async () => {
      // Upload signature first if required and not yet uploaded
      if (signatureRequired && signatureBlob && !inspection.tenantSignature) {
        await uploadSignatureMutation.mutateAsync(signatureBlob);
      }

      const response = await apiClient.post(`/inspections/${inspection.id}/complete`, {
        findings: generateFindings(),
      });
      return response.data;
    },
    onSuccess: () => {
      onComplete();
    },
  });

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Initialize local state from server data
  useEffect(() => {
    if (roomsData?.rooms) {
      const newState = {};
      roomsData.rooms.forEach(room => {
        room.checklistItems?.forEach(item => {
          newState[item.id] = { status: item.status, notes: item.notes };
        });
      });
      setLocalChecklistState(newState);

      // Track which rooms have checklist items
      const generated = new Set();
      roomsData.rooms.forEach(room => {
        if (room.checklistItems && room.checklistItems.length > 0) {
          generated.add(room.id);
        }
      });
      setGeneratedRooms(generated);
    }
  }, [roomsData]);

  const handleStartInspection = () => {
    startInspectionMutation.mutate();
    setCompletedSteps(new Set([0]));
  };

  const handleCancelInspection = async () => {
    if (activeStep === 0) {
      // Revert status if on step 0
      if (inspection.status === 'IN_PROGRESS') {
        try {
          await apiClient.patch(`/inspections/${inspection.id}`, { status: 'SCHEDULED' });
        } catch (error) {
          console.error('Error reverting inspection status:', error);
        }
      }
    }
    onCancel();
  };

  const handleAddRoom = () => {
    if (newRoom.name) {
      if (editingRoom) {
        updateRoomMutation.mutate({ roomId: editingRoom.id, roomData: newRoom });
      } else {
        addRoomMutation.mutate(newRoom);
      }
    }
  };

  const handleEditRoom = (room) => {
    setEditingRoom(room);
    setNewRoom({
      name: room.name,
      roomType: room.roomType || '',
      notes: room.notes || '',
    });
    setRoomDialogOpen(true);
  };

  const handleCloseRoomDialog = () => {
    setRoomDialogOpen(false);
    setEditingRoom(null);
    setNewRoom({ name: '', roomType: '', notes: '' });
  };

  const handleGenerateChecklistClick = (room) => {
    // Check if room already has checklist items
    if (room.checklistItems && room.checklistItems.length > 0) {
      setConfirmDialog({ open: true, room });
    } else {
      handleGenerateChecklist(room);
    }
  };

  const handleConfirmGenerate = () => {
    if (confirmDialog.room) {
      handleGenerateChecklist(confirmDialog.room);
    }
    setConfirmDialog({ open: false, room: null });
  };

  const handleGenerateChecklist = async (room) => {
    setGeneratingChecklists(prev => ({ ...prev, [room.id]: true }));

    try {
      const template = CHECKLIST_TEMPLATES[inspection.type] || CHECKLIST_TEMPLATES.ROUTINE;
      const roomSpecific = ROOM_SPECIFIC_ITEMS[room.roomType] || [];
      const allItems = [...template, ...roomSpecific];

      for (const item of allItems) {
        await addChecklistItemMutation.mutateAsync({
          roomId: room.id,
          description: item,
        });
      }

      setGeneratedRooms(prev => new Set([...prev, room.id]));
      setSnackbar({ open: true, message: 'Checklist generated successfully', severity: 'success' });
    } catch (error) {
      console.error('Error generating checklist:', error);
      setSnackbar({ open: true, message: 'Failed to generate checklist', severity: 'error' });
    } finally {
      setGeneratingChecklists(prev => ({ ...prev, [room.id]: false }));
    }
  };

  // Debounced checklist item update
  const handleChecklistItemChange = useCallback((roomId, itemId, status, notes = '') => {
    const itemKey = itemId;

    // Optimistic update
    setLocalChecklistState(prev => ({
      ...prev,
      [itemKey]: { status, notes }
    }));

    // Mark as saving
    setSavingItems(prev => ({ ...prev, [itemKey]: true }));

    // Clear existing timer for this item
    if (debounceTimers.current[itemKey]) {
      clearTimeout(debounceTimers.current[itemKey]);
    }

    // Store the pending update
    pendingUpdates.current[itemKey] = { roomId, itemId, status, notes };

    // Set new debounced timer (500ms)
    debounceTimers.current[itemKey] = setTimeout(() => {
      const update = pendingUpdates.current[itemKey];
      if (update) {
        updateChecklistItemMutation.mutate(update, {
          onSuccess: () => {
            setSavingItems(prev => {
              const newState = { ...prev };
              delete newState[itemKey];
              return newState;
            });
            delete pendingUpdates.current[itemKey];
          },
          onError: (error) => {
            console.error('Failed to update checklist item:', error);
            setSavingItems(prev => {
              const newState = { ...prev };
              delete newState[itemKey];
              return newState;
            });
            setSnackbar({ open: true, message: 'Failed to save item status', severity: 'error' });
            // Revert optimistic update on error
            refetchRooms();
          }
        });
      }
    }, 500);
  }, [updateChecklistItemMutation, refetchRooms]);

  const validateStep = (step) => {
    switch (step) {
      case 1:
        // Must have at least 1 room before going to step 2
        if (!roomsData?.rooms || roomsData.rooms.length === 0) {
          setStepError('Please add at least one room before proceeding');
          return false;
        }
        break;
      case 2:
        // Must have checklist items before going to step 3
        const hasChecklistItems = roomsData?.rooms?.some(room =>
          room.checklistItems && room.checklistItems.length > 0
        );
        if (!hasChecklistItems) {
          setStepError('Please generate checklists for at least one room before proceeding');
          return false;
        }
        break;
    }
    setStepError('');
    return true;
  };

  const handleNext = () => {
    if (validateStep(activeStep + 1)) {
      setCompletedSteps(prev => new Set([...prev, activeStep]));
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    setStepError('');
    setActiveStep(activeStep - 1);
  };

  const handleStepClick = (step) => {
    // Allow clicking on completed steps or current step
    if (completedSteps.has(step) || step === activeStep) {
      setStepError('');
      setActiveStep(step);
    }
  };

  const handleAddIssue = () => {
    if (newIssue.title) {
      addIssueMutation.mutate(newIssue);
    }
  };

  const handleSignatureSave = (blob, dataURL) => {
    setSignatureBlob(blob);
    setSignaturePreview(dataURL);
  };

  const handlePhotoUpload = async (event, roomId = null, issueId = null) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('photos', file);

      const response = await apiClient.post('/uploads/inspection-photos', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      if (response.data.success && response.data.urls && response.data.urls.length > 0) {
        const url = response.data.urls[0];

        // Ensure progress remains at 100% after successful upload
        setUploadProgress(100);

        // Add photo to inspection
        await addPhotoMutation.mutateAsync({
          roomId,
          issueId,
          url,
          caption: photoCaption,
        });

        // Reset state
        setPhotoPreview(null);
        setPhotoCaption('');
      } else {
        throw new Error('Upload failed: No URL returned');
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      alert(error.response?.data?.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const generateFindings = () => {
    const allRooms = roomsData?.rooms || [];
    const allIssues = issuesData?.issues || [];

    let findings = `Inspection completed with ${allRooms.length} room(s) inspected.\n\n`;

    allRooms.forEach((room) => {
      findings += `${room.name}:\n`;
      const failedItems = room.checklistItems.filter((item) => item.status === 'FAILED');
      if (failedItems.length > 0) {
        findings += `  - ${failedItems.length} failed checklist item(s)\n`;
      }
    });

    if (allIssues.length > 0) {
      findings += `\nTotal Issues Found: ${allIssues.length}\n`;
      const highSeverity = allIssues.filter((i) => i.severity === 'HIGH' || i.severity === 'CRITICAL');
      if (highSeverity.length > 0) {
        findings += `  - ${highSeverity.length} high/critical severity issue(s)\n`;
      }
    }

    return findings;
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h5" gutterBottom>
              Ready to start inspection?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {inspection.title} - {inspection.type}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Property: {inspection.property?.name}
              {inspection.unit && ` - Unit ${inspection.unit.unitNumber}`}
            </Typography>
            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              This will mark the inspection as IN PROGRESS. You'll be able to add rooms, checklists, and
              document issues as you go through the property.
            </Alert>
            <Button
              variant="contained"
              size="large"
              onClick={handleStartInspection}
              disabled={startInspectionMutation.isLoading}
            >
              Start Inspection
            </Button>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
              <Typography variant="h6">Add Rooms to Inspect</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setRoomDialogOpen(true)}
              >
                Add Room
              </Button>
            </Stack>

            {roomsData?.rooms?.length === 0 ? (
              <Alert severity="info">
                No rooms added yet. Click "Add Room" to start adding rooms to inspect.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {roomsData?.rooms?.map((room) => (
                  <Grid item xs={12} sm={6} md={4} key={room.id}>
                    <Card>
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Typography variant="h6" gutterBottom>
                            {room.name}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleEditRoom(room)}
                            sx={{ mt: -0.5 }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                        <Chip
                          label={room.roomType || 'Not specified'}
                          size="small"
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {room.checklistItems?.length || 0} checklist items
                          {generatedRooms.has(room.id) && (
                            <Chip
                              label="Generated"
                              size="small"
                              color="success"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => handleGenerateChecklistClick(room)}
                          sx={{ mt: 1 }}
                          disabled={generatingChecklists[room.id] || generatedRooms.has(room.id)}
                          startIcon={generatingChecklists[room.id] ? <CircularProgress size={16} /> : null}
                        >
                          {generatingChecklists[room.id]
                            ? 'Generating...'
                            : generatedRooms.has(room.id)
                            ? 'Checklist Generated'
                            : 'Generate Checklist'}
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* Add/Edit Room Dialog */}
            <Dialog open={roomDialogOpen} onClose={handleCloseRoomDialog} maxWidth="sm" fullWidth>
              <DialogTitle>{editingRoom ? 'Edit Room' : 'Add Room'}</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <TextField
                    label="Room Name"
                    value={newRoom.name}
                    onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                    fullWidth
                    required
                  />
                  <TextField
                    select
                    label="Room Type"
                    value={newRoom.roomType}
                    onChange={(e) => setNewRoom({ ...newRoom, roomType: e.target.value })}
                    fullWidth
                  >
                    {ROOM_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type.replace('_', ' ')}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Notes"
                    value={newRoom.notes}
                    onChange={(e) => setNewRoom({ ...newRoom, notes: e.target.value })}
                    fullWidth
                    multiline
                    rows={2}
                  />
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseRoomDialog}>Cancel</Button>
                <Button onClick={handleAddRoom} variant="contained" disabled={!newRoom.name}>
                  {editingRoom ? 'Update Room' : 'Add Room'}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Confirm Regenerate Checklist Dialog */}
            <Dialog
              open={confirmDialog.open}
              onClose={() => setConfirmDialog({ open: false, room: null })}
              maxWidth="sm"
            >
              <DialogTitle>Regenerate Checklist?</DialogTitle>
              <DialogContent>
                <Typography>
                  This room already has {confirmDialog.room?.checklistItems?.length || 0} checklist items.
                  Generating a new checklist will add more items. Do you want to continue?
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirmDialog({ open: false, room: null })}>Cancel</Button>
                <Button onClick={handleConfirmGenerate} variant="contained" color="primary">
                  Continue
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
              <Typography variant="h6">Conduct Inspection</Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setIssueDialogOpen(true)}
              >
                Add Issue
              </Button>
            </Stack>

            {roomsData?.rooms?.map((room) => (
              <Card key={room.id} sx={{ mb: 3 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">{room.name}</Typography>
                    <Chip label={room.roomType || 'Not specified'} size="small" />
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Checklist Items:
                  </Typography>

                  {room.checklistItems?.length === 0 ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      No checklist items. Generate a checklist from the "Add Rooms" step.
                    </Alert>
                  ) : (
                    <List>
                      {room.checklistItems?.map((item) => {
                        const localState = localChecklistState[item.id] || { status: item.status, notes: item.notes };
                        const isSaving = savingItems[item.id];
                        return (
                          <ListItem key={item.id}>
                            <Box sx={{ width: '100%' }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2" sx={{ flex: 1 }}>
                                  {item.description}
                                  {isSaving && (
                                    <CircularProgress
                                      size={12}
                                      sx={{ ml: 1, verticalAlign: 'middle' }}
                                    />
                                  )}
                                </Typography>
                                <Button
                                  size="small"
                                  variant={localState.status === 'PASSED' ? 'contained' : 'outlined'}
                                  color="success"
                                  onClick={() =>
                                    handleChecklistItemChange(room.id, item.id, 'PASSED', localState.notes || '')
                                  }
                                >
                                  Pass
                                </Button>
                                <Button
                                  size="small"
                                  variant={localState.status === 'FAILED' ? 'contained' : 'outlined'}
                                  color="error"
                                  onClick={() =>
                                    handleChecklistItemChange(room.id, item.id, 'FAILED', localState.notes || '')
                                  }
                                >
                                  Fail
                                </Button>
                                <Button
                                  size="small"
                                  variant={localState.status === 'NA' ? 'contained' : 'outlined'}
                                  onClick={() =>
                                    handleChecklistItemChange(room.id, item.id, 'NA', localState.notes || '')
                                  }
                                >
                                  N/A
                                </Button>
                              </Stack>
                              {localState.status && (
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                                  <Chip
                                    label={localState.status}
                                    size="small"
                                    color={
                                      localState.status === 'PASSED'
                                        ? 'success'
                                        : localState.status === 'FAILED'
                                        ? 'error'
                                        : 'default'
                                    }
                                  />
                                  {isSaving && (
                                    <Typography variant="caption" color="text.secondary">
                                      Saving...
                                    </Typography>
                                  )}
                                </Stack>
                              )}
                            </Box>
                          </ListItem>
                        );
                      })}
                    </List>
                  )}

                  <Divider sx={{ my: 2 }} />

                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        id={`photo-upload-${room.id}`}
                        type="file"
                        onChange={(e) => handlePhotoUpload(e, room.id, null)}
                        disabled={isUploading}
                      />
                      <label htmlFor={`photo-upload-${room.id}`}>
                        <Button
                          component="span"
                          startIcon={isUploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                          size="small"
                          disabled={isUploading}
                        >
                          {isUploading ? 'Uploading...' : `Add Photo (${room.photos?.length || 0})`}
                        </Button>
                      </label>
                      {isUploading && (
                        <Typography variant="caption" color="text.secondary">
                          {uploadProgress}%
                        </Typography>
                      )}
                    </Stack>

                    {isUploading && (
                      <Box>
                        <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 1 }} />
                        {photoPreview && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <img
                              src={photoPreview}
                              alt="Upload preview"
                              style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              Uploading to cloud storage...
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}

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

            {/* Add Issue Dialog */}
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
                    <MenuItem value="">General (not room-specific)</MenuItem>
                    {roomsData?.rooms?.map((room) => (
                      <MenuItem key={room.id} value={room.id}>
                        {room.name}
                      </MenuItem>
                    ))}
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
                    <MenuItem value="LOW">Low</MenuItem>
                    <MenuItem value="MEDIUM">Medium</MenuItem>
                    <MenuItem value="HIGH">High</MenuItem>
                    <MenuItem value="CRITICAL">Critical</MenuItem>
                  </TextField>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddIssue} variant="contained">
                  Add Issue
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review & Complete Inspection
            </Typography>

            <Alert severity="success" sx={{ mb: 3 }}>
              Review all the data below and click "Complete Inspection" when ready.
            </Alert>

            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Summary:
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h3" color="primary">
                    {roomsData?.rooms?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Rooms Inspected
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h3" color="warning.main">
                    {issuesData?.issues?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Issues Found
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h3" color="info.main">
                    {roomsData?.rooms?.reduce((sum, r) => sum + (r.photos?.length || 0), 0) || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Photos Taken
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {issuesData?.issues?.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Issues Found:
                </Typography>
                <List>
                  {issuesData.issues.map((issue) => (
                    <ListItem key={issue.id}>
                      <ListItemText
                        primary={issue.title}
                        secondary={`${issue.room?.name || 'General'} - ${issue.severity}`}
                      />
                      <Chip
                        label={issue.severity}
                        size="small"
                        color={
                          issue.severity === 'CRITICAL' || issue.severity === 'HIGH'
                            ? 'error'
                            : issue.severity === 'MEDIUM'
                            ? 'warning'
                            : 'default'
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Tenant Signature - Only for MOVE_IN and MOVE_OUT inspections */}
            {signatureRequired && (
              <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 3 }} />
                {inspection.tenantSignature ? (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                      Tenant Signature
                    </Typography>
                    <Paper sx={{ p: 2, display: 'inline-block' }}>
                      <img
                        src={inspection.tenantSignature}
                        alt="Tenant Signature"
                        style={{ maxWidth: '300px', height: 'auto', border: '1px solid #ddd' }}
                      />
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        Signature captured
                      </Typography>
                    </Paper>
                  </Box>
                ) : signaturePreview ? (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                      Tenant Signature
                    </Typography>
                    <Paper sx={{ p: 2, display: 'inline-block' }}>
                      <img
                        src={signaturePreview}
                        alt="Tenant Signature Preview"
                        style={{ maxWidth: '300px', height: 'auto', border: '1px solid #ddd' }}
                      />
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        Signature ready to be saved
                      </Typography>
                    </Paper>
                  </Box>
                ) : (
                  <SignatureCapture onSave={handleSignatureSave} />
                )}
              </Box>
            )}

            <Box sx={{ mt: 4, textAlign: 'center' }}>
              {signatureRequired && !signaturePreview && !inspection.tenantSignature && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Please capture the tenant signature before completing the inspection.
                </Alert>
              )}
              <Button
                variant="contained"
                size="large"
                color="success"
                onClick={() => completeInspectionMutation.mutate()}
                disabled={
                  completeInspectionMutation.isLoading ||
                  (signatureRequired && !signaturePreview && !inspection.tenantSignature)
                }
              >
                {completeInspectionMutation.isLoading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Completing...
                  </>
                ) : (
                  'Complete Inspection'
                )}
              </Button>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label, index) => (
          <Step key={label} completed={completedSteps.has(index)}>
            <StepButton onClick={() => handleStepClick(index)} disabled={!completedSteps.has(index) && index !== activeStep}>
              {label}
            </StepButton>
          </Step>
        ))}
      </Stepper>

      {stepError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setStepError('')}>
          {stepError}
        </Alert>
      )}

      <Paper sx={{ p: 3, minHeight: 400 }}>{renderStepContent(activeStep)}</Paper>

      <Stack direction="row" spacing={2} sx={{ mt: 3 }} justifyContent="space-between">
        <Button onClick={handleCancelInspection} startIcon={<CancelIcon />}>
          Cancel
        </Button>
        <Stack direction="row" spacing={2}>
          {activeStep > 0 && activeStep < 3 && (
            <Button
              onClick={handleBack}
              startIcon={<ArrowBackIcon />}
            >
              Back
            </Button>
          )}
          {activeStep > 0 && activeStep < 3 && (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<ArrowForwardIcon />}
            >
              Next
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InspectionConductForm;
