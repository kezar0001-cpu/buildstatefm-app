import { useState } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Paper,
  Typography,
  Stack,
  LinearProgress,
  Collapse,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

/**
 * Simplified Wizard Component
 * Provides a clean, intuitive multi-step form experience
 * 
 * @param {Object} props
 * @param {Array} props.steps - Array of step configurations
 * @param {Function} props.onComplete - Callback when wizard is completed
 * @param {Function} props.onCancel - Callback when wizard is cancelled
 * @param {string} props.title - Wizard title
 * @param {string} props.subtitle - Wizard subtitle
 * @param {boolean} props.linear - Whether steps must be completed in order
 * @param {boolean} props.showProgress - Show progress bar
 * @param {string} props.orientation - 'vertical' or 'horizontal'
 */
export default function Wizard({
  steps = [],
  onComplete,
  onCancel,
  title,
  subtitle,
  linear = true,
  showProgress = true,
  orientation = 'vertical',
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState({});
  const [stepData, setStepData] = useState({});
  const [error, setError] = useState(null);

  const currentStep = steps[activeStep];
  const isLastStep = activeStep === steps.length - 1;
  const isFirstStep = activeStep === 0;

  // Calculate progress percentage
  const progress = ((activeStep + 1) / steps.length) * 100;

  const handleNext = async () => {
    setError(null);

    // Validate current step if validation function exists
    if (currentStep.validate) {
      const validationError = await currentStep.validate(stepData[activeStep]);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Mark step as completed
    setCompletedSteps((prev) => ({
      ...prev,
      [activeStep]: true,
    }));

    // If last step, complete wizard
    if (isLastStep) {
      if (onComplete) {
        await onComplete(stepData);
      }
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const handleStepClick = (stepIndex) => {
    if (!linear || completedSteps[stepIndex - 1] || stepIndex === 0) {
      setError(null);
      setActiveStep(stepIndex);
    }
  };

  const handleStepDataChange = (data) => {
    setStepData((prev) => ({
      ...prev,
      [activeStep]: data,
    }));
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      {(title || subtitle) && (
        <Box sx={{ mb: 4 }}>
          {title && (
            <Typography variant="h5" fontWeight={700} gutterBottom>
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      )}

      {/* Progress Bar */}
      {showProgress && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
              },
            }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1, textAlign: 'right' }}
          >
            Step {activeStep + 1} of {steps.length}
          </Typography>
        </Box>
      )}

      {/* Error Alert */}
      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      </Collapse>

      {/* Stepper */}
      <Stepper
        activeStep={activeStep}
        orientation={orientation}
        sx={{
          ...(orientation === 'horizontal' && {
            mb: 4,
          }),
        }}
      >
        {steps.map((step, index) => {
          const stepProps = {};
          const labelProps = {};

          if (step.optional) {
            labelProps.optional = (
              <Typography variant="caption" color="text.secondary">
                Optional
              </Typography>
            );
          }

          return (
            <Step
              key={step.label}
              {...stepProps}
              completed={completedSteps[index]}
              sx={{
                cursor: !linear || completedSteps[index - 1] || index === 0 ? 'pointer' : 'default',
              }}
            >
              <StepLabel
                {...labelProps}
                onClick={() => handleStepClick(index)}
                sx={{
                  '& .MuiStepLabel-label': {
                    fontWeight: activeStep === index ? 700 : 400,
                  },
                }}
              >
                {step.label}
              </StepLabel>

              {orientation === 'vertical' && (
                <StepContent>
                  <Box sx={{ py: 2 }}>
                    {/* Step Description */}
                    {step.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {step.description}
                      </Typography>
                    )}

                    {/* Step Content */}
                    {step.content && (
                      <Box sx={{ mb: 3 }}>
                        {typeof step.content === 'function'
                          ? step.content({
                              data: stepData[index],
                              onChange: handleStepDataChange,
                              allData: stepData,
                            })
                          : step.content}
                      </Box>
                    )}

                    {/* Step Actions */}
                    <Stack direction="row" spacing={2}>
                      <Button
                        disabled={isFirstStep}
                        onClick={handleBack}
                        startIcon={<ArrowBackIcon />}
                        variant="outlined"
                      >
                        Back
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        endIcon={isLastStep ? <CheckIcon /> : <ArrowForwardIcon />}
                      >
                        {isLastStep ? 'Complete' : 'Next'}
                      </Button>
                      {onCancel && (
                        <Button onClick={handleCancel} color="inherit">
                          Cancel
                        </Button>
                      )}
                    </Stack>
                  </Box>
                </StepContent>
              )}
            </Step>
          );
        })}
      </Stepper>

      {/* Horizontal Stepper Content */}
      {orientation === 'horizontal' && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          {/* Step Description */}
          {currentStep?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {currentStep.description}
            </Typography>
          )}

          {/* Step Content */}
          {currentStep?.content && (
            <Box sx={{ mb: 3 }}>
              {typeof currentStep.content === 'function'
                ? currentStep.content({
                    data: stepData[activeStep],
                    onChange: handleStepDataChange,
                    allData: stepData,
                  })
                : currentStep.content}
            </Box>
          )}

          {/* Step Actions */}
          <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
            <Button
              disabled={isFirstStep}
              onClick={handleBack}
              startIcon={<ArrowBackIcon />}
              variant="outlined"
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={isLastStep ? <CheckIcon /> : <ArrowForwardIcon />}
            >
              {isLastStep ? 'Complete' : 'Next'}
            </Button>
            {onCancel && (
              <Button onClick={handleCancel} color="inherit">
                Cancel
              </Button>
            )}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
