import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys.js';
import { format } from 'date-fns';
import { resolveFileUrl } from '../utils/fileUtils';
import toast from 'react-hot-toast';
import logger from '../utils/logger';
import SkeletonDetail from '../components/SkeletonDetail';
import Breadcrumbs from '../components/Breadcrumbs';

// Import report templates
import MaintenanceHistoryTemplate from '../components/reports/MaintenanceHistoryTemplate';
import UnitLedgerTemplate from '../components/reports/UnitLedgerTemplate';
import MaintenanceSummaryTemplate from '../components/reports/MaintenanceSummaryTemplate';
import FinancialSummaryTemplate from '../components/reports/FinancialSummaryTemplate';
import InspectionTrendsTemplate from '../components/reports/InspectionTrendsTemplate';
import JobCompletionTimelineTemplate from '../components/reports/JobCompletionTimelineTemplate';
import AssetConditionHistoryTemplate from '../components/reports/AssetConditionHistoryTemplate';
import PlannedVsExecutedTemplate from '../components/reports/PlannedVsExecutedTemplate';
import TenantIssueHistoryTemplate from '../components/reports/TenantIssueHistoryTemplate';

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

const REPORT_TEMPLATES = {
  MAINTENANCE_HISTORY: MaintenanceHistoryTemplate,
  UNIT_LEDGER: UnitLedgerTemplate,
  MAINTENANCE_SUMMARY: MaintenanceSummaryTemplate,
  FINANCIAL_SUMMARY: FinancialSummaryTemplate,
  INSPECTION_TRENDS: InspectionTrendsTemplate,
  JOB_COMPLETION_TIMELINE: JobCompletionTimelineTemplate,
  ASSET_CONDITION_HISTORY: AssetConditionHistoryTemplate,
  PLANNED_VS_EXECUTED: PlannedVsExecutedTemplate,
  TENANT_ISSUE_HISTORY: TenantIssueHistoryTemplate,
};

export default function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Fetch report metadata
  const { data: reportResponse, isLoading: isLoadingReport, error: reportError } = useQuery({
    queryKey: queryKeys.reports.detail(id),
    queryFn: async () => {
      const response = await apiClient.get(`/reports/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const report = reportResponse?.report || reportResponse;

  // Fetch report data
  const { data: reportDataResponse, isLoading: isLoadingData, error: dataError } = useQuery({
    queryKey: queryKeys.reports.data(id),
    queryFn: async () => {
      const response = await apiClient.get(`/reports/${id}/data`);
      return response.data?.data || response.data;
    },
    enabled: !!id && report?.status === 'COMPLETED',
    retry: false,
  });

  const reportData = reportDataResponse;

  const handleDownloadPDF = async () => {
    if (!report?.fileUrl) {
      toast.error('PDF file is not available for this report.');
      return;
    }

    try {
      setPdfGenerating(true);
      const response = await apiClient.get(`/reports/${id}/download`);
      
      if (response.data?.url) {
        window.open(resolveFileUrl(response.data.url), '_blank');
      } else if (report.fileUrl) {
        window.open(resolveFileUrl(report.fileUrl), '_blank');
      }
    } catch (error) {
      logger.error('Failed to download PDF:', error);
      toast.error('Failed to download PDF report. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handlePrint = () => {
    if (printRef.current) {
      window.print();
    }
  };

  if (isLoadingReport || isLoadingData) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <SkeletonDetail />
      </Container>
    );
  }

  if (reportError || dataError || !report) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {reportError?.message || dataError?.message || 'Failed to load report. Please try again.'}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/reports')}>
          Back to Reports
        </Button>
      </Container>
    );
  }

  if (report.status !== 'COMPLETED') {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          This report is still being processed. Please check back later.
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/reports')}>
          Back to Reports
        </Button>
      </Container>
    );
  }

  const ReportTemplate = REPORT_TEMPLATES[report.reportType];
  const reportTypeLabel = REPORT_TYPES[report.reportType] || report.reportType;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      <Breadcrumbs
        items={[
          { label: 'Reports', path: '/reports' },
          { label: reportTypeLabel },
        ]}
      />

      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {reportTypeLabel}
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            {report.property?.name}
            {report.unit?.unitNumber && ` • Unit ${report.unit.unitNumber}`}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip
              label={report.status}
              color={report.status === 'COMPLETED' ? 'success' : report.status === 'PROCESSING' ? 'info' : 'default'}
              size="small"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
              Generated: {report.createdAt ? format(new Date(report.createdAt), 'PPp') : 'N/A'}
            </Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/reports')}
          >
            Back
          </Button>
          {report.fileUrl && (
            <>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
              >
                Print
              </Button>
              <Button
                variant="contained"
                startIcon={pdfGenerating ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                onClick={handleDownloadPDF}
                disabled={pdfGenerating}
              >
                {pdfGenerating ? 'Generating...' : 'Download PDF'}
              </Button>
            </>
          )}
        </Stack>
      </Box>

      {/* Report Content */}
      <Paper
        ref={printRef}
        elevation={0}
        sx={{
          p: { xs: 2, md: 4 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          '@media print': {
            boxShadow: 'none',
            border: 'none',
            borderRadius: 0,
          },
        }}
      >
        {isLoadingData ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : ReportTemplate && reportData ? (
          <ReportTemplate reportData={reportData} report={report} />
        ) : (
          <Alert severity="warning">
            {!reportData ? 'Report data is not available yet.' : `Template not found for report type: ${report.reportType}`}
          </Alert>
        )}
      </Paper>
    </Container>
  );
}

