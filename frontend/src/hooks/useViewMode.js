import { useState, useCallback, useEffect } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import logger from '../utils/logger';

/**
 * useViewMode Hook
 *
 * Manages view mode preference with localStorage persistence.
 * Automatically switches to list view on mobile devices.
 *
 * @param {Object} options
 * @param {string} options.storageKey - localStorage key for persistence (required)
 * @param {string} options.defaultMode - Default view mode (default: 'grid')
 * @param {Array} options.validModes - Valid view modes (default: ['grid', 'list', 'table'])
 * @param {boolean} options.forceListOnMobile - Force list view on mobile (default: true)
 *
 * @returns {Object} View mode state and handlers
 * @returns {string} return.viewMode - Current view mode
 * @returns {Function} return.setViewMode - Update view mode
 * @returns {boolean} return.isMobile - Whether device is mobile
 * @returns {string} return.effectiveViewMode - Actual view mode (respects mobile override)
 *
 * @example
 * const { viewMode, setViewMode, effectiveViewMode } = useViewMode({
 *   storageKey: 'properties-view-mode',
 *   defaultMode: 'grid',
 *   validModes: ['grid', 'list', 'table'],
 * });
 */
export const useViewMode = ({
  storageKey,
  defaultMode = 'grid',
  validModes = ['grid', 'list', 'table'],
  forceListOnMobile = true,
} = {}) => {
  if (!storageKey) {
    throw new Error('useViewMode: storageKey is required');
  }

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Initialize view mode from localStorage
  const [viewMode, setViewModeState] = useState(() => {
    if (typeof window === 'undefined') return defaultMode;

    try {
      const stored = localStorage.getItem(storageKey);
      return stored && validModes.includes(stored) ? stored : defaultMode;
    } catch (error) {
      logger.warn(`Failed to read view mode from localStorage (${storageKey}):`, error);
      return defaultMode;
    }
  });

  // Update view mode and persist to localStorage
  const setViewMode = useCallback(
    (newMode) => {
      if (!validModes.includes(newMode)) {
        logger.warn(`Invalid view mode: ${newMode}. Valid modes: ${validModes.join(', ')}`);
        return;
      }

      setViewModeState(newMode);

      try {
        localStorage.setItem(storageKey, newMode);
      } catch (error) {
        logger.warn(`Failed to save view mode to localStorage (${storageKey}):`, error);
      }
    },
    [storageKey, validModes]
  );

  // Determine effective view mode (respects mobile override)
  const effectiveViewMode = forceListOnMobile && isMobile ? 'list' : viewMode;

  return {
    viewMode,
    setViewMode,
    isMobile,
    effectiveViewMode,
  };
};

export default useViewMode;
