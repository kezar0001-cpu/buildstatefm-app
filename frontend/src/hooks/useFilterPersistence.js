import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';

/**
 * Custom hook for persisting filter state in URL search params.
 * Filters persist across page navigation and can be bookmarked/shared.
 * 
 * @param {object} defaultFilters - Default filter values
 * @param {object} options - Configuration options
 * @returns {object} Filter state and control functions
 * 
 * @example
 * const { filters, updateFilter, resetFilters } = useFilterPersistence({
 *   status: 'all',
 *   search: '',
 *   category: null,
 * });
 */
export function useFilterPersistence(defaultFilters = {}, options = {}) {
  const { 
    prefix = '', // Optional prefix for filter keys (e.g., 'jobs.')
    syncOnMount = true, // Whether to sync URL params on mount
  } = options;
  
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  
  // Initialize filters from URL or defaults
  const getInitialFilters = useCallback(() => {
    const filters = { ...defaultFilters };
    
    if (syncOnMount) {
      Object.keys(defaultFilters).forEach((key) => {
        const paramKey = prefix ? `${prefix}${key}` : key;
        const value = searchParams.get(paramKey);
        
        if (value !== null) {
          // Try to parse as JSON for complex values
          try {
            filters[key] = JSON.parse(value);
          } catch {
            // If not JSON, use as string
            filters[key] = value;
          }
        }
      });
    }
    
    return filters;
  }, [defaultFilters, searchParams, prefix, syncOnMount]);
  
  const [filters, setFilters] = useState(getInitialFilters);
  
  // Sync filters with URL params when they change
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    let hasChanges = false;
    
    Object.keys(defaultFilters).forEach((key) => {
      const paramKey = prefix ? `${prefix}${key}` : key;
      const currentValue = filters[key];
      const defaultValue = defaultFilters[key];
      
      // Remove param if it matches default or is empty/null
      if (currentValue === defaultValue || currentValue === '' || currentValue === null || currentValue === undefined) {
        if (newParams.has(paramKey)) {
          newParams.delete(paramKey);
          hasChanges = true;
        }
      } else {
        // Update param with current value
        const stringValue = typeof currentValue === 'object' 
          ? JSON.stringify(currentValue)
          : String(currentValue);
        
        if (newParams.get(paramKey) !== stringValue) {
          newParams.set(paramKey, stringValue);
          hasChanges = true;
        }
      }
    });
    
    if (hasChanges) {
      setSearchParams(newParams, { replace: true });
    }
  }, [filters, defaultFilters, prefix, searchParams, setSearchParams]);
  
  // Update a single filter
  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);
  
  // Update multiple filters at once
  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);
  
  // Reset all filters to defaults
  const resetFilters = useCallback(() => {
    setFilters({ ...defaultFilters });
  }, [defaultFilters]);
  
  // Reset a specific filter to its default
  const resetFilter = useCallback((key) => {
    setFilters((prev) => ({
      ...prev,
      [key]: defaultFilters[key],
    }));
  }, [defaultFilters]);
  
  // Clear all filters from URL (useful for cleanup)
  const clearFiltersFromURL = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    let hasChanges = false;
    
    Object.keys(defaultFilters).forEach((key) => {
      const paramKey = prefix ? `${prefix}${key}` : key;
      if (newParams.has(paramKey)) {
        newParams.delete(paramKey);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setSearchParams(newParams, { replace: true });
    }
  }, [defaultFilters, prefix, searchParams, setSearchParams]);
  
  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    resetFilter,
    clearFiltersFromURL,
  };
}

export default useFilterPersistence;

