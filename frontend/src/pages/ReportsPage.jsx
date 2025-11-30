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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  Stepper,
  Step,
  StepLabel,
  Grid,
  FormHelperText,
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
});

const REPORT_TYPES = {
  MAINTENANCE_HISTORY: 'Maintenance History',
  UNIT_LEDGER: 'Unit Ledger',
};

const REPORT_SECTIONS = {
  MAINTENANCE_HISTORY: ['Audit Trail', 'Inspections', 'Jobs', 'Service Requests', 'Upcoming'],
  UNIT_LEDGER: ['Audit Trail', 'Payments', 'Unit Updates', 'Upcoming'],
};

const REPORT_TYPE_DETAILS = {
  MAINTENANCE_HISTORY: {
    title: 'Maintenance History',
    description: 'Create an audit-ready history of inspections, jobs, service requests, and upcoming work.',
  },
  UNIT_LEDGER: {
    title: 'Unit Ledger',
    description: 'Capture payments, unit updates, and an audit trail for resident communications.',
  },
};

const WIZARD_STEPS = ['Select report type', 'Choose scope', 'Date range', 'Review & submit'];

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
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

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
      setIsWizardOpen(false);
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    trigger,
    getValues,
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

  const handleWizardOpen = () => {
    setIsWizardOpen(true);
  };

  const handleWizardClose = () => {
    setIsWizardOpen(false);
    setActiveStep(0);
    reset();
    setSelectedPropertyId('');
  };

  const handleNextStep = async () => {
    const fieldsByStep = [
      ['reportType'],
      ['propertyId'],
      ['fromDate', 'toDate'],
      [],
    ];

    const currentFields = fieldsByStep[activeStep] || [];
    if (currentFields.length === 0) {
      setActiveStep((prev) => prev + 1);
      return;
    }

    const isValid = await trigger(currentFields);
    if (isValid) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBackStep = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

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

  const renderWizardContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight={700}>
              Choose a report type
            </Typography>
            <Controller
              name="reportType"
              control={control}
              render={({ field }) => (
                <Grid container spacing={2}>
                  {Object.entries(REPORT_TYPE_DETAILS).map(([key, details]) => {
                    const isSelected = field.value === key;
                    return (
                      <Grid item xs={12} sm={6} key={key}>
                        <Paper
                          role="button"
                          tabIndex={0}
                          onClick={() => field.onChange(key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              field.onChange(key);
                            }
                          }}
                          variant="outlined"
                          sx={{
                            p: 2.5,
                            height: '100%',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'primary.light' : 'background.paper',
                            transition: 'all 0.2s ease',
                            '&:hover': { boxShadow: 4, borderColor: 'primary.main' },
                            outline: 'none',
                          }}
                        >
                          <Stack spacing={1} alignItems="flex-start">
                            <Chip label={REPORT_TYPES[key]} color={isSelected ? 'primary' : 'default'} size="small" />
                            <Typography variant="subtitle1" fontWeight={700}>
                              {details.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {details.description}
                            </Typography>
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            />
            {errors.reportType && <FormHelperText error>{errors.reportType.message}</FormHelperText>}
          </Stack>
        );
      case 1:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              Choose property and scope
            </Typography>
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
                  helperText={errors.propertyId?.message || 'Select where this report should focus'}
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
                  helperText={errors.unitId?.message || 'Limit the report to a single unit (optional)'}
                >
                  <MenuItem value="">
                    <em>All Units</em>
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
        );
      case 2:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              Set date coverage
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
                    helperText={errors.fromDate?.message || 'Starting date for the report window'}
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
                    helperText={errors.toDate?.message || 'Ending date for the report window'}
                  />
                )}
              />
            </Stack>
          </Stack>
        );
      case 3:
      default:
        {
          const values = getValues();
          const selectedProperty = propertiesData.find((prop) => prop.id === values.propertyId);
          const selectedUnit = unitsData.find((unit) => unit.id === values.unitId);
          return (
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={700}>
                Review
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                      Report Type
                    </Typography>
                    <Chip label={REPORT_TYPES[values.reportType] || 'Not selected'} color="primary" size="small" />
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                      Property
                    </Typography>
                    <Typography variant="body2">
                      {selectedProperty?.name || 'Not selected'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                      Unit
                    </Typography>
                    <Typography variant="body2">
                      {selectedUnit?.unitNumber ? `Unit ${selectedUnit.unitNumber}` : 'All Units'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                      Coverage
                    </Typography>
                    <Typography variant="body2">
                      {values.fromDate && values.toDate
                        ? `${format(new Date(values.fromDate), 'PP')} - ${format(new Date(values.toDate), 'PP')}`
                        : 'Not set'}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
            </Stack>
          );
        }
    }
  };

  const isLastStep = activeStep === WIZARD_STEPS.length - 1;

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
            <GradientButton size="large" onClick={handleWizardOpen}>
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
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2.5}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Stack spacing={1}>
                <Typography variant="h6" fontWeight={700}>
                  Generate New Report
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
                  Launch the guided workflow to choose your report type, select the property and unit scope, and confirm
                  coverage before submitting.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                  {WIZARD_STEPS.map((step) => (
                    <Chip key={step} label={step} size="small" color="default" />
                  ))}
                </Stack>
              </Stack>
              <GradientButton size="large" onClick={handleWizardOpen}>
                Launch Report Wizard
              </GradientButton>
            </Stack>

            <Divider />

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2.5, height: '100%', borderRadius: 2 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      What happens in the wizard
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Pick the report template that matches your need.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Choose the property and optional unit scope.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Lock in the date coverage and review before submitting.
                    </Typography>
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2.5, height: '100%', borderRadius: 2 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Report coverage
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                      {Object.values(REPORT_SECTIONS)
                        .flat()
                        .filter((section, index, arr) => arr.indexOf(section) === index)
                        .map((section) => (
                          <Chip key={section} label={section} size="small" />
                        ))}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Reports keep the same audit-friendly formatting used across inspections, jobs, payments, and service
                      requests.
                    </Typography>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Stack>
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
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={handleWizardOpen}>
                New Report
              </Button>
            }
          >
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

      <Dialog open={isWizardOpen} onClose={handleWizardClose} fullWidth maxWidth="md">
        <DialogTitle>Report creation wizard</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {WIZARD_STEPS.map((step) => (
                <Step key={step}>
                  <StepLabel>{step}</StepLabel>
                </Step>
              ))}
            </Stepper>
            <Stack spacing={2}>{renderWizardContent()}</Stack>
            {mutation.isError && <Alert severity="error">{mutation.error.message}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button onClick={handleWizardClose} color="inherit">
            Cancel
          </Button>
          {activeStep > 0 && (
            <Button onClick={handleBackStep} disabled={mutation.isPending || isSubmitting}>
              Back
            </Button>
          )}
          <GradientButton
            onClick={isLastStep ? onSubmit : handleNextStep}
            disabled={mutation.isPending || isSubmitting}
          >
            {isLastStep ? (mutation.isPending ? 'Submitting...' : t('reports.submit')) : 'Next'}
          </GradientButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
