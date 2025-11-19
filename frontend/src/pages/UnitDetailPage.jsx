import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Stack,
  Card,
  CardContent,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Home as HomeIcon,
  Bed as BedIcon,
  Bathtub as BathtubIcon,
  SquareFoot as AreaIcon,
  AttachMoney as MoneyIcon,
  PersonAdd as PersonAddIcon,
  Person as PersonIcon,
  Delete as DeleteIcon,
  CalendarToday as CalendarIcon,
  Work as WorkIcon,
  Assignment as InspectionIcon,
  ArrowBackIos,
  ArrowForwardIos,
  Close as CloseIcon,
  BuildCircle as ServiceIcon,
  Schedule as ScheduleIcon,
  MailOutline as MailOutlineIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import UnitForm from '../components/UnitForm';
import TenantAssignmentDialog from '../components/TenantAssignmentDialog';
import InviteTenantDialog from '../components/InviteTenantDialog';
import { formatDate, formatDateTime } from '../utils/date';
import toast from 'react-hot-toast';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';
import Breadcrumbs from '../components/Breadcrumbs';

import MoveInWizard from '../components/MoveInWizard';
import MoveOutWizard from '../components/MoveOutWizard';

const getStatusColor = (status) => {
  const colors = {
    AVAILABLE: 'success',
    OCCUPIED: 'primary',
    MAINTENANCE: 'warning',
    PENDING_MOVE_IN: 'info',
    PENDING_MOVE_OUT: 'info',
    VACANT: 'default',
  };
  return colors[status] || 'default';
};

export default function UnitDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [inviteTenantDialogOpen, setInviteTenantDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [moveInWizardOpen, setMoveInWizardOpen] = useState(false);
  const [moveOutWizardOpen, setMoveOutWizardOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Fetch unit details
  const unitQuery = useQuery({
    queryKey: queryKeys.units.detail(id),
    queryFn: async () => {
      const response = await apiClient.get(`/units/${id}`);
      return response.data?.unit || response.data;
    },
  });

  // Fetch unit tenants
  const tenantsQuery = useQuery({
    queryKey: queryKeys.units.tenants(id),
    queryFn: async () => {
      const response = await apiClient.get(`/units/${id}/tenants`);
      return response.data?.tenants || [];
    },
  });

  // Fetch unit jobs
  const jobsQuery = useQuery({
    queryKey: queryKeys.units.jobs(id),
    queryFn: async () => {
      const response = await apiClient.get(`/jobs?unitId=${id}`);
      return ensureArray(response.data, ['items', 'data.items', 'jobs']);
    },
  });

  // Fetch unit inspections
  const inspectionsQuery = useQuery({
    queryKey: queryKeys.units.inspections(id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections?unitId=${id}`);
      return ensureArray(response.data, ['items', 'data.items', 'inspections']);
    },
  });

  // Fetch unit activity
  const activityQuery = useQuery({
    queryKey: ['units', id, 'activity'],
    queryFn: async () => {
      const response = await apiClient.get(`/units/${id}/activity?limit=20`);
      return response.data?.activities || [];
    },
  });

  // Fetch unit images
  const unitImagesQuery = useQuery({
    queryKey: ['units', id, 'images'],
    queryFn: async () => {
      const response = await apiClient.get(`/units/${id}/images`);
      return response.data?.images || [];
    },
  });

  // Remove tenant mutation
  const removeTenantMutation = useMutation({
    mutationFn: async (tenantId) => {
      const response = await apiClient.delete(`/units/${id}/tenants/${tenantId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.tenants(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.units.detail(id) });
      toast.success('Tenant removed successfully');
      setConfirmRemoveOpen(false);
      setSelectedTenant(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to remove tenant');
    },
  });

  const unit = unitQuery.data;
  const tenants = tenantsQuery.data || [];
  const activeTenant = tenants.find((t) => t.isActive);
  const jobs = jobsQuery.data || [];
  const inspections = inspectionsQuery.data || [];
  const activities = activityQuery.data || [];
  const unitImages = unitImagesQuery.data || [];
  const unitCarouselImages = unitImages.length
    ? unitImages
    : unit?.imageUrl
      ? [{ imageUrl: unit.imageUrl, caption: null, isPrimary: true }]
      : [];

  // Lightbox handlers
  const handleOpenLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
  };

  const handleLightboxPrev = () => {
    setLightboxIndex((prev) => (prev - 1 + unitCarouselImages.length) % unitCarouselImages.length);
  };

  const handleLightboxNext = () => {
    setLightboxIndex((prev) => (prev + 1) % unitCarouselImages.length);
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseLightbox();
      } else if (e.key === 'ArrowLeft') {
        handleLightboxPrev();
      } else if (e.key === 'ArrowRight') {
        handleLightboxNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, unitCarouselImages.length]);

  const propertyPath = unit?.propertyId
    ? `/properties/${unit.propertyId}`
    : unit?.property?.id
      ? `/properties/${unit.property.id}`
      : null;
  const breadcrumbOverrides = {
    '/units': { label: 'Properties', to: '/properties' },
    [`/units/${id}`]: unit?.unitNumber ? `Unit ${unit.unitNumber}` : 'Unit Details',
  };
  const breadcrumbExtras = unit?.property && propertyPath
    ? [
        {
          label: unit.property.name,
          to: propertyPath,
          after: '/properties',
        },
      ]
    : [];

  const handleBack = () => {
    if (unit?.propertyId) {
      navigate(`/properties/${unit.propertyId}`);
    } else {
      navigate('/properties');
    }
  };

  const handleEditUnit = () => {
    setEditDialogOpen(true);
  };

  const handleAssignTenant = () => {
    setSelectedTenant(null);
    setAssignDialogOpen(true);
  };

  const handleInviteTenant = () => {
    setInviteTenantDialogOpen(true);
  };

  const handleEditTenant = (tenant) => {
    setSelectedTenant(tenant);
    setAssignDialogOpen(true);
  };

  const handleRemoveTenant = (tenant) => {
    setSelectedTenant(tenant);
    setConfirmRemoveOpen(true);
  };

  const confirmRemove = () => {
    if (selectedTenant) {
      removeTenantMutation.mutate(selectedTenant.tenantId);
    }
  };

  const isLoading = unitQuery.isLoading || tenantsQuery.isLoading;
  const error = unitQuery.error || tenantsQuery.error;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <DataState
        isLoading={isLoading}
        error={error}
        isEmpty={!unit}
        emptyMessage="Unit not found"
      >
        {unit && (
          <>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
              <Breadcrumbs
                labelOverrides={breadcrumbOverrides}
                extraCrumbs={breadcrumbExtras}
              />
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                sx={{ mb: 2 }}
              >
                Back to Property
              </Button>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="h4" gutterBottom>
                    Unit {unit.unitNumber}
                  </Typography>
                  {unit.property && (
                    <Typography variant="body1" color="text.secondary">
                      {unit.property.name}
                      {unit.property.address && ` • ${unit.property.address}`}
                    </Typography>
                  )}
                </Box>

                <Stack direction="row" spacing={1}>
                  <Chip
                    label={unit.status?.replace('_', ' ')}
                    color={getStatusColor(unit.status)}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={handleEditUnit}
                  >
                    Edit Unit
                  </Button>
                  {unit.status === 'AVAILABLE' && (
                    <Button
                      variant="contained"
                      onClick={() => setMoveInWizardOpen(true)}
                    >
                      Move In
                    </Button>
                  )}
                  {unit.status === 'OCCUPIED' && (
                    <Button
                      variant="contained"
                      onClick={() => setMoveOutWizardOpen(true)}
                    >
                      Move Out
                    </Button>
                  )}
                </Stack>
              </Box>
            </Box>

            <Grid container spacing={3}>
              {/* Unit Information */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Unit Information
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Stack spacing={2}>
                      {unit.bedrooms !== null && unit.bedrooms !== undefined && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BedIcon color="action" />
                          <Typography>
                            {unit.bedrooms} {unit.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}
                          </Typography>
                        </Box>
                      )}

                      {unit.bathrooms !== null && unit.bathrooms !== undefined && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BathtubIcon color="action" />
                          <Typography>
                            {unit.bathrooms} {unit.bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}
                          </Typography>
                        </Box>
                      )}

                      {unit.area && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AreaIcon color="action" />
                          <Typography>{unit.area} sq ft</Typography>
                        </Box>
                      )}

                      {unit.rentAmount && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MoneyIcon color="action" />
                          <Typography>${unit.rentAmount.toLocaleString()}/month</Typography>
                        </Box>
                      )}

                      {unit.floor !== null && unit.floor !== undefined && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <HomeIcon color="action" />
                          <Typography>Floor {unit.floor}</Typography>
                        </Box>
                      )}

                      {unit.description && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Description
                          </Typography>
                          <Typography variant="body2">{unit.description}</Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Current Tenant */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 2,
                      }}
                    >
                      <Typography variant="h6">Current Tenant</Typography>
                      {!activeTenant && (
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="outlined"
                            startIcon={<MailOutlineIcon />}
                            onClick={handleInviteTenant}
                            size="small"
                          >
                            Invite Tenant
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<PersonAddIcon />}
                            onClick={handleAssignTenant}
                            size="small"
                          >
                            Assign Tenant
                          </Button>
                        </Stack>
                      )}
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    {activeTenant ? (
                      <Box>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            mb: 2,
                          }}
                        >
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            <PersonIcon />
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {activeTenant.tenant?.firstName} {activeTenant.tenant?.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {activeTenant.tenant?.email}
                            </Typography>
                          </Box>
                        </Box>

                        <Stack spacing={1.5}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Lease Period
                            </Typography>
                            <Typography variant="body2">
                              {formatDate(activeTenant.leaseStart)} - {formatDate(activeTenant.leaseEnd)}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Monthly Rent
                            </Typography>
                            <Typography variant="body2">
                              ${activeTenant.rentAmount?.toLocaleString()}
                            </Typography>
                          </Box>

                          {activeTenant.depositAmount && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Security Deposit
                              </Typography>
                              <Typography variant="body2">
                                ${activeTenant.depositAmount.toLocaleString()}
                              </Typography>
                            </Box>
                          )}
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => handleEditTenant(activeTenant)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => handleRemoveTenant(activeTenant)}
                          >
                            Remove
                          </Button>
                        </Stack>
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 3 }}>
                        <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography color="text.secondary" gutterBottom>
                          No tenant assigned to this unit
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: 'center' }}>
                          <Button
                            variant="outlined"
                            startIcon={<MailOutlineIcon />}
                            onClick={handleInviteTenant}
                          >
                            Invite Tenant
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<PersonAddIcon />}
                            onClick={handleAssignTenant}
                          >
                            Assign Tenant
                          </Button>
                        </Stack>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Unit Image Gallery - Modern Split Layout */}
              <Grid item xs={12}>
                {unitCarouselImages.length > 0 ? (
                  <Box>
                    {/* Desktop: Split layout (large left + 2x2 grid right) */}
                    {/* Mobile: Stacked layout */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: unitCarouselImages.length === 1
                          ? '1fr'
                          : { xs: '1fr', md: '2fr 1fr' },
                        gap: 1,
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Main Large Image */}
                      <Paper
                        sx={{
                          position: 'relative',
                          paddingTop: { xs: '56.25%', md: '66.67%' }, // 16:9 mobile, 3:2 desktop
                          overflow: 'hidden',
                          cursor: 'pointer',
                          borderRadius: { xs: 3, md: 0 },
                          transition: 'transform 0.3s ease',
                          '&:hover': {
                            transform: 'scale(1.01)',
                            '& img': {
                              filter: 'brightness(1.05)',
                            },
                          },
                        }}
                        onClick={() => handleOpenLightbox(0)}
                        elevation={0}
                      >
                        <Box
                          component="img"
                          src={typeof unitCarouselImages[0] === 'string' ? unitCarouselImages[0] : unitCarouselImages[0].imageUrl}
                          alt={typeof unitCarouselImages[0] === 'object' && unitCarouselImages[0].caption ? unitCarouselImages[0].caption : `Unit ${unit.unitNumber} main image`}
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'filter 0.3s ease',
                          }}
                        />
                        <Chip
                          label="Primary"
                          size="small"
                          color="primary"
                          sx={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                            zIndex: 2,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}
                        />
                      </Paper>

                      {/* 2x2 Grid of Thumbnails (desktop only) */}
                      {unitCarouselImages.length > 1 && (
                        <Box
                          sx={{
                            display: { xs: 'none', md: 'grid' },
                            gridTemplateColumns: '1fr 1fr',
                            gridTemplateRows: '1fr 1fr',
                            gap: 1,
                          }}
                        >
                          {unitCarouselImages.slice(1, 5).map((image, idx) => {
                            const imageUrl = typeof image === 'string' ? image : image.imageUrl;
                            const caption = typeof image === 'object' ? image.caption : null;
                            const actualIndex = idx + 1;

                            return (
                              <Paper
                                key={image.id || actualIndex}
                                sx={{
                                  position: 'relative',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  borderRadius: 0,
                                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                  '&:hover': {
                                    transform: 'scale(1.05)',
                                    boxShadow: 4,
                                    zIndex: 1,
                                    '& img': {
                                      filter: 'brightness(1.1)',
                                    },
                                  },
                                }}
                                onClick={() => handleOpenLightbox(actualIndex)}
                                elevation={0}
                              >
                                <Box
                                  component="img"
                                  src={imageUrl}
                                  alt={caption || `Unit ${unit.unitNumber} image ${actualIndex + 1}`}
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transition: 'filter 0.2s ease',
                                  }}
                                />
                              </Paper>
                            );
                          })}

                          {/* "+N more" tile - shown in last position if there are more than 5 images */}
                          {unitCarouselImages.length > 5 && (
                            <Paper
                              sx={{
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                borderRadius: 0,
                                bgcolor: 'rgba(0,0,0,0.75)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s ease',
                                '&:hover': {
                                  bgcolor: 'rgba(0,0,0,0.85)',
                                },
                                ...(unitCarouselImages.length > 5 && unitCarouselImages[4] && {
                                  backgroundImage: `url(${typeof unitCarouselImages[4] === 'string' ? unitCarouselImages[4] : unitCarouselImages[4].imageUrl})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  '&::before': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(0,0,0,0.6)',
                                    zIndex: 1,
                                  },
                                }),
                              }}
                              onClick={() => handleOpenLightbox(4)}
                              elevation={0}
                            >
                              <Typography
                                variant="h5"
                                sx={{
                                  color: 'white',
                                  fontWeight: 700,
                                  zIndex: 2,
                                  position: 'relative',
                                }}
                              >
                                +{unitCarouselImages.length - 4}
                              </Typography>
                            </Paper>
                          )}
                        </Box>
                      )}
                    </Box>

                    {/* Mobile: Horizontal scroll gallery for additional images */}
                    {unitCarouselImages.length > 1 && (
                      <Box
                        sx={{
                          display: { xs: 'flex', md: 'none' },
                          gap: 1,
                          overflowX: 'auto',
                          mt: 1,
                          pb: 1,
                          '&::-webkit-scrollbar': {
                            height: 6,
                          },
                          '&::-webkit-scrollbar-thumb': {
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            borderRadius: 3,
                          },
                        }}
                      >
                        {unitCarouselImages.slice(1).map((image, idx) => {
                          const imageUrl = typeof image === 'string' ? image : image.imageUrl;
                          const caption = typeof image === 'object' ? image.caption : null;
                          const actualIndex = idx + 1;

                          return (
                            <Paper
                              key={image.id || actualIndex}
                              sx={{
                                position: 'relative',
                                minWidth: 100,
                                height: 80,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                borderRadius: 2,
                                '&:hover': {
                                  boxShadow: 3,
                                },
                              }}
                              onClick={() => handleOpenLightbox(actualIndex)}
                            >
                              <Box
                                component="img"
                                src={imageUrl}
                                alt={caption || `Unit ${unit.unitNumber} image ${actualIndex + 1}`}
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            </Paper>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Paper
                    sx={{
                      height: { xs: 220, sm: 280, md: 350 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.100',
                      borderRadius: 3,
                      color: 'grey.400',
                    }}
                  >
                    <HomeIcon sx={{ fontSize: { xs: 72, md: 100 } }} />
                  </Paper>
                )}
              </Grid>

              {/* Jobs and Inspections Tabs */}
              <Grid item xs={12}>
                <Paper>
                  <Tabs
                    value={currentTab}
                    onChange={(e, newValue) => setCurrentTab(newValue)}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Tab label="Overview" />
                    <Tab label={`Jobs (${jobs.length})`} icon={<WorkIcon />} iconPosition="start" />
                    <Tab
                      label={`Inspections (${inspections.length})`}
                      icon={<InspectionIcon />}
                      iconPosition="start"
                    />
                  </Tabs>

                  <Box sx={{ p: 3 }}>
                    {/* Overview Tab */}
                    {currentTab === 0 && (
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          Recent Activity
                        </Typography>
                        <DataState
                          isLoading={activityQuery.isLoading}
                          error={activityQuery.error}
                          isEmpty={activities.length === 0}
                          emptyMessage="No recent activity for this unit"
                        >
                          <List>
                            {activities.map((activity) => {
                              let icon;
                              let activityColor = 'default';

                              switch (activity.type) {
                                case 'job':
                                  icon = <WorkIcon />;
                                  activityColor = 'primary';
                                  break;
                                case 'inspection':
                                  icon = <InspectionIcon />;
                                  activityColor = 'success';
                                  break;
                                case 'service_request':
                                  icon = <ServiceIcon />;
                                  activityColor = 'warning';
                                  break;
                                case 'tenant_assignment':
                                  icon = <PersonIcon />;
                                  activityColor = 'info';
                                  break;
                                default:
                                  icon = <ScheduleIcon />;
                              }

                              return (
                                <ListItem
                                  key={`${activity.type}-${activity.id}`}
                                  sx={{
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    mb: 1,
                                    cursor: activity.type !== 'tenant_assignment' ? 'pointer' : 'default',
                                    '&:hover': activity.type !== 'tenant_assignment' ? { bgcolor: 'action.hover' } : {},
                                  }}
                                  onClick={() => {
                                    if (activity.type === 'job') {
                                      navigate(`/jobs?jobId=${activity.id}`);
                                    } else if (activity.type === 'inspection') {
                                      navigate(`/inspections/${activity.id}`);
                                    } else if (activity.type === 'service_request') {
                                      // Service requests don't have a detail page yet, so we don't navigate
                                    }
                                  }}
                                >
                                  <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: `${activityColor}.main` }}>
                                      {icon}
                                    </Avatar>
                                  </ListItemAvatar>
                                  <ListItemText
                                    primary={activity.title}
                                    secondary={
                                      <>
                                        <Typography variant="body2" color="text.secondary">
                                          {activity.description}
                                        </Typography>
                                        <Box sx={{ mt: 0.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                                          <Chip
                                            label={activity.status}
                                            size="small"
                                            color={
                                              activity.status === 'COMPLETED' || activity.status === 'ACTIVE'
                                                ? 'success'
                                                : activity.status === 'IN_PROGRESS'
                                                ? 'primary'
                                                : activity.status === 'PENDING'
                                                ? 'warning'
                                                : 'default'
                                            }
                                          />
                                          {activity.priority && (
                                            <Chip
                                              label={activity.priority}
                                              size="small"
                                              color={
                                                activity.priority === 'URGENT'
                                                  ? 'error'
                                                  : activity.priority === 'HIGH'
                                                  ? 'warning'
                                                  : 'default'
                                              }
                                            />
                                          )}
                                          <Typography variant="caption" color="text.secondary">
                                            {formatDateTime(activity.date)}
                                          </Typography>
                                        </Box>
                                      </>
                                    }
                                  />
                                </ListItem>
                              );
                            })}
                          </List>
                        </DataState>
                      </Box>
                    )}

                    {/* Jobs Tab */}
                    {currentTab === 1 && (
                      <Box>
                        <DataState
                          isLoading={jobsQuery.isLoading}
                          error={jobsQuery.error}
                          isEmpty={jobs.length === 0}
                          emptyMessage="No jobs for this unit"
                        >
                          <List>
                            {jobs.map((job) => (
                              <ListItem
                                key={job.id}
                                sx={{
                                  border: 1,
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  mb: 1,
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: 'action.hover' },
                                }}
                                onClick={() => navigate(`/jobs?jobId=${job.id}`)}
                              >
                                <ListItemAvatar>
                                  <Avatar>
                                    <WorkIcon />
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={job.title}
                                  secondary={
                                    <>
                                      {job.description && (
                                        <Typography variant="body2" color="text.secondary">
                                          {job.description}
                                        </Typography>
                                      )}
                                      <Box sx={{ mt: 0.5 }}>
                                        <Chip
                                          label={job.status}
                                          size="small"
                                          sx={{ mr: 1 }}
                                        />
                                        <Chip
                                          label={job.priority}
                                          size="small"
                                          color={
                                            job.priority === 'URGENT'
                                              ? 'error'
                                              : job.priority === 'HIGH'
                                              ? 'warning'
                                              : 'default'
                                          }
                                        />
                                      </Box>
                                    </>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        </DataState>
                      </Box>
                    )}

                    {/* Inspections Tab */}
                    {currentTab === 2 && (
                      <Box>
                        <DataState
                          isLoading={inspectionsQuery.isLoading}
                          error={inspectionsQuery.error}
                          isEmpty={inspections.length === 0}
                          emptyMessage="No inspections for this unit"
                        >
                          <List>
                            {inspections.map((inspection) => (
                              <ListItem
                                key={inspection.id}
                                sx={{
                                  border: 1,
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  mb: 1,
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: 'action.hover' },
                                }}
                                onClick={() => navigate(`/inspections/${inspection.id}`)}
                              >
                                <ListItemAvatar>
                                  <Avatar>
                                    <InspectionIcon />
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={inspection.title}
                                  secondary={
                                    <>
                                      <Typography variant="body2" color="text.secondary">
                                        {formatDateTime(inspection.scheduledDate)}
                                      </Typography>
                                      <Box sx={{ mt: 0.5 }}>
                                        <Chip
                                          label={inspection.status}
                                          size="small"
                                          sx={{ mr: 1 }}
                                        />
                                        <Chip
                                          label={inspection.type}
                                          size="small"
                                        />
                                      </Box>
                                    </>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        </DataState>
                      </Box>
                    )}
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            {/* Edit Unit Dialog */}
            <UnitForm
              key={unit.id}
              open={editDialogOpen}
              onClose={() => setEditDialogOpen(false)}
              propertyId={unit.propertyId}
              unit={unit}
              onSuccess={() => {
                setEditDialogOpen(false);
                unitQuery.refetch();
              }}
            />

            {/* Tenant Assignment Dialog */}
            <TenantAssignmentDialog
              open={assignDialogOpen}
              onClose={() => {
                setAssignDialogOpen(false);
                setSelectedTenant(null);
              }}
              unitId={id}
              tenant={selectedTenant}
            />

            {/* Invite Tenant Dialog */}
            <InviteTenantDialog
              open={inviteTenantDialogOpen}
              onClose={() => setInviteTenantDialogOpen(false)}
              unitId={id}
              unitNumber={unit?.unitNumber}
            />

            {/* Confirm Remove Dialog */}
            <Dialog
              open={confirmRemoveOpen}
              onClose={() => setConfirmRemoveOpen(false)}
            >
              <DialogTitle>Remove Tenant</DialogTitle>
              <DialogContent>
                <Typography>
                  Are you sure you want to remove{' '}
                  <strong>
                    {selectedTenant?.tenant?.firstName} {selectedTenant?.tenant?.lastName}
                  </strong>{' '}
                  from this unit?
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirmRemoveOpen(false)}>Cancel</Button>
                <Button
                  onClick={confirmRemove}
                  color="error"
                  variant="contained"
                  disabled={removeTenantMutation.isLoading}
                >
                  Remove
                </Button>
              </DialogActions>
            </Dialog>

            {/* Move In Wizard Dialog */}
            <Dialog
              open={moveInWizardOpen}
              onClose={() => setMoveInWizardOpen(false)}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>Move In Wizard</DialogTitle>
              <DialogContent>
                <MoveInWizard unitId={id} onComplete={() => setMoveInWizardOpen(false)} />
              </DialogContent>
            </Dialog>

            {/* Move Out Wizard Dialog */}
            <Dialog
              open={moveOutWizardOpen}
              onClose={() => setMoveOutWizardOpen(false)}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>Move Out Wizard</DialogTitle>
              <DialogContent>
                <MoveOutWizard unitId={id} onComplete={() => setMoveOutWizardOpen(false)} />
              </DialogContent>
            </Dialog>

            {/* Image Lightbox Dialog */}
            <Dialog
              open={lightboxOpen}
              onClose={handleCloseLightbox}
              maxWidth={false}
              PaperProps={{
                sx: {
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  boxShadow: 'none',
                  margin: 0,
                  maxWidth: '100vw',
                  maxHeight: '100vh',
                  borderRadius: 0,
                },
              }}
              sx={{
                '& .MuiBackdrop-root': {
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                },
              }}
            >
              <DialogContent
                sx={{
                  position: 'relative',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '100vh',
                  overflow: 'hidden',
                }}
              >
                {/* Close Button */}
                <IconButton
                  onClick={handleCloseLightbox}
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    color: 'white',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    zIndex: 3,
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.2)',
                    },
                  }}
                >
                  <CloseIcon />
                </IconButton>

                {/* Previous Arrow */}
                {unitCarouselImages.length > 1 && (
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLightboxPrev();
                    }}
                    sx={{
                      position: 'absolute',
                      left: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'white',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      zIndex: 3,
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.2)',
                      },
                    }}
                  >
                    <ArrowBackIos sx={{ ml: 0.5 }} />
                  </IconButton>
                )}

                {/* Next Arrow */}
                {unitCarouselImages.length > 1 && (
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLightboxNext();
                    }}
                    sx={{
                      position: 'absolute',
                      right: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'white',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      zIndex: 3,
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.2)',
                      },
                    }}
                  >
                    <ArrowForwardIos />
                  </IconButton>
                )}

                {/* Image */}
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: { xs: 2, md: 4 },
                  }}
                >
                  <Box
                    component="img"
                    src={typeof unitCarouselImages[lightboxIndex] === 'string' ? unitCarouselImages[lightboxIndex] : unitCarouselImages[lightboxIndex]?.imageUrl}
                    alt={typeof unitCarouselImages[lightboxIndex] === 'object' && unitCarouselImages[lightboxIndex]?.caption ? unitCarouselImages[lightboxIndex].caption : `Unit ${unit?.unitNumber} image ${lightboxIndex + 1}`}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '90vh',
                      objectFit: 'contain',
                      transition: 'opacity 0.3s ease',
                    }}
                  />
                </Box>

                {/* Image Counter and Caption */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
                    padding: 3,
                    zIndex: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'white',
                      textAlign: 'center',
                      fontWeight: 500,
                    }}
                  >
                    {lightboxIndex + 1} / {unitCarouselImages.length}
                  </Typography>
                  {typeof unitCarouselImages[lightboxIndex] === 'object' && unitCarouselImages[lightboxIndex]?.caption && (
                    <Typography
                      variant="body1"
                      sx={{
                        color: 'white',
                        textAlign: 'center',
                        mt: 1,
                      }}
                    >
                      {unitCarouselImages[lightboxIndex].caption}
                    </Typography>
                  )}
                </Box>
              </DialogContent>
            </Dialog>
          </>
        )}
      </DataState>
    </Container>
  );
}
