import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  Alert,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Link,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { format } from 'date-fns';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';
import { resolveFileUrl } from '../utils/fileUtils';

const reportSchema = z.object({
  reportType: z.string().min(1, 'forms.required'),
  propertyId: z.string().min(1, 'forms.required'),
  unitId: z.string().optional().nullable(),
  fromDate: z.string().min(1, 'forms.required'),
  toDate: z.string().min(1, 'forms.required'),
});

const REPORT_TYPES = {
  MAINTENANCE_HISTORY: 'Maintenance History',
  UNIT_LEDGER: 'Unit Ledger',
};

export default function ReportsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  // Data fetching
  const { data: propertiesData = [], isLoading: isLoadingProperties } = useQuery({
    queryKey: queryKeys.properties.selectOptions(),
    queryFn: async () => {
      const res = await apiClient.get('/properties');
      return ensureArray(res.data, ['items', 'data.items', 'properties']);
    },
  });

  const { data: unitsData = [], isLoading: isLoadingUnits } = useQuery({
    queryKey: queryKeys.units.listByProperty(selectedPropertyId),
    queryFn: async () => {
      const res = await apiClient.get(`/units?propertyId=${selectedPropertyId}`);
      return ensureArray(res.data, ['items', 'data.items', 'units']);
    },
    enabled: !!selectedPropertyId,
  });

  const { data: rawReportsData = [], isLoading: isLoadingReports } = useQuery({
    queryKey: queryKeys.reports.all(),
    queryFn: async () => {
      const res = await apiClient.get('/reports');
      return ensureArray(res.data, [
        'reports',
        'data.reports',
        'data.items',
        'items',
      ]);
    },
    refetchInterval: (query) => {
      const reports = query.state.data;
      const isProcessing = reports?.some(
        (r) => r.status === 'PENDING' || r.status === 'PROCESSING'
      );
      return isProcessing ? 5000 : false;
    },
  });

  const reportsData = useMemo(
    () => (Array.isArray(rawReportsData) ? rawReportsData : []),
    [rawReportsData]
  );

  const mutation = useMutation({
    mutationFn: (newReport) => apiClient.post('/reports', newReport),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
      reset();
      setSelectedPropertyId('');
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportType: '',
      propertyId: '',
      unitId: '',
      fromDate: '',
      toDate: '',
    },
  });

  const propertyIdValue = watch('propertyId');

  useEffect(() => {
    if (propertyIdValue) {
      setSelectedPropertyId(propertyIdValue);
    }
  }, [propertyIdValue]);

  const onSubmit = handleSubmit((data) => {
    const payload = {
      ...data,
      fromDate: new Date(data.fromDate).toISOString(),
      toDate: new Date(data.toDate).toISOString(),
    };
    mutation.mutate(payload);
  });

  const getStatusChip = (status) => {
    const colorMap = {
      PENDING: 'default',
      PROCESSING: 'info',
      COMPLETED: 'success',
      FAILED: 'error',
    };
    return <Chip label={status} color={colorMap[status] || 'default'} size="small" />;
  };

  return (
    <Stack spacing={4} sx={{ px: { xs: 2, sm: 3, md: 0 }, py: { xs: 2, md: 0 } }}>
      <Box sx={{ animation: 'fade-in-down 0.5s ease-out' }}>
        <Typography
          variant="h4"
          sx={{
            fontSize: { xs: '1.75rem', md: '2.125rem' },
            fontWeight: 800,
            background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}
        >
          {t('reports.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
          {t('reports.description')}
        </Typography>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: { xs: '100%', md: 700 } }}>
        <Typography variant="h6" sx={{ mb: 2, fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
          Generate New Report
        </Typography>
        <form onSubmit={onSubmit} noValidate>
          <Stack spacing={2}>
            <Controller
              name="reportType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Report Type"
                  error={!!errors.reportType}
                  helperText={errors.reportType?.message}
                >
                  {Object.entries(REPORT_TYPES).map(([key, value]) => (
                    <MenuItem key={key} value={key}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="propertyId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Property"
                  disabled={isLoadingProperties}
                  error={!!errors.propertyId}
                  helperText={errors.propertyId?.message}
                >
                  {propertiesData.map((prop) => (
                    <MenuItem key={prop.id} value={prop.id}>
                      {prop.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="unitId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Unit (Optional)"
                  disabled={!selectedPropertyId || isLoadingUnits}
                  error={!!errors.unitId}
                  helperText={errors.unitId?.message}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {unitsData.map((unit) => (
                    <MenuItem key={unit.id} value={unit.id}>
                      {unit.unitNumber}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="fromDate"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="From"
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    error={!!errors.fromDate}
                    helperText={errors.fromDate?.message}
                  />
                )}
              />
              <Controller
                name="toDate"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="To"
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    error={!!errors.toDate}
                    helperText={errors.toDate?.message}
                  />
                )}
              />
            </Stack>
            {mutation.isError && (
              <Alert severity="error">{mutation.error.message}</Alert>
            )}
            {mutation.isSuccess && (
              <Alert severity="success">Report generation has been queued.</Alert>
            )}
            <Stack direction="row" justifyContent="flex-end">
              <Button type="submit" variant="contained" disabled={isSubmitting || mutation.isPending}>
                {t('reports.submit')}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" sx={{ mb: 2, fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
          Generated Reports
        </Typography>
        {isLoadingReports ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : reportsData.length === 0 ? (
          <Alert severity="info">
            No reports generated yet. Create your first report using the form above.
          </Alert>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: { xs: 800, md: 'auto' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Report Type</TableCell>
                  <TableCell>Property</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Date Range</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportsData.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                        {REPORT_TYPES[report.reportType] || report.reportType}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                        {report.property?.name || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                        {report.unit?.unitNumber || 'All Units'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                        {report.parameters?.fromDate && report.parameters?.toDate ? (
                          <>
                            {format(new Date(report.parameters.fromDate), 'PP')} -{' '}
                            {format(new Date(report.parameters.toDate), 'PP')}
                          </>
                        ) : (
                          'N/A'
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>{getStatusChip(report.status)}</TableCell>
                    <TableCell>
                      {report.status === 'COMPLETED' && report.fileUrl && (
                        <Button
                          variant="outlined"
                          size="small"
                          href={resolveFileUrl(report.fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Download
                        </Button>
                      )}
                      {report.status === 'PROCESSING' && (
                        <CircularProgress size={20} />
                      )}
                      {report.status === 'FAILED' && (
                        <Typography variant="caption" color="error">
                          Failed
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
