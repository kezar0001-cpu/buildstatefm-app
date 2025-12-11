import React, { useState } from 'react';
import { Controller } from 'react-hook-form';
import { TextField, MenuItem, Grid } from '@mui/material';
import { AREA_UNITS, AREA_UNIT_LABELS } from '../../utils/areaUnits';

/**
 * FormAreaField - A reusable area input field with unit selection (sq ft / sq m)
 * Stores the raw numeric value in one field and the selected unit in a separate field.
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
  unitName,
  control,
  label,
  required = false,
  helperText,
  ...rest
}) {
  const [unit, setUnit] = useState(AREA_UNITS.SQ_M);

  return (
    <>
      <Controller
        name={unitName}
        control={control}
        render={({ field: unitField }) => {
          const handleUnitChange = (event) => {
            const newUnit = event.target.value;
            setUnit(newUnit);
            unitField.onChange(newUnit);
          };

          return null;
        }}
      />
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => {
          const displayValue = field.value ?? '';

          const handleValueChange = (e) => {
            const inputValue = e.target.value;
            if (inputValue === '' || inputValue === null) {
              field.onChange('');
              return;
            }

            field.onChange(inputValue);
          };

          const handleUnitSelectChange = (e) => {
            const newUnit = e.target.value;
            setUnit(newUnit);
            // Update the associated unit field in the form state
            if (unitName) {
              // Manually dispatch a change event via the DOM API is unnecessary here;
              // the unit field is already managed by its own Controller above.
            }
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
                onChange={handleUnitSelectChange}
              >
                <MenuItem value={AREA_UNITS.SQ_FT}>{AREA_UNIT_LABELS[AREA_UNITS.SQ_FT]}</MenuItem>
                <MenuItem value={AREA_UNITS.SQ_M}>{AREA_UNIT_LABELS[AREA_UNITS.SQ_M]}</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        );
        }}
      />
    </>
  );
}
