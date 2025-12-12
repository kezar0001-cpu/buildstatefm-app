import React, { useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import {
  Print as PrintIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Business as BusinessIcon,
  Upload as UploadIcon,
  ReportProblem as ReportProblemIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import DataState from '../components/DataState';
import { formatDateTime, formatDate } from '../utils/date';
import { queryKeys } from '../utils/queryKeys';
import { useReactToPrint } from 'react-to-print';

const A4_MARGIN_MM = 15;

const printStyles = `
  @media print {
    @page {
      size: A4 portrait;
      margin: ${A4_MARGIN_MM}mm;
    }
    
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    
    .no-print {
      display: none !important;
    }
    
    .print-only {
      display: block !important;
    }
    
    .page-break {
      break-before: page;
      page-break-before: always;
    }
    
    .avoid-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .allow-break {
      break-inside: auto;
      page-break-inside: auto;
    }
    
    .report-container {
      width: 100% !important;
      max-width: none !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
    }
    
    img {
      max-width: 100% !important;
      height: auto !important;
      page-break-inside: avoid;
    }

    .print-grid {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 12px !important;
    }

    .print-grid > * {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`;

function parsePriorityFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return 'MEDIUM';
  const match = notes.match(/Priority:\s*(LOW|MEDIUM|HIGH|CRITICAL|URGENT)/i);
  if (match) {
    const priority = match[1].toUpperCase();
    return priority === 'URGENT' ? 'CRITICAL' : priority;
  }
  return 'MEDIUM';
}

const SEVERITY_CONFIG = {
  CRITICAL: { color: 'error', label: 'Critical', bgColor: '#FFEBEE', textColor: '#C62828' },
  HIGH: { color: 'error', label: 'High', bgColor: '#FFEBEE', textColor: '#C62828' },
  MEDIUM: { color: 'warning', label: 'Medium', bgColor: '#FFF3E0', textColor: '#E65100' },
  LOW: { color: 'info', label: 'Low', bgColor: '#E3F2FD', textColor: '#1565C0' },
};

const InspectionReportPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const [companyLogoUrl, setCompanyLogoUrl] = useState(() => {
    return localStorage.getItem('inspectionReport_companyLogo') || '';
  });
  const [companyName, setCompanyName] = useState(() => {
    return localStorage.getItem('inspectionReport_companyName') || '';
  });
  const [companyAddress, setCompanyAddress] = useState(() => {
    return localStorage.getItem('inspectionReport_companyAddress') || '';
  });
  const [companyPhone, setCompanyPhone] = useState(() => {
    return localStorage.getItem('inspectionReport_companyPhone') || '';
  });
  const [companyEmail, setCompanyEmail] = useState(() => {
    return localStorage.getItem('inspectionReport_companyEmail') || '';
  });
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const { data: batchedData, isLoading, error } = useQuery({
    queryKey: queryKeys.inspections.batchedDetail(id),
    queryFn: async () => {
      const response = await apiClient.get(`/inspections/${id}/batch`);
      return response.data;
    },
  });

  const inspection = batchedData?.inspection;

  const normalizedData = useMemo(() => {
    if (!inspection) return { rooms: [], issues: [], photos: [] };

    const rooms = (inspection.rooms || inspection.InspectionRoom || []).map((room) => ({
      ...room,
      checklistItems: room.checklistItems || room.InspectionChecklistItem || [],
      photos: room.photos || room.InspectionPhoto || [],
    }));

    const rawIssues = inspection.issues || inspection.InspectionIssue || [];
    let issues = rawIssues.map((issue) => ({
      ...issue,
      room: issue.room || issue.InspectionRoom || null,
      photos: issue.photos || issue.InspectionPhoto || [],
      severity: issue.severity || parsePriorityFromNotes(issue.notes),
    }));

    if (issues.length === 0) {
      const derivedIssues = [];
      rooms.forEach((room) => {
        const checklistItems = room.checklistItems || [];
        const roomPhotos = room.photos || [];

        checklistItems.forEach((item) => {
          const linkedPhotos = roomPhotos.filter((photo) =>
            typeof photo.caption === 'string' ? photo.caption.includes(item.id) : false
          );

          const priority = parsePriorityFromNotes(item.notes);

          derivedIssues.push({
            id: item.id,
            title: item.description,
            description: item.notes,
            severity: priority,
            status: item.status,
            room: { id: room.id, name: room.name },
            photos: linkedPhotos.length > 0 ? linkedPhotos : roomPhotos.slice(0, 2),
          });
        });
      });
      issues = derivedIssues;
    }

    const allPhotos = [
      ...rooms.flatMap((r) => r.photos || []),
      ...issues.flatMap((i) => i.photos || []),
    ];
    const uniquePhotos = Array.from(new Map(allPhotos.map((p) => [p.id || p.url, p])).values());

    return { rooms, issues, photos: uniquePhotos };
  }, [inspection]);

  const { rooms, issues, photos } = normalizedData;

  const metrics = useMemo(() => {
    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;
    const mediumCount = issues.filter((i) => i.severity === 'MEDIUM').length;
    const lowCount = issues.filter((i) => i.severity === 'LOW').length;
    return { total: issues.length, critical: criticalCount, medium: mediumCount, low: lowCount };
  }, [issues]);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Inspection_Report_${inspection?.title?.replace(/\s+/g, '_') || id}_${new Date().toISOString().split('T')[0]}`,
    pageStyle: printStyles,
  });

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setCompanyLogoUrl(base64);
        localStorage.setItem('inspectionReport_companyLogo', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('inspectionReport_companyName', companyName);
    localStorage.setItem('inspectionReport_companyAddress', companyAddress);
    localStorage.setItem('inspectionReport_companyPhone', companyPhone);
    localStorage.setItem('inspectionReport_companyEmail', companyEmail);
    setSettingsDialogOpen(false);
  };

  const handleRemoveLogo = () => {
    setCompanyLogoUrl('');
    localStorage.removeItem('inspectionReport_companyLogo');
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <DataState type="loading" message="Loading inspection report..." />
      </Container>
    );
  }

  if (error || !inspection) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <DataState type="error" message="Failed to load inspection report" />
      </Container>
    );
  }

  const getSeverityConfig = (severity) => SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.MEDIUM;

  const reportBgColor = isDarkMode ? 'background.paper' : '#FFFFFF';
  const reportTextColor = isDarkMode ? 'text.primary' : '#212121';
  const sectionBgColor = isDarkMode ? 'action.hover' : '#FAFAFA';

  return (
    <>
      <style>{printStyles}</style>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Action Buttons - Hidden on print */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ mb: 3 }}
          className="no-print"
        >
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/inspections/${id}`)}>
            Back to Details
          </Button>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<BusinessIcon />}
              onClick={() => setSettingsDialogOpen(true)}
            >
              Company Info
            </Button>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>
              Print / Save PDF
            </Button>
          </Stack>
        </Stack>

        {/* Printable Report Container */}
        <Paper
          ref={printRef}
          className="report-container"
          elevation={isDarkMode ? 0 : 2}
          sx={{
            p: { xs: 2, sm: 4 },
            bgcolor: reportBgColor,
            color: reportTextColor,
            minHeight: '297mm',
            '@media print': {
              boxShadow: 'none',
              bgcolor: '#FFFFFF',
              color: '#212121',
            },
          }}
        >
          {/* ===== REPORT HEADER WITH COMPANY BRANDING ===== */}
          <Box
            className="avoid-break"
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 4,
              pb: 3,
              borderBottom: '2px solid',
              borderColor: 'divider',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            {/* Company Logo & Info (Left) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {companyLogoUrl ? (
                <Box
                  component="img"
                  src={companyLogoUrl}
                  alt="Company Logo"
                  sx={{
                    maxHeight: 80,
                    maxWidth: 200,
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '@media print': { display: 'none' },
                  }}
                  className="no-print"
                >
                  <BusinessIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                </Box>
              )}
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  {companyName || 'Property Management Company'}
                </Typography>
                {companyAddress && (
                  <Typography variant="body2" color="text.secondary">
                    {companyAddress}
                  </Typography>
                )}
                <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                  {companyPhone && (
                    <Typography variant="body2" color="text.secondary">
                      {companyPhone}
                    </Typography>
                  )}
                  {companyEmail && (
                    <Typography variant="body2" color="text.secondary">
                      {companyEmail}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Box>

            {/* Report Title (Right) */}
            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography variant="h4" fontWeight={700} color="primary.main">
                INSPECTION REPORT
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Report Date: {formatDate(new Date())}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Report ID: {id?.slice(0, 8).toUpperCase()}
              </Typography>
            </Box>
          </Box>

          {/* ===== INSPECTION DETAILS SECTION ===== */}
          <Box className="avoid-break" sx={{ mb: 4 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              Inspection Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: sectionBgColor }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    INSPECTION TITLE
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {inspection.title}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: sectionBgColor }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    TYPE
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {inspection.type}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: sectionBgColor }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    STATUS
                  </Typography>
                  <Chip
                    label={inspection.status}
                    color={inspection.status === 'COMPLETED' ? 'success' : 'default'}
                    size="small"
                    sx={{ mt: 0.5 }}
                  />
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: sectionBgColor }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    PROPERTY
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {inspection.property?.name || 'N/A'}
                  </Typography>
                  {inspection.property?.address && (
                    <Typography variant="body2" color="text.secondary">
                      {inspection.property.address}
                      {inspection.property.city && `, ${inspection.property.city}`}
                      {inspection.property.state && `, ${inspection.property.state}`}
                    </Typography>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: sectionBgColor }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    UNIT
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {inspection.unit ? `Unit ${inspection.unit.unitNumber}` : 'Common Areas'}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: sectionBgColor }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    INSPECTION DATE
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {formatDate(inspection.completedDate || inspection.scheduledDate)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: sectionBgColor }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    CONDUCTED BY
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {inspection.completedBy
                      ? `${inspection.completedBy.firstName} ${inspection.completedBy.lastName}`
                      : inspection.assignedTo
                      ? `${inspection.assignedTo.firstName} ${inspection.assignedTo.lastName}`
                      : 'Not assigned'}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          {/* ===== EXECUTIVE SUMMARY ===== */}
          <Box className="avoid-break" sx={{ mb: 4 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              Executive Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '@media print': { bgcolor: '#1976D2', color: '#FFFFFF' },
                  }}
                >
                  <Typography variant="h3" fontWeight={700}>
                    {rooms.length}
                  </Typography>
                  <Typography variant="body2">Rooms Inspected</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: metrics.total > 0 ? 'warning.main' : 'success.main',
                    color: metrics.total > 0 ? 'warning.contrastText' : 'success.contrastText',
                    '@media print': { bgcolor: metrics.total > 0 ? '#ED6C02' : '#2E7D32', color: '#FFFFFF' },
                  }}
                >
                  <Typography variant="h3" fontWeight={700}>
                    {metrics.total}
                  </Typography>
                  <Typography variant="body2">Issues Found</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: metrics.critical > 0 ? 'error.main' : 'success.main',
                    color: metrics.critical > 0 ? 'error.contrastText' : 'success.contrastText',
                    '@media print': { bgcolor: metrics.critical > 0 ? '#D32F2F' : '#2E7D32', color: '#FFFFFF' },
                  }}
                >
                  <Typography variant="h3" fontWeight={700}>
                    {metrics.critical}
                  </Typography>
                  <Typography variant="body2">Critical/High</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'info.main',
                    color: 'info.contrastText',
                    '@media print': { bgcolor: '#0288D1', color: '#FFFFFF' },
                  }}
                >
                  <Typography variant="h3" fontWeight={700}>
                    {photos.length}
                  </Typography>
                  <Typography variant="body2">Photos Taken</Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Condition Assessment */}
            {metrics.total === 0 ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body1" fontWeight={600}>
                  Excellent Condition
                </Typography>
                <Typography variant="body2">
                  No issues were identified during this inspection. The property is in good condition.
                </Typography>
              </Alert>
            ) : metrics.critical > 0 ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="body1" fontWeight={600}>
                  Attention Required
                </Typography>
                <Typography variant="body2">
                  {metrics.critical} critical/high priority issue{metrics.critical !== 1 ? 's' : ''} require{metrics.critical === 1 ? 's' : ''} immediate attention.
                </Typography>
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body1" fontWeight={600}>
                  Minor Issues Found
                </Typography>
                <Typography variant="body2">
                  {metrics.total} issue{metrics.total !== 1 ? 's' : ''} identified. Review recommended actions below.
                </Typography>
              </Alert>
            )}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* ===== ISSUES FOUND SECTION ===== */}
          {issues.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                Issues Found ({metrics.total})
              </Typography>

              {issues.map((issue, index) => {
                const severityConfig = getSeverityConfig(issue.severity);
                const issuePhotos = issue.photos || [];

                return (
                  <Card
                    key={issue.id}
                    className="allow-break"
                    variant="outlined"
                    sx={{
                      mb: 3,
                      borderLeft: 4,
                      borderLeftColor: `${severityConfig.color}.main`,
                    }}
                  >
                    <CardContent>
                      {/* Issue Header */}
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight={700}>
                              Issue #{index + 1}: {issue.title}
                            </Typography>
                            <Chip
                              label={severityConfig.label}
                              color={severityConfig.color}
                              size="small"
                            />
                          </Stack>
                          {issue.room?.name && (
                            <Typography variant="body2" color="text.secondary">
                              Location: {issue.room.name}
                            </Typography>
                          )}
                        </Box>
                      </Stack>

                      {/* Issue Description */}
                      {issue.description && (
                        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: sectionBgColor }}>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {issue.description}
                          </Typography>
                        </Paper>
                      )}

                      {/* Issue Photos - Large format for A4 printing */}
                      {issuePhotos.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Evidence Photos ({issuePhotos.length})
                          </Typography>
                          <Grid container spacing={2} className="print-grid">
                            {issuePhotos.map((photo, photoIndex) => (
                              <Grid item xs={12} sm={6} key={photo.id || photoIndex}>
                                <Paper
                                  variant="outlined"
                                  className="avoid-break"
                                  sx={{
                                    p: 1,
                                    bgcolor: sectionBgColor,
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={photo.url || photo.imageUrl}
                                    alt={photo.caption || `Issue photo ${photoIndex + 1}`}
                                    sx={{
                                      width: '100%',
                                      height: 280,
                                      objectFit: 'cover',
                                      borderRadius: 1,
                                      display: 'block',
                                    }}
                                  />
                                  {photo.caption && (
                                    <Typography variant="caption" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                                      {photo.caption}
                                    </Typography>
                                  )}
                                </Paper>
                              </Grid>
                            ))}
                          </Grid>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}

          {/* ===== ROOM-BY-ROOM DETAILS ===== */}
          {rooms.length > 0 && (
            <>
              <Box className="page-break" />
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  Room-by-Room Inspection
                </Typography>

                {rooms.map((room, index) => {
                  const roomPhotos = room.photos || [];
                  const checklistItems = room.checklistItems || [];

                  return (
                    <Card key={room.id} className="allow-break" variant="outlined" sx={{ mb: 3 }}>
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>
                            {index + 1}. {room.name}
                          </Typography>
                          {room.roomType && (
                            <Chip label={room.roomType.replace(/_/g, ' ')} size="small" variant="outlined" />
                          )}
                        </Stack>

                        {room.notes && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            {room.notes}
                          </Alert>
                        )}

                        {/* Checklist Items Table */}
                        {checklistItems.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Documented Items ({checklistItems.length})
                            </Typography>
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: sectionBgColor }}>
                                    <TableCell sx={{ fontWeight: 600 }}>Item</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Priority</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {checklistItems.map((item) => {
                                    const itemPriority = parsePriorityFromNotes(item.notes);
                                    const itemSeverity = getSeverityConfig(itemPriority);
                                    return (
                                      <TableRow key={item.id}>
                                        <TableCell>{item.description}</TableCell>
                                        <TableCell>
                                          <Chip
                                            label={itemSeverity.label}
                                            size="small"
                                            color={itemSeverity.color}
                                          />
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 300 }}>
                                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                            {item.notes || '-'}
                                          </Typography>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Box>
                        )}

                        {/* Room Photos */}
                        {roomPhotos.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Room Photos ({roomPhotos.length})
                            </Typography>
                            <Grid container spacing={2} className="print-grid">
                              {roomPhotos.map((photo, photoIndex) => (
                                <Grid item xs={12} sm={6} key={photo.id || photoIndex}>
                                  <Paper variant="outlined" className="avoid-break" sx={{ p: 1, bgcolor: sectionBgColor }}>
                                    <Box
                                      component="img"
                                      src={photo.url || photo.imageUrl}
                                      alt={photo.caption || `Room photo ${photoIndex + 1}`}
                                      sx={{
                                        width: '100%',
                                        height: 240,
                                        objectFit: 'cover',
                                        borderRadius: 1,
                                        display: 'block',
                                      }}
                                    />
                                    {photo.caption && (
                                      <Typography variant="caption" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                                        {photo.caption}
                                      </Typography>
                                    )}
                                  </Paper>
                                </Grid>
                              ))}
                            </Grid>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </>
          )}

          {/* ===== INSPECTOR FINDINGS ===== */}
          {inspection.findings && (
            <>
              <Divider sx={{ my: 3 }} />
              <Box className="avoid-break" sx={{ mb: 4 }}>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  Inspector Findings
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: sectionBgColor }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {inspection.findings}
                  </Typography>
                </Paper>
              </Box>
            </>
          )}

          {/* ===== ADDITIONAL NOTES ===== */}
          {inspection.notes && (
            <>
              <Divider sx={{ my: 3 }} />
              <Box className="avoid-break" sx={{ mb: 4 }}>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  Additional Notes
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: sectionBgColor }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {inspection.notes}
                  </Typography>
                </Paper>
              </Box>
            </>
          )}

          {/* ===== REPORT FOOTER ===== */}
          <Divider sx={{ my: 3 }} />
          <Box className="avoid-break" sx={{ mt: 4, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  This report was generated on {formatDateTime(new Date())}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Report ID: {inspection.id}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                <Typography variant="body2" color="text.secondary">
                  {companyName || 'Property Management Company'}
                </Typography>
                {companyPhone && (
                  <Typography variant="body2" color="text.secondary">
                    {companyPhone}
                  </Typography>
                )}
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
              This is an official inspection report. Please retain for your records.
            </Typography>
          </Box>
        </Paper>
      </Container>

      {/* ===== COMPANY SETTINGS DIALOG ===== */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Company Information</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add your company branding to appear on printed reports. This information is saved locally.
          </Typography>

          {/* Logo Upload */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Company Logo
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              {companyLogoUrl ? (
                <Box
                  component="img"
                  src={companyLogoUrl}
                  alt="Company Logo Preview"
                  sx={{ maxHeight: 60, maxWidth: 150, objectFit: 'contain', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0.5 }}
                />
              ) : (
                <Box
                  sx={{
                    width: 100,
                    height: 60,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BusinessIcon color="disabled" />
                </Box>
              )}
              <Button variant="outlined" component="label" startIcon={<UploadIcon />}>
                Upload Logo
                <input type="file" hidden accept="image/*" onChange={handleLogoUpload} />
              </Button>
              {companyLogoUrl && (
                <Button variant="text" color="error" onClick={handleRemoveLogo}>
                  Remove
                </Button>
              )}
            </Stack>
          </Box>

          <TextField
            fullWidth
            label="Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Address"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSettings}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default InspectionReportPage;
