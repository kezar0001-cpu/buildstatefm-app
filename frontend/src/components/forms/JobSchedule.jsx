import React from 'react';
import { Grid } from '@mui/material';
import { Controller } from 'react-hook-form';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { enGB } from 'date-fns/locale/en-GB';

const JobSchedule = ({ control }) => (
  <Grid item xs={12} sm={6}>
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Controller
        name="scheduledDate"
        control={control}
        render={({ field, fieldState: { error } }) => (
          <DateTimePicker
            {...field}
            label="Scheduled Date (Optional)"
            format="dd/MM/yyyy HH:mm"
            onChange={(newValue) => {
              field.onChange(newValue);
            }}
            value={field.value ? new Date(field.value) : null}
            slotProps={{
              textField: {
                fullWidth: true,
                error: !!error,
                helperText: error?.message,
              },
            }}
          />
        )}
      />
    </LocalizationProvider>
  </Grid>
);

export default JobSchedule;
