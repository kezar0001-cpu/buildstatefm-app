import React from 'react';
import { TextField, FormControl, FormLabel, FormHelperText, FormControlLabel, Checkbox, Select, MenuItem, InputLabel } from '@mui/material';

/**
 * Enhanced form field component with inline validation error display.
 * Wraps MUI form components to consistently show validation errors.
 */

/**
 * Text field with inline error display
 */
export function FormTextField({
  error,
  helperText,
  showError = true,
  ...props
}) {
  return (
    <TextField
      error={!!error && showError}
      helperText={showError && error ? error : helperText}
      {...props}
    />
  );
}

/**
 * Select field with inline error display
 */
export function FormSelectField({
  label,
  error,
  helperText,
  showError = true,
  children,
  ...props
}) {
  return (
    <FormControl fullWidth error={!!error && showError}>
      {label && <InputLabel>{label}</InputLabel>}
      <Select label={label} {...props}>
        {children}
      </Select>
      {(showError && error) || helperText ? (
        <FormHelperText>{showError && error ? error : helperText}</FormHelperText>
      ) : null}
    </FormControl>
  );
}

/**
 * Checkbox with inline error display
 */
export function FormCheckbox({
  label,
  error,
  helperText,
  showError = true,
  ...props
}) {
  return (
    <FormControl error={!!error && showError} component="fieldset">
      <FormControlLabel
        control={<Checkbox {...props} />}
        label={label}
      />
      {(showError && error) || helperText ? (
        <FormHelperText error={!!error && showError}>
          {showError && error ? error : helperText}
        </FormHelperText>
      ) : null}
    </FormControl>
  );
}

/**
 * Generic form field wrapper with consistent error display
 */
export function FormField({
  label,
  error,
  helperText,
  required = false,
  children,
  fullWidth = true,
  ...props
}) {
  return (
    <FormControl
      fullWidth={fullWidth}
      error={!!error}
      required={required}
      {...props}
    >
      {label && <FormLabel>{label}</FormLabel>}
      {children}
      {(error || helperText) && (
        <FormHelperText error={!!error}>
          {error || helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
}

/**
 * Helper to extract error message from validation result
 * Handles Zod errors, string errors, and object errors
 */
export function getFieldError(errors, fieldName) {
  if (!errors) return null;
  
  // Handle Zod error format
  if (errors?.issues && Array.isArray(errors.issues)) {
    const fieldError = errors.issues.find(
      (issue) => issue.path && issue.path.includes(fieldName)
    );
    return fieldError?.message || null;
  }
  
  // Handle object with field names as keys
  if (typeof errors === 'object' && !Array.isArray(errors)) {
    return errors[fieldName] || null;
  }
  
  // Handle string error (global error)
  if (typeof errors === 'string') {
    return errors;
  }
  
  return null;
}

export default {
  FormTextField,
  FormSelectField,
  FormCheckbox,
  FormField,
  getFieldError,
};

