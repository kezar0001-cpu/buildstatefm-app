import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Collapse,
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
  useMediaQuery,
  useTheme,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Grid,
  Card,
  CardContent,
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
import PageHeader from '../components/PageHeader';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  FilterList as FilterListIcon,
  Add as AddIcon,
  Description as DescriptionIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import { useCurrentUser } from '../context/UserContext';
import toast from 'react-hot-toast';
import TableSkeleton from '../components/skeletons/TableSkeleton';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

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
  MAINTENANCE_SUMMARY: 'Maintenance Summary',
  FINANCIAL_SUMMARY: 'Financial Summary',
  INSPECTION_TRENDS: 'Inspection Trends',
  JOB_COMPLETION_TIMELINE: 'Job Completion Timeline',
  ASSET_CONDITION_HISTORY: 'Asset Condition History',
  PLANNED_VS_EXECUTED: 'Planned vs Executed',
  TENANT_ISSUE_HISTORY: 'Tenant Issue History',
};

const REPORT_SECTIONS = {
  MAINTENANCE_HISTORY: ['Service Requests', 'Maintenance Jobs', 'Summary'],
  UNIT_LEDGER: ['Tenant Information', 'Maintenance Costs', 'Summary'],
  MAINTENANCE_SUMMARY: ['Overview', 'Status Breakdown', 'Priority Breakdown'],
  FINANCIAL_SUMMARY: ['Financial Overview', 'Monthly Breakdown'],
  INSPECTION_TRENDS: ['Overview', 'Status Breakdown', 'Type Breakdown', 'Monthly Trend'],
  JOB_COMPLETION_TIMELINE: ['Completion Timeline', 'Performance Metrics'],
  ASSET_CONDITION_HISTORY: ['Inspection Findings', 'Recommendations'],
  PLANNED_VS_EXECUTED: ['Planned Maintenance', 'Execution Summary'],
  TENANT_ISSUE_HISTORY: ['Service Requests', 'Category Breakdown', 'Status Breakdown'],
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
  const navigate = useNavigate();
  const { user: currentUser } = useCurrentUser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [filterPropertyId, setFilterPropertyId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('reports-view-mode') || 'table';
    } catch {
      return 'table';
    }
  });

  // Reports are only accessible to Property Managers and Owners
  useEffect(() => {
    if (currentUser && !['PROPERTY_MANAGER', 'OWNER'].includes(currentUser.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  // Don't render if user doesn't have access
  if (currentUser && !['PROPERTY_MANAGER', 'OWNER'].includes(currentUser.role)) {
    return null;
  }

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
      const searchTarget = `${report.property?.name || ''} ${report.unit?.unitNumber || ''} ${
        REPORT_TYPES[report.reportType] || report.reportType || ''
      } ${report.status || ''}`
        .toLowerCase()
        .trim();
      const matchesSearch = searchInput
        ? searchTarget.includes(searchInput.toLowerCase())
        : true;

      return matchesStatus && matchesType && matchesProperty && matchesSearch;
    });
  }, [reportsData, statusFilter, typeFilter, filterPropertyId, searchInput]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter) count += 1;
    if (statusFilter) count += 1;
    if (filterPropertyId) count += 1;
    return count;
  }, [filterPropertyId, statusFilter, typeFilter]);

  const hasFilters = !!searchInput || activeFilterCount > 0;

  const handleClearFilters = () => {
    setSearchInput('');
    setStatusFilter('');
    setTypeFilter('');
    setFilterPropertyId('');
  };

  const mutation = useMutation({
    mutationFn: (newReport) => apiClient.post('/reports', newReport),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
      reset();
      setSelectedPropertyId('');
      setActiveStep(0);
      setIsWizardOpen(false);
      
      // Navigate to report detail page if report is completed
      const report = response.data?.report || response.data;
      if (report?.id) {
        if (report.status === 'COMPLETED') {
          toast.success('Report generated successfully!');
          navigate(`/reports/${report.id}`);
        } else {
          toast.success('Report generation started! Your report will be available once processing completes.');
        }
      } else {
        toast.success('Report generation started! Your report will be available in the table below once processing completes.');
      }
    },
    onError: (error) => {
      // Show error message with more details
      const errorMessage = error?.response?.data?.message || 'Failed to generate report. Please try again.';
      const statusCode = error?.response?.status;

      console.error('Error generating report:', {
        message: errorMessage,
        status: statusCode,
        data: error?.response?.data,
        error: error,
      });

      if (statusCode === 500) {
        toast.error('Server error occurred while generating report. Please try again or contact support if the issue persists.');
      } else if (statusCode === 400) {
        toast.error(errorMessage || 'Invalid report parameters. Please check your selections and try again.');
      } else if (statusCode === 403) {
        toast.error('You do not have permission to generate reports for this property.');
      } else {
        toast.error(errorMessage);
      }
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
    try {
      // Validate dates before conversion
      const fromDate = new Date(data.fromDate);
      const toDate = new Date(data.toDate);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        toast.error('Invalid date format. Please check your dates and try again.');
        return;
      }

      if (fromDate > toDate) {
        toast.error('Start date must be before end date.');
        return;
      }

      const payload = {
        reportType: data.reportType,
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      };

      console.log('Generating report with payload:', payload);
      mutation.mutate(payload);
    } catch (error) {
      console.error('Error preparing report payload:', error);
      toast.error('Failed to prepare report data. Please check your inputs and try again.');
    }
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

  const handleViewModeChange = (event, newViewMode) => {
    if (newViewMode !== null) {
      setViewMode(newViewMode);
      try {
        localStorage.setItem('reports-view-mode', newViewMode);
      } catch (err) {
        // Ignore localStorage errors
      }
    }
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
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 }, bgcolor: 'transparent' }}>
      <PageShell
        title="Reports"
        subtitle="Generate audit-ready outputs for inspections, jobs, payments, and service requests."
        actions={(
          <GradientButton
            startIcon={<AddIcon />}
            size="large"
            onClick={handleStartNewReport}
            sx={{ width: { xs: '100%', md: 'auto' } }}
          >
            Generate Report
          </GradientButton>
        )}
        contentSpacing={{ xs: 3, md: 3 }}
      >
        {/* Filters Section */}
        <Paper
          sx={{
            mb: 3,
            p: { xs: 2, md: 3.5 },
            borderRadius: { xs: 2, md: 2 },
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
            animation: 'fade-in-up 0.6s ease-out',
          }}
        >
          <Stack spacing={{ xs: 1.5, md: 0 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', md: 'center' }}
              sx={{ gap: { xs: 1.5, lg: 2 } }}
            >
              <TextField
                placeholder="Search reports..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                      <SearchIcon />
                    </Box>
                  ),
                  endAdornment: searchInput && (
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                      <IconButton
                        aria-label="clear search"
                        onClick={() => setSearchInput('')}
                        edge="end"
                        size="small"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ),
                }}
                size="small"
                sx={{
                  width: { xs: '100%', md: 'auto' },
                  flex: { md: '1 0 260px' },
                  minWidth: { md: 260 },
                  maxWidth: { md: 420 },
                }}
              />

              {isMobile ? (
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FilterListIcon />}
                    onClick={() => setFiltersExpanded((prev) => !prev)}
                    sx={{ textTransform: 'none', flex: 1 }}
                  >
                    Filters
                    {activeFilterCount > 0 && (
                      <Chip
                        label={activeFilterCount}
                        size="small"
                        color="primary"
                        sx={{ ml: 1, height: 20, minWidth: 20 }}
                      />
                    )}
                  </Button>

                  {hasFilters && (
                    <Button
                      variant="text"
                      color="inherit"
                      size="small"
                      onClick={handleClearFilters}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                      startIcon={<CloseIcon />}
                    >
                      Clear
                    </Button>
                  )}
                </Stack>
              ) : (
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{
                    flexWrap: 'nowrap',
                    gap: 1.5,
                    width: 'auto',
                    flexShrink: 0,
                    overflow: 'visible',
                    whiteSpace: 'nowrap',
                    alignItems: 'center',
                  }}
                >
                  <FormControl size="small" sx={{ minWidth: 160, flexShrink: 0 }}>
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

                  <FormControl size="small" sx={{ minWidth: 150, flexShrink: 0 }}>
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

                  <FormControl size="small" sx={{ minWidth: 180, flexShrink: 0 }}>
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

                  {hasFilters && (
                    <Button
                      variant="text"
                      color="inherit"
                      size="small"
                      onClick={handleClearFilters}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                      startIcon={<CloseIcon />}
                    >
                      Clear
                    </Button>
                  )}
                </Stack>
              )}

              {!isMobile && (
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={handleViewModeChange}
                  aria-label="View mode toggle"
                  size="small"
                  sx={{
                    backgroundColor: 'background.paper',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    flexShrink: 0,
                    '& .MuiToggleButtonGroup-grouped': {
                      minWidth: 40,
                      border: 'none',
                      '&:not(:first-of-type)': {
                        borderRadius: 2,
                      },
                      '&:first-of-type': {
                        borderRadius: 2,
                      },
                    },
                    '& .MuiToggleButton-root': {
                      color: 'text.secondary',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    },
                    '& .Mui-selected': {
                      color: 'error.main',
                      backgroundColor: 'transparent !important',
                      '&:hover': {
                        backgroundColor: 'action.hover !important',
                      },
                    },
                  }}
                >
                  <ToggleButton value="grid" aria-label="grid view">
                    <Tooltip title="Grid View">
                      <ViewModuleIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="list" aria-label="list view">
                    <Tooltip title="List View">
                      <ViewListIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="table" aria-label="table view">
                    <Tooltip title="Table View">
                      <TableChartIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
            </Stack>

            {isMobile && (
              <Collapse in={filtersExpanded} timeout="auto" unmountOnExit>
                <Stack spacing={1.5} sx={{ pt: 1 }}>
                  <FormControl size="small" fullWidth>
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

                  <FormControl size="small" fullWidth>
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

                  <FormControl size="small" fullWidth>
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
                </Stack>
              </Collapse>
            )}
          </Stack>
        </Paper>

        {/* Generated Reports Content */}
        {isLoadingReports ? (
          <Box sx={{ mt: 3 }}>
            {viewMode === 'grid' && (
              <LoadingSkeleton variant="card" count={6} height={280} />
            )}
            {viewMode === 'list' && (
              <LoadingSkeleton variant="list" count={5} showAvatar={true} height={120} />
            )}
            {viewMode === 'table' && <LoadingSkeleton variant="table" count={5} />}
          </Box>
        ) : filteredReports.length === 0 ? (
          <EmptyState
            icon={DescriptionIcon}
            iconColor="#dc2626"
            title="No reports yet"
            description="Generate your first report to track inspections, jobs, payments, and service requests. Create audit-ready outputs for your property management needs."
            actionLabel="Generate Report"
            onAction={handleStartNewReport}
          />
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <Grid container spacing={3}>
            {filteredReports.map((report) => {
              const createdAt = report.createdAt || report.created_at || report.createdDate;
              const coverage = REPORT_SECTIONS[report.reportType] || ['Audit Trail'];
              return (
                <Grid item xs={12} sm={6} md={4} key={report.id}>
                  <Card
                    sx={{
                      height: '100%',
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6,
                      },
                    }}
                  >
                    <CardContent>
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="h6" fontWeight={600} gutterBottom>
                            {REPORT_TYPES[report.reportType] || report.reportType}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Tracks updates for properties, units, payments, and upcoming work.
                          </Typography>
                        </Box>
                        <Divider />
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Scope
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {report.property?.name || 'All Properties'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {report.unit?.unitNumber ? `Unit ${report.unit.unitNumber}` : 'All Units'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            Coverage
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                            {coverage.slice(0, 3).map((section) => (
                              <Chip key={section} label={section} size="small" variant="outlined" />
                            ))}
                            {coverage.length > 3 && (
                              <Chip label={`+${coverage.length - 3}`} size="small" variant="outlined" />
                            )}
                          </Stack>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Created
                          </Typography>
                          <Typography variant="body2">
                            {createdAt ? format(new Date(createdAt), 'PP p') : 'Pending'}
                          </Typography>
                        </Box>
                        <Box>
                          {getStatusChip(report.status)}
                        </Box>
                        {report.status === 'COMPLETED' && (
                          <Stack spacing={1}>
                            <Button
                              variant="contained"
                              fullWidth
                              onClick={() => navigate(`/reports/${report.id}`)}
                              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                            >
                              View Report
                            </Button>
                            {report.fileUrl && (
                              <Button
                                variant="outlined"
                                fullWidth
                                href={resolveFileUrl(report.fileUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                              >
                                Download PDF
                              </Button>
                            )}
                          </Stack>
                        )}
                        {report.status === 'PROCESSING' && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={20} />
                            <Typography variant="body2" color="text.secondary">
                              Processing...
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        ) : viewMode === 'list' ? (
          /* List View */
          <Stack spacing={2}>
            {filteredReports.map((report) => {
              const createdAt = report.createdAt || report.created_at || report.createdDate;
              const coverage = REPORT_SECTIONS[report.reportType] || ['Audit Trail'];
              return (
                <Card
                  key={report.id}
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: 4,
                    },
                  }}
                >
                  <CardContent>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                      <Box flex={1}>
                        <Typography variant="h6" fontWeight={600}>
                          {REPORT_TYPES[report.reportType] || report.reportType}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {report.property?.name || 'All Properties'} • {report.unit?.unitNumber ? `Unit ${report.unit.unitNumber}` : 'All Units'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                        {coverage.slice(0, 2).map((section) => (
                          <Chip key={section} label={section} size="small" variant="outlined" />
                        ))}
                        {coverage.length > 2 && (
                          <Chip label={`+${coverage.length - 2}`} size="small" variant="outlined" />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {createdAt ? format(new Date(createdAt), 'PP') : 'Pending'}
                      </Typography>
                      {getStatusChip(report.status)}
                      {report.status === 'COMPLETED' && (
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => navigate(`/reports/${report.id}`)}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            View
                          </Button>
                          {report.fileUrl && (
                            <Button
                              variant="outlined"
                              size="small"
                              href={resolveFileUrl(report.fileUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              PDF
                            </Button>
                          )}
                        </Stack>
                      )}
                      {report.status === 'PROCESSING' && (
                        <CircularProgress size={20} />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        ) : (
          /* Table View */
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
                        {report.status === 'COMPLETED' && (
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => navigate(`/reports/${report.id}`)}
                              sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                              }}
                            >
                              View
                            </Button>
                            {report.fileUrl && (
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
                                PDF
                              </Button>
                            )}
                          </Stack>
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
      </PageShell>

      <Dialog
        open={isWizardOpen}
        onClose={handleCloseWizard}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 3 },
            maxHeight: { xs: '100vh', sm: '90vh' },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Generate report
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
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
            <Stepper activeStep={activeStep} alternativeLabel={!isMobile} orientation={isMobile ? 'vertical' : 'horizontal'} sx={{ pb: 1 }}>
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
