import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  Paper,
} from '@mui/material';
import { Home as HomeIcon, Visibility as VisibilityIcon, Assignment as AssignmentIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import DataState from '../components/DataState';
import PropertyImageCarousel from '../components/PropertyImageCarousel';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys';
import { format } from 'date-fns';

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

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Breadcrumbs
        labelOverrides={{
          '/tenant/unit': 'My Unit',
        }}
      />
      <PageShell
        title="My Unit"
        subtitle="View your assigned unit and inspection reports"
        contentSpacing={{ xs: 3, md: 3 }}
      >
        <DataState
          isLoading={unitsLoading}
          isError={!!unitsError}
          error={unitsError}
          isEmpty={!unitsLoading && !unitsError && uniqueUnits.length === 0}
          emptyMessage="You don’t have a unit assigned yet"
          onRetry={refetchUnits}
        >
          {uniqueUnits.length > 1 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Select Unit</Typography>
                  <FormControl fullWidth>
                    <InputLabel id="tenant-unit-select-label">Unit</InputLabel>
                    <Select
                      labelId="tenant-unit-select-label"
                      label="Unit"
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
                </Stack>
              </CardContent>
            </Card>
          )}

          {selectedUnit && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <HomeIcon color="primary" />
                    <Box>
                      <Typography variant="h6">Unit {selectedUnit.unitNumber}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedUnit.property?.name || 'Property'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider />

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">Property</Typography>
                      <Typography variant="body1">{selectedUnit.property?.name || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">Unit Status</Typography>
                      <Chip label={selectedUnit.status || 'N/A'} size="small" color="primary" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">Bedrooms</Typography>
                      <Typography variant="body1">{selectedUnit.bedrooms ?? 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">Bathrooms</Typography>
                      <Typography variant="body1">{selectedUnit.bathrooms ?? 'N/A'}</Typography>
                    </Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Card>
          )}

          {propertyId && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Property</Typography>
                  <Divider />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">Name</Typography>
                      <Typography variant="body1">{property?.name || selectedUnit?.property?.name || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">Address</Typography>
                      <Typography variant="body1">{property?.address || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">City</Typography>
                      <Typography variant="body1">{property?.city || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">Postcode</Typography>
                      <Typography variant="body1">{property?.postcode || property?.zipCode || 'N/A'}</Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="h6" sx={{ pt: 1 }}>Photo Gallery</Typography>
                  <Divider />
                  <PropertyImageCarousel
                    images={propertyImages}
                    fallbackText={property?.name || selectedUnit?.property?.name || 'Property'}
                    height={240}
                    showArrows
                    showDots
                    showFullscreenButton
                    showCounter
                  />
                  {propertyLoading && (
                    <Typography variant="caption" color="text.secondary">Loading property details…</Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <AssignmentIcon color="primary" />
                  <Typography variant="h6">Inspection Reports</Typography>
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
                    <EmptyState
                      icon={AssignmentIcon}
                      title="No inspections yet"
                      description="When an inspection is completed for your unit, the report will appear here."
                    />
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Title</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Scheduled</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {inspections.map((inspection) => (
                            <TableRow key={inspection.id}>
                              <TableCell>{inspection.title || 'Inspection'}</TableCell>
                              <TableCell>
                                <Chip
                                  label={inspection.status || 'N/A'}
                                  size="small"
                                  color={inspection.status === 'COMPLETED' ? 'success' : 'default'}
                                />
                              </TableCell>
                              <TableCell>
                                {inspection.scheduledDate
                                  ? format(new Date(inspection.scheduledDate), 'MMM dd, yyyy')
                                  : 'N/A'}
                              </TableCell>
                              <TableCell align="right">
                                <Button
                                  size="small"
                                  startIcon={<VisibilityIcon />}
                                  onClick={() => navigate(`/inspections/${inspection.id}/report`)}
                                >
                                  View Report
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </DataState>
              </Stack>
            </CardContent>
          </Card>
        </DataState>
      </PageShell>
    </Container>
  );
}
