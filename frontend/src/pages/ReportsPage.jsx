import { useState, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Stack,
  TextField,
  Button,
  Alert,
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
  MenuItem,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { format } from 'date-fns';
import ensureArray from '../utils/ensureArray';
import { queryKeys } from '../utils/queryKeys.js';
import { resolveFileUrl } from '../utils/fileUtils';
import GradientButton from '../components/GradientButton';
import { Search as SearchIcon, Close as CloseIcon, FilterList as FilterListIcon } from '@mui/icons-material';
import ReportWizard from '../components/ReportWizard';
import { REPORT_TYPES, REPORT_SECTIONS } from '../constants/reportConstants';

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
  const [filterPropertyId, setFilterPropertyId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [lastQueuedMessage, setLastQueuedMessage] = useState('');

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
  });

  const handleWizardSubmit = (data, resetWizard) => {
    const payload = {
      ...data,
      fromDate: new Date(data.fromDate).toISOString(),
      toDate: new Date(data.toDate).toISOString(),
    };

    mutation.mutate(payload, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
        resetWizard?.();
        setSelectedPropertyId('');
        setWizardOpen(false);
        setLastQueuedMessage('Report generation has been queued. We will refresh this list once it finishes.');
      },
    });
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setSelectedPropertyId('');
    mutation.reset();
  };

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
                setLastQueuedMessage('');
                setWizardOpen(true);
              }}
            >
              Start New Report
            </GradientButton>
          </Stack>
        </Paper>

        {/* Wizard CTA */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
            background: 'linear-gradient(135deg, #fff7ed 0%, #fff1f2 100%)',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Generate reports with the guided wizard
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Launch the same multi-step workflow used across inspections, jobs, and service requests to keep report
                generation consistent.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} divider={<span style={{ width: 1 }} />}>
                <Chip label="Pick template" size="small" color="primary" variant="outlined" />
                <Chip label="Set scope" size="small" color="primary" variant="outlined" />
                <Chip label="Confirm dates" size="small" color="primary" variant="outlined" />
              </Stack>
              {lastQueuedMessage && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  {lastQueuedMessage}
                </Alert>
              )}
            </Box>
            <Stack direction={{ xs: 'row', md: 'column' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
              <GradientButton
                size="large"
                onClick={() => {
                  setLastQueuedMessage('');
                  setWizardOpen(true);
                }}
              >
                Generate Report
              </GradientButton>
              <Button
                variant="outlined"
                onClick={() => {
                  setLastQueuedMessage('');
                  setWizardOpen(true);
                }}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                Use Wizard
              </Button>
            </Stack>
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
            <GradientButton
              size="medium"
              sx={{ mt: 1.5 }}
              onClick={() => {
                setLastQueuedMessage('');
                setWizardOpen(true);
              }}
            >
              Generate Report
            </GradientButton>
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

        <ReportWizard
          open={wizardOpen}
          onClose={closeWizard}
          onSubmit={handleWizardSubmit}
          propertiesData={propertiesData}
          unitsData={unitsData}
          isLoadingProperties={isLoadingProperties}
          isLoadingUnits={isLoadingUnits}
          onPropertyChange={setSelectedPropertyId}
          isSubmitting={mutation.isPending}
          serverError={mutation.error?.message}
        />
      </Stack>
    </Container>
  );
}
