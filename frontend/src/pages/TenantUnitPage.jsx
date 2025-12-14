import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
  Button,
  Paper,
  Avatar,
  IconButton,
  alpha,
} from '@mui/material';
import {
  Home as HomeIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  CalendarMonth as CalendarIcon,
  AttachMoney as MoneyIcon,
  LocalParking as ParkingIcon,
  Wifi as WifiIcon,
  Pets as PetsIcon,
  Description as DocumentIcon,
  MedicalServices as EmergencyIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import PropertyImageCarousel from '../components/PropertyImageCarousel';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys';
import { format } from 'date-fns';

// Quick Action Button Component
const QuickActionButton = ({ icon: Icon, label, onClick, color = 'primary' }) => (
  <Button
    variant="contained"
    color={color}
    size="large"
    startIcon={<Icon />}
    onClick={onClick}
    sx={{
      py: 1.5,
      textTransform: 'none',
      fontSize: '1rem',
      fontWeight: 600,
      boxShadow: 3,
      '&:hover': {
        boxShadow: 6,
        transform: 'translateY(-2px)',
      },
      transition: 'all 0.3s ease',
    }}
  >
    {label}
  </Button>
);

// Info Card Component
const InfoCard = ({ title, icon: Icon, children, color = 'primary.main' }) => (
  <Card
    sx={{
      height: '100%',
      transition: 'all 0.3s ease',
      '&:hover': {
        boxShadow: 6,
        transform: 'translateY(-4px)',
      },
    }}
  >
    <CardContent>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              bgcolor: alpha(color, 0.1),
              color: color,
              borderRadius: 2,
              p: 1,
              display: 'flex',
            }}
          >
            <Icon />
          </Box>
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
        </Stack>
        <Divider />
        {children}
      </Stack>
    </CardContent>
  </Card>
);

// Inspection Card Component
const InspectionCard = ({ inspection, onClick }) => {
  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return <CheckCircleIcon color="success" />;
      case 'SCHEDULED':
        return <ScheduleIcon color="info" />;
      default:
        return <AssignmentIcon color="action" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return 'success';
      case 'SCHEDULED':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-2px)',
        },
      }}
      onClick={onClick}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center" flex={1}>
              {getStatusIcon(inspection.status)}
              <Box flex={1}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  {inspection.title || 'Inspection'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {inspection.scheduledDate
                    ? format(new Date(inspection.scheduledDate), 'EEEE, MMMM dd, yyyy')
                    : 'Date not scheduled'}
                </Typography>
              </Box>
            </Stack>
            <Chip
              label={inspection.status || 'N/A'}
              size="small"
              color={getStatusColor(inspection.status)}
            />
          </Stack>
          <Button
            variant="outlined"
            size="small"
            endIcon={<ChevronRightIcon />}
            sx={{ alignSelf: 'flex-start' }}
          >
            View Report
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function TenantUnitPage() {
  const navigate = useNavigate();

  const { data: units = [], isLoading: unitsLoading, error: unitsError, refetch: refetchUnits } = useQuery({
    queryKey: queryKeys.dashboard.tenantUnits(),
    queryFn: async () => {
      const response = await apiClient.get('/tenants/my-units');
      return ensureArray(response.data, ['items', 'data.items', 'units', 'data']);
    },
    retry: 1,
  });

  const uniqueUnits = useMemo(
    () =>
      Array.isArray(units)
        ? Array.from(
          new Map(
            units
              .filter(Boolean)
              .map((unit) => [unit?.id || unit?.unitId || JSON.stringify(unit), unit])
          ).values()
        )
        : [],
    [units]
  );

  const [selectedUnitId, setSelectedUnitId] = useState('');

  const resolvedSelectedUnitId = useMemo(() => {
    if (selectedUnitId && uniqueUnits.some((u) => u.id === selectedUnitId)) return selectedUnitId;
    return uniqueUnits[0]?.id || '';
  }, [selectedUnitId, uniqueUnits]);

  const selectedUnit = useMemo(
    () => uniqueUnits.find((u) => u.id === resolvedSelectedUnitId) || null,
    [uniqueUnits, resolvedSelectedUnitId]
  );

  const unitId = selectedUnit?.id;
  const propertyId = selectedUnit?.propertyId || selectedUnit?.property?.id || null;

  const { data: propertyResponse, isLoading: propertyLoading } = useQuery({
    queryKey: queryKeys.properties.detail(propertyId || 'none'),
    queryFn: async () => {
      const response = await apiClient.get(`/properties/${propertyId}`);
      return response.data;
    },
    enabled: Boolean(propertyId),
    retry: 1,
  });

  const property = propertyResponse?.property ?? null;
  const propertyImages = Array.isArray(property?.images) ? property.images : [];

  const {
    data: inspections = [],
    isLoading: inspectionsLoading,
    error: inspectionsError,
    refetch: refetchInspections,
  } = useQuery({
    queryKey: queryKeys.inspections.byUnit(unitId),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections?unitId=${unitId}`);
      return ensureArray(response.data, ['items', 'data.items', 'inspections', 'data']);
    },
    enabled: !!unitId,
    retry: 1,
  });

  if (unitsLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <DataState isLoading={true} />
      </Container>
    );
  }

  if (unitsError || !selectedUnit) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <DataState
          isError={true}
          error={unitsError}
          isEmpty={!unitsError && !selectedUnit}
          emptyMessage="You don't have a unit assigned yet"
          onRetry={refetchUnits}
        />
      </Container>
    );
  }

  const fullAddress = [
    property?.address,
    property?.city,
    property?.state,
    property?.postcode || property?.zipCode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Hero Section with Property Images */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 300, md: 400 },
          bgcolor: 'grey.900',
          overflow: 'hidden',
        }}
      >
        <PropertyImageCarousel
          images={propertyImages}
          fallbackText={property?.name || 'Your Unit'}
          height={{ xs: 300, md: 400 }}
          showArrows
          showDots
          autoPlay
        />
        {/* Overlay with Unit Info */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)',
            color: 'white',
            p: { xs: 2, md: 4 },
          }}
        >
          <Container maxWidth="xl">
            <Stack spacing={1}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Typography variant="h3" fontWeight={800} sx={{ color: 'white' }}>
                  Unit {selectedUnit.unitNumber}
                </Typography>
                <Chip
                  label={selectedUnit.status || 'OCCUPIED'}
                  color="success"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    bgcolor: 'success.main',
                    color: 'white',
                  }}
                />
              </Stack>
              <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {fullAddress || property?.name || 'Your Property'}
              </Typography>
              <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <HomeIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    {selectedUnit.bedrooms || 0} Bedrooms
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <HomeIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    {selectedUnit.bathrooms || 0} Bathrooms
                  </Typography>
                </Stack>
              </Stack>
            </Stack>
          </Container>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Quick Actions */}
        <Paper
          elevation={3}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <QuickActionButton
                icon={BuildIcon}
                label="Request Maintenance"
                onClick={() => navigate('/service-requests')}
                color="error"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <QuickActionButton
                icon={DocumentIcon}
                label="View Lease"
                onClick={() => { }}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <QuickActionButton
                icon={PersonIcon}
                label="Contact Manager"
                onClick={() => { }}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <QuickActionButton
                icon={MoneyIcon}
                label="Payment Portal"
                onClick={() => { }}
                color="warning"
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Key Information Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Lease Details */}
          <Grid item xs={12} md={6} lg={3}>
            <InfoCard title="Lease Details" icon={CalendarIcon} color="#3b82f6">
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Move-in Date
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {selectedUnit.moveInDate
                      ? format(new Date(selectedUnit.moveInDate), 'MMM dd, yyyy')
                      : 'Not available'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Lease End
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {selectedUnit.leaseEndDate
                      ? format(new Date(selectedUnit.leaseEndDate), 'MMM dd, yyyy')
                      : 'Not available'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Monthly Rent
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    ${selectedUnit.rentAmount || '---'}/mo
                  </Typography>
                </Box>
              </Stack>
            </InfoCard>
          </Grid>

          {/* Property Manager */}
          <Grid item xs={12} md={6} lg={3}>
            <InfoCard title="Property Manager" icon={PersonIcon} color="#10b981">
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body1" fontWeight={600}>
                      {property?.manager?.name || 'Not assigned'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Property Manager
                    </Typography>
                  </Box>
                </Stack>
                <Divider />
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {property?.manager?.phone || '(555) 123-4567'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EmailIcon fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                      {property?.manager?.email || 'manager@property.com'}
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </InfoCard>
          </Grid>

          {/* Emergency Contacts */}
          <Grid item xs={12} md={6} lg={3}>
            <InfoCard title="Emergency" icon={EmergencyIcon} color="#ef4444">
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    24/7 Maintenance Hotline
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={<PhoneIcon />}
                    href="tel:+1555999911"
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    (555) 999-0911
                  </Button>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Emergency Services
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={<EmergencyIcon />}
                    href="tel:911"
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    911
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  For life-threatening emergencies, call 911 first
                </Typography>
              </Stack>
            </InfoCard>
          </Grid>

          {/* Amenities */}
          <Grid item xs={12} md={6} lg={3}>
            <InfoCard title="Amenities" icon={WifiIcon} color="#8b5cf6">
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ParkingIcon fontSize="small" color="success" />
                  <Typography variant="body2">1 Parking Space</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <WifiIcon fontSize="small" color="success" />
                  <Typography variant="body2">WiFi Included</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PetsIcon fontSize="small" color={selectedUnit.petsAllowed ? 'success' : 'action'} />
                  <Typography variant="body2">
                    {selectedUnit.petsAllowed ? 'Pets Allowed' : 'No Pets'}
                  </Typography>
                </Stack>
                <Divider />
                <Typography variant="caption" color="text.secondary">
                  Check your lease for full amenity details
                </Typography>
              </Stack>
            </InfoCard>
          </Grid>
        </Grid>

        {/* Inspection Reports */}
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 4 }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <AssignmentIcon color="primary" sx={{ fontSize: 32 }} />
                <Typography variant="h5" fontWeight={700}>
                  Inspection Reports
                </Typography>
              </Stack>
              <Chip label={`${inspections.length} Total`} color="primary" />
            </Stack>

            <Divider />

            <DataState
              isLoading={inspectionsLoading}
              isError={!!inspectionsError}
              error={inspectionsError}
              isEmpty={!inspectionsLoading && !inspectionsError && inspections.length === 0}
              emptyMessage="No inspections found for your unit"
              onRetry={refetchInspections}
            >
              {inspections.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    No Inspections Yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    When an inspection is completed for your unit, the report will appear here.
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {inspections.map((inspection) => (
                    <Grid item xs={12} key={inspection.id}>
                      <InspectionCard
                        inspection={inspection}
                        onClick={() => navigate(`/inspections/${inspection.id}/report`)}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </DataState>
          </Stack>
        </Paper>

        {/* Documents & Resources */}
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DocumentIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h5" fontWeight={700}>
                Documents & Resources
              </Typography>
            </Stack>

            <Divider />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<DocumentIcon />}
                  sx={{ py: 1.5, textTransform: 'none' }}
                >
                  Lease Agreement
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<CheckCircleIcon />}
                  sx={{ py: 1.5, textTransform: 'none' }}
                >
                  Move-in Checklist
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<DocumentIcon />}
                  sx={{ py: 1.5, textTransform: 'none' }}
                >
                  Community Rules
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<DocumentIcon />}
                  sx={{ py: 1.5, textTransform: 'none' }}
                >
                  Utility Info
                </Button>
              </Grid>
            </Grid>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
