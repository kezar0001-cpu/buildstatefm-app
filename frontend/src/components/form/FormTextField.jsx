import { Controller } from 'react-hook-form';
import { TextField, Box } from '@mui/material';
import { FieldValidationIndicator, CharacterCounter, RequiredIndicator } from './FormValidationHelper';

/**
 * FormTextField - A reusable text field component integrated with React Hook Form
 * Enhanced with real-time validation feedback and better UX
 *
 * @param {object} props
 * @param {string} props.name - Field name for form registration
 * @param {object} props.control - React Hook Form control object
 * @param {string} props.label - Field label
 * @param {boolean} [props.required] - Whether field is required
 * @param {boolean} [props.multiline] - Whether to show multiline textarea
 * @param {number} [props.rows] - Number of rows for multiline
 * @param {string} [props.type] - Input type (text, number, email, etc.)
 * @param {string} [props.helperText] - Additional helper text
 * @param {object} [props.inputProps] - Additional input props
 * @param {number} [props.maxLength] - Maximum character length
 * @param {number} [props.minLength] - Minimum character length
 * @param {boolean} [props.showValidationIndicator] - Show validation indicator (default: true)
 */
export default function FormTextField({
  name,
  control,
  label,
  required = false,
  multiline = false,
  rows,
  type = 'text',
  helperText,
  inputProps,
  maxLength,
  minLength,
  showValidationIndicator = true,
  ...rest
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error, isTouched } }) => (
        <Box>
          <TextField
            {...field}
            {...rest}
            fullWidth
            label={
              <>
                {label}
                {required && <RequiredIndicator required={required} />}
              </>
            }
            multiline={multiline}
            rows={rows}
            type={type}
            error={!!error && isTouched}
            helperText={
              error && isTouched
                ? error.message
                : helperText
            }
            inputProps={{
              'aria-invalid': !!error && isTouched,
              'aria-describedby': error && isTouched ? `${name}-error` : undefined,
              'aria-required': required,
              maxLength,
              ...inputProps,
            }}
            FormHelperTextProps={{
              id: error && isTouched ? `${name}-error` : undefined,
              role: error && isTouched ? 'alert' : undefined,
              'aria-live': error && isTouched ? 'polite' : undefined,
            }}
            sx={{
              ...rest.sx,
              '& .MuiOutlinedInput-root': {
                '&.Mui-error': {
                  animation: 'shake 0.3s ease-in-out',
                },
              },
              '@keyframes shake': {
                '0%, 100%': { transform: 'translateX(0)' },
                '25%': { transform: 'translateX(-4px)' },
                '75%': { transform: 'translateX(4px)' },
              },
            }}
          />
          {showValidationIndicator && (
            <FieldValidationIndicator
              error={error?.message}
              touched={isTouched}
              value={field.value}
              required={required}
            />
          )}
          {(maxLength || minLength) && (
            <CharacterCounter value={field.value} maxLength={maxLength} minLength={minLength} />
          )}
        </Box>
      )}
    />
  );
}
