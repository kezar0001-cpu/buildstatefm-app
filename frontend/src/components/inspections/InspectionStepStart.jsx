import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';

export const InspectionStepStart = ({ inspection, onStart }) => {
  return (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <Typography variant="h5" gutterBottom>
        Ready to start inspection?
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {inspection.title} - {inspection.type}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Property: {inspection.property?.name}
        {inspection.unit && ` - Unit ${inspection.unit.unitNumber}`}
      </Typography>
      <Alert severity="info" sx={{ mb: 3, textAlign: 'left', maxWidth: 600, mx: 'auto' }}>
        This will mark the inspection as IN PROGRESS. You'll be able to add rooms, checklists, and
        document issues as you go through the property.
      </Alert>
      <Button
        variant="contained"
        size="large"
        onClick={onStart}
      >
        Start Inspection
      </Button>
    </Box>
  );
};
