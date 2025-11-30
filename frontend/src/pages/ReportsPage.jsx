import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Stack,
  TextField,
  Button,
  Alert,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Paper,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  Stepper,
  Step,
  StepLabel,
  Divider,
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
import GradientButton from '../components/GradientButton';
import { Search as SearchIcon, Close as CloseIcon, FilterList as FilterListIcon } from '@mui/icons-material';

const reportSchema = z.object({
  reportType: z.string().min(1, 'forms.required'),
  propertyId: z.string().min(1, 'forms.required'),
  unitId: z.string().optional().nullable(),
  fromDate: z.string().min(1, 'forms.required'),
  toDate: z.string().min(1, 'forms.required'),
}).superRefine((data, ctx) => {
  if (data.fromDate && data.toDate) {
    const from = new Date(data.fromDate);
    const to = new Date(data.toDate);

    if (from > to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be after the start date',
        path: ['toDate'],
      });
    }
  }
});

const REPORT_TYPES = {
  MAINTENANCE_HISTORY: 'Maintenance History',
  UNIT_LEDGER: 'Unit Ledger',
};

const REPORT_SECTIONS = {
  MAINTENANCE_HISTORY: ['Audit Trail', 'Inspections', 'Jobs', 'Service Requests', 'Upcoming'],
  UNIT_LEDGER: ['Audit Trail', 'Payments', 'Unit Updates', 'Upcoming'],
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
];

export default function ReportsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [filterPropertyId, setFilterPropertyId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [wizardMessage, setWizardMessage] = useState(null);

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

  const filteredReports = useMemo(() => {
    return reportsData.filter((report) => {
      const matchesStatus = statusFilter ? report.status === statusFilter : true;
      const matchesType = typeFilter ? report.reportType === typeFilter : true;
      const matchesProperty = filterPropertyId ? report.property?.id === filterPropertyId : true;
      const createdAt = report.createdAt || report.created_at || report.createdDate;
      const createdDate = createdAt ? new Date(createdAt) : null;
      const matchesFrom = dateFrom && createdDate ? createdDate >= new Date(dateFrom) : true;
      const matchesTo = dateTo && createdDate ? createdDate <= new Date(dateTo) : true;
      const searchTarget = `${report.property?.name || ''} ${report.unit?.unitNumber || ''} ${
        REPORT_TYPES[report.reportType] || report.reportType || ''
      } ${report.status || ''}`
        .toLowerCase()
        .trim();
      const matchesSearch = searchInput
        ? searchTarget.includes(searchInput.toLowerCase())
        : true;

      return matchesStatus && matchesType && matchesProperty && matchesFrom && matchesTo && matchesSearch;
    });
  }, [reportsData, statusFilter, typeFilter, filterPropertyId, dateFrom, dateTo, searchInput]);

  const mutation = useMutation({
    mutationFn: (newReport) => apiClient.post('/reports', newReport),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
      reset();
      setSelectedPropertyId('');
      setActiveStep(0);
      setWizardMessage({
        type: 'success',
        text: 'Report generation has been queued. You can start another below.',
      });
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    trigger,
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
  const reportTypeValue = watch('reportType');
  const unitIdValue = watch('unitId');
  const fromDateValue = watch('fromDate');
  const toDateValue = watch('toDate');

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
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={4}>
        {/* Page Header */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            background: 'linear-gradient(135deg, #fff7ed 0%, #fff1f2 100%)',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#c2410c',
                }}
              >
                Reports
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Generate audit-ready outputs for inspections, jobs, payments, and service requests.
              </Typography>
            </Box>
            <GradientButton
              size="large"
              onClick={() => {
                setActiveStep(0);
                document
                  .getElementById('report-form')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Start New Report
            </GradientButton>
          </Stack>
        </Paper>

        {/* Generate New Report Section */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.08)',
          }}
          id="report-form"
        >
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Generate New Report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create owner-ready outputs with consistent formatting
            </Typography>
          </Box>
          <form onSubmit={onSubmit} noValidate>
            <Stack spacing={3}>
              <Stepper activeStep={activeStep} alternativeLabel>
                {["Report Type", "Scope", "Date Range", "Review"].map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 2, md: 3 },
                  borderRadius: 2,
                  backgroundColor: '#fffaf5',
                  borderColor: 'divider',
                }}
              >
                {activeStep === 0 && (
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Choose the type of report you need
                    </Typography>
                    <Controller
                      name="reportType"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          fullWidth
                          label="Report Type"
                          error={!!errors.reportType}
                          helperText={errors.reportType?.message || 'Pick the workflow that matches your export'}
                        >
                          {Object.entries(REPORT_TYPES).map(([key, value]) => (
                            <MenuItem key={key} value={key}>
                              {value}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Stack>
                )}

                {activeStep === 1 && (
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Define the scope of your report
                    </Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <Controller
                        name="propertyId"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            select
                            fullWidth
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
                            fullWidth
                            label="Unit (Optional)"
                            disabled={!selectedPropertyId || isLoadingUnits}
                            error={!!errors.unitId}
                            helperText={errors.unitId?.message || 'Leave blank to include all units'}
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
                    </Stack>
                  </Stack>
                )}

                {activeStep === 2 && (
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Set the date range for your export
                    </Typography>
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
                  </Stack>
                )}

                {activeStep === 3 && (
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Review and confirm
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography color="text.secondary">Report</Typography>
                        <Typography fontWeight={600}>{REPORT_TYPES[reportTypeValue] || 'Not selected'}</Typography>
                      </Stack>
                      <Divider />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography color="text.secondary">Property</Typography>
                        <Typography fontWeight={600}>
                          {propertiesData.find((p) => p.id === propertyIdValue)?.name || 'Not selected'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography color="text.secondary">Unit</Typography>
                        <Typography fontWeight={600}>
                          {unitsData.find((u) => u.id === unitIdValue)?.unitNumber || 'All units'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography color="text.secondary">Date Range</Typography>
                        <Typography fontWeight={600}>
                          {fromDateValue && toDateValue
                            ? `${format(new Date(fromDateValue), 'PP')} - ${format(new Date(toDateValue), 'PP')}`
                            : 'Not set'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                )}
              </Paper>

              {wizardMessage && (
                <Alert severity={wizardMessage.type} onClose={() => setWizardMessage(null)}>
                  {wizardMessage.text}
                </Alert>
              )}
              {mutation.isError && (
                <Alert severity="error">{mutation.error.message}</Alert>
              )}

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="text"
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep((prev) => Math.max(prev - 1, 0))}
                    sx={{ textTransform: 'none' }}
                  >
                    Back
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => {
                      reset();
                      setActiveStep(0);
                      setWizardMessage(null);
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    Reset
                  </Button>
                </Stack>
                <GradientButton
                  type={activeStep === 3 ? 'submit' : 'button'}
                  size="large"
                  disabled={isSubmitting || mutation.isPending}
                  onClick={async (e) => {
                    if (activeStep === 3) {
                      return;
                    }

                    const stepFields = [
                      ['reportType'],
                      ['propertyId'],
                      ['fromDate', 'toDate'],
                    ];

                    const fieldsToValidate = stepFields[activeStep];

                    if (
                      fieldsToValidate &&
                      !(await trigger(fieldsToValidate, { shouldFocus: true }))
                    ) {
                      return;
                    }

                    if (activeStep === 2 && fromDateValue && toDateValue) {
                      const from = new Date(fromDateValue);
                      const to = new Date(toDateValue);
                      if (from > to) {
                        setWizardMessage({
                          type: 'error',
                          text: 'Please ensure the end date is after the start date.',
                        });
                        return;
                      }
                    }

                    setWizardMessage(null);
                    setActiveStep((prev) => Math.min(prev + 1, 3));
                  }}
                >
                  {activeStep === 3 ? t('reports.submit') : 'Next'}
                </GradientButton>
              </Stack>
            </Stack>
          </form>
        </Paper>

        {/* Filters */}
        <Paper
          sx={{
            p: { xs: 2.5, md: 3.5 },
            mb: 1,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" rowGap={2}>
            <TextField
              placeholder="Search reports by property, unit, type, or status..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchInput && (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="clear search"
                      onClick={() => setSearchInput('')}
                      edge="end"
                      size="small"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              size="small"
              sx={{ flexGrow: 1, minWidth: 260 }}
            />

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Report Type</InputLabel>
              <Select
                value={typeFilter}
                label="Report Type"
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="">All Types</MenuItem>
                {Object.entries(REPORT_TYPES).map(([key, value]) => (
                  <MenuItem key={key} value={key}>
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Property</InputLabel>
              <Select
                value={filterPropertyId}
                label="Property"
                onChange={(e) => setFilterPropertyId(e.target.value)}
              >
                <MenuItem value="">All Properties</MenuItem>
                {propertiesData.map((prop) => (
                  <MenuItem key={prop.id} value={prop.id}>
                    {prop.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />

            <TextField
              label="To Date"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />

            <Button
              variant="outlined"
              size="small"
              startIcon={<FilterListIcon />}
              onClick={() => {
                setSearchInput('');
                setStatusFilter('');
                setTypeFilter('');
                setFilterPropertyId('');
                setDateFrom('');
                setDateTo('');
              }}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              Clear Filters
            </Button>
          </Stack>
        </Paper>

        {/* Generated Reports Section */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.08)',
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Generated Reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Keep track of processing and completed exports
            </Typography>
          </Box>
        {isLoadingReports ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredReports.length === 0 ? (
          <Alert severity="info">
            No reports match your filters. Try expanding the date range or clearing filters.
          </Alert>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: { xs: 900, md: 'auto' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Report Type</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell>Coverage</TableCell>
                  <TableCell>Date Range</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReports.map((report) => {
                  const createdAt = report.createdAt || report.created_at || report.createdDate;
                  const coverage = REPORT_SECTIONS[report.reportType] || ['Audit Trail'];
                  return (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {REPORT_TYPES[report.reportType] || report.reportType}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Tracks updates for properties, units, payments, and upcoming work.
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                            {report.property?.name || 'All Properties'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {report.unit?.unitNumber ? `Unit ${report.unit.unitNumber}` : 'All Units'}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                          {coverage.map((section) => (
                            <Chip key={section} label={section} size="small" color="default" />
                          ))}
                        </Stack>
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
                      <TableCell>
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                          {createdAt ? format(new Date(createdAt), 'PP p') : 'Pending'}
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
                            sx={{
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 600,
                            }}
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
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
        </Paper>
      </Stack>
    </Container>
  );
}
