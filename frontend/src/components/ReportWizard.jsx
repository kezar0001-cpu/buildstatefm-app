import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormHelperText,
  LinearProgress,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Button,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import GradientButton from './GradientButton';
import { REPORT_TYPES, REPORT_SECTIONS, REPORT_DESCRIPTIONS } from '../constants/reportConstants';

const wizardSchema = z
  .object({
    reportType: z.string().min(1, 'forms.required'),
    propertyId: z.string().min(1, 'forms.required'),
    unitId: z.string().optional().nullable(),
    fromDate: z.string().min(1, 'forms.required'),
    toDate: z.string().min(1, 'forms.required'),
  })
  .refine((data) => new Date(data.toDate) >= new Date(data.fromDate), {
    path: ['toDate'],
    message: 'End date must be after start date',
  });

const defaultValues = {
  reportType: '',
  propertyId: '',
  unitId: '',
  fromDate: '',
  toDate: '',
};

const steps = [
  { label: 'Report type', helper: 'Pick the output you need.' },
  { label: 'Scope', helper: 'Choose the property and optional unit.' },
  { label: 'Date range', helper: 'Select the coverage window.' },
  { label: 'Review', helper: 'Confirm details before generating.' },
];

const stepFields = [
  ['reportType'],
  ['propertyId', 'unitId'],
  ['fromDate', 'toDate'],
  [],
];

const ReportWizard = ({
  open,
  onClose,
  onSubmit,
  propertiesData,
  unitsData,
  isLoadingProperties,
  isLoadingUnits,
  onPropertyChange,
  isSubmitting,
  serverError,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const {
    control,
    trigger,
    getValues,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(wizardSchema),
    defaultValues,
  });

  const propertyIdValue = watch('propertyId');
  const reportTypeValue = watch('reportType');

  useEffect(() => {
    if (open) {
      onPropertyChange?.(propertyIdValue || '');
    } else {
      reset(defaultValues);
      setActiveStep(0);
      onPropertyChange?.('');
    }
  }, [open, propertyIdValue, onPropertyChange, reset]);

  const handleNext = async () => {
    const fields = stepFields[activeStep];
    if (fields.length) {
      const isValid = await trigger(fields);
      if (!isValid) return;
    }

    if (activeStep === steps.length - 1) {
      const values = getValues();
      onSubmit?.(values, () => {
        reset(defaultValues);
        setActiveStep(0);
      });
      return;
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  const coverage = useMemo(
    () => REPORT_SECTIONS[reportTypeValue] || REPORT_SECTIONS.MAINTENANCE_HISTORY,
    [reportTypeValue]
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
              Choose the report template that matches your needs. Each option uses the standardized formatting used
              across Buildstate workflows.
            </Typography>
            <Controller
              name="reportType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="Report Type"
                  error={!!errors.reportType}
                  helperText={errors.reportType?.message || 'Switch templates anytime before generating.'}
                >
                  {Object.entries(REPORT_TYPES).map(([key, value]) => (
                    <MenuItem key={key} value={key}>
                      <Stack spacing={0.5}>
                        <Typography fontWeight={600}>{value}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {REPORT_DESCRIPTIONS[key]}
                        </Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>
        );
      case 1:
        return (
          <Stack spacing={2}>
            <Controller
              name="propertyId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="Property"
                  disabled={isLoadingProperties}
                  error={!!errors.propertyId}
                  helperText={errors.propertyId?.message || 'Select the property this report should cover.'}
                >
                  {propertiesData.map((prop) => (
                    <MenuItem key={prop.id} value={prop.id}>
                      {prop.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="unitId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="Unit (Optional)"
                  disabled={!propertyIdValue || isLoadingUnits}
                  error={!!errors.unitId}
                  helperText={errors.unitId?.message || 'Narrow the output to a specific unit when needed.'}
                >
                  <MenuItem value="">
                    <em>All units</em>
                  </MenuItem>
                  {unitsData.map((unit) => (
                    <MenuItem key={unit.id} value={unit.id}>
                      {unit.unitNumber}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>
        );
      case 2:
        return (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="fromDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="From"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  error={!!errors.fromDate}
                  helperText={errors.fromDate?.message || 'Oldest activity to include.'}
                />
              )}
            />
            <Controller
              name="toDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="To"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  error={!!errors.toDate}
                  helperText={errors.toDate?.message || 'Latest activity to include.'}
                />
              )}
            />
          </Stack>
        );
      case 3:
      default:
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
              Review the selections before queuing your report. You can reopen the wizard to adjust if anything looks off.
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Report:
                </Typography>
                <Chip label={REPORT_TYPES[reportTypeValue] || 'Select a report type'} color="primary" size="small" />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Coverage:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                  {coverage.map((section) => (
                    <Chip key={section} label={section} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {propertyIdValue ? 'Property and unit set. Date range locked in for this export.' : 'Choose a property to finalize the scope.'}
              </Typography>
            </Stack>
          </Stack>
        );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Guided Report Builder
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Follow the same wizard experience used across other Buildstate workflows.
            </Typography>
          </Box>
          {isSubmitting && <LinearProgress sx={{ width: 160, borderRadius: 5 }} />}
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ py: 2 }}>
          {steps.map((step) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Stack spacing={3} sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {steps[activeStep]?.helper}
          </Typography>

          <Divider />

          {renderStepContent()}

          {serverError && (
            <Alert severity="error" variant="outlined">
              {serverError}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.5 }}>
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Progress {activeStep + 1} of {steps.length}
          </Typography>
          <FormHelperText sx={{ color: 'text.secondary' }}>
            Save time by reusing the wizard—your last selections stay filled until you close it.
          </FormHelperText>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <Button onClick={onClose} disabled={isSubmitting} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={handleBack} disabled={activeStep === 0 || isSubmitting} sx={{ textTransform: 'none' }}>
            Back
          </Button>
          <GradientButton
            onClick={handleNext}
            disabled={isSubmitting}
            size="large"
            sx={{ minWidth: 140 }}
          >
            {activeStep === steps.length - 1 ? 'Generate Report' : 'Next'}
          </GradientButton>
        </Stack>
      </Stack>
    </Dialog>
  );
};

export default ReportWizard;
