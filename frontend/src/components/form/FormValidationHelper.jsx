import React from 'react';
import { Box, Typography, Alert, AlertTitle } from '@mui/material';
import { ErrorOutline, CheckCircle } from '@mui/icons-material';

/**
 * Form validation helper components for better UX
 */

/**
 * Display validation summary at the top of the form
 */
export function FormValidationSummary({ errors, touched }) {
  if (!errors || Object.keys(errors).length === 0) {
    return null;
  }

  const errorCount = Object.keys(errors).length;
  const errorMessages = Object.entries(errors)
    .filter(([field]) => touched?.[field])
    .map(([field, message]) => ({ field, message }));

  if (errorMessages.length === 0) {
    return null;
  }

  return (
    <Alert severity="error" sx={{ mb: 3 }}>
      <AlertTitle>
        Please fix {errorMessages.length} error{errorMessages.length > 1 ? 's' : ''} before submitting
      </AlertTitle>
      <Box component="ul" sx={{ m: 0, pl: 2 }}>
        {errorMessages.map(({ field, message }) => (
          <li key={field}>
            <Typography variant="body2">
              <strong>{field}:</strong> {message}
            </Typography>
          </li>
        ))}
      </Box>
    </Alert>
  );
}

/**
 * Field validation indicator - shows success/error state
 */
export function FieldValidationIndicator({ error, touched, value, required }) {
  if (!touched) return null;

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mt: 0.5,
          color: 'error.main',
        }}
      >
        <ErrorOutline sx={{ fontSize: 16 }} />
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  if (value && required) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mt: 0.5,
          color: 'success.main',
        }}
      >
        <CheckCircle sx={{ fontSize: 16 }} />
        <Typography variant="caption" color="success.main">
          Looks good
        </Typography>
      </Box>
    );
  }

  return null;
}

/**
 * Character counter for text fields
 */
export function CharacterCounter({ value, maxLength, minLength }) {
  if (!maxLength && !minLength) return null;

  const length = value?.length || 0;
  const isOverLimit = maxLength && length > maxLength;
  const isUnderLimit = minLength && length < minLength;

  return (
    <Typography
      variant="caption"
      sx={{
        mt: 0.5,
        color: isOverLimit ? 'error.main' : isUnderLimit ? 'warning.main' : 'text.secondary',
        textAlign: 'right',
        display: 'block',
      }}
    >
      {length}
      {maxLength && ` / ${maxLength}`}
      {minLength && !maxLength && ` (min: ${minLength})`}
    </Typography>
  );
}

/**
 * Required field indicator
 */
export function RequiredIndicator({ required }) {
  if (!required) return null;
  return (
    <Typography component="span" sx={{ color: 'error.main', ml: 0.5 }}>
      *
    </Typography>
  );
}

export default {
  FormValidationSummary,
  FieldValidationIndicator,
  CharacterCounter,
  RequiredIndicator,
};

