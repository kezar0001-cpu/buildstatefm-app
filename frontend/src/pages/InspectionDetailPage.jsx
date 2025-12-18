import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fab,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  InputAdornment,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AddTask as AddTaskIcon,
  ArrowBack as ArrowBackIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  ChevronRight as ChevronRightIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  Home as HomeIcon,
  Lightbulb as LightbulbIcon,
  LocationOn as LocationIcon,
  Work as WorkIcon,
  MoreVert as MoreVertIcon,
  NotificationsActive as NotificationsActiveIcon,
  Person as PersonIcon,
  Photo as PhotoIcon,
  PlayArrow as PlayArrowIcon,
  Cancel as CancelIcon,
  ReportProblem as ReportProblemIcon,
  Room as RoomIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import Breadcrumbs from '../components/Breadcrumbs';
import InspectionForm from '../components/InspectionForm';
import { CompleteInspectionDialog } from '../components/CompleteInspectionDialog';
import { InspectionPhotoGalleryModal } from '../components/InspectionPhotoGalleryModal';
import SkeletonDetail from '../components/SkeletonDetail';
import RecommendationWizard from '../components/RecommendationWizard';
import { formatPropertyAddressLine } from '../utils/formatPropertyLocation';
import { formatDateTime, formatDate } from '../utils/date';
import { STATUS_COLOR, TYPE_COLOR } from '../constants/inspections';
import { useCurrentUser } from '../context/UserContext';
import { queryKeys } from '../utils/queryKeys.js';
import logger from '../utils/logger';

const SEVERITY_CONFIG = {
  CRITICAL: { color: 'error', label: 'Critical', icon: <ReportProblemIcon fontSize="small" /> },
  HIGH: { color: 'error', label: 'High', icon: <WarningIcon fontSize="small" /> },
  MEDIUM: { color: 'warning', label: 'Medium', icon: <WarningIcon fontSize="small" /> },
  LOW: { color: 'info', label: 'Low', icon: null },
};

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
 * Get the effective priority/severity for an issue or checklist item
 */
function getIssuePriority(item) {
  if (item.severity && SEVERITY_CONFIG[item.severity]) {
    return item.severity;
  }
  return parsePriorityFromNotes(item.notes);
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`inspection-tabpanel-${index}`}
      aria-labelledby={`inspection-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function StatusBadge({ status }) {
  const statusConfig = {
    SCHEDULED: { color: 'info', label: 'Scheduled' },
    IN_PROGRESS: { color: 'warning', label: 'In Progress' },
    PENDING_APPROVAL: { color: 'secondary', label: 'Pending Approval' },
    COMPLETED: { color: 'success', label: 'Completed' },
    CANCELLED: { color: 'default', label: 'Cancelled' },
  };

  const config = statusConfig[status] || { color: 'default', label: status };

  return (
    <Chip
      label={config.label}
      color={config.color}
      size="small"
      sx={{ fontWeight: 600 }}
    />
  );
}

function MetricCard({ icon, label, value, color = 'primary', onClick }) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2,
        textAlign: 'center',
        bgcolor: `${color}.lighter`,
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 2,
        } : {},
      }}
    >
      <Box sx={{ color: `${color}.main`, mb: 1 }}>{icon}</Box>
      <Typography
        variant="h4"
        fontWeight={700}
        color={`${color}.main`}
        sx={{ fontSize: { xs: 28, sm: 34, md: 40 } }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

function IssueCard({ issue, isMobile, onClick, onConvertToJob, onConvertToRecommendation, canManage, isConverting }) {
  const severityConfig = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.MEDIUM;
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleConvertToJob = () => {
    handleMenuClose();
    onConvertToJob?.(issue);
  };

  const handleConvertToRecommendation = () => {
    handleMenuClose();
    onConvertToRecommendation?.(issue);
  };

  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.2s',
        '&:hover': onClick ? { bgcolor: 'action.hover' } : {},
      }}
    >
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Avatar
          sx={{
            bgcolor: `${severityConfig.color}.lighter`,
            color: `${severityConfig.color}.main`,
            width: 40,
            height: 40,
          }}
        >
          {severityConfig.icon || <ReportProblemIcon fontSize="small" />}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
              {issue.title}
            </Typography>
            <Chip
              label={severityConfig.label}
              color={severityConfig.color}
              size="small"
              variant="outlined"
            />
            {canManage && (
              <>
                <IconButton
                  size="small"
                  onClick={handleMenuClick}
                  disabled={isConverting}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={menuOpen}
                  onClose={handleMenuClose}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MenuItem onClick={handleConvertToJob}>
                    <ListItemIcon>
                      <WorkIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Convert to Job</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={handleConvertToRecommendation}>
                    <ListItemIcon>
                      <LightbulbIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Convert to Recommendation</ListItemText>
                  </MenuItem>
                </Menu>
              </>
            )}
          </Stack>
          {issue.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {issue.description}
            </Typography>
          )}
          {issue.room && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
              <RoomIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {issue.room.name}
              </Typography>
            </Stack>
          )}
          {issue.photos?.length > 0 && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
              <PhotoIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {issue.photos.length} photo{issue.photos.length !== 1 ? 's' : ''}
              </Typography>
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

function RoomCard({ room, isMobile, expanded, onToggle }) {
  const checklistItems = room.checklistItems || [];
  const completedItems = checklistItems.filter(
    (item) => item.status === 'PASSED' || item.status === 'FAILED' || item.status === 'NA'
  ).length;
  const progress = checklistItems.length > 0 ? (completedItems / checklistItems.length) * 100 : 0;
  const photos = room.photos || [];

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box
        onClick={onToggle}
        sx={{
          p: 2,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Avatar sx={{ bgcolor: 'primary.lighter', color: 'primary.main' }}>
          <RoomIcon />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {room.name}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {completedItems}/{checklistItems.length} items
            </Typography>
            {photos.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {photos.length} photo{photos.length !== 1 ? 's' : ''}
              </Typography>
            )}
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              mt: 1,
              height: 4,
              borderRadius: 2,
              bgcolor: 'action.hover',
            }}
          />
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2 }}>
          {checklistItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No checklist items
            </Typography>
          ) : (
            <List dense disablePadding>
              {checklistItems.map((item) => (
                <ListItem key={item.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {item.status === 'PASSED' ? (
                      <CheckCircleIcon fontSize="small" color="success" />
                    ) : item.status === 'FAILED' ? (
                      <ReportProblemIcon fontSize="small" color="error" />
                    ) : (
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: 'action.disabled',
                        }}
                      />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.description}
                    secondary={item.notes}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
          {photos.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Photos
              </Typography>
              <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
                {photos.slice(0, 4).map((photo, idx) => (
                  <CardMedia
                    key={photo.id || idx}
                    component="img"
                    image={photo.url || photo.imageUrl}
                    alt={photo.caption || `Photo ${idx + 1}`}
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 1,
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ))}
                {photos.length > 4 && (
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      +{photos.length - 4}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function InspectionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const [activeTab, setActiveTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [photoGalleryOpen, setPhotoGalleryOpen] = useState(false);
  const [recommendationWizardOpen, setRecommendationWizardOpen] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState({});

  const [estimateCostDialogOpen, setEstimateCostDialogOpen] = useState(false);
  const [estimateCostDialogMode, setEstimateCostDialogMode] = useState('single');
  const [estimateCostIssue, setEstimateCostIssue] = useState(null);
  const [estimateCostIssues, setEstimateCostIssues] = useState([]);
  const [estimateCostInput, setEstimateCostInput] = useState('');

  const [completeData, setCompleteData] = useState({
    findings: '',
    notes: '',
    tags: [],
    autoCreateJobs: true,
    confirmJobCreation: false,
  });
  const [previewJobs, setPreviewJobs] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    remindAt: '',
    recipients: [],
    note: '',
    channel: 'IN_APP',
  });
  const [jobForm, setJobForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assignedToId: '',
    scheduledDate: '',
  });

  const isTechnician = user?.role === 'TECHNICIAN';
  const canManage = useMemo(
    () => user?.role === 'PROPERTY_MANAGER' || user?.role === 'TECHNICIAN' || user?.role === 'ADMIN',
    [user?.role]
  );

  const canEdit = useMemo(
    () => user?.role === 'PROPERTY_MANAGER' || user?.role === 'ADMIN',
    [user?.role]
  );

  const {
    data: batchedData,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.inspections.batchedDetail(id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${id}/batch`);
      return response.data;
    },
    staleTime: 30 * 1000,
  });

  const inspection = batchedData?.inspection;
  const auditData = batchedData?.auditLogs || [];
  const inspectorOptions = batchedData?.inspectors || [];

  const normalizedInspection = useMemo(() => {
    if (!inspection) return null;

    const rooms = (inspection.rooms || inspection.InspectionRoom || []).map((room) => ({
      ...room,
      checklistItems: room.checklistItems || room.InspectionChecklistItem || [],
      photos: room.photos || room.InspectionPhoto || [],
    }));

    const rawIssues = (inspection.issues || inspection.InspectionIssue || []).map((issue) => ({
      ...issue,
      room: issue.room || issue.InspectionRoom || null,
      photos: issue.photos || issue.InspectionPhoto || [],
    }));

    let issues = rawIssues;

    if (!issues || issues.length === 0) {
      const derivedIssues = [];

      rooms.forEach((room) => {
        const checklistItems = room.checklistItems || [];
        const roomPhotos = room.photos || [];

        checklistItems.forEach((item) => {
          const linkedPhotos = roomPhotos.filter((photo) =>
            typeof photo.caption === 'string' ? photo.caption.includes(item.id) : false
          );

          // Parse priority from notes field
          const priority = getIssuePriority(item);

          derivedIssues.push({
            id: item.id,
            title: item.description,
            description: item.notes,
            severity: priority,
            status: item.status,
            room: { id: room.id, name: room.name },
            photos: linkedPhotos,
          });
        });
      });

      issues = derivedIssues;
    }

    const attachments = inspection.attachments || inspection.InspectionAttachment || [];

    return {
      ...inspection,
      rooms,
      issues,
      attachments,
    };
  }, [inspection]);

  const metrics = useMemo(() => {
    if (!normalizedInspection) return { rooms: 0, issues: 0, photos: 0, progress: 0 };

    const rooms = normalizedInspection.rooms || [];
    const issues = normalizedInspection.issues || [];
    const roomPhotos = rooms.flatMap((r) => r.photos || []);
    const issuePhotos = issues.flatMap((i) => i.photos || []);
    const attachments = normalizedInspection.attachments || [];

    const allChecklistItems = rooms.flatMap((r) => r.checklistItems || []);
    const completedItems = allChecklistItems.filter(
      (item) => item.status === 'PASSED' || item.status === 'FAILED' || item.status === 'NA'
    ).length;
    let progress =
      allChecklistItems.length > 0
        ? Math.round((completedItems / allChecklistItems.length) * 100)
        : 0;

    // Once an inspection is marked COMPLETED, we always show 100% complete,
    // regardless of the underlying checklist math. This better reflects the
    // workflow where completion is an explicit action.
    if (normalizedInspection.status === 'COMPLETED') {
      progress = 100;
    }

    return {
      rooms: rooms.length,
      issues: issues.length,
      photos: roomPhotos.length + issuePhotos.length + attachments.length,
      progress,
      criticalIssues: issues.filter((i) => {
        const priority = i.severity || getIssuePriority(i);
        return priority === 'CRITICAL' || priority === 'HIGH';
      }).length,
    };
  }, [normalizedInspection]);

  const previewMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post(`/inspections/${id}/complete`, {
        ...payload,
        previewOnly: true,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setPreviewJobs(data.followUpJobs || []);
      setShowPreview(true);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post(`/inspections/${id}/complete`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() });
      setCompleteDialogOpen(false);
      setPreviewJobs([]);
      setShowPreview(false);
    },
  });

  const reminderMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post(`/inspections/${id}/reminders`, payload);
      return response.data;
    },
    onSuccess: () => {
      setReminderDialogOpen(false);
      setReminderForm({ remindAt: '', recipients: [], note: '', channel: 'IN_APP' });
    },
  });

  const jobMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post(`/inspections/${id}/jobs`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(id) });
      setJobDialogOpen(false);
      setJobForm({
        title: '',
        description: '',
        priority: 'MEDIUM',
        assignedToId: '',
        scheduledDate: '',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.patch(`/inspections/${id}`, { status: 'CANCELLED' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() });
      navigate('/inspections');
    },
  });

  const convertToJobMutation = useMutation({
    mutationFn: async (issue) => {
      const response = await apiClient.post('/jobs', {
        title: issue.title,
        description: issue.description || `Issue from inspection: ${issue.title}`,
        priority: issue.severity || 'MEDIUM',
        propertyId: inspection?.propertyId,
        unitId: inspection?.unitId,
        inspectionId: id,
        status: 'OPEN',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.batchedDetail(id) });
      toast.success('Issue converted to job successfully');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to convert issue to job');
    },
  });

  const convertToRecommendationMutation = useMutation({
    mutationFn: async ({ issue, estimatedCost }) => {
      const response = await apiClient.post('/recommendations', {
        title: issue.title,
        description: issue.description || `Issue from inspection: ${issue.title}`,
        priority: issue.severity || 'MEDIUM',
        propertyId: inspection?.propertyId,
        inspectionId: id,
        estimatedCost,
        status: 'SUBMITTED',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.batchedDetail(id) });
      toast.success('Issue converted to recommendation successfully');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to convert issue to recommendation');
    },
  });

  const convertAllToRecommendationsMutation = useMutation({
    mutationFn: async ({ issues, estimatedCost }) => {
      const promises = issues.map((issue) =>
        apiClient.post('/recommendations', {
          title: issue.title,
          description: issue.description || `Issue from inspection: ${issue.title}`,
          priority: issue.severity || 'MEDIUM',
          propertyId: inspection?.propertyId,
          inspectionId: id,
          estimatedCost,
          status: 'SUBMITTED',
        })
      );
      return Promise.all(promises);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.batchedDetail(id) });
      toast.success(`${data.length} issue(s) converted to recommendations`);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to convert issues to recommendations');
    },
  });

  const handleConvertIssueToJob = (issue) => {
    convertToJobMutation.mutate(issue);
  };

  const handleConvertIssueToRecommendation = (issue) => {
    setEstimateCostDialogMode('single');
    setEstimateCostIssue(issue);
    setEstimateCostIssues([]);
    setEstimateCostInput('');
    setEstimateCostDialogOpen(true);
  };

  const handleConvertAllToRecommendations = () => {
    const issues = normalizedInspection?.issues || [];
    if (issues.length > 0) {
      setEstimateCostDialogMode('bulk');
      setEstimateCostIssue(null);
      setEstimateCostIssues(issues);
      setEstimateCostInput('');
      setEstimateCostDialogOpen(true);
    }
  };

  const handleCloseEstimateCostDialog = () => {
    setEstimateCostDialogOpen(false);
    setEstimateCostIssue(null);
    setEstimateCostIssues([]);
    setEstimateCostInput('');
  };

  const handleConfirmEstimateCostDialog = () => {
    const raw = String(estimateCostInput || '').trim();
    const estimatedCost = raw ? Number(raw) : undefined;

    if (raw && (Number.isNaN(estimatedCost) || estimatedCost < 0)) {
      toast.error('Estimated cost must be a valid positive number');
      return;
    }

    if (estimateCostDialogMode === 'bulk') {
      convertAllToRecommendationsMutation.mutate({ issues: estimateCostIssues, estimatedCost });
      handleCloseEstimateCostDialog();
      return;
    }

    if (estimateCostIssue) {
      convertToRecommendationMutation.mutate({ issue: estimateCostIssue, estimatedCost });
    }
    handleCloseEstimateCostDialog();
  };

  const handlePreviewJobs = () => {
    previewMutation.mutate({
      findings: completeData.findings,
      notes: completeData.notes,
      tags: completeData.tags,
    });
  };

  const handleCompleteSubmit = () => {
    completeMutation.mutate({
      findings: completeData.findings,
      notes: completeData.notes,
      tags: completeData.tags,
      autoCreateJobs: completeData.autoCreateJobs,
    });
  };

  const handleReminderSubmit = () => {
    reminderMutation.mutate({
      remindAt: reminderForm.remindAt,
      recipients: reminderForm.recipients,
      channel: reminderForm.channel,
      note: reminderForm.note,
    });
  };

  const handleJobSubmit = () => {
    jobMutation.mutate({
      title: jobForm.title,
      description: jobForm.description,
      priority: jobForm.priority,
      assignedToId: jobForm.assignedToId || undefined,
      scheduledDate: jobForm.scheduledDate
        ? new Date(jobForm.scheduledDate).toISOString()
        : undefined,
    });
  };

  const toggleRoomExpanded = (roomId) => {
    setExpandedRooms((prev) => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <SkeletonDetail variant="default" showTabs={true} showActions={true} />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <DataState
          type="error"
          message="Failed to load inspection"
          action={{ label: 'Back to inspections', onClick: () => navigate('/inspections') }}
        />
      </Container>
    );
  }

  if (!inspection) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <DataState
          type="empty"
          message="Inspection not found"
          action={{ label: 'Back to inspections', onClick: () => navigate('/inspections') }}
        />
      </Container>
    );
  }

  const canComplete =
    canManage && inspection.status !== 'COMPLETED' && inspection.status !== 'CANCELLED';

  const canCancel =
    canEdit &&
    (inspection.status === 'SCHEDULED' || inspection.status === 'IN_PROGRESS');
  const propertyId = normalizedInspection?.property?.id || normalizedInspection?.propertyId || null;
  const rooms = normalizedInspection?.rooms || [];
  const issues = normalizedInspection?.issues || [];

  return (
    <Box sx={{ pb: isMobile ? (isSmall ? 16 : 10) : 4 }}>
      <Container maxWidth="lg" sx={{ pt: isMobile ? 2 : 4 }}>
        {!isMobile && (
          <Breadcrumbs
            labelOverrides={{
              [`/inspections/${id}`]: inspection.title || 'Inspection Details',
            }}
            extraCrumbs={
              propertyId
                ? [
                    {
                      label: inspection.property?.name || 'Property Details',
                      to: `/properties/${propertyId}`,
                      after: '/inspections',
                    },
                  ]
                : []
            }
          />
        )}

        {/* Hero Section */}
        <Paper
          elevation={isMobile ? 0 : 1}
          sx={{
            p: isMobile ? 2 : 3,
            mb: 3,
            borderRadius: isMobile ? 0 : 2,
            mx: isMobile ? -2 : 0,
            bgcolor: 'background.paper',
          }}
        >
          <Stack
            direction={isMobile ? 'column' : 'row'}
            spacing={2}
            alignItems={isMobile ? 'stretch' : 'flex-start'}
          >
            {/* Back button and title */}
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <IconButton
                  onClick={() => navigate('/inspections')}
                  size="small"
                  sx={{ ml: -1 }}
                >
                  <ArrowBackIcon />
                </IconButton>
                <StatusBadge status={inspection.status} />
                <Chip
                  label={inspection.type}
                  size="small"
                  variant="outlined"
                  color={TYPE_COLOR[inspection.type] || 'default'}
                />
              </Stack>

              <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={700} sx={{ mb: 1 }}>
                {inspection.title}
              </Typography>

              <Stack
                direction={isMobile ? 'column' : 'row'}
                spacing={isMobile ? 1 : 3}
                sx={{ color: 'text.secondary' }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CalendarIcon fontSize="small" />
                  <Typography variant="body2">
                    {formatDateTime(inspection.scheduledDate)}
                  </Typography>
                </Stack>
                {inspection.property && (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/properties/${propertyId}`)}
                  >
                    <HomeIcon fontSize="small" />
                    <Typography variant="body2">{inspection.property.name}</Typography>
                    <ChevronRightIcon fontSize="small" />
                  </Stack>
                )}
                {inspection.assignedTo && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <PersonIcon fontSize="small" />
                    <Typography variant="body2">
                      {inspection.assignedTo.firstName} {inspection.assignedTo.lastName}
                    </Typography>
                  </Stack>
                )}
              </Stack>

              {isMobile && (
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PhotoIcon />}
                    onClick={() => setPhotoGalleryOpen(true)}
                  >
                    Photos ({metrics.photos})
                  </Button>
                  {inspection.status === 'COMPLETED' && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<DescriptionIcon />}
                      onClick={() => navigate(`/inspections/${id}/report`)}
                    >
                      View Report
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => setEditDialogOpen(true)}
                    >
                      Edit
                    </Button>
                  )}
                </Stack>
              )}
            </Box>

            {/* Desktop Actions */}
            {!isMobile && (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PhotoIcon />}
                  onClick={() => setPhotoGalleryOpen(true)}
                >
                  Photos ({metrics.photos})
                </Button>
                {inspection.status === 'COMPLETED' && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<DescriptionIcon />}
                    onClick={() => navigate(`/inspections/${id}/report`)}
                  >
                    View Report
                  </Button>
                )}
                {canManage && (
                  <>
                    {canEdit && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => setEditDialogOpen(true)}
                      >
                        Edit
                      </Button>
                    )}
                    {(inspection.status === 'SCHEDULED' ||
                      inspection.status === 'IN_PROGRESS') && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => navigate(`/inspections/${id}/conduct`)}
                      >
                        {inspection.status === 'IN_PROGRESS' ? 'Continue' : 'Start'}
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => cancelMutation.mutate()}
                        disabled={cancelMutation.isPending}
                      >
                        {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Inspection'}
                      </Button>
                    )}
                    {canComplete && (
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => {
                          setCompleteData({
                            findings: inspection.findings || '',
                            notes: inspection.notes || '',
                            tags: inspection.tags || [],
                            autoCreateJobs: true,
                            confirmJobCreation: false,
                          });
                          setPreviewJobs([]);
                          setShowPreview(false);
                          setCompleteDialogOpen(true);
                        }}
                      >
                        Complete
                      </Button>
                    )}
                  </>
                )}
              </Stack>
            )}
          </Stack>

          {/* Progress bar for in-progress inspections */}
          {inspection.status === 'IN_PROGRESS' && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="caption" fontWeight={600}>
                  {metrics.progress}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={metrics.progress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
          )}
        </Paper>

        {/* Metrics Grid */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <MetricCard
              icon={<RoomIcon />}
              label="Rooms"
              value={metrics.rooms}
              color="primary"
              onClick={() => setActiveTab(1)}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <MetricCard
              icon={<ReportProblemIcon />}
              label="Issues"
              value={metrics.issues}
              color={metrics.criticalIssues > 0 ? 'error' : 'warning'}
              onClick={() => setActiveTab(2)}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <MetricCard
              icon={<PhotoIcon />}
              label="Photos"
              value={metrics.photos}
              color="info"
              onClick={() => setPhotoGalleryOpen(true)}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <MetricCard
              icon={<AssignmentIcon />}
              label="Complete"
              value={`${metrics.progress}%`}
              color={metrics.progress === 100 ? 'success' : 'primary'}
            />
          </Grid>
        </Grid>

        {/* Critical Issues Alert */}
        {metrics.criticalIssues > 0 && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={
              <Button color="inherit" size="small" onClick={() => setActiveTab(2)}>
                View Issues
              </Button>
            }
          >
            {metrics.criticalIssues} critical/high severity issue
            {metrics.criticalIssues !== 1 ? 's' : ''} found during inspection
          </Alert>
        )}

        {/* Tabs */}
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant={isSmall ? 'scrollable' : isMobile ? 'fullWidth' : 'standard'}
            scrollButtons={isSmall ? 'auto' : false}
            allowScrollButtonsMobile
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            <Tab label="Overview" />
            <Tab label={`Rooms (${metrics.rooms})`} />
            <Tab label={`Issues (${metrics.issues})`} />
            <Tab label="Activity" />
          </Tabs>

          <Box sx={{ p: isMobile ? 2 : 3 }}>
            {/* Overview Tab */}
            <TabPanel value={activeTab} index={0}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Details
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">
                            Property
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ cursor: propertyId ? 'pointer' : 'default' }}
                            onClick={() => propertyId && navigate(`/properties/${propertyId}`)}
                          >
                            <Typography variant="body1">
                              {inspection.property?.name || '—'}
                            </Typography>
                            {propertyId && <ChevronRightIcon fontSize="small" color="action" />}
                          </Stack>
                          {inspection.property && (
                            <Typography variant="caption" color="text.secondary">
                              {formatPropertyAddressLine(inspection.property)}
                            </Typography>
                          )}
                        </Grid>
                        {inspection.unit && (
                          <Grid item xs={12} sm={6}>
                            <Typography variant="caption" color="text.secondary">
                              Unit
                            </Typography>
                            <Typography variant="body1">
                              Unit {inspection.unit.unitNumber}
                            </Typography>
                          </Grid>
                        )}
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">
                            Assigned Inspector
                          </Typography>
                          <Typography variant="body1">
                            {inspection.assignedTo
                              ? `${inspection.assignedTo.firstName} ${inspection.assignedTo.lastName}`
                              : 'Unassigned'}
                          </Typography>
                        </Grid>
                        {inspection.completedBy && (
                          <Grid item xs={12} sm={6}>
                            <Typography variant="caption" color="text.secondary">
                              Completed By
                            </Typography>
                            <Typography variant="body1">
                              {inspection.completedBy.firstName} {inspection.completedBy.lastName}
                            </Typography>
                          </Grid>
                        )}
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">
                            Notes
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{ whiteSpace: 'pre-wrap' }}
                          >
                            {inspection.notes || '—'}
                          </Typography>
                        </Grid>
                        {inspection.findings && (
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              Findings
                            </Typography>
                            <Typography
                              variant="body1"
                              sx={{ whiteSpace: 'pre-wrap' }}
                            >
                              {inspection.findings}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>

                  {/* Tags */}
                  {inspection.tags?.length > 0 && (
                    <Card variant="outlined" sx={{ mb: 3 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Tags
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {inspection.tags.map((tag) => (
                            <Chip key={tag} label={tag} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  )}
                </Grid>

                <Grid item xs={12} md={4}>
                  {/* Quick Actions */}
                  <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Quick Actions
                      </Typography>
                      <Stack spacing={1.5}>
                        {canManage && metrics.issues > 0 && (
                          <Button
                            variant="contained"
                            fullWidth
                            startIcon={<LightbulbIcon />}
                            onClick={() => setRecommendationWizardOpen(true)}
                          >
                            Create Recommendations
                          </Button>
                        )}
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<PhotoIcon />}
                          onClick={() => setPhotoGalleryOpen(true)}
                        >
                          View Photo Gallery
                        </Button>
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<LightbulbIcon />}
                          onClick={() => navigate('/recommendations')}
                        >
                          All Recommendations
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>

                  {/* Linked Jobs */}
                  {inspection.jobs?.length > 0 && (
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Linked Jobs
                        </Typography>
                        <Stack spacing={1}>
                          {inspection.jobs.map((job) => (
                            <Paper
                              key={job.id}
                              variant="outlined"
                              sx={{
                                p: 1.5,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                              onClick={() => navigate(`/jobs/${job.id}`)}
                            >
                              <Typography variant="subtitle2">{job.title}</Typography>
                              <Chip label={job.status} size="small" sx={{ mt: 0.5 }} />
                            </Paper>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  )}
                </Grid>
              </Grid>
            </TabPanel>

            {/* Rooms Tab */}
            <TabPanel value={activeTab} index={1}>
              {rooms.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <RoomIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No rooms added yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Start the inspection to add rooms and checklist items.
                  </Typography>
                  {canManage &&
                    (inspection.status === 'SCHEDULED' ||
                      inspection.status === 'IN_PROGRESS') && (
                      <Button
                        variant="contained"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => navigate(`/inspections/${id}/conduct`)}
                      >
                        {inspection.status === 'IN_PROGRESS' ? 'Continue Inspection' : 'Start Inspection'}
                      </Button>
                    )}
                </Box>
              ) : (
                <Stack spacing={2}>
                  {rooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      isMobile={isMobile}
                      expanded={expandedRooms[room.id]}
                      onToggle={() => toggleRoomExpanded(room.id)}
                    />
                  ))}
                </Stack>
              )}
            </TabPanel>

            {/* Issues Tab */}
            <TabPanel value={activeTab} index={2}>
              {issues.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No issues found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Great! No issues were recorded during this inspection.
                  </Typography>
                </Box>
              ) : (
                <>
                  {canManage && (
                    <Alert
                      severity="info"
                      sx={{ mb: 2 }}
                      action={
                        <Stack direction={isSmall ? 'column' : 'row'} spacing={1} sx={{ width: isSmall ? '100%' : 'auto' }}>
                          <Button
                            color="inherit"
                            size="small"
                            onClick={handleConvertAllToRecommendations}
                            disabled={convertAllToRecommendationsMutation.isPending}
                            startIcon={<LightbulbIcon />}
                            fullWidth={isSmall}
                          >
                            {convertAllToRecommendationsMutation.isPending
                              ? 'Converting...'
                              : 'Convert All to Recommendations'}
                          </Button>
                        </Stack>
                      }
                    >
                      {issues.length} issue{issues.length !== 1 ? 's' : ''} found. Convert individually or all at once to recommendations for property owner review.
                    </Alert>
                  )}
                  <Stack spacing={2}>
                    {issues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        isMobile={isMobile}
                        canManage={canManage}
                        onConvertToJob={handleConvertIssueToJob}
                        onConvertToRecommendation={handleConvertIssueToRecommendation}
                        isConverting={convertToJobMutation.isPending || convertToRecommendationMutation.isPending}
                      />
                    ))}
                  </Stack>
                </>
              )}
            </TabPanel>

            {/* Activity Tab */}
            <TabPanel value={activeTab} index={3}>
              {auditData.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <HistoryIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No activity yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Activity will appear here as changes are made.
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {auditData.map((log, index) => (
                    <React.Fragment key={log.id}>
                      <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.lighter', color: 'primary.main' }}>
                            {log.user?.firstName?.[0] || '?'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="subtitle2">
                                {log.action.replace(/_/g, ' ')}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDateTime(log.createdAt)}
                              </Typography>
                            </Stack>
                          }
                          secondary={
                            log.user
                              ? `${log.user.firstName} ${log.user.lastName}`
                              : 'System'
                          }
                        />
                      </ListItem>
                      {index < auditData.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </TabPanel>
          </Box>
        </Paper>
      </Container>

      {/* Mobile Floating Action Bar */}
      {isMobile && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            p: 2,
            borderRadius: 0,
            zIndex: 1100,
          }}
        >
          <Stack direction={isSmall ? 'column' : 'row'} spacing={1}>
            {(inspection.status === 'SCHEDULED' || inspection.status === 'IN_PROGRESS') &&
              canManage && (
                <>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<PlayArrowIcon />}
                    onClick={() => navigate(`/inspections/${id}/conduct`)}
                    sx={{ flex: 2 }}
                  >
                    {inspection.status === 'IN_PROGRESS' ? 'Continue' : 'Start'}
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<CancelIcon />}
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    sx={{ flex: 2 }}
                  >
                    {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
                  </Button>
                </>
              )}
            {inspection.status === 'COMPLETED' && (
              <Button
                variant="contained"
                fullWidth
                startIcon={<DescriptionIcon />}
                onClick={() => navigate(`/inspections/${id}/report`)}
                sx={{ flex: 2 }}
              >
                View Report
              </Button>
            )}
            <Stack direction="row" spacing={1} justifyContent={isSmall ? 'flex-end' : 'flex-start'}>
              <IconButton
                onClick={() => setPhotoGalleryOpen(true)}
                sx={{ bgcolor: 'action.hover' }}
              >
                <PhotoIcon />
              </IconButton>
              {canManage && (
                <IconButton
                  onClick={() => setEditDialogOpen(true)}
                  sx={{ bgcolor: 'action.hover' }}
                >
                  <EditIcon />
                </IconButton>
              )}
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Dialogs */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <InspectionForm
          inspection={inspection}
          onSuccess={() => {
            queryClient.invalidateQueries(['inspection', id]);
            queryClient.invalidateQueries(['inspections']);
            setEditDialogOpen(false);
          }}
          onCancel={() => setEditDialogOpen(false)}
        />
      </Dialog>

      <CompleteInspectionDialog
        open={completeDialogOpen}
        onClose={() => {
          setCompleteDialogOpen(false);
          setShowPreview(false);
          setPreviewJobs([]);
          setCompleteData({
            findings: '',
            notes: '',
            tags: [],
            autoCreateJobs: true,
            confirmJobCreation: false,
          });
        }}
        inspection={inspection}
        onSubmit={handleCompleteSubmit}
        isLoading={completeMutation.isPending || previewMutation.isPending}
        previewJobs={previewJobs}
        onPreviewJobs={handlePreviewJobs}
        initialFormData={completeData}
      />

      <Dialog
        open={reminderDialogOpen}
        onClose={() => setReminderDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Schedule Reminder</DialogTitle>
        <DialogContent dividers>
          {reminderMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to create reminder. Please try again.
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              label="Reminder time"
              type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={reminderForm.remindAt}
              onChange={(e) =>
                setReminderForm((prev) => ({ ...prev, remindAt: e.target.value }))
              }
              fullWidth
            />
            <TextField
              select
              label="Delivery channel"
              value={reminderForm.channel}
              onChange={(e) =>
                setReminderForm((prev) => ({ ...prev, channel: e.target.value }))
              }
            >
              <MenuItem value="IN_APP">In-app notification</MenuItem>
              <MenuItem value="EMAIL">Email</MenuItem>
            </TextField>
            <TextField
              select
              label="Recipients"
              SelectProps={{
                multiple: true,
                renderValue: (selected) =>
                  selected.length ? `${selected.length} selected` : 'None',
              }}
              value={reminderForm.recipients}
              onChange={(e) =>
                setReminderForm((prev) => ({
                  ...prev,
                  recipients:
                    typeof e.target.value === 'string'
                      ? e.target.value.split(',')
                      : e.target.value,
                }))
              }
            >
              {inspectorOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.firstName} {option.lastName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Message"
              multiline
              minRows={2}
              value={reminderForm.note}
              onChange={(e) =>
                setReminderForm((prev) => ({ ...prev, note: e.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: isMobile ? 2 : undefined }}>
          <Button onClick={() => setReminderDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<NotificationsActiveIcon />}
            onClick={handleReminderSubmit}
            disabled={reminderMutation.isPending}
          >
            Schedule
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={jobDialogOpen}
        onClose={() => setJobDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Create Follow-up Job</DialogTitle>
        <DialogContent dividers>
          {jobMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to create job. Please check the details and try again.
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              label="Job title"
              value={jobForm.title}
              onChange={(e) => setJobForm((prev) => ({ ...prev, title: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Description"
              multiline
              minRows={3}
              value={jobForm.description}
              onChange={(e) =>
                setJobForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />
            <TextField
              select
              label="Priority"
              value={jobForm.priority}
              onChange={(e) =>
                setJobForm((prev) => ({ ...prev, priority: e.target.value }))
              }
            >
              {PRIORITY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Assign to"
              value={jobForm.assignedToId}
              onChange={(e) =>
                setJobForm((prev) => ({ ...prev, assignedToId: e.target.value }))
              }
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {inspectorOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.firstName} {option.lastName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Scheduled date"
              type="date"
              value={jobForm.scheduledDate}
              onChange={(e) =>
                setJobForm((prev) => ({ ...prev, scheduledDate: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: isMobile ? 2 : undefined }}>
          <Button onClick={() => setJobDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<AddTaskIcon />}
            onClick={handleJobSubmit}
          >
            Create Job
          </Button>
        </DialogActions>
      </Dialog>

      <RecommendationWizard
        open={recommendationWizardOpen}
        onClose={() => setRecommendationWizardOpen(false)}
        initialPropertyId={propertyId}
        initialInspectionId={inspection.id}
      />

      <Dialog
        open={estimateCostDialogOpen}
        onClose={handleCloseEstimateCostDialog}
        maxWidth="xs"
        fullWidth
        fullScreen={isSmall}
      >
        <DialogTitle>Estimated repair cost</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Enter an estimated cost for the repair so it can be included on the recommendation.
            </Typography>
            <TextField
              label="Estimated cost"
              value={estimateCostInput}
              onChange={(e) => setEstimateCostInput(e.target.value)}
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              placeholder="Optional"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: isSmall ? 2 : undefined }}>
          <Button onClick={handleCloseEstimateCostDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmEstimateCostDialog}
            disabled={convertToRecommendationMutation.isPending || convertAllToRecommendationsMutation.isPending}
          >
            Convert
          </Button>
        </DialogActions>
      </Dialog>

      <InspectionPhotoGalleryModal
        open={photoGalleryOpen}
        onClose={() => setPhotoGalleryOpen(false)}
        inspection={inspection}
        roomPhotos={rooms.flatMap((room) =>
          (room.photos || []).map((photo) => ({
            ...photo,
            roomName: room.name,
          }))
        )}
        issuePhotos={issues.flatMap((issue) =>
          (issue.photos || []).map((photo) => ({
            ...photo,
            issueTitle: issue.title,
            issueDescription: issue.description,
          }))
        )}
        attachments={inspection.attachments || []}
      />
    </Box>
  );
}
