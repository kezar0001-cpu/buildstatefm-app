import React, { useState } from 'react';
import { TextField, MenuItem, Stack } from '@mui/material';
import { AREA_UNITS, AREA_UNIT_LABELS, toSquareFeet, fromSquareFeet } from '../utils/areaUnits';

/**
 * AreaField - A reusable area input field with unit selection (sq ft / sq m)
 * Works with standard onChange handlers (no react-hook-form required)
 * Stores values in square feet, but allows input in either unit
 *
 * @param {object} props
 * @param {string} props.id - Input ID
 * @param {string} props.label - Field label (without unit suffix)
 * @param {string|number} props.value - Value in square feet
 * @param {function} props.onChange - Change handler that receives event with value in sq ft
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
  required = false,
  error = false,
  helperText,
  fullWidth = true,
  ...rest
}) {
  const [unit, setUnit] = useState(AREA_UNITS.SQ_FT);

  // Convert the stored value (in sq ft) to the selected unit for display
  const displayValue = value ? fromSquareFeet(parseFloat(value), unit) : '';

  const handleValueChange = (e) => {
    const inputValue = e.target.value;
    if (inputValue === '' || inputValue === null) {
      onChange({ target: { value: '' } });
      return;
    }

    const numericValue = parseFloat(inputValue);
    if (!isNaN(numericValue)) {
      // Convert to square feet for storage
      const sqFtValue = toSquareFeet(numericValue, unit);
      onChange({ target: { value: sqFtValue.toString() } });
    }
  };

  const handleUnitChange = (e) => {
    const newUnit = e.target.value;
    setUnit(newUnit);
    // No need to update the field value, just the display
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
        value={displayValue}
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
        value={unit}
        onChange={handleUnitChange}
        sx={{ flex: 1, minWidth: '120px' }}
      >
        <MenuItem value={AREA_UNITS.SQ_FT}>{AREA_UNIT_LABELS[AREA_UNITS.SQ_FT]}</MenuItem>
        <MenuItem value={AREA_UNITS.SQ_M}>{AREA_UNIT_LABELS[AREA_UNITS.SQ_M]}</MenuItem>
      </TextField>
    </Stack>
  );
}
