import { useState, useEffect } from 'react';

/**
 * Custom hook for managing dashboard user preferences
 * Persists preferences in localStorage
 */
export function useDashboardPreferences() {
  // Auto-refresh preference (default: true)
  const [autoRefresh, setAutoRefresh] = useState(() => {
    const stored = localStorage.getItem('dashboard:autoRefresh');
    return stored === null ? true : stored === 'true';
  });

  // Refresh interval in milliseconds (default: 5 minutes)
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const stored = localStorage.getItem('dashboard:refreshInterval');
    return stored ? Number(stored) : 5 * 60 * 1000; // 5 minutes
  });

  // Hide upgrade modal permanently
  const [hideUpgradeModal, setHideUpgradeModal] = useState(() => {
    return localStorage.getItem('dashboard:hideUpgradeModal') === 'true';
  });

  // Last time upgrade modal was shown
  const [upgradeLastShownAt, setUpgradeLastShownAt] = useState(() => {
    const stored = localStorage.getItem('dashboard:upgradeLastShownAt');
    return stored ? Number(stored) : null;
  });

  // Persist auto-refresh preference
  useEffect(() => {
    localStorage.setItem('dashboard:autoRefresh', String(autoRefresh));
  }, [autoRefresh]);

  // Persist refresh interval
  useEffect(() => {
    localStorage.setItem('dashboard:refreshInterval', String(refreshInterval));
  }, [refreshInterval]);

  // Persist hide upgrade modal preference
  useEffect(() => {
    localStorage.setItem('dashboard:hideUpgradeModal', String(hideUpgradeModal));
  }, [hideUpgradeModal]);

  // Persist upgrade modal last shown timestamp
  useEffect(() => {
    if (upgradeLastShownAt !== null) {
      localStorage.setItem('dashboard:upgradeLastShownAt', String(upgradeLastShownAt));
    }
  }, [upgradeLastShownAt]);

  // Check if upgrade modal can be shown (throttle to once per day)
  const canShowUpgradeModal = () => {
    if (hideUpgradeModal) return false;

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (!upgradeLastShownAt) return true;

    return now - upgradeLastShownAt > oneDayMs;
  };

  // Mark upgrade modal as shown
  const markUpgradeModalShown = () => {
    setUpgradeLastShownAt(Date.now());
  };

  // Reset upgrade modal preferences (for testing or user request)
  const resetUpgradeModalPreferences = () => {
    setHideUpgradeModal(false);
    setUpgradeLastShownAt(null);
    localStorage.removeItem('dashboard:hideUpgradeModal');
    localStorage.removeItem('dashboard:upgradeLastShownAt');
    sessionStorage.removeItem('hasSeenUpgradeModal');
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefresh((prev) => !prev);
  };

  // Set custom refresh interval
  const setCustomRefreshInterval = (minutes) => {
    setRefreshInterval(minutes * 60 * 1000);
  };

  return {
    // Auto-refresh settings
    autoRefresh,
    setAutoRefresh,
    toggleAutoRefresh,
    refreshInterval,
    setRefreshInterval,
    setCustomRefreshInterval,

    // Upgrade modal settings
    hideUpgradeModal,
    setHideUpgradeModal,
    canShowUpgradeModal,
    markUpgradeModalShown,
    resetUpgradeModalPreferences,
  };
}

/**
 * Preset refresh intervals
 */
export const REFRESH_INTERVALS = {
  OFF: 0,
  ONE_MINUTE: 1 * 60 * 1000,
  TWO_MINUTES: 2 * 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
};

/**
 * Get human-readable label for refresh interval
 */
export function getRefreshIntervalLabel(ms) {
  if (ms === 0) return 'Off';
  const minutes = ms / (60 * 1000);
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}
