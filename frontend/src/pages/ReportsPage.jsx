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
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
} from '@mui/material';
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
import { Search as SearchIcon, Close as CloseIcon, FilterList as FilterListIcon, Add as AddIcon } from '@mui/icons-material';

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

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
];

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [filterPropertyId, setFilterPropertyId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
    setValue,
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
    } else {
      setSelectedPropertyId('');
      setValue('unitId', '');
    }
  }, [propertyIdValue, setValue]);

  const steps = [
    {
      label: 'Report type',
      description: 'Pick the template and insights you want to export.',
    },
    {
      label: 'Scope',
      description: 'Choose the property and unit you want to audit.',
    },
    {
      label: 'Timeline',
      description: 'Set the coverage window for the report.',
    },
    {
      label: 'Review & generate',
      description: 'Confirm your selections before exporting.',
    },
  ];

  const onSubmit = handleSubmit((data) => {
    const payload = {
      ...data,
      fromDate: new Date(data.fromDate).toISOString(),
      toDate: new Date(data.toDate).toISOString(),
    };
    mutation.mutate(payload);
  });

  const handleNext = async () => {
    const validationFields = [
      ['reportType'],
      ['propertyId', 'unitId'],
      ['fromDate', 'toDate'],
      [],
    ];

    const currentFields = validationFields[activeStep] || [];
    if (currentFields.length > 0) {
      const isValid = await trigger(currentFields);
      if (!isValid) return;
    }

    if (activeStep === steps.length - 1) {
      onSubmit();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStartNewReport = () => {
    reset();
    setSelectedPropertyId('');
    setActiveStep(0);
    setIsWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
  };

  const selectedReportSections =
    REPORT_SECTIONS[reportTypeValue] || REPORT_SECTIONS.MAINTENANCE_HISTORY;
  const selectedProperty = propertiesData.find((prop) => prop.id === propertyIdValue);
  const selectedUnit = unitsData.find((unit) => unit.id === unitIdValue);

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
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 2, md: 0 }}
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
              }}
              gutterBottom
            >
              Reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Generate audit-ready outputs for inspections, jobs, payments, and service requests.
            </Typography>
          </Box>
          <GradientButton startIcon={<AddIcon />} size="medium" onClick={handleStartNewReport}>
            Generate Report
          </GradientButton>
        </Stack>

        {/* Filters Section */}
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
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', md: 'center' }}
            flexWrap="wrap"
          >
            <TextField
              placeholder="Search reports by property, unit, type, or status"
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

      <Dialog open={isWizardOpen} onClose={handleCloseWizard} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Generate report
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Follow the wizard to export an audit-ready report without missing details.
              </Typography>
            </Box>
            <IconButton onClick={handleCloseWizard} aria-label="close wizard" size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent dividers>
          <Stack spacing={3}>
            <Stepper activeStep={activeStep} alternativeLabel sx={{ pb: 1 }}>
              {steps.map((step) => (
                <Step key={step.label}>
                  <StepLabel>{step.label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 2,
                backgroundColor: 'background.default',
              }}
            >
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {steps[activeStep].label}
                  </Typography>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {steps[activeStep].description}
                  </Typography>
                </Box>

                {activeStep === 0 && (
                  <Stack spacing={2}>
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
                    <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                      {selectedReportSections.map((section) => (
                        <Chip key={section} label={section} color="default" variant="outlined" />
                      ))}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Each report includes an audit trail plus the sections shown above so stakeholders can review every
                      update with consistent formatting.
                    </Typography>
                  </Stack>
                )}

                {activeStep === 1 && (
                  <Stack spacing={2}>
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
                          helperText={errors.unitId?.message}
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
                    <Alert severity="info" variant="outlined">
                      You can scope the report to a single unit or leave it blank to include everything for the selected
                      property.
                    </Alert>
                  </Stack>
                )}

                {activeStep === 2 && (
                  <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
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
                )}

                {activeStep === 3 && (
                  <Stack spacing={2}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        Report summary
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                        <Chip label={REPORT_TYPES[reportTypeValue] || 'Select a type'} color="primary" />
                        <Chip label={selectedProperty?.name || 'No property selected'} />
                        <Chip label={selectedUnit?.unitNumber ? `Unit ${selectedUnit.unitNumber}` : 'All Units'} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Coverage:{' '}
                        {fromDateValue && toDateValue
                          ? `${format(new Date(fromDateValue), 'PP')} – ${format(
                              new Date(toDateValue),
                              'PP'
                            )}`
                          : 'Select dates'}
                      </Typography>
                    </Stack>
                    <Alert severity="success" variant="outlined">
                      We will generate an audit-ready export with the sections shown above. You can download it once the
                      status reaches Completed.
                    </Alert>
                  </Stack>
                )}

                <Stack direction="row" spacing={2} justifyContent="space-between" sx={{ pt: 1 }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={handleBack}
                    disabled={activeStep === 0 || isSubmitting || mutation.isPending}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Back
                  </Button>
                  <GradientButton
                    size="large"
                    onClick={handleNext}
                    disabled={isSubmitting || mutation.isPending}
                  >
                    {activeStep === steps.length - 1
                      ? mutation.isPending
                        ? 'Generating...'
                        : 'Generate Report'
                      : 'Continue'}
                  </GradientButton>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
