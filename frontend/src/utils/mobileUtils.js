/**
 * Mobile utility functions for responsive design
 */

/**
 * Check if device is mobile
 * @returns {boolean} True if mobile device
 */
export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
    userAgent.toLowerCase()
  );
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return isMobileDevice || hasTouch;
}

/**
 * Get optimal touch target size for mobile
 * @param {number} baseSize - Base size in pixels
 * @returns {number} Optimal size for touch targets (minimum 44px for accessibility)
 */
export function getTouchTargetSize(baseSize = 44) {
  return isMobileDevice() ? Math.max(baseSize, 44) : baseSize;
}

/**
 * Get responsive spacing values
 * @param {number|object} spacing - Spacing value or object with breakpoints
 * @returns {object} Responsive spacing object
 */
export function getResponsiveSpacing(spacing) {
  if (typeof spacing === 'number') {
    return {
      xs: spacing * 0.75, // Smaller on mobile
      sm: spacing * 0.875,
      md: spacing,
      lg: spacing * 1.125,
    };
  }
  return spacing;
}

/**
 * Get responsive font size
 * @param {number} baseSize - Base font size in pixels
 * @returns {object} Responsive font size object
 */
export function getResponsiveFontSize(baseSize) {
  return {
    xs: `${baseSize * 0.875}px`, // Smaller on mobile
    sm: `${baseSize * 0.9375}px`,
    md: `${baseSize}px`,
    lg: `${baseSize * 1.125}px`,
  };
}

/**
 * Get responsive grid columns
 * @param {number} baseColumns - Base number of columns
 * @returns {object} Responsive grid columns
 */
export function getResponsiveGridColumns(baseColumns = 12) {
  return {
    xs: baseColumns, // Full width on mobile
    sm: Math.ceil(baseColumns / 2), // Half width on small screens
    md: Math.ceil(baseColumns / 3), // Third width on medium screens
    lg: Math.ceil(baseColumns / 4), // Quarter width on large screens
  };
}

/**
 * Check if screen is small (mobile)
 * @returns {boolean} True if screen width < 600px
 */
export function isSmallScreen() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 600;
}

/**
 * Check if screen is medium (tablet)
 * @returns {boolean} True if screen width between 600px and 960px
 */
export function isMediumScreen() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 600 && window.innerWidth < 960;
}

/**
 * Check if screen is large (desktop)
 * @returns {boolean} True if screen width >= 960px
 */
export function isLargeScreen() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 960;
}

export default {
  isMobileDevice,
  getTouchTargetSize,
  getResponsiveSpacing,
  getResponsiveFontSize,
  getResponsiveGridColumns,
  isSmallScreen,
  isMediumScreen,
  isLargeScreen,
};

