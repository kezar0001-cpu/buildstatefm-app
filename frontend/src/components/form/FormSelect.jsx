import { Controller } from 'react-hook-form';
import { TextField, MenuItem, Box } from '@mui/material';
import { FieldValidationIndicator, RequiredIndicator } from './FormValidationHelper';

/**
 * FormSelect - A reusable select/dropdown component integrated with React Hook Form
 * Enhanced with real-time validation feedback and better UX
 *
 * @param {object} props
 * @param {string} props.name - Field name for form registration
 * @param {object} props.control - React Hook Form control object
 * @param {string} props.label - Field label
 * @param {boolean} [props.required] - Whether field is required
 * @param {Array} props.options - Array of options, either strings or {value, label} objects
 * @param {string} [props.helperText] - Additional helper text
 * @param {boolean} [props.showValidationIndicator] - Show validation indicator (default: true)
 */
export default function FormSelect({
  name,
  control,
  label,
  required = false,
  options = [],
  helperText,
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
            select
            label={
              <>
                {label}
                {required && <RequiredIndicator required={required} />}
              </>
            }
            error={!!error && isTouched}
            helperText={error && isTouched ? error.message : helperText}
            SelectProps={{
              'aria-invalid': !!error && isTouched,
              'aria-describedby': error && isTouched ? `${name}-error` : undefined,
              'aria-required': required,
              MenuProps: {
                PaperProps: {
                  sx: {
                    maxHeight: 300,
                    '& .MuiMenuItem-root': {
                      minHeight: 48, // Better touch target for mobile
                    },
                  },
                },
              },
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
          >
            {options.map((option) => {
              // Handle both string options and {value, label} object options
              const value = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label;

              return (
                <MenuItem key={value} value={value}>
                  {optionLabel}
                </MenuItem>
              );
            })}
          </TextField>
          {showValidationIndicator && (
            <FieldValidationIndicator
              error={error?.message}
              touched={isTouched}
              value={field.value}
              required={required}
            />
          )}
        </Box>
      )}
    />
  );
}
