import React from 'react';
import { TextField } from '@mui/material';
import { formatDateForInput, formatDateTimeForInput, toISOString } from '../utils/date';

/**
 * Standardized date picker field component.
 * Ensures consistent date handling across the application.
 * 
 * @param {string} value - Date value (ISO string or Date object)
 * @param {function} onChange - Change handler (receives ISO string)
 * @param {string} type - 'date' or 'datetime-local' (default: 'date')
 * @param {object} error - Error object or message
 * @param {string} helperText - Helper text
 * @param {object} props - Additional TextField props
 */
export default function DatePickerField({
  value,
  onChange,
  type = 'date',
  error,
  helperText,
  showError = true,
  ...props
}) {
  const formatValue = type === 'datetime-local' ? formatDateTimeForInput : formatDateForInput;
  const inputValue = value ? formatValue(value) : '';
  
  const handleChange = (event) => {
    const inputValue = event.target.value;
    
    if (!inputValue) {
      onChange?.(null);
      return;
    }
    
    // Convert to ISO string for API submission
    const isoValue = toISOString(inputValue);
    onChange?.(isoValue);
  };
  
  return (
    <TextField
      type={type}
      value={inputValue}
      onChange={handleChange}
      error={!!error && showError}
      helperText={showError && error ? error : helperText}
      InputLabelProps={{ shrink: true }}
      {...props}
    />
  );
}

