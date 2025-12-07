import React, { useState, useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { TextField, MenuItem, Grid } from '@mui/material';
import { AREA_UNITS, AREA_UNIT_LABELS, toSquareFeet, fromSquareFeet } from '../../utils/areaUnits';

/**
 * FormAreaField - A reusable area input field with unit selection (sq ft / sq m)
 * Stores values in square feet in the form, but allows input in either unit
 *
 * @param {object} props
 * @param {string} props.name - Field name for form registration
 * @param {object} props.control - React Hook Form control object
 * @param {string} props.label - Field label (without unit suffix)
 * @param {boolean} [props.required] - Whether field is required
 * @param {string} [props.helperText] - Additional helper text
 */
export default function FormAreaField({
  name,
  control,
  label,
  required = false,
  helperText,
  ...rest
}) {
  const [unit, setUnit] = useState(AREA_UNITS.SQ_FT);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        // Fix: Convert the stored value (in sqm as integer) to the selected unit for display
        const displayValue = field.value ? (() => {
          const sqmValue = parseFloat(field.value);
          if (unit === AREA_UNITS.SQ_M) {
            return sqmValue;
          } else {
            // Convert from sqm to sq ft
            return sqmValue * 10.7639;
          }
        })() : '';

        const handleValueChange = (e) => {
          const inputValue = e.target.value;
          if (inputValue === '' || inputValue === null) {
            field.onChange(null);
            return;
          }

          const numericValue = parseFloat(inputValue);
          if (!isNaN(numericValue)) {
            // Fix: Store as integer sqm (not sq ft) to avoid precision issues
            // Convert input to sqm, then round to nearest integer
            let sqmValue;
            if (unit === AREA_UNITS.SQ_M) {
              sqmValue = numericValue;
            } else {
              // Convert from sq ft to sq m
              sqmValue = numericValue / 10.7639;
            }
            // Round to nearest integer
            const integerSqm = Math.round(sqmValue);
            field.onChange(integerSqm);
          }
        };

        const handleUnitChange = (newUnit) => {
          setUnit(newUnit);
          // No need to update the field value, just the display
        };

        return (
          <Grid container spacing={1}>
            <Grid item xs={8}>
              <TextField
                {...rest}
                fullWidth
                label={label}
                required={required}
                type="number"
                value={displayValue}
                onChange={handleValueChange}
                onBlur={field.onBlur}
                error={!!error}
                helperText={error?.message || helperText}
                inputProps={{
                  'aria-invalid': !!error,
                  'aria-describedby': error ? `${name}-error` : undefined,
                  step: 'any',
                }}
                FormHelperTextProps={{
                  id: error ? `${name}-error` : undefined,
                  role: error ? 'alert' : undefined,
                  'aria-live': error ? 'polite' : undefined,
                }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                select
                fullWidth
                label="Unit"
                value={unit}
                onChange={(e) => handleUnitChange(e.target.value)}
              >
                <MenuItem value={AREA_UNITS.SQ_FT}>{AREA_UNIT_LABELS[AREA_UNITS.SQ_FT]}</MenuItem>
                <MenuItem value={AREA_UNITS.SQ_M}>{AREA_UNIT_LABELS[AREA_UNITS.SQ_M]}</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        );
      }}
    />
  );
}
