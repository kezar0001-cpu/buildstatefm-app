
import React, { useState, useEffect } from 'react';
import {
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Box,
  TextField,
  Stack,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';

const steps = [
  'Give Notice',
  'Schedule Move-out Inspection',
  'Compare Conditions',
  'Calculate Deductions',
  'Process Final Payment',
  'Mark Unit AVAILABLE',
];

const MoveOutWizard = ({ unitId, onComplete }) => {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    moveOutDate: '',
    inspectionDate: '',
    moveInFindings: '',
    moveOutFindings: '',
    deductions: '',
    finalPaymentProcessed: false,
  });

  const { data: moveInInspection } = useQuery({
    queryKey: ['inspections', { unitId, type: 'MOVE_IN' }],
    queryFn: async () => {
      const response = await apiClient.get(`/inspections?unitId=${unitId}&type=MOVE_IN`);
      return response.data?.inspections?.[0];
    },
  });

  // Update form data when move-in inspection is loaded
  useEffect(() => {
    if (moveInInspection?.findings) {
      setFormData((prev) => ({ ...prev, moveInFindings: moveInInspection.findings }));
    }
  }, [moveInInspection]);

  const moveOutMutation = useMutation({
    mutationFn: (data) => apiClient.post(`/units/${unitId}/move-out`, data),
    onSuccess: (response, variables) => {
      // Show appropriate success message based on step
      if (variables.step === 0) {
        toast.success('Move-out notice given successfully');
      } else if (variables.step === 1) {
        toast.success('Move-out inspection scheduled successfully');
      } else if (variables.step === 5) {
        toast.success('Unit marked as available');
      }

      if (activeStep === steps.length - 1) {
        queryClient.invalidateQueries({ queryKey: ['units', unitId] });
        onComplete();
      } else {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to process move-out step');
    },
  });

  const handleNext = () => {
    // Validate required fields before proceeding
    if (activeStep === 0) {
      if (!formData.moveOutDate) {
        toast.error('Please select a move-out date');
        return;
      }
      moveOutMutation.mutate({ step: 0, moveOutDate: formData.moveOutDate });
    } else if (activeStep === 1) {
      if (!formData.inspectionDate) {
        toast.error('Please select an inspection date');
        return;
      }
      moveOutMutation.mutate({ step: 1, inspectionDate: formData.inspectionDate });
    } else if (activeStep === 5) {
      moveOutMutation.mutate({ step: 5 });
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Helper function to check if Next button should be disabled
  const isNextDisabled = () => {
    if (moveOutMutation.isPending) return true;

    if (activeStep === 0 && !formData.moveOutDate) return true;
    if (activeStep === 1 && !formData.inspectionDate) return true;

    return false;
  };

  // Get today's date in YYYY-MM-DD format for min date attribute
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <TextField
            label="Move Out Date"
            type="date"
            value={formData.moveOutDate}
            onChange={(e) => setFormData({ ...formData, moveOutDate: e.target.value })}
            fullWidth
            required
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              min: getTodayDate(),
            }}
          />
        );
      case 1:
        return (
          <TextField
            label="Inspection Date"
            type="date"
            value={formData.inspectionDate}
            onChange={(e) => setFormData({ ...formData, inspectionDate: e.target.value })}
            fullWidth
            required
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              min: getTodayDate(),
            }}
          />
        );
      case 2:
        return (
          <Stack spacing={2}>
            <TextField
              label="Move-in Findings"
              multiline
              rows={4}
              value={formData.moveInFindings}
              disabled
              fullWidth
            />
            <TextField
              label="Move-out Findings"
              multiline
              rows={4}
              value={formData.moveOutFindings}
              onChange={(e) => setFormData({ ...formData, moveOutFindings: e.target.value })}
              fullWidth
            />
          </Stack>
        );
      case 3:
        return (
          <TextField
            label="Deductions"
            type="number"
            value={formData.deductions}
            onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
            fullWidth
            inputProps={{
              min: 0,
              step: 0.01,
            }}
          />
        );
      case 4:
        return (
          <FormControlLabel
            control={<Checkbox checked={formData.finalPaymentProcessed} onChange={(e) => setFormData({ ...formData, finalPaymentProcessed: e.target.checked })} />}
            label="Final Payment Processed"
          />
        );
      case 5:
        return <Typography>Click Finish to mark the unit as available and complete the move-out process.</Typography>;
      default:
        return 'Unknown step';
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <React.Fragment>
        <Typography sx={{ mt: 2, mb: 1 }}>Step {activeStep + 1}</Typography>
        {getStepContent(activeStep)}
        <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
          <Button
            color="inherit"
            disabled={activeStep === 0 || moveOutMutation.isPending}
            onClick={handleBack}
            sx={{ mr: 1 }}
          >
            Back
          </Button>
          <Box sx={{ flex: '1 1 auto' }} />
          <Button
            onClick={onComplete}
            disabled={moveOutMutation.isPending}
            sx={{ mr: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isNextDisabled()}
          >
            {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </Box>
      </React.Fragment>
    </Box>
  );
};

export default MoveOutWizard;
