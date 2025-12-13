import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * useFilterState Hook
 *
 * Manages filter state with URL synchronization for bookmarking and sharing.
 * Handles search term debouncing and filter persistence.
 *
 * @param {Object} options
 * @param {Object} options.initialFilters - Initial filter values
 * @param {string} options.searchParamKey - URL param key for search (default: 'search')
 * @param {number} options.debounceMs - Debounce delay in ms (default: 300)
 *
 * @returns {Object} Filter state and handlers
 * @returns {Object} return.filters - Current filter values
 * @returns {string} return.searchTerm - Current search term
 * @returns {string} return.debouncedSearchTerm - Debounced search term
 * @returns {Function} return.setSearchTerm - Update search term
 * @returns {Function} return.setFilter - Update single filter
 * @returns {Function} return.setFilters - Update multiple filters
 * @returns {Function} return.clearFilters - Clear all filters
 * @returns {number} return.activeFilterCount - Count of active filters
 * @returns {boolean} return.hasActiveFilters - Whether any filters are active
 *
 * @example
 * const {
 *   filters,
 *   searchTerm,
 *   debouncedSearchTerm,
 *   setSearchTerm,
 *   setFilter,
 *   clearFilters,
 *   activeFilterCount,
 *   hasActiveFilters,
 * } = useFilterState({
 *   initialFilters: { status: '', priority: '' },
 *   debounceMs: 300,
 * });
 */
export const useFilterState = ({
  initialFilters = {},
  searchParamKey = 'search',
  debounceMs = 300,
} = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL params or initial values
  const [filters, setFiltersState] = useState(() => {
    const urlFilters = {};
    const params = new URLSearchParams(searchParams);

    // Load filters from URL
    Object.keys(initialFilters).forEach((key) => {
      const urlValue = params.get(key);
      urlFilters[key] = urlValue !== null ? urlValue : initialFilters[key];
    });

    return urlFilters;
  });

  // Search term state
  const [searchTerm, setSearchTermState] = useState(
    searchParams.get(searchParamKey) || ''
  );
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  // Debounce search term
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      // Update URL if search term changed
      if (searchTerm !== searchParams.get(searchParamKey)) {
        updateSearchParam(searchParamKey, searchTerm);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL search params
  const updateSearchParam = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        if (value && value !== '' && value !== 'all') {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
        return newParams;
      });
    },
    [setSearchParams]
  );

  // Set search term
  const setSearchTerm = useCallback((value) => {
    setSearchTermState(value);
  }, []);

  // Set single filter
  const setFilter = useCallback(
    (key, value) => {
      setFiltersState((prev) => {
        const updated = { ...prev, [key]: value };
        updateSearchParam(key, value);
        return updated;
      });
    },
    [updateSearchParam]
  );

  // Set multiple filters
  const setFilters = useCallback(
    (newFilters) => {
      setFiltersState((prev) => {
        const updated = { ...prev, ...newFilters };
        // Update URL for each filter
        Object.entries(newFilters).forEach(([key, value]) => {
          updateSearchParam(key, value);
        });
        return updated;
      });
    },
    [updateSearchParam]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTermState('');
    setDebouncedSearchTerm('');
    setFiltersState(initialFilters);

    // Clear URL params
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      Object.keys(initialFilters).forEach((key) => {
        newParams.delete(key);
      });
      newParams.delete(searchParamKey);
      return newParams;
    });
  }, [initialFilters, searchParamKey, setSearchParams]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '' && value !== 'all' && value !== false) {
        count += 1;
      }
    });
    return count;
  }, [filters]);

  const hasActiveFilters = !!debouncedSearchTerm || activeFilterCount > 0;

  return {
    filters,
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
    setFilter,
    setFilters,
    clearFilters,
    activeFilterCount,
    hasActiveFilters,
  };
};

export default useFilterState;
