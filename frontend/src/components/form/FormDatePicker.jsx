import { Controller } from 'react-hook-form';
import { TextField } from '@mui/material';
import { formatDateForInput } from '../../utils/date';
import { RequiredIndicator } from './FormValidationHelper';

/**
 * FormDatePicker - A reusable date picker component integrated with React Hook Form
 *
 * Uses HTML5 date input which internally uses yyyy-mm-dd format but displays
 * according to user's locale. For display purposes elsewhere in the app,
 * use formatDate() utility to show dates in dd-mm-yyyy format.
 *
 * @param {object} props
 * @param {string} props.name - Field name for form registration
 * @param {object} props.control - React Hook Form control object
 * @param {string} props.label - Field label
 * @param {boolean} [props.required] - Whether field is required
 * @param {string} [props.helperText] - Additional helper text
 */
export default function FormDatePicker({
  name,
  control,
  label,
  required = false,
  helperText,
  ...rest
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, ...fieldProps }, fieldState: { error } }) => {
        // Convert date value to yyyy-mm-dd format for HTML input
        const inputValue = value ? formatDateForInput(value) : '';

        return (
          <TextField
            {...fieldProps}
            {...rest}
            fullWidth
            type="date"
            label={
              <>
                {label}
                {required && <RequiredIndicator required={required} />}
              </>
            }
            error={!!error}
            value={inputValue}
            onChange={(e) => {
              // Store the date as yyyy-mm-dd string (HTML5 date input format)
              // The form will convert it to ISO string when submitting to the API
              onChange(e.target.value);
            }}
            helperText={error?.message || helperText || 'Format: dd-mm-yyyy'}
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              'aria-invalid': !!error,
              'aria-describedby': error ? `${name}-error` : undefined,
              'aria-required': required,
            }}
            FormHelperTextProps={{
              id: error ? `${name}-error` : undefined,
              role: error ? 'alert' : undefined,
              'aria-live': error ? 'polite' : undefined,
            }}
          />
        );
      }}
    />
  );
}
