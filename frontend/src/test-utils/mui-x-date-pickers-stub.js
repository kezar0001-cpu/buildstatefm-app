import React from 'react';

export function DatePicker({ label, value, onChange, slotProps }) {
  const inputProps = slotProps?.textField?.inputProps || {};
  const helperText = slotProps?.textField?.helperText;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('input', {
      'aria-label': label,
      value: value ? String(value) : '',
      onChange: (e) => onChange?.(e.target.value),
      ...inputProps,
    }),
    helperText ? React.createElement('div', null, helperText) : null
  );
}

export function LocalizationProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

export class AdapterDateFns {}
