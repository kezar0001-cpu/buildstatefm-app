import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  TextField,
  Alert,
  Divider,
  Grid,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Fab,
  useTheme,
  useMediaQuery,
  AppBar,
  Toolbar,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  Phone as PhoneIcon,
  Message as MessageIcon,
  History as HistoryIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Timer as TimerIcon,
  Directions as DirectionsIcon,
  CameraAlt as CameraIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import Breadcrumbs from '../components/Breadcrumbs';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { queryKeys } from '../utils/queryKeys.js';
import { canTransition } from '../constants/jobStatuses.js';
import {
  applyJobUpdateToQueries,
  restoreJobQueries,
  snapshotJobQueries,
} from '../utils/jobCache.js';
import ensureArray from '../utils/ensureArray';
import ServiceRequestPhotoUpload from '../components/ServiceRequestPhotoUpload';

const STATUS_OPTIONS = [
  { value: 'IN_PROGRESS', label: 'Start Job', color: 'warning' },
  { value: 'COMPLETED', label: 'Mark Complete', color: 'success' },
];

export default function TechnicianJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [notes, setNotes] = useState('');
  // Parts & Labor State
  const [parts, setParts] = useState([]);
  const [newPartName, setNewPartName] = useState('');
  const [newPartCost, setNewPartCost] = useState('');

  // Photo Evidence State
  const [evidencePhotos, setEvidencePhotos] = useState([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  // Fetch job details
  const { data: job, isLoading, error } = useQuery({
    queryKey: queryKeys.jobs.detail(id),
    queryFn: async () => {
      const response = await apiClient.get(`/jobs/${id}`);
      return response.data;
    },
  });

  // Fetch Job History for this Property
  const { data: jobHistoryData } = useQuery({
    queryKey: ['jobs', 'history', job?.propertyId],
    queryFn: async () => {
      if (!job?.propertyId) return { items: [] };
      const response = await apiClient.get(`/jobs?propertyId=${job.propertyId}&limit=5&status=COMPLETED`);
      return response.data;
    },
    enabled: !!job?.propertyId,
  });

  const jobHistory = ensureArray(jobHistoryData, ['items', 'data.items', 'jobs']).filter(j => j.id !== id);

  // Update job mutation
  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      const response = await apiClient.patch(`/jobs/${id}`, updates);
      return response.data;
    },
    onMutate: async (updates) => {
      setUpdateError('');
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
      const previousJobs = snapshotJobQueries(queryClient);
      const baseJob = job || { id };
      applyJobUpdateToQueries(queryClient, { ...baseJob, id, ...updates, updatedAt: new Date().toISOString() });
      return { previousJobs };
    },
    onSuccess: (updatedJob) => {
      const normalizedJob = updatedJob?.job || updatedJob;
      applyJobUpdateToQueries(queryClient, normalizedJob);
      setUpdateSuccess('Job updated successfully');
      setUpdateError('');
      setTimeout(() => setUpdateSuccess(''), 3000);
    },
    onError: (error, _variables, context) => {
      setUpdateError(error.response?.data?.message || 'Failed to update job');
      restoreJobQueries(queryClient, context?.previousJobs);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status) => {
      const response = await apiClient.patch(`/jobs/${id}/status`, { status });
      return response.data;
    },
    onMutate: async (status) => {
      setUpdateError('');
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
      const previousJobs = snapshotJobQueries(queryClient);
      const baseJob = job || { id };
      applyJobUpdateToQueries(queryClient, { ...baseJob, id, status, updatedAt: new Date().toISOString() });
      return { previousJobs };
    },
    onSuccess: (updatedJob) => {
      const normalizedJob = updatedJob?.job || updatedJob;
      applyJobUpdateToQueries(queryClient, normalizedJob);
      setUpdateSuccess('Status updated');
      setUpdateError('');
      setConfirmDialogOpen(false);
      setPendingStatus(null);
      setTimeout(() => setUpdateSuccess(''), 3000);
    },
    onError: (error, _variables, context) => {
      setUpdateError(error.response?.data?.message || 'Failed to update status');
      setConfirmDialogOpen(false);
      setPendingStatus(null);
      restoreJobQueries(queryClient, context?.previousJobs);
    },
  });

  // Photo Upload Mutation placeholder
  const uploadPhotosMutation = useMutation({
    mutationFn: async (photos) => {
      // In a real app, uses FormData to POST /jobs/:id/images
      // const formData = new FormData();
      // photos.forEach(p => formData.append('images', p.file));
      // await apiClient.post(`/jobs/${id}/images`, formData);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Mock delay
      return true;
    },
    onMutate: () => setIsUploadingPhotos(true),
    onSuccess: () => {
      setIsUploadingPhotos(false);
      setEvidencePhotos([]);
      setUpdateSuccess('Photos uploaded successfully');
      setTimeout(() => setUpdateSuccess(''), 3000);
    },
    onError: () => {
      setIsUploadingPhotos(false);
      setUpdateError('Failed to upload photos');
    }
  });

  const handleStatusChange = (newStatus) => {
    setPendingStatus(newStatus);
    setConfirmDialogOpen(true);
  };

  const handleConfirmStatusChange = () => {
    if (pendingStatus) statusMutation.mutate(pendingStatus);
  };

  const handleAddNotes = () => {
    if (!notes.trim()) return;
    const existingNotes = job?.notes || '';
    const timestamp = format(new Date(), 'MMM dd, HH:mm');
    const newNotes = existingNotes
      ? `${existingNotes}\n\n[${timestamp}]\n${notes}`
      : `[${timestamp}]\n${notes}`;
    updateMutation.mutate({ notes: newNotes });
    setNotes('');
  };

  const handleUploadPhotos = () => {
    if (evidencePhotos.length === 0) return;
    uploadPhotosMutation.mutate(evidencePhotos);
  };

  // Parts & Labor Logic
  const handleAddPart = () => {
    if (!newPartName || !newPartCost) return;
    const cost = parseFloat(newPartCost);
    if (isNaN(cost)) return;

    const newItem = { id: Date.now(), name: newPartName, cost };
    const updatedParts = [...parts, newItem];
    setParts(updatedParts);
    setNewPartName('');
    setNewPartCost('');

    // Auto-update actual cost
    const totalCost = updatedParts.reduce((sum, item) => sum + item.cost, 0);
    updateMutation.mutate({ actualCost: totalCost });
  };

  const handleDeletePart = (partId) => {
    const updatedParts = parts.filter(p => p.id !== partId);
    setParts(updatedParts);
    // Auto-update actual cost
    const totalCost = updatedParts.reduce((sum, item) => sum + item.cost, 0);
    updateMutation.mutate({ actualCost: totalCost });
  };

  const canUpdateStatus = (status) => canTransition(job?.status, status);

  const durationText = useMemo(() => {
    if (job?.status !== 'IN_PROGRESS' || !job?.updatedAt) return null;
    try {
      const start = parseISO(job.updatedAt);
      const mins = differenceInMinutes(new Date(), start);
      if (mins < 60) return `${mins}m`;
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    } catch { return null; }
  }, [job]);

  return (
    <Container maxWidth="lg" sx={{ py: 3, pb: isMobile ? 10 : 3 }}>
      <Breadcrumbs
        labelOverrides={{
          '/dashboard': { label: 'Technician Dashboard', to: '/technician/dashboard' },
          [`/technician/jobs/${id}`]: job?.title || 'Job Details',
        }}
      />

      {/* Smart Action Bar - Desktop Only */}
      {!isMobile && (
        <Paper elevation={3} sx={{ p: 2, mb: 3, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/technician/dashboard')}
            color="inherit"
          >
            Back
          </Button>

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<DirectionsIcon />} onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job?.property?.address || '')}`, '_blank')}>
              Navigate
            </Button>
            <Button variant="outlined" startIcon={<PhoneIcon />} href={`tel:${job?.property?.manager?.phoneNumber || ''}`} disabled={!job?.property?.manager?.phoneNumber}>
              Call Mgr
            </Button>
          </Stack>
        </Paper>
      )}

      <DataState data={job} isLoading={isLoading} error={error}>
        {job && (
          <Grid container spacing={3}>
            {/* Main Content */}
            <Grid item xs={12} md={8}>
              <Card sx={{ mb: 3, borderTop: `4px solid ${job.status === 'IN_PROGRESS' ? '#ed6c02' : '#1976d2'}` }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                    <Box>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                        <Chip label={job.status.replace('_', ' ')} color={job.status === 'IN_PROGRESS' ? 'warning' : 'primary'} />
                        {durationText && (
                          <Chip icon={<TimerIcon />} label={durationText} color="warning" variant="outlined" />
                        )}
                      </Stack>
                      <Typography variant="h4" fontWeight={700}>{job.title}</Typography>
                    </Box>
                  </Stack>

                  <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem' }}>
                    {job.description}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Stack direction="row" spacing={1}>
                        <LocationIcon color="action" />
                        <Box>
                          <Typography variant="subtitle2">Property</Typography>
                          <Typography variant="body2">{job.property?.name}</Typography>
                          <Typography variant="body2" color="text.secondary">{job.property?.address}</Typography>
                        </Box>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      {job.unit && (
                        <Stack direction="row" spacing={1}>
                          <HistoryIcon color="action" /> {/* Placeholder icon for Unit */}
                          <Box>
                            <Typography variant="subtitle2">Unit</Typography>
                            <Typography variant="body2">Unit {job.unit.unitNumber}</Typography>
                          </Box>
                        </Stack>
                      )}
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Photo Evidence Section */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6" display="flex" alignItems="center">
                      <CameraIcon sx={{ mr: 1 }} /> Job Evidence / Photos
                    </Typography>
                    {evidencePhotos.length > 0 && (
                      <Button
                        variant="contained"
                        startIcon={<CloudUploadIcon />}
                        disabled={isUploadingPhotos}
                        onClick={handleUploadPhotos}
                      >
                        {isUploadingPhotos ? 'Uploading...' : 'Upload Photos'}
                      </Button>
                    )}
                  </Stack>

                  <ServiceRequestPhotoUpload
                    photos={evidencePhotos}
                    onPhotosChange={setEvidencePhotos}
                    maxFiles={5}
                    uploading={isUploadingPhotos}
                  />
                </CardContent>
              </Card>

              {/* Job History Context */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" alignItems="center" display="flex" gutterBottom>
                    <HistoryIcon sx={{ mr: 1 }} /> Property Job History
                  </Typography>
                  {jobHistory.length > 0 ? (
                    <List dense>
                      {jobHistory.map(hJob => (
                        <ListItem key={hJob.id} divider>
                          <ListItemText
                            primary={hJob.title}
                            secondary={`${format(parseISO(hJob.updatedAt), 'MMM dd')} - ${hJob.assignedTo?.firstName || 'Tech'}`}
                          />
                          <Chip label="Done" size="small" variant="outlined" />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No recent job history found.</Typography>
                  )}
                </CardContent>
              </Card>

              {/* Existing Notes */}
              {job.notes && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Notes Log</Typography>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                      {job.notes}
                    </Paper>
                  </CardContent>
                </Card>
              )}
            </Grid>

            {/* Actions Sidebar - Desktop */}
            <Grid item xs={12} md={4}>
              <Stack spacing={3}>
                {/* Status Control - Hide on Mobile since we have sticky footer */}
                {!isMobile && (
                  <Card elevation={3}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Status</Typography>
                      {updateSuccess && <Alert severity="success" sx={{ mb: 2 }}>{updateSuccess}</Alert>}
                      {updateError && <Alert severity="error" sx={{ mb: 2 }}>{updateError}</Alert>}

                      <Stack spacing={2}>
                        {STATUS_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            variant="contained"
                            color={option.color}
                            fullWidth
                            size="large"
                            disabled={!canUpdateStatus(option.value) || statusMutation.isPending}
                            onClick={() => handleStatusChange(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {/* Parts & Labor Logging */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                      <MoneyIcon sx={{ mr: 1 }} /> Parts & Labor
                    </Typography>

                    {/* List of items */}
                    <List dense>
                      {parts.map(part => (
                        <ListItem key={part.id} secondaryAction={
                          <IconButton edge="end" size="small" onClick={() => handleDeletePart(part.id)}><DeleteIcon /></IconButton>
                        }>
                          <ListItemText primary={part.name} secondary={`$${part.cost.toFixed(2)}`} />
                        </ListItem>
                      ))}
                      {job.actualCost > 0 && parts.length === 0 && (
                        <ListItem>
                          <ListItemText primary="Previously logged total" secondary={`$${job.actualCost.toFixed(2)}`} />
                        </ListItem>
                      )}
                    </List>

                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle2" align="right" sx={{ mb: 2 }}>
                      Total: ${(parts.reduce((sum, p) => sum + p.cost, 0) + (parts.length === 0 ? (job.actualCost || 0) : 0)).toFixed(2)}
                    </Typography>

                    <Stack spacing={1}>
                      <TextField
                        placeholder="Item (e.g., Copper Pipe)"
                        size="small"
                        value={newPartName}
                        onChange={(e) => setNewPartName(e.target.value)}
                      />
                      <TextField
                        placeholder="Cost (0.00)"
                        size="small"
                        type="number"
                        value={newPartCost}
                        onChange={(e) => setNewPartCost(e.target.value)}
                        InputProps={{ startAdornment: <Typography color="text.secondary" sx={{ mr: 1 }}>$</Typography> }}
                      />
                      <Button startIcon={<AddIcon />} variant="outlined" onClick={handleAddPart} disabled={!newPartName || !newPartCost}>
                        Add Item
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Quick Note */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Add Note</Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      placeholder="Type a note..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <Button variant="contained" fullWidth disabled={!notes.trim()} onClick={handleAddNotes}>
                      Save Note
                    </Button>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        )}
      </DataState>

      {/* Mobile Sticky Footer */}
      {isMobile && job && (
        <AppBar position="fixed" color="default" sx={{ top: 'auto', bottom: 0, borderTop: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 1 }}>
            {job.status === 'ASSIGNED' ? (
              <Button
                variant="contained"
                color="warning"
                fullWidth
                size="large"
                disabled={statusMutation.isPending}
                onClick={() => handleStatusChange('IN_PROGRESS')}
              >
                Start Job
              </Button>
            ) : job.status === 'IN_PROGRESS' ? (
              <Button
                variant="contained"
                color="success"
                fullWidth
                size="large"
                disabled={statusMutation.isPending}
                onClick={() => handleStatusChange('COMPLETED')}
              >
                Mark Complete
              </Button>
            ) : (
              <Typography color="text.secondary" variant="body2" sx={{ mx: 'auto' }}>Job Completed</Typography>
            )}

            {/* Quick Nav Button in footer for mobile */}
            <IconButton color="primary" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job?.property?.address || '')}`, '_blank')}>
              <DirectionsIcon />
            </IconButton>
            <IconButton color="primary" href={`tel:${job?.property?.manager?.phoneNumber || ''}`} disabled={!job?.property?.manager?.phoneNumber}>
              <PhoneIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Update</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingStatus === 'IN_PROGRESS' ? 'Start this job now?' : 'Mark this job as complete?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmStatusChange} variant="contained" autoFocus>Confirm</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
