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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Home as HomeIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  KingBed as BedroomIcon,
  Bathtub as BathroomIcon,
  LocationOn as LocationIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  ChevronRight as ChevronRightIcon,
  Apartment as ApartmentIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import PropertyImageCarousel from '../components/PropertyImageCarousel';
import PageShell from '../components/PageShell';
import Breadcrumbs from '../components/Breadcrumbs';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys';
import { format } from 'date-fns';

// Inspection Card Component
const InspectionCard = ({ inspection, onClick }) => {
  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return 'success';
      case 'SCHEDULED':
        return 'info';
      case 'IN_PROGRESS':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: 4,
          borderColor: 'primary.main',
        },
      }}
      onClick={onClick}
    >
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center" flex={1}>
            <AssignmentIcon color="primary" />
            <Box flex={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                {inspection.title || 'Inspection'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {inspection.scheduledDate
                  ? format(new Date(inspection.scheduledDate), 'EEEE, MMM dd, yyyy')
                  : 'Date not scheduled'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={inspection.status?.replace(/_/g, ' ') || 'N/A'}
              size="small"
              color={getStatusColor(inspection.status)}
            />
            <Button
              variant="text"
              size="small"
              endIcon={<ChevronRightIcon />}
              sx={{ textTransform: 'none' }}
            >
              View
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function TenantUnitPage() {
  const navigate = useNavigate();

  // Fetch tenant's assigned units
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

  // Fetch property details
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

  // Combine unit images and property images for the gallery
  const unitImages = Array.isArray(selectedUnit?.images) ? selectedUnit.images : [];
  const propertyImages = Array.isArray(property?.images) ? property.images : [];
  const allImages = [...unitImages, ...propertyImages];

  // Fetch inspections for this unit
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

  // Build the full address
  const fullAddress = [
    property?.address,
    property?.city,
    property?.state,
    property?.postcode || property?.zipCode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Breadcrumbs
        labelOverrides={{
          '/tenant/unit': 'My Home',
        }}
      />
      <PageShell
        title="My Home"
        subtitle="View your assigned home and inspection reports"
        contentSpacing={{ xs: 3, md: 3 }}
      >
        <DataState
          isLoading={unitsLoading}
          isError={!!unitsError}
          error={unitsError}
          isEmpty={!unitsLoading && !unitsError && uniqueUnits.length === 0}
          emptyMessage="You don't have a home assigned yet. Contact your property manager."
          onRetry={refetchUnits}
        >
          {/* Unit Selector (if multiple units) */}
          {uniqueUnits.length > 1 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <FormControl fullWidth>
                  <InputLabel id="tenant-unit-select-label">Select Home</InputLabel>
                  <Select
                    labelId="tenant-unit-select-label"
                    label="Select Home"
                    value={resolvedSelectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                  >
                    {uniqueUnits.map((unit) => (
                      <MenuItem key={unit.id} value={unit.id}>
                        {unit.property?.name ? `${unit.property.name} — ` : ''}Unit {unit.unitNumber}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </CardContent>
            </Card>
          )}

          {selectedUnit && (
            <>
              {/* Photo Gallery */}
              <Card sx={{ mb: 3, overflow: 'hidden' }}>
                <PropertyImageCarousel
                  images={allImages}
                  fallbackText={property?.name || `Unit ${selectedUnit.unitNumber}`}
                  height={{ xs: 200, sm: 280, md: 360 }}
                  showArrows
                  showDots
                  showCounter
                  showFullscreenButton
                  borderRadius={0}
                />
              </Card>

              {/* Unit & Property Info */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Stack spacing={3}>
                    {/* Header */}
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                      <Box
                        sx={{
                          background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                          color: 'white',
                          borderRadius: 2,
                          p: 1.5,
                          display: 'flex',
                        }}
                      >
                        <ApartmentIcon fontSize="large" />
                      </Box>
                      <Box flex={1}>
                        <Typography variant="h5" fontWeight={700}>
                          Unit {selectedUnit.unitNumber}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {property?.name || selectedUnit.property?.name || 'Property'}
                        </Typography>
                      </Box>
                      <Chip
                        label={selectedUnit.status || 'OCCUPIED'}
                        color={selectedUnit.status === 'OCCUPIED' ? 'success' : 'default'}
                        size="medium"
                      />
                    </Stack>

                    <Divider />

                    {/* Unit Details */}
                    <Grid container spacing={3}>
                      <Grid item xs={6} sm={3}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <BedroomIcon color="action" fontSize="small" />
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Bedrooms
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {selectedUnit.bedrooms ?? 'N/A'}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <BathroomIcon color="action" fontSize="small" />
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Bathrooms
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {selectedUnit.bathrooms ?? 'N/A'}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>
                      {selectedUnit.squareFeet && (
                        <Grid item xs={6} sm={3}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <HomeIcon color="action" fontSize="small" />
                            <Box>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Size
                              </Typography>
                              <Typography variant="body1" fontWeight={600}>
                                {selectedUnit.squareFeet} sq ft
                              </Typography>
                            </Box>
                          </Stack>
                        </Grid>
                      )}
                      {selectedUnit.floor && (
                        <Grid item xs={6} sm={3}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Floor
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {selectedUnit.floor}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>

                    {/* Address */}
                    {fullAddress && (
                      <>
                        <Divider />
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          <LocationIcon color="action" sx={{ mt: 0.25 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Address
                            </Typography>
                            <Typography variant="body1">
                              {fullAddress}
                            </Typography>
                          </Box>
                        </Stack>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Quick Actions
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={<BuildIcon />}
                        onClick={() => navigate('/service-requests')}
                        sx={{
                          py: 1.5,
                          textTransform: 'none',
                          background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #991b1b 0%, #ea580c 100%)',
                          },
                        }}
                      >
                        Request Maintenance
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<AssignmentIcon />}
                        onClick={() => navigate('/service-requests')}
                        sx={{ py: 1.5, textTransform: 'none' }}
                      >
                        View My Requests
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Inspection Reports */}
              <Card>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <AssignmentIcon color="primary" />
                      <Typography variant="h6" fontWeight={700}>
                        Inspection Reports
                      </Typography>
                    </Stack>
                    {inspections.length > 0 && (
                      <Chip label={`${inspections.length} Total`} size="small" variant="outlined" />
                    )}
                  </Stack>

                  <Divider sx={{ mb: 2 }} />

                  <DataState
                    isLoading={inspectionsLoading}
                    isError={!!inspectionsError}
                    error={inspectionsError}
                    isEmpty={!inspectionsLoading && !inspectionsError && inspections.length === 0}
                    emptyMessage="No inspections found for your home yet"
                    onRetry={refetchInspections}
                  >
                    <Stack spacing={2}>
                      {inspections.map((inspection) => (
                        <InspectionCard
                          key={inspection.id}
                          inspection={inspection}
                          onClick={() => navigate(`/inspections/${inspection.id}/report`)}
                        />
                      ))}
                    </Stack>
                  </DataState>
                </CardContent>
              </Card>
            </>
          )}
        </DataState>
      </PageShell>
    </Container>
  );
}
