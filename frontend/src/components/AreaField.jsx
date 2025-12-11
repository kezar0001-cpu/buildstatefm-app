import React from 'react';
import { TextField, MenuItem, Stack } from '@mui/material';
import { AREA_UNITS, AREA_UNIT_LABELS } from '../utils/areaUnits';

/**
 * AreaField - A reusable area input field with unit selection (sq ft / sq m)
 * Works with standard onChange handlers (no react-hook-form required)
 * Stores values in square feet, but allows input in either unit
 *
 * @param {object} props
 * @param {string} props.id - Input ID
 * @param {string} props.label - Field label (without unit suffix)
 * @param {string|number} props.value - Raw numeric value (no unit conversion)
 * @param {string} props.unit - Selected unit (AREA_UNITS.SQ_FT or AREA_UNITS.SQ_M)
 * @param {function} props.onChange - Change handler for the numeric value
 * @param {function} props.onUnitChange - Change handler for the unit value
 * @param {boolean} [props.required] - Whether field is required
 * @param {boolean} [props.error] - Whether field has error
 * @param {string} [props.helperText] - Helper text
 * @param {boolean} [props.fullWidth] - Full width
 */
export default function AreaField({
  id,
  label,
  value,
  onChange,
  unit,
  onUnitChange,
  required = false,
  error = false,
  helperText,
  fullWidth = true,
  ...rest
}) {
  const handleValueChange = (e) => {
    const inputValue = e.target.value;
    if (inputValue === '' || inputValue === null) {
      onChange({ target: { value: '' } });
      return;
    }

    onChange({ target: { value: inputValue } });
  };

  const handleUnitChange = (e) => {
    const newUnit = e.target.value;
    if (onUnitChange) {
      onUnitChange({ target: { value: newUnit } });
    }
  };

  return (
    <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} sx={{ width: fullWidth ? '100%' : 'auto' }}>
      <TextField
        {...rest}
        fullWidth
        id={id}
        label={label}
        required={required}
        type="number"
        value={value ?? ''}
        onChange={handleValueChange}
        error={error}
        helperText={helperText}
        inputProps={{
          step: 'any',
        }}
        sx={{ flex: 3 }}
      />
      <TextField
        select
        fullWidth
        label="Unit"
        value={unit || AREA_UNITS.SQ_M}
        onChange={handleUnitChange}
        sx={{ flex: 1, minWidth: '120px' }}
      >
        <MenuItem value={AREA_UNITS.SQ_FT}>{AREA_UNIT_LABELS[AREA_UNITS.SQ_FT]}</MenuItem>
        <MenuItem value={AREA_UNITS.SQ_M}>{AREA_UNIT_LABELS[AREA_UNITS.SQ_M]}</MenuItem>
      </TextField>
    </Stack>
  );
}
