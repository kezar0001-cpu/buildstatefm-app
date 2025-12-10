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
  useMediaQuery,
  useTheme,
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
import UnitOwnerAssignmentDialog from '../components/UnitOwnerAssignmentDialog';
import InviteOwnerDialog from '../components/InviteOwnerDialog';
import { formatDate, formatDateTime } from '../utils/date';
import toast from 'react-hot-toast';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';
import Breadcrumbs from '../components/Breadcrumbs';

import MoveInWizard from '../components/MoveInWizard';
import MoveOutWizard from '../components/MoveOutWizard';
import InspectionForm from '../components/InspectionForm';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [inviteTenantDialogOpen, setInviteTenantDialogOpen] = useState(false);
  const [assignOwnerDialogOpen, setAssignOwnerDialogOpen] = useState(false);
  const [inviteOwnerDialogOpen, setInviteOwnerDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [confirmRemoveOwnerOpen, setConfirmRemoveOwnerOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [moveInWizardOpen, setMoveInWizardOpen] = useState(false);
  const [moveOutWizardOpen, setMoveOutWizardOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [inspectionFormDialogOpen, setInspectionFormDialogOpen] = useState(false);

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

  // Remove owner mutation
  const removeOwnerMutation = useMutation({
    mutationFn: async (ownerId) => {
      const response = await apiClient.delete(`/units/${id}/owners/${ownerId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.detail(id) });
      toast.success('Owner removed successfully');
      setConfirmRemoveOwnerOpen(false);
      setSelectedOwner(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to remove owner');
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

  const handleAssignOwner = () => {
    setAssignOwnerDialogOpen(true);
  };

  const handleInviteOwner = () => {
    setInviteOwnerDialogOpen(true);
  };

  const handleRemoveOwner = (owner) => {
    setSelectedOwner(owner);
    setConfirmRemoveOwnerOpen(true);
  };

  const confirmRemoveOwner = () => {
    if (selectedOwner) {
      removeOwnerMutation.mutate(selectedOwner.ownerId);
    }
  };

  const isLoading = unitQuery.isLoading || tenantsQuery.isLoading;
  const error = unitQuery.error || tenantsQuery.error;

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <DataState
        isLoading={isLoading}
        error={error}
        isEmpty={!unit}
        emptyMessage="Unit not found"
      >
        {unit && (
          <>
            {/* Top Navigation */}
            <Container maxWidth="xl" sx={{ pt: 3, pb: 2 }}>
              <Breadcrumbs
                labelOverrides={breadcrumbOverrides}
                extraCrumbs={breadcrumbExtras}
              />
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                sx={{ mt: 1 }}
              >
                Back to Property
              </Button>
            </Container>

            {/* Hero Section with Image Gallery */}
            <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
              <Container maxWidth="xl" sx={{ py: 0 }}>
                <Grid container spacing={0}>
                  {/* Image Gallery - Takes full width on mobile, left side on desktop */}
                  <Grid item xs={12} lg={8}>
                    {unitCarouselImages.length > 0 ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: unitCarouselImages.length === 1
                            ? '1fr'
                            : { xs: '1fr', md: '2fr 1fr' },
                          gap: 1,
                          overflow: 'hidden',
                          height: { xs: 300, md: 400, lg: 450 },
                        }}
                      >
                        {/* Main Large Image */}
                        <Paper
                          sx={{
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            borderRadius: 0,
                            height: '100%',
                            transition: 'transform 0.3s ease',
                            '&:hover': {
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
                              height: '100%',
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

                            {/* "+N more" tile */}
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
                                  ...(unitCarouselImages[4] && {
                                    backgroundImage: `url(${typeof unitCarouselImages[4] === 'string' ? unitCarouselImages[4] : unitCarouselImages[4].imageUrl})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    '&::before': {
                                      content: '""',
                                      position: 'absolute',
                                      inset: 0,
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
                                  }}
                                >
                                  +{unitCarouselImages.length - 4}
                                </Typography>
                              </Paper>
                            )}
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Paper
                        sx={{
                          height: { xs: 300, md: 400, lg: 450 },
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.100',
                          borderRadius: 0,
                          color: 'grey.400',
                        }}
                        elevation={0}
                      >
                        <HomeIcon sx={{ fontSize: { xs: 72, md: 100 } }} />
                      </Paper>
                    )}

                    {/* Mobile: Horizontal scroll for additional images */}
                    {unitCarouselImages.length > 1 && (
                      <Box
                        sx={{
                          display: { xs: 'flex', md: 'none' },
                          gap: 1,
                          overflowX: 'auto',
                          p: 2,
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
                                flexShrink: 0,
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
                  </Grid>

                  {/* Unit Summary Card - Right side on desktop */}
                  <Grid item xs={12} lg={4}>
                    <Box
                      sx={{
                        p: 4,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      {/* Header */}
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                          <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
                            Unit {unit.unitNumber}
                          </Typography>
                          <Chip
                            label={unit.status?.replace('_', ' ')}
                            color={getStatusColor(unit.status)}
                            sx={{ fontWeight: 600 }}
                          />
                        </Box>

                        {unit.property && (
                          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            {unit.property.name}
                            {unit.property.address && ` • ${unit.property.address}`}
                          </Typography>
                        )}

                        {/* Key Stats */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                          {unit.bedrooms !== null && unit.bedrooms !== undefined && (
                            <Grid item xs={6}>
                              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                <BedIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                  {unit.bedrooms}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {unit.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}
                                </Typography>
                              </Box>
                            </Grid>
                          )}

                          {unit.bathrooms !== null && unit.bathrooms !== undefined && (
                            <Grid item xs={6}>
                              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                <BathtubIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                  {unit.bathrooms}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {unit.bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}
                                </Typography>
                              </Box>
                            </Grid>
                          )}

                          {unit.area && (
                            <Grid item xs={6}>
                              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                <AreaIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                  {unit.area}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  sq ft
                                </Typography>
                              </Box>
                            </Grid>
                          )}

                          {unit.rentAmount && (
                            <Grid item xs={6}>
                              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.lighter', borderRadius: 2 }}>
                                <MoneyIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                                  ${unit.rentAmount.toLocaleString()}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  /month
                                </Typography>
                              </Box>
                            </Grid>
                          )}
                        </Grid>
                      </Box>

                      {/* Actions */}
                      <Stack spacing={1.5}>
                        {unit.status === 'AVAILABLE' && (
                          <Button
                            variant="contained"
                            size="large"
                            fullWidth
                            onClick={() => setMoveInWizardOpen(true)}
                            sx={{ fontWeight: 600 }}
                          >
                            Move In Tenant
                          </Button>
                        )}
                        {unit.status === 'OCCUPIED' && (
                          <Button
                            variant="contained"
                            size="large"
                            fullWidth
                            onClick={() => setMoveOutWizardOpen(true)}
                            sx={{ fontWeight: 600 }}
                          >
                            Move Out Tenant
                          </Button>
                        )}
                        <Button
                          variant="contained"
                          size="large"
                          fullWidth
                          startIcon={<CalendarIcon />}
                          onClick={() => setInspectionFormDialogOpen(true)}
                          sx={{ fontWeight: 600 }}
                        >
                          Schedule Inspection
                        </Button>
                        <Button
                          variant="outlined"
                          size="large"
                          fullWidth
                          startIcon={<EditIcon />}
                          onClick={handleEditUnit}
                        >
                          Edit Unit Details
                        </Button>
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              </Container>
            </Box>

            {/* Main Content Area */}
            <Container maxWidth="xl" sx={{ py: 4 }}>
              <Grid container spacing={3}>
                {/* Main Content Column */}
                <Grid item xs={12} lg={8}>
                  <Stack spacing={3}>
                    {/* Current Tenant Card */}
                    <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 3,
                          }}
                        >
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Current Tenant
                          </Typography>
                          {!activeTenant && (
                            <Stack direction="row" spacing={1}>
                              <Button
                                variant="outlined"
                                startIcon={<MailOutlineIcon />}
                                onClick={handleInviteTenant}
                                size="small"
                              >
                                Invite
                              </Button>
                              <Button
                                variant="contained"
                                startIcon={<PersonAddIcon />}
                                onClick={handleAssignTenant}
                                size="small"
                              >
                                Assign
                              </Button>
                            </Stack>
                          )}
                        </Box>

                        {activeTenant ? (
                          <Box>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                mb: 3,
                                p: 2,
                                bgcolor: 'action.hover',
                                borderRadius: 2,
                              }}
                            >
                              <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                                <PersonIcon sx={{ fontSize: 32 }} />
                              </Avatar>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="h6" fontWeight={600}>
                                  {activeTenant.tenant?.firstName} {activeTenant.tenant?.lastName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {activeTenant.tenant?.email}
                                </Typography>
                              </Box>
                            </Box>

                            <Grid container spacing={2} sx={{ mb: 2 }}>
                              <Grid item xs={12} sm={6}>
                                <Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                    Lease Period
                                  </Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                                    {formatDate(activeTenant.leaseStart)} - {formatDate(activeTenant.leaseEnd)}
                                  </Typography>
                                </Box>
                              </Grid>

                              <Grid item xs={12} sm={6}>
                                <Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                    Monthly Rent
                                  </Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                                    ${activeTenant.rentAmount?.toLocaleString()}
                                  </Typography>
                                </Box>
                              </Grid>

                              {activeTenant.depositAmount && (
                                <Grid item xs={12} sm={6}>
                                  <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                      Security Deposit
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                                      ${activeTenant.depositAmount.toLocaleString()}
                                    </Typography>
                                  </Box>
                                </Grid>
                              )}
                            </Grid>

                            <Divider sx={{ my: 2 }} />

                            <Stack direction="row" spacing={1}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={() => handleEditTenant(activeTenant)}
                              >
                                Edit Lease
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => handleRemoveTenant(activeTenant)}
                              >
                                Remove Tenant
                              </Button>
                            </Stack>
                          </Box>
                        ) : (
                          <Box sx={{ textAlign: 'center', py: 4 }}>
                            <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                              No tenant assigned
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Assign a tenant or send an invitation to get started
                            </Typography>
                            <Stack direction="row" spacing={2} sx={{ justifyContent: 'center' }}>
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

                    {/* Activity Tabs */}
                    <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                      <Tabs
                        value={currentTab}
                        onChange={(e, newValue) => setCurrentTab(newValue)}
                        sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                      >
                        <Tab label="Recent Activity" />
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
                            <DataState
                              isLoading={activityQuery.isLoading}
                              error={activityQuery.error}
                              isEmpty={activities.length === 0}
                              emptyMessage="No recent activity for this unit"
                            >
                              <Stack spacing={1.5}>
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
                                    <Box
                                      key={`${activity.type}-${activity.id}`}
                                      sx={{
                                        p: 2,
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        cursor: activity.type !== 'tenant_assignment' ? 'pointer' : 'default',
                                        transition: 'all 0.2s',
                                        '&:hover': activity.type !== 'tenant_assignment' ? {
                                          bgcolor: 'action.hover',
                                          borderColor: 'primary.main',
                                          transform: 'translateX(4px)',
                                        } : {},
                                      }}
                                      onClick={() => {
                                        if (activity.type === 'job') {
                                          navigate(`/jobs?jobId=${activity.id}`);
                                        } else if (activity.type === 'inspection') {
                                          navigate(`/inspections/${activity.id}`);
                                        }
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Avatar sx={{ bgcolor: `${activityColor}.main` }}>
                                          {icon}
                                        </Avatar>
                                        <Box sx={{ flexGrow: 1 }}>
                                          <Typography variant="subtitle1" fontWeight={600}>
                                            {activity.title}
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            {activity.description}
                                          </Typography>
                                          <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
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
                                        </Box>
                                      </Box>
                                    </Box>
                                  );
                                })}
                              </Stack>
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
                              <Stack spacing={1.5}>
                                {jobs.map((job) => (
                                  <Box
                                    key={job.id}
                                    sx={{
                                      p: 2,
                                      border: 1,
                                      borderColor: 'divider',
                                      borderRadius: 2,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      '&:hover': {
                                        bgcolor: 'action.hover',
                                        borderColor: 'primary.main',
                                        transform: 'translateX(4px)',
                                      },
                                    }}
                                    onClick={() => navigate(`/jobs?jobId=${job.id}`)}
                                  >
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                      <Avatar>
                                        <WorkIcon />
                                      </Avatar>
                                      <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                          {job.title}
                                        </Typography>
                                        {job.description && (
                                          <Typography variant="body2" color="text.secondary">
                                            {job.description}
                                          </Typography>
                                        )}
                                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                          <Chip label={job.status} size="small" />
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
                                      </Box>
                                    </Box>
                                  </Box>
                                ))}
                              </Stack>
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
                              <Stack spacing={1.5}>
                                {inspections.map((inspection) => (
                                  <Box
                                    key={inspection.id}
                                    sx={{
                                      p: 2,
                                      border: 1,
                                      borderColor: 'divider',
                                      borderRadius: 2,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      '&:hover': {
                                        bgcolor: 'action.hover',
                                        borderColor: 'primary.main',
                                        transform: 'translateX(4px)',
                                      },
                                    }}
                                    onClick={() => navigate(`/inspections/${inspection.id}`)}
                                  >
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                      <Avatar>
                                        <InspectionIcon />
                                      </Avatar>
                                      <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                          {inspection.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {formatDateTime(inspection.scheduledDate)}
                                        </Typography>
                                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                          <Chip label={inspection.status} size="small" />
                                          <Chip label={inspection.type} size="small" />
                                        </Box>
                                      </Box>
                                    </Box>
                                  </Box>
                                ))}
                              </Stack>
                            </DataState>
                          </Box>
                        )}
                      </Box>
                    </Card>
                  </Stack>
                </Grid>

                {/* Sidebar */}
                <Grid item xs={12} lg={4}>
                  <Stack spacing={3}>
                    {/* Unit Details Card */}
                    <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                          Unit Details
                        </Typography>

                        <Stack spacing={2}>
                          {unit.floor !== null && unit.floor !== undefined && (
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                Floor
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                                Floor {unit.floor}
                              </Typography>
                            </Box>
                          )}

                          {unit.description && (
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                Description
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                                {unit.description}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>

                    {/* Unit Owners Card */}
                    <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 2,
                          }}
                        >
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Owners
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              onClick={handleInviteOwner}
                              title="Invite Owner"
                            >
                              <MailOutlineIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={handleAssignOwner}
                              title="Assign Owner"
                            >
                              <PersonAddIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Box>

                        {unit?.owners && unit.owners.length > 0 ? (
                          <Stack spacing={1.5}>
                            {unit.owners.map((ownerRecord) => (
                              <Box
                                key={ownerRecord.id}
                                sx={{
                                  p: 1.5,
                                  border: 1,
                                  borderColor: 'divider',
                                  borderRadius: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1.5,
                                }}
                              >
                                <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                                  <PersonIcon fontSize="small" />
                                </Avatar>
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                  <Typography variant="subtitle2" fontWeight={600} noWrap>
                                    {ownerRecord.owner
                                      ? `${ownerRecord.owner.firstName} ${ownerRecord.owner.lastName}`
                                      : 'Unknown Owner'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                                    {ownerRecord.owner?.email}
                                  </Typography>
                                  <Typography variant="caption" color="primary.main" fontWeight={600}>
                                    {ownerRecord.ownershipPercentage}% ownership
                                  </Typography>
                                </Box>
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveOwner(ownerRecord)}
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ))}
                          </Stack>
                        ) : (
                          <Box sx={{ textAlign: 'center', py: 3 }}>
                            <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              No owners assigned
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: 'center' }}>
                              <Button
                                variant="text"
                                size="small"
                                startIcon={<MailOutlineIcon />}
                                onClick={handleInviteOwner}
                              >
                                Invite
                              </Button>
                              <Button
                                variant="text"
                                size="small"
                                startIcon={<PersonAddIcon />}
                                onClick={handleAssignOwner}
                              >
                                Assign
                              </Button>
                            </Stack>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Stack>
                </Grid>
              </Grid>
            </Container>

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

            {/* Owner Assignment Dialog */}
            <UnitOwnerAssignmentDialog
              open={assignOwnerDialogOpen}
              onClose={() => setAssignOwnerDialogOpen(false)}
              unitId={id}
            />

            {/* Invite Owner Dialog */}
            <InviteOwnerDialog
              open={inviteOwnerDialogOpen}
              onClose={() => setInviteOwnerDialogOpen(false)}
              property={{ id: unit?.propertyId }}
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

            {/* Confirm Remove Owner Dialog */}
            <Dialog
              open={confirmRemoveOwnerOpen}
              onClose={() => setConfirmRemoveOwnerOpen(false)}
            >
              <DialogTitle>Remove Owner</DialogTitle>
              <DialogContent>
                <Typography>
                  Are you sure you want to remove{' '}
                  <strong>
                    {selectedOwner?.owner?.firstName} {selectedOwner?.owner?.lastName}
                  </strong>{' '}
                  from this unit?
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirmRemoveOwnerOpen(false)}>Cancel</Button>
                <Button
                  onClick={confirmRemoveOwner}
                  color="error"
                  variant="contained"
                  disabled={removeOwnerMutation.isLoading}
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
              fullScreen={isMobile}
            >
              <DialogTitle>
                Move In Wizard
                {isMobile && (
                  <IconButton
                    aria-label="close"
                    onClick={() => setMoveInWizardOpen(false)}
                    sx={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      color: (theme) => theme.palette.grey[500],
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                )}
              </DialogTitle>
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
              fullScreen={isMobile}
            >
              <DialogTitle>
                Move Out Wizard
                {isMobile && (
                  <IconButton
                    aria-label="close"
                    onClick={() => setMoveOutWizardOpen(false)}
                    sx={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      color: (theme) => theme.palette.grey[500],
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                )}
              </DialogTitle>
              <DialogContent>
                <MoveOutWizard unitId={id} onComplete={() => setMoveOutWizardOpen(false)} />
              </DialogContent>
            </Dialog>

            {/* Schedule Inspection Dialog */}
            <Dialog
              open={inspectionFormDialogOpen}
              onClose={() => setInspectionFormDialogOpen(false)}
              maxWidth="md"
              fullWidth
            >
              <InspectionForm
                onSuccess={() => {
                  setInspectionFormDialogOpen(false);
                  queryClient.invalidateQueries({ queryKey: queryKeys.inspections.list() });
                  queryClient.invalidateQueries({ queryKey: queryKeys.units.inspections(id) });
                  queryClient.invalidateQueries({ queryKey: ['units', id, 'activity'] });
                }}
                onCancel={() => setInspectionFormDialogOpen(false)}
                initialValues={{
                  propertyId: unit?.propertyId,
                  unitId: id,
                }}
              />
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
    </Box>
  );
}
