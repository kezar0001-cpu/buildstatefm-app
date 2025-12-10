import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  Switch,
  Box,
  Typography,
  Stack,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

/**
 * Wizard Field Component
 * Simplified form field wrapper for wizard steps
 * 
 * @param {Object} props
 * @param {string} props.type - Field type: 'text', 'select', 'date', 'checkbox', 'radio', 'switch', 'number', 'email', 'tel'
 * @param {string} props.name - Field name
 * @param {string} props.label - Field label
 * @param {*} props.value - Field value
 * @param {Function} props.onChange - Change handler
 * @param {Array} props.options - Options for select/radio fields
 * @param {boolean} props.required - Whether field is required
 * @param {string} props.helperText - Helper text
 * @param {string} props.error - Error message
 * @param {boolean} props.disabled - Whether field is disabled
 * @param {boolean} props.fullWidth - Whether field should be full width
 * @param {Object} props.inputProps - Additional input props
 */
export default function WizardField({
  type = 'text',
  name,
  label,
  value,
  onChange,
  options = [],
  required = false,
  helperText,
  error,
  disabled = false,
  fullWidth = true,
  inputProps = {},
  ...otherProps
}) {
  const handleChange = (event) => {
    let newValue;

    if (type === 'checkbox' || type === 'switch') {
      newValue = event.target.checked;
    } else if (type === 'date') {
      newValue = event;
    } else {
      newValue = event.target.value;
    }

    if (onChange) {
      onChange(name, newValue);
    }
  };

  // Text, Email, Tel, Number fields
  if (['text', 'email', 'tel', 'number', 'password'].includes(type)) {
    return (
      <TextField
        name={name}
        label={label}
        type={type}
        value={value || ''}
        onChange={handleChange}
        required={required}
        helperText={error || helperText}
        error={!!error}
        disabled={disabled}
        fullWidth={fullWidth}
        InputProps={inputProps}
        {...otherProps}
      />
    );
  }

  // Textarea
  if (type === 'textarea') {
    return (
      <TextField
        name={name}
        label={label}
        value={value || ''}
        onChange={handleChange}
        required={required}
        helperText={error || helperText}
        error={!!error}
        disabled={disabled}
        fullWidth={fullWidth}
        multiline
        rows={4}
        {...otherProps}
      />
    );
  }

  // Select dropdown
  if (type === 'select') {
    return (
      <FormControl fullWidth={fullWidth} required={required} error={!!error} disabled={disabled}>
        <InputLabel>{label}</InputLabel>
        <Select
          name={name}
          value={value || ''}
          onChange={handleChange}
          label={label}
          {...otherProps}
        >
          {options.map((option) => (
            <MenuItem
              key={typeof option === 'object' ? option.value : option}
              value={typeof option === 'object' ? option.value : option}
            >
              {typeof option === 'object' ? option.label : option}
            </MenuItem>
          ))}
        </Select>
        {(error || helperText) && <FormHelperText>{error || helperText}</FormHelperText>}
      </FormControl>
    );
  }

  // Date picker
  if (type === 'date') {
    return (
      <DatePicker
        label={label}
        value={value || null}
        onChange={handleChange}
        disabled={disabled}
        slotProps={{
          textField: {
            fullWidth,
            required,
            helperText: error || helperText,
            error: !!error,
          },
        }}
        {...otherProps}
      />
    );
  }

  // Checkbox
  if (type === 'checkbox') {
    return (
      <FormControl error={!!error} disabled={disabled}>
        <FormControlLabel
          control={
            <Checkbox
              name={name}
              checked={!!value}
              onChange={handleChange}
              {...otherProps}
            />
          }
          label={label}
        />
        {(error || helperText) && <FormHelperText>{error || helperText}</FormHelperText>}
      </FormControl>
    );
  }

  // Switch
  if (type === 'switch') {
    return (
      <FormControl error={!!error} disabled={disabled}>
        <FormControlLabel
          control={
            <Switch
              name={name}
              checked={!!value}
              onChange={handleChange}
              {...otherProps}
            />
          }
          label={label}
        />
        {(error || helperText) && <FormHelperText>{error || helperText}</FormHelperText>}
      </FormControl>
    );
  }

  // Radio group
  if (type === 'radio') {
    return (
      <FormControl error={!!error} disabled={disabled} fullWidth={fullWidth}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {label}
          {required && <span style={{ color: 'red' }}> *</span>}
        </Typography>
        <RadioGroup name={name} value={value || ''} onChange={handleChange} {...otherProps}>
          {options.map((option) => (
            <FormControlLabel
              key={typeof option === 'object' ? option.value : option}
              value={typeof option === 'object' ? option.value : option}
              control={<Radio />}
              label={typeof option === 'object' ? option.label : option}
            />
          ))}
        </RadioGroup>
        {(error || helperText) && <FormHelperText>{error || helperText}</FormHelperText>}
      </FormControl>
    );
  }

  return null;
}

/**
 * Wizard Field Group Component
 * Groups multiple fields with a title
 */
export function WizardFieldGroup({ title, subtitle, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      {title && (
        <Typography variant="h6" fontWeight={600} gutterBottom>
          {title}
        </Typography>
      )}
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>
      )}
      <Stack spacing={2.5}>{children}</Stack>
    </Box>
  );
}
