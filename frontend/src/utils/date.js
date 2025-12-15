/**
 * Date Utilities
 *
 * Standard format: dd/MM/yyyy (e.g., 05/11/2025)
 * This ensures consistent date handling across the application
 */

/**
 * Format a date string or Date object to dd/MM/yyyy format
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date string (dd/MM/yyyy) or '—' if invalid
 */
export function formatDate(dateInput) {
  if (!dateInput) return '—';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format a date string or Date object to dd/MM/yyyy HH:MM format
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted datetime string or '—' if invalid
 */
export function formatDateTime(dateInput) {
  if (!dateInput) return '—';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Parse a dd/MM/yyyy (or legacy dd-MM-yyyy) date string to a Date object
 * @param {string} dateString - Date string in dd/MM/yyyy or dd-MM-yyyy format
 * @returns {Date|null} Date object or null if invalid
 */
export function parseDate(dateString) {
  if (!dateString) return null;

  // Handle dd/MM/yyyy (preferred) and dd-MM-yyyy (legacy)
  const ddmmyyyyPattern = /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/;
  const match = dateString.match(ddmmyyyyPattern);

  if (match) {
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(year, month - 1, day));

    // Validate the date is real (e.g., not 31-02-2025)
    if (
      date.getUTCDate() === parseInt(day, 10) &&
      date.getUTCMonth() === parseInt(month, 10) - 1 &&
      date.getUTCFullYear() === parseInt(year, 10)
    ) {
      return date;
    }
    return null;
  }

  // Fallback: try parsing as ISO or other standard formats
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date for HTML input field (yyyy-mm-dd)
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date string (yyyy-mm-dd) or empty string if invalid
 */
export function formatDateForInput(dateInput) {
  if (!dateInput) return '';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format a datetime for HTML datetime-local input field (yyyy-mm-ddThh:mm)
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted datetime string or empty string if invalid
 */
export function formatDateTimeForInput(dateInput) {
  if (!dateInput) return '';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert a date input to ISO 8601 string for API submission
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string|null} ISO 8601 string or null if invalid
 */
export function toISOString(dateInput) {
  if (!dateInput) return null;

  let date;

  // If it's a string in dd/MM/yyyy (or legacy dd-MM-yyyy) format, parse it first
  if (typeof dateInput === 'string') {
    const ddmmyyyyPattern = /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/;
    if (ddmmyyyyPattern.test(dateInput)) {
      date = parseDate(dateInput);
    } else {
      date = new Date(dateInput);
    }
  } else {
    date = dateInput;
  }

  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

/**
 * Validate if a string is a valid date in dd-mm-yyyy format
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidDateFormat(dateString) {
  if (!dateString) return false;

  const ddmmyyyyPattern = /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/;
  const match = dateString.match(ddmmyyyyPattern);

  if (!match) return false;

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(year, month - 1, day));

  // Check if the date is valid
  return (
    date.getUTCDate() === parseInt(day, 10) &&
    date.getUTCMonth() === parseInt(month, 10) - 1 &&
    date.getUTCFullYear() === parseInt(year, 10)
  );
}

/**
 * Calculate days remaining until a date
 * @param {string|Date} endDateInput - End date string or Date object
 * @returns {number|null} Days remaining or null if invalid
 */
export function calculateDaysRemaining(endDateInput) {
  if (!endDateInput) return null;

  const parsed = typeof endDateInput === 'string' ? new Date(endDateInput) : endDateInput;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }

  // Clone to avoid mutating caller-provided Date objects.
  const endDate = new Date(parsed.getTime());

  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  if (diffTime <= 0) return 0; // Trial has expired

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil(diffTime / msPerDay);
}
