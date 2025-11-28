import React from 'react';
import { Box, Stepper, Step, StepButton, Paper, Alert, Snackbar, Stack, Button } from '@mui/material';
import { ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { useInspectionConduct } from '../hooks/useInspectionConduct';
import { InspectionStepStart } from './inspections/InspectionStepStart';
import { InspectionStepAddRooms } from './inspections/InspectionStepAddRooms';
import { InspectionStepConduct } from './inspections/InspectionStepConduct';
import { InspectionStepReview } from './inspections/InspectionStepReview';

const InspectionConductForm = ({ inspection, onComplete, onCancel }) => {
  const {
    activeStep, setActiveStep, completedSteps, stepError, setStepError,
    snackbar, setSnackbar, rooms, issues, actions, lastSaved
  } = useInspectionConduct(inspection, onComplete);

  const steps = ['Start Inspection', 'Add Rooms', 'Conduct Inspection', 'Review & Complete'];

  const handleNext = () => {
    if (activeStep === 1 && rooms.length === 0) {
      setStepError('Please add at least one room.');
      return;
    }
    setActiveStep(prev => prev + 1);
    setStepError('');
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0: return <InspectionStepStart inspection={inspection} onStart={actions.startInspection} />;
      case 1: return <InspectionStepAddRooms inspection={inspection} rooms={rooms} actions={actions} />;
      case 2: return <InspectionStepConduct inspection={inspection} rooms={rooms} actions={actions} lastSaved={lastSaved} />;
      case 3: return <InspectionStepReview inspection={inspection} rooms={rooms} issues={issues} onComplete={actions.completeInspection} isCompleting={actions.isCompleting} />;
      default: return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label, index) => (
          <Step key={label} completed={completedSteps.has(index)}>
            <StepButton onClick={() => setActiveStep(index)}>{label}</StepButton>
          </Step>
        ))}
      </Stepper>

      {stepError && <Alert severity="error" sx={{ mb: 2 }}>{stepError}</Alert>}

      <Paper sx={{ p: 3, minHeight: 400 }}>
        {renderStep()}
      </Paper>

      <Stack direction="row" spacing={2} sx={{ mt: 3 }} justifyContent="space-between">
        <Button onClick={onCancel} startIcon={<CancelIcon />}>Cancel</Button>
        <Stack direction="row" spacing={2}>
          {activeStep > 0 && activeStep < 3 && (
            <Button onClick={() => setActiveStep(prev => prev - 1)} startIcon={<ArrowBackIcon />}>Back</Button>
          )}
          {activeStep > 0 && activeStep < 3 && (
            <Button variant="contained" onClick={handleNext} endIcon={<ArrowForwardIcon />}>Next</Button>
          )}
        </Stack>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default InspectionConductForm;