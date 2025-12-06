import React, { useState } from 'react';
import { Box, Typography, Alert, Grid, Paper, List, ListItem, ListItemText, Chip, Divider, Button, CircularProgress } from '@mui/material';
import toast from 'react-hot-toast';
import SignatureCapture from '../SignatureCapture';
import { apiClient } from '../../api/client';

export const InspectionStepReview = ({ inspection, rooms, issues, onComplete, isCompleting, isMobile = false }) => {
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [signatureBlob, setSignatureBlob] = useState(null);
  
  const signatureRequired = inspection.type === 'MOVE_IN' || inspection.type === 'MOVE_OUT';

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
    onComplete({ 
      findings: `Completed with ${rooms.length} rooms and ${issues.length} issues.` // Simplified
    });
  };

  return (
    <Box>
      <Typography variant={isMobile ? 'subtitle1' : 'h6'} gutterBottom>Review & Complete Inspection</Typography>
      <Alert severity="success" sx={{ mb: isMobile ? 2 : 3 }}>
        Review all the data below and click "Complete Inspection" when ready.
      </Alert>

      <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: isMobile ? 2 : 3 }}>
        <Grid item xs={4}>
          <Paper sx={{ p: isMobile ? 1.5 : 2, textAlign: 'center' }}>
            <Typography variant={isMobile ? 'h4' : 'h3'} color="primary">{rooms.length}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.75rem' : undefined }}>
              Rooms Inspected
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: isMobile ? 1.5 : 2, textAlign: 'center' }}>
            <Typography variant={isMobile ? 'h4' : 'h3'} color="warning.main">{issues.length}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.75rem' : undefined }}>
              Issues Found
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: isMobile ? 1.5 : 2, textAlign: 'center' }}>
            <Typography variant={isMobile ? 'h4' : 'h3'} color="info.main">
              {rooms.reduce((sum, r) => sum + (r.photos?.length || 0), 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.75rem' : undefined }}>
              Photos Taken
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {issues.length > 0 && (
        <Box sx={{ mb: 3 }}>
           <Typography variant="subtitle1">Issues Found:</Typography>
           <List>
             {issues.map(issue => (
               <ListItem key={issue.id}>
                 <ListItemText 
                   primary={issue.title} 
                   secondary={`${issue.room?.name || 'General'} - ${issue.severity}`} 
                 />
                 <Chip label={issue.severity} size="small" color={issue.severity === 'CRITICAL' ? 'error' : 'warning'} />
               </ListItem>
             ))}
           </List>
        </Box>
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
