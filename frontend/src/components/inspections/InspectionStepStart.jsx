import React from 'react';
import { Box, Typography, Button, Alert, Stack } from '@mui/material';
import InspectionChecklistPreview from '../InspectionChecklistPreview';

export const InspectionStepStart = ({ inspection, rooms, issues, onStart, isMobile = false }) => {
  return (
    <Box sx={{ py: isMobile ? 2 : 4 }}>
      <Box sx={{ textAlign: 'center', mb: isMobile ? 2 : 4 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>
          Ready to start inspection?
        </Typography>
        <Typography variant={isMobile ? 'body2' : 'body1'} color="text.secondary" sx={{ mb: isMobile ? 2 : 3 }}>
          {inspection.title} - {inspection.type}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: isMobile ? 2 : 3 }}>
          Property: {inspection.property?.name}
          {inspection.unit && ` - Unit ${inspection.unit.unitNumber}`}
        </Typography>
        <Alert severity="info" sx={{ mb: isMobile ? 2 : 3, textAlign: 'left', maxWidth: isMobile ? '100%' : 600, mx: 'auto' }}>
          This will mark the inspection as IN PROGRESS. You'll be able to add rooms, checklists, and
          document issues as you go through the property.
        </Alert>
      </Box>

      {/* Checklist Preview */}
      {!isMobile && (
        <Stack spacing={3} sx={{ maxWidth: 800, mx: 'auto', mb: 4 }}>
          <InspectionChecklistPreview inspection={inspection} rooms={rooms} issues={issues} />
        </Stack>
      )}

      {/* Start Button */}
      <Box sx={{ textAlign: 'center' }}>
        <Button
          variant="contained"
          size={isMobile ? 'large' : 'large'}
          onClick={onStart}
          fullWidth={isMobile}
          sx={{
            minHeight: isMobile ? 48 : undefined,
            py: isMobile ? 1.5 : undefined,
          }}
        >
          Start Inspection
        </Button>
      </Box>
    </Box>
  );
};
