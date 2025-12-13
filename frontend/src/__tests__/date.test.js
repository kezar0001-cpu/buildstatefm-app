import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  parseDate,
  formatDateForInput,
  formatDateTimeForInput,
  toISOString,
  isValidDateFormat,
  calculateDaysRemaining,
} from '../utils/date';

describe('formatDate', () => {
  it('should format a valid date string to dd-mm-yyyy', () => {
    const dateString = '2024-01-15T14:30:00Z';
    const result = formatDate(dateString);
    expect(result).toBe('15-01-2024');
  });

  it('should format a Date object to dd-mm-yyyy', () => {
    const date = new Date('2024-03-20T10:00:00Z');
    const result = formatDate(date);
    expect(result).toBe('20-03-2024');
  });

  it('should return "—" for null or undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('should return "—" for invalid date strings', () => {
    expect(formatDate('invalid-date')).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('should format a valid date string to dd-mm-yyyy HH:MM', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    const result = formatDateTime(date);
    // Match pattern dd-mm-yyyy HH:MM
    expect(result).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/);
  });

  it('should return "—" for null or undefined', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });

  it('should return "—" for invalid date strings', () => {
    expect(formatDateTime('invalid-date')).toBe('—');
    expect(formatDateTime('not a date')).toBe('—');
  });

  it('should handle ISO date strings', () => {
    const isoDate = new Date('2024-03-20T10:00:00Z').toISOString();
    const result = formatDateTime(isoDate);
    expect(result).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/);
  });
});

describe('parseDate', () => {
  it('should parse dd-mm-yyyy format correctly', () => {
    const result = parseDate('15-01-2024');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2024);
    expect(result?.getMonth()).toBe(0); // January is 0
    expect(result?.getDate()).toBe(15);
  });

  it('should return null for invalid dates', () => {
    expect(parseDate('31-02-2024')).toBe(null); // Invalid date
    expect(parseDate('invalid-date')).toBe(null);
  });

  it('should return null for null or undefined', () => {
    expect(parseDate(null)).toBe(null);
    expect(parseDate(undefined)).toBe(null);
    expect(parseDate('')).toBe(null);
  });

  it('should fallback to standard Date parsing for ISO strings', () => {
    const result = parseDate('2024-01-15T14:30:00Z');
    expect(result).toBeInstanceOf(Date);
  });
});

describe('formatDateForInput', () => {
  it('should format date to yyyy-mm-dd for HTML input', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    const result = formatDateForInput(date);
    expect(result).toBe('2024-01-15');
  });

  it('should return empty string for invalid dates', () => {
    expect(formatDateForInput(null)).toBe('');
    expect(formatDateForInput(undefined)).toBe('');
    expect(formatDateForInput('')).toBe('');
  });
});

describe('formatDateTimeForInput', () => {
  it('should format datetime to yyyy-mm-ddThh:mm for HTML input', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    const result = formatDateTimeForInput(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('should return empty string for invalid dates', () => {
    expect(formatDateTimeForInput(null)).toBe('');
    expect(formatDateTimeForInput(undefined)).toBe('');
    expect(formatDateTimeForInput('')).toBe('');
  });
});

describe('toISOString', () => {
  it('should convert dd-mm-yyyy format to ISO string', () => {
    const result = toISOString('15-01-2024');
    expect(result).toContain('2024-01-15');
  });

  it('should convert Date object to ISO string', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    const result = toISOString(date);
    expect(result).toBe(date.toISOString());
  });

  it('should return null for invalid dates', () => {
    expect(toISOString(null)).toBe(null);
    expect(toISOString(undefined)).toBe(null);
    expect(toISOString('')).toBe(null);
  });
});

describe('isValidDateFormat', () => {
  it('should validate correct dd-mm-yyyy format', () => {
    expect(isValidDateFormat('15-01-2024')).toBe(true);
    expect(isValidDateFormat('31-12-2024')).toBe(true);
  });

  it('should reject invalid dates', () => {
    expect(isValidDateFormat('31-02-2024')).toBe(false); // Invalid date
    expect(isValidDateFormat('2024-01-15')).toBe(false); // Wrong format
    expect(isValidDateFormat('invalid')).toBe(false);
    expect(isValidDateFormat('')).toBe(false);
    expect(isValidDateFormat(null)).toBe(false);
  });
});

describe('calculateDaysRemaining', () => {
  it('should return null for null or undefined', () => {
    expect(calculateDaysRemaining(null)).toBe(null);
    expect(calculateDaysRemaining(undefined)).toBe(null);
  });

  it('should return null for invalid date strings', () => {
    expect(calculateDaysRemaining('invalid-date')).toBe(null);
  });

  it('should return 0 for expired dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    expect(calculateDaysRemaining(pastDate.toISOString())).toBe(0);
  });

  it('should calculate days remaining for future dates', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const result = calculateDaysRemaining(futureDate.toISOString());
    expect(result).toBeGreaterThanOrEqual(9);
    expect(result).toBeLessThanOrEqual(11);
  });
});
