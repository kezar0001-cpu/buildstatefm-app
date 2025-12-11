import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Stack,
  Avatar,
  Skeleton,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Photo as PhotoIcon,
  Room as RoomIcon,
  AutoAwesome as AutoAwesomeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ReportProblem as IssueIcon,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import SignatureCapture from '../SignatureCapture';
import { apiClient } from '../../api/client';

export const InspectionStepReview = ({ inspection, rooms, issues, onComplete, isCompleting, isMobile = false }) => {
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [signatureBlob, setSignatureBlob] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  // In the conduct flow, checklist items are treated as issues
  const allIssues = rooms.flatMap((r) => r.checklistItems || r.InspectionChecklistItem || []);

  // Status and priority helpers
  const STATUS_LABELS = {
    PENDING: 'Pending',
    PASSED: 'Passed',
    FAILED: 'Failed',
    NA: 'N/A',
  };

  const PRIORITY_CONFIG = {
    CRITICAL: { color: 'error', label: 'Critical' },
    HIGH: { color: 'error', label: 'High' },
    MEDIUM: { color: 'warning', label: 'Medium' },
    LOW: { color: 'info', label: 'Low' },
  };

  const signatureRequired = inspection.type === 'MOVE_IN' || inspection.type === 'MOVE_OUT';

  // Calculate metrics - handle both Prisma model names and aliased names
  const totalPhotos = rooms.reduce((sum, r) => {
    const roomPhotos = (r.photos || r.InspectionPhoto || []).length;
    return sum + roomPhotos;
  }, 0);
  const criticalIssues = allIssues.filter(
    (i) => i.severity === 'CRITICAL' || i.severity === 'HIGH'
  );

  // Generate AI summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inspections/${inspection.id}/generate-summary`);
      return response.data;
    },
    onSuccess: (data) => {
      setAiSummary(data.summary);
    },
    onError: (error) => {
      console.error('Failed to generate summary:', error);
      // Generate a fallback summary locally
      const fallbackSummary = generateLocalSummary();
      setAiSummary(fallbackSummary);
    },
  });

  // Generate a local fallback summary if AI fails
  const generateLocalSummary = () => {
    const roomNames = rooms.map((r) => r.name).join(', ');
    const issueCount = allIssues.length;
    const criticalCount = criticalIssues.length;
    
    let summary = `This ${inspection.type.toLowerCase().replace('_', ' ')} inspection covered ${rooms.length} room${rooms.length !== 1 ? 's' : ''} (${roomNames}). `;
    
    if (issueCount === 0) {
      summary += 'No issues were identified during the inspection. The property appears to be in good condition.';
    } else {
      summary += `A total of ${issueCount} issue${issueCount !== 1 ? 's were' : ' was'} identified. `;
      if (criticalCount > 0) {
        summary += `${criticalCount} ${criticalCount === 1 ? 'issue requires' : 'issues require'} immediate attention. `;
      }
      summary += `${totalPhotos} photo${totalPhotos !== 1 ? 's were' : ' was'} taken to document the findings.`;
    }
    
    return summary;
  };

  // Auto-generate summary on mount
  useEffect(() => {
    if (!aiSummary && rooms.length > 0) {
      generateSummaryMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignatureSave = (blob, dataURL) => {
    setSignatureBlob(blob);
    setSignaturePreview(dataURL);
  };

  const handleComplete = async () => {
    // Handle signature upload if needed before completing
    if (signatureRequired && signatureBlob && !inspection.tenantSignature) {
      try {
        const formData = new FormData();
        formData.append('signature', signatureBlob, 'signature.png');
        await apiClient.post(`/inspections/${inspection.id}/signature`, formData, {
           headers: { 'Content-Type': 'multipart/form-data' }
        });
      } catch (e) {
        console.error('Failed to upload signature', e);
        toast.error('Failed to save signature. Please try again.');
        return;
      }
    }
    
    // Include the AI summary in the findings
    const findings = aiSummary || generateLocalSummary();
    
    onComplete({ 
      findings,
      notes: `Inspection completed. ${rooms.length} rooms inspected, ${allIssues.length} issues documented, ${totalPhotos} photos taken.`
    });
  };

  return (
    <Box>
      <Typography variant={isMobile ? 'subtitle1' : 'h6'} gutterBottom>Review & Complete Inspection</Typography>
      
      {criticalIssues.length > 0 ? (
        <Alert severity="warning" sx={{ mb: isMobile ? 2 : 3 }}>
          <strong>{criticalIssues.length} critical/high priority issue{criticalIssues.length !== 1 ? 's' : ''}</strong> found. 
          Review the summary below before completing.
        </Alert>
      ) : (
        <Alert severity="success" sx={{ mb: isMobile ? 2 : 3 }}>
          Review all the data below and click "Complete Inspection" when ready.
        </Alert>
      )}

      {/* Metrics Cards */}
      <Grid container spacing={isMobile ? 1.5 : 2} sx={{ mb: isMobile ? 2 : 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: isMobile ? 1.5 : 2, textAlign: 'center', bgcolor: 'primary.lighter' }}>
            <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
              <RoomIcon />
            </Avatar>
            <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={700} color="primary.main">
              {rooms.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Rooms
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: isMobile ? 1.5 : 2, textAlign: 'center', bgcolor: allIssues.length > 0 ? 'warning.lighter' : 'success.lighter' }}>
            <Avatar sx={{ bgcolor: allIssues.length > 0 ? 'warning.main' : 'success.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
              {allIssues.length > 0 ? <IssueIcon /> : <CheckCircleIcon />}
            </Avatar>
            <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={700} color={allIssues.length > 0 ? 'warning.main' : 'success.main'}>
              {allIssues.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Issues
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: isMobile ? 1.5 : 2, textAlign: 'center', bgcolor: 'info.lighter' }}>
            <Avatar sx={{ bgcolor: 'info.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
              <PhotoIcon />
            </Avatar>
            <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={700} color="info.main">
              {totalPhotos}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Photos
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: isMobile ? 1.5 : 2, textAlign: 'center', bgcolor: criticalIssues.length > 0 ? 'error.lighter' : 'grey.100' }}>
            <Avatar sx={{ bgcolor: criticalIssues.length > 0 ? 'error.main' : 'grey.400', mx: 'auto', mb: 1, width: 40, height: 40 }}>
              <WarningIcon />
            </Avatar>
            <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={700} color={criticalIssues.length > 0 ? 'error.main' : 'text.secondary'}>
              {criticalIssues.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Critical
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* AI Summary Card */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoAwesomeIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>
                Inspection Summary
              </Typography>
            </Stack>
            <IconButton size="small" onClick={() => setSummaryExpanded(!summaryExpanded)}>
              {summaryExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
          <Collapse in={summaryExpanded}>
            {generateSummaryMutation.isPending ? (
              <Box>
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="90%" />
                <Skeleton variant="text" width="95%" />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {aiSummary || 'Generating summary...'}
              </Typography>
            )}
            {!generateSummaryMutation.isPending && (
              <Button
                size="small"
                startIcon={<AutoAwesomeIcon />}
                onClick={() => generateSummaryMutation.mutate()}
                sx={{ mt: 1 }}
                disabled={generateSummaryMutation.isPending}
              >
                Regenerate Summary
              </Button>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {/* Room-by-Room Summary */}
      {rooms.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Room Details
            </Typography>
            <List disablePadding>
              {rooms.map((room, index) => {
                const roomIssues = room.checklistItems || room.InspectionChecklistItem || [];
                const roomPhotos = (room.photos || room.InspectionPhoto || []).length;
                return (
                  <React.Fragment key={room.id}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={600}>
                              {room.name}
                            </Typography>
                            {roomIssues.length > 0 && (
                              <Chip
                                label={`${roomIssues.length} issue${roomIssues.length !== 1 ? 's' : ''}`}
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            )}
                            {roomPhotos > 0 && (
                              <Chip
                                label={`${roomPhotos} photo${roomPhotos !== 1 ? 's' : ''}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        }
                        secondary={room.notes ? room.notes.substring(0, 100) + (room.notes.length > 100 ? '...' : '') : 'No notes'}
                      />
                    </ListItem>
                    {index < rooms.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Issues List (checklist items treated as issues) */}
      {allIssues.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              All Issues ({allIssues.length})
            </Typography>
            <List disablePadding>
              {allIssues.slice(0, 10).map((issue, index) => (
                <React.Fragment key={issue.id}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText
                      primary={issue.description || issue.title}
                      secondary={
                        issue.notes
                          ? issue.notes
                          : `Status: ${STATUS_LABELS[issue.status] || STATUS_LABELS.PENDING}`
                      }
                    />
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={STATUS_LABELS[issue.status] || STATUS_LABELS.PENDING}
                        size="small"
                        color={
                          issue.status === 'PASSED'
                            ? 'success'
                            : issue.status === 'FAILED'
                            ? 'error'
                            : 'default'
                        }
                        variant="outlined"
                      />
                      <Chip
                        label={
                          (PRIORITY_CONFIG[issue.severity]?.label || issue.severity || 'Medium')
                        }
                        size="small"
                        color={PRIORITY_CONFIG[issue.severity]?.color || 'warning'}
                        variant={
                          issue.severity === 'CRITICAL' || issue.severity === 'HIGH'
                            ? 'filled'
                            : 'outlined'
                        }
                      />
                    </Stack>
                  </ListItem>
                  {index < Math.min(allIssues.length, 10) - 1 && <Divider />}
                </React.Fragment>
              ))}
              {allIssues.length > 10 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  + {allIssues.length - 10} more issues
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>
      )}

      {signatureRequired && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="subtitle1" sx={{ mb: 2 }}>Tenant Signature</Typography>
          
          {inspection.tenantSignature ? (
             <Paper sx={{ p: 2, display: 'inline-block' }}>
               <img src={inspection.tenantSignature} alt="Signature" style={{ maxWidth: 300 }} />
               <Typography variant="caption" display="block">Captured</Typography>
             </Paper>
          ) : signaturePreview ? (
             <Paper sx={{ p: 2, display: 'inline-block' }}>
               <img src={signaturePreview} alt="Signature Preview" style={{ maxWidth: 300 }} />
               <Typography variant="caption" display="block">Ready to save</Typography>
             </Paper>
          ) : (
             <SignatureCapture onSave={handleSignatureSave} />
          )}
        </Box>
      )}

      <Box sx={{ mt: isMobile ? 3 : 4, textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          color="success"
          onClick={handleComplete}
          disabled={isCompleting || (signatureRequired && !signaturePreview && !inspection.tenantSignature)}
          fullWidth={isMobile}
          sx={{
            minHeight: isMobile ? 48 : undefined,
            py: isMobile ? 1.5 : undefined,
          }}
        >
          {isCompleting ? <CircularProgress size={24} /> : 'Complete Inspection'}
        </Button>
      </Box>
    </Box>
  );
};
