import React, { useState } from 'react';
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

  const completeInspectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inspections/${inspection.id}/complete`, {
        findings: generateFindings(),
      });
      return response.data;
    },
    onSuccess: () => {
      onComplete();
    },
  });

  const handleStartInspection = () => {
    startInspectionMutation.mutate();
  };

  const handleAddRoom = () => {
    if (newRoom.name) {
      addRoomMutation.mutate(newRoom);
    }
  };

  const handleGenerateChecklist = async (room) => {
    const template = CHECKLIST_TEMPLATES[inspection.type] || CHECKLIST_TEMPLATES.ROUTINE;
    const roomSpecific = ROOM_SPECIFIC_ITEMS[room.roomType] || [];
    const allItems = [...template, ...roomSpecific];

    for (const item of allItems) {
      await addChecklistItemMutation.mutateAsync({
        roomId: room.id,
        description: item,
      });
    }
  };

  const handleChecklistItemChange = (roomId, itemId, status, notes) => {
    updateChecklistItemMutation.mutate({ roomId, itemId, status, notes });
  };

  const handleAddIssue = () => {
    if (newIssue.title) {
      addIssueMutation.mutate(newIssue);
    }
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
      setUploadProgress(0);
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
                        <Typography variant="h6" gutterBottom>
                          {room.name}
                        </Typography>
                        <Chip
                          label={room.roomType || 'Not specified'}
                          size="small"
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {room.checklistItems?.length || 0} checklist items
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => handleGenerateChecklist(room)}
                          sx={{ mt: 1 }}
                        >
                          Generate Checklist
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* Add Room Dialog */}
            <Dialog open={roomDialogOpen} onClose={() => setRoomDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Add Room</DialogTitle>
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
                <Button onClick={() => setRoomDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddRoom} variant="contained">
                  Add Room
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
                      {room.checklistItems?.map((item) => (
                        <ListItem key={item.id}>
                          <Box sx={{ width: '100%' }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" sx={{ flex: 1 }}>
                                {item.description}
                              </Typography>
                              <Button
                                size="small"
                                variant={item.status === 'PASSED' ? 'contained' : 'outlined'}
                                color="success"
                                onClick={() =>
                                  handleChecklistItemChange(room.id, item.id, 'PASSED', item.notes)
                                }
                              >
                                Pass
                              </Button>
                              <Button
                                size="small"
                                variant={item.status === 'FAILED' ? 'contained' : 'outlined'}
                                color="error"
                                onClick={() =>
                                  handleChecklistItemChange(room.id, item.id, 'FAILED', item.notes)
                                }
                              >
                                Fail
                              </Button>
                              <Button
                                size="small"
                                variant={item.status === 'NA' ? 'contained' : 'outlined'}
                                onClick={() =>
                                  handleChecklistItemChange(room.id, item.id, 'NA', item.notes)
                                }
                              >
                                N/A
                              </Button>
                            </Stack>
                            {item.status && (
                              <Chip
                                label={item.status}
                                size="small"
                                color={
                                  item.status === 'PASSED'
                                    ? 'success'
                                    : item.status === 'FAILED'
                                    ? 'error'
                                    : 'default'
                                }
                                sx={{ mt: 1 }}
                              />
                            )}
                          </Box>
                        </ListItem>
                      ))}
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

            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Button
                variant="contained"
                size="large"
                color="success"
                onClick={() => completeInspectionMutation.mutate()}
                disabled={completeInspectionMutation.isLoading}
              >
                Complete Inspection
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
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper sx={{ p: 3, minHeight: 400 }}>{renderStepContent(activeStep)}</Paper>

      <Stack direction="row" spacing={2} sx={{ mt: 3 }} justifyContent="space-between">
        <Button onClick={onCancel} startIcon={<CancelIcon />}>
          Cancel
        </Button>
        <Stack direction="row" spacing={2}>
          {activeStep > 0 && activeStep < 3 && (
            <Button
              onClick={() => setActiveStep(activeStep - 1)}
              startIcon={<ArrowBackIcon />}
            >
              Back
            </Button>
          )}
          {activeStep > 0 && activeStep < 3 && (
            <Button
              variant="contained"
              onClick={() => setActiveStep(activeStep + 1)}
              endIcon={<ArrowForwardIcon />}
            >
              Next
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

export default InspectionConductForm;
