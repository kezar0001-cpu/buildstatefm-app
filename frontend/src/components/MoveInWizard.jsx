
import React, { useState } from 'react';
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
  MobileStepper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';

const steps = [
  'Invite Tenant',
  'Schedule Move-in Inspection',
  'Document Unit Condition',
  'Collect Deposit',
  'Activate Lease',
];

const MoveInWizard = ({ unitId, onComplete }) => {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    leaseStart: '',
    leaseEnd: '',
    rentAmount: '',
    depositAmount: '',
    inspectionDate: '',
    findings: '',
    depositCollected: false,
  });

  const moveInMutation = useMutation({
    mutationFn: (data) => apiClient.post(`/units/${unitId}/move-in`, data),
    onSuccess: (response, variables) => {
      // Show appropriate success message based on step
      if (variables.step === 0) {
        toast.success('Tenant lease created successfully');
      } else if (variables.step === 1) {
        toast.success('Move-in inspection scheduled successfully');
      } else if (variables.step === 4) {
        toast.success('Lease activated - Move-in complete!');
      }

      if (activeStep === steps.length - 1) {
        queryClient.invalidateQueries({ queryKey: ['units', unitId] });
        onComplete();
      } else {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to process move-in step');
    },
  });

  const handleNext = () => {
    // Validate required fields before proceeding
    if (activeStep === 0) {
      if (!formData.email) {
        toast.error('Please enter tenant email');
        return;
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('Please enter a valid email address');
        return;
      }
      if (!formData.leaseStart) {
        toast.error('Please select a lease start date');
        return;
      }
      if (!formData.leaseEnd) {
        toast.error('Please select a lease end date');
        return;
      }
      if (!formData.rentAmount || parseFloat(formData.rentAmount) <= 0) {
        toast.error('Please enter a valid rent amount');
        return;
      }
      // Convert to numbers before sending
      const payload = {
        step: 0,
        email: formData.email,
        leaseStart: formData.leaseStart,
        leaseEnd: formData.leaseEnd,
        rentAmount: parseFloat(formData.rentAmount),
        depositAmount: formData.depositAmount ? parseFloat(formData.depositAmount) : 0,
      };
      moveInMutation.mutate(payload);
    } else if (activeStep === 1) {
      if (!formData.inspectionDate) {
        toast.error('Please select an inspection date');
        return;
      }
      moveInMutation.mutate({ step: 1, inspectionDate: formData.inspectionDate });
    } else if (activeStep === 4) {
      moveInMutation.mutate({ step: 4 });
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Helper function to check if Next button should be disabled
  const isNextDisabled = () => {
    if (moveInMutation.isPending) return true;

    if (activeStep === 0) {
      return !formData.email || !formData.leaseStart || !formData.leaseEnd || !formData.rentAmount;
    }
    if (activeStep === 1) {
      return !formData.inspectionDate;
    }

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
          <Stack spacing={2}>
            <TextField
              label="Tenant Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
              required
              placeholder="tenant@example.com"
            />
            <TextField
              label="Lease Start Date"
              type="date"
              value={formData.leaseStart}
              onChange={(e) => setFormData({ ...formData, leaseStart: e.target.value })}
              fullWidth
              required
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                min: getTodayDate(),
              }}
            />
            <TextField
              label="Lease End Date"
              type="date"
              value={formData.leaseEnd}
              onChange={(e) => setFormData({ ...formData, leaseEnd: e.target.value })}
              fullWidth
              required
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                min: formData.leaseStart || getTodayDate(),
              }}
            />
            <TextField
              label="Rent Amount"
              type="number"
              value={formData.rentAmount}
              onChange={(e) => setFormData({ ...formData, rentAmount: e.target.value })}
              fullWidth
              required
              inputProps={{
                min: 0,
                step: 0.01,
              }}
            />
            <TextField
              label="Deposit Amount"
              type="number"
              value={formData.depositAmount}
              onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
              fullWidth
              inputProps={{
                min: 0,
                step: 0.01,
              }}
            />
          </Stack>
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
          <TextField
            label="Inspection Findings"
            multiline
            rows={4}
            value={formData.findings}
            onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
            fullWidth
            placeholder="Document the condition of the unit..."
          />
        );
      case 3:
        return (
          <FormControlLabel
            control={<Checkbox checked={formData.depositCollected} onChange={(e) => setFormData({ ...formData, depositCollected: e.target.checked })} />}
            label="Deposit Collected"
          />
        );
      case 4:
        return <Typography>Click Finish to activate the lease and complete the move-in process.</Typography>;
      default:
        return 'Unknown step';
    }
  };

  return (
    <Box sx={{ width: '100%', px: { xs: 1, sm: 2 } }}>
      {/* Desktop Stepper */}
      {!isMobile && (
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      {/* Mobile Stepper */}
      {isMobile && (
        <MobileStepper
          variant="progress"
          steps={steps.length}
          position="static"
          activeStep={activeStep}
          sx={{ mb: 2, flexGrow: 1, bgcolor: 'transparent' }}
          nextButton={<Box />}
          backButton={<Box />}
        />
      )}

      <React.Fragment>
        <Typography 
          variant={isMobile ? 'h6' : 'body1'} 
          sx={{ mt: 2, mb: 2, fontWeight: 600 }}
        >
          {steps[activeStep]}
        </Typography>
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ mb: 2 }}
        >
          Step {activeStep + 1} of {steps.length}
        </Typography>
        
        <Box sx={{ minHeight: { xs: '200px', sm: '250px' }, mb: 3 }}>
          {getStepContent(activeStep)}
        </Box>

        {/* Mobile Button Layout - Stacked */}
        {isMobile ? (
          <Stack spacing={1.5}>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={isNextDisabled()}
              fullWidth
              size="large"
              endIcon={activeStep < steps.length - 1 ? <KeyboardArrowRight /> : null}
            >
              {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
            <Button
              color="inherit"
              disabled={activeStep === 0 || moveInMutation.isPending}
              onClick={handleBack}
              fullWidth
              startIcon={<KeyboardArrowLeft />}
            >
              Back
            </Button>
            <Button
              onClick={onComplete}
              disabled={moveInMutation.isPending}
              fullWidth
              variant="outlined"
            >
              Cancel
            </Button>
          </Stack>
        ) : (
          /* Desktop Button Layout - Horizontal */
          <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
            <Button
              color="inherit"
              disabled={activeStep === 0 || moveInMutation.isPending}
              onClick={handleBack}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            <Box sx={{ flex: '1 1 auto' }} />
            <Button
              onClick={onComplete}
              disabled={moveInMutation.isPending}
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
        )}
      </React.Fragment>
    </Box>
  );
};

export default MoveInWizard;
