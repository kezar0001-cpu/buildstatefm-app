// Area unit conversion utilities

export const AREA_UNITS = {
  SQ_FT: 'sq_ft',
  SQ_M: 'sq_m',
};

export const AREA_UNIT_LABELS = {
  [AREA_UNITS.SQ_FT]: 'sq ft',
  [AREA_UNITS.SQ_M]: 'sq m',
};

// Conversion factor: 1 square meter = 10.7639 square feet
const SQ_M_TO_SQ_FT = 10.7639;

/**
 * Convert area value from one unit to another
 * @param {number} value - The area value to convert
 * @param {string} fromUnit - The source unit (AREA_UNITS.SQ_FT or AREA_UNITS.SQ_M)
 * @param {string} toUnit - The target unit (AREA_UNITS.SQ_FT or AREA_UNITS.SQ_M)
 * @returns {number} The converted value
 */
export const convertArea = (value, fromUnit, toUnit) => {
  if (!value || fromUnit === toUnit) return value;

  if (fromUnit === AREA_UNITS.SQ_M && toUnit === AREA_UNITS.SQ_FT) {
    return value * SQ_M_TO_SQ_FT;
  }

  if (fromUnit === AREA_UNITS.SQ_FT && toUnit === AREA_UNITS.SQ_M) {
    return value / SQ_M_TO_SQ_FT;
  }

  return value;
};

/**
 * Convert area value to square feet (for database storage)
 * @param {number} value - The area value
 * @param {string} unit - The current unit
 * @returns {number} The value in square feet
 */
export const toSquareFeet = (value, unit) => {
  return convertArea(value, unit, AREA_UNITS.SQ_FT);
};

/**
 * Convert area value from square feet (from database) to desired unit
 * @param {number} value - The area value in square feet
 * @param {string} unit - The desired unit
 * @returns {number} The value in the desired unit
 */
export const fromSquareFeet = (value, unit) => {
  return convertArea(value, AREA_UNITS.SQ_FT, unit);
};

/**
 * Format area value with unit label
 * @param {number} value - The area value
 * @param {string} unit - The unit
 * @returns {string} Formatted string with unit label
 */
export const formatAreaWithUnit = (value, unit) => {
  if (!value) return 'N/A';
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${AREA_UNIT_LABELS[unit]}`;
};
