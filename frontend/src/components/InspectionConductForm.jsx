import React from 'react';
import { Box, Stepper, Step, StepButton, Paper, Alert, Snackbar, Stack, Button, Typography, useTheme, useMediaQuery } from '@mui/material';
import { ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { useInspectionConduct } from '../hooks/useInspectionConduct';
import { InspectionStepStart } from './inspections/InspectionStepStart';
import { InspectionStepInspectRooms } from './inspections/InspectionStepInspectRooms';
import { InspectionStepReview } from './inspections/InspectionStepReview';

const InspectionConductForm = ({ inspection, onComplete, onCancel, isMobile = false }) => {
  const theme = useTheme();
  const mobileBreakpoint = useMediaQuery(theme.breakpoints.down('md'));
  const isMobileView = isMobile || mobileBreakpoint;

  const {
    activeStep, setActiveStep, completedSteps, stepError, setStepError,
    snackbar, setSnackbar, rooms, issues, actions, lastSaved
  } = useInspectionConduct(inspection, onComplete);

  const steps = ['Start Inspection', 'Inspect Rooms', 'Review & Complete'];

  const handleNext = () => {
    if (activeStep === 1 && rooms.length === 0) {
      setStepError('Please add and inspect at least one room before continuing.');
      return;
    }
    setActiveStep(prev => prev + 1);
    setStepError('');
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0: return <InspectionStepStart inspection={inspection} onStart={actions.startInspection} isMobile={isMobileView} />;
      case 1: return <InspectionStepInspectRooms inspection={inspection} rooms={rooms} actions={actions} lastSaved={lastSaved} isMobile={isMobileView} />;
      case 2: return <InspectionStepReview inspection={inspection} rooms={rooms} issues={issues} onComplete={actions.completeInspection} isCompleting={actions.isCompleting} isMobile={isMobileView} />;
      default: return null;
    }
  };

  return (
    <Box sx={{ p: isMobileView ? 1 : 3 }}>
      {!isMobileView && (
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label, index) => (
            <Step key={label} completed={completedSteps.has(index)}>
              <StepButton onClick={() => setActiveStep(index)}>{label}</StepButton>
            </Step>
          ))}
        </Stepper>
      )}

      {isMobileView && (
        <Box sx={{ mb: 2, px: 1 }}>
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2 }}>
            {steps.map((label, index) => (
              <Box
                key={label}
                sx={{
                  flex: 1,
                  height: 4,
                  bgcolor: index <= activeStep ? 'primary.main' : 'divider',
                  borderRadius: 2,
                }}
              />
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Step {activeStep + 1} of {steps.length}: {steps[activeStep]}
          </Typography>
        </Box>
      )}

      {stepError && (
        <Alert severity="error" sx={{ mb: 2, mx: isMobileView ? 0 : undefined }}>
          {stepError}
        </Alert>
      )}

      <Paper 
        sx={{ 
          p: isMobileView ? 2 : 3, 
          minHeight: isMobileView ? 'auto' : 400,
          boxShadow: isMobileView ? 'none' : undefined,
          border: isMobileView ? 'none' : undefined,
        }}
      >
        {renderStep()}
      </Paper>

      <Stack 
        direction="row" 
        spacing={2} 
        sx={{ 
          mt: 3,
          position: isMobileView ? 'sticky' : 'static',
          bottom: isMobileView ? 0 : undefined,
          bgcolor: isMobileView ? 'background.paper' : 'transparent',
          py: isMobileView ? 2 : 0,
          px: isMobileView ? 1 : 0,
          borderTop: isMobileView ? '1px solid' : 'none',
          borderColor: isMobileView ? 'divider' : undefined,
          zIndex: isMobileView ? 10 : 'auto',
        }} 
        justifyContent="space-between"
      >
        <Button 
          onClick={onCancel} 
          startIcon={<CancelIcon />}
          sx={{
            minHeight: isMobileView ? 44 : undefined,
            minWidth: isMobileView ? 44 : undefined,
          }}
        >
          {isMobileView ? '' : 'Cancel'}
        </Button>
        <Stack direction="row" spacing={2}>
          {activeStep > 0 && (
            <Button 
              onClick={() => setActiveStep(prev => prev - 1)} 
              startIcon={<ArrowBackIcon />}
              sx={{
                minHeight: isMobileView ? 44 : undefined,
                minWidth: isMobileView ? 44 : undefined,
              }}
            >
              {isMobileView ? '' : 'Back'}
            </Button>
          )}
          {activeStep > 0 && activeStep < 2 && (
            <Button 
              variant="contained" 
              onClick={handleNext} 
              endIcon={<ArrowForwardIcon />}
              sx={{
                minHeight: isMobileView ? 44 : undefined,
                minWidth: isMobileView ? 44 : undefined,
              }}
            >
              {isMobileView ? 'Next' : 'Next'}
            </Button>
          )}
        </Stack>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ 
          vertical: isMobileView ? 'top' : 'bottom', 
          horizontal: isMobileView ? 'center' : 'right' 
        }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default InspectionConductForm;