import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

/**
 * Optimized query hook with smart caching and stale time management
 *
 * Automatically adjusts stale time and cache time based on data volatility:
 * - Static data (rarely changes): 30 minutes stale time
 * - Semi-static data (changes occasionally): 10 minutes
 * - Dynamic data (changes frequently): 2 minutes
 *
 * @param {Object} options - React Query options
 * @param {string} options.volatility - 'static' | 'semi-static' | 'dynamic' (default: 'semi-static')
 * @param {boolean} options.refetchOnMount - Override refetch on mount behavior
 * @param {boolean} options.refetchOnWindowFocus - Override refetch on window focus
 * @returns {Object} React Query result
 *
 * @example
 * // For user profile (rarely changes)
 * const { data } = useOptimizedQuery({
 *   queryKey: ['profile', userId],
 *   queryFn: fetchProfile,
 *   volatility: 'static'
 * });
 *
 * // For job list (changes frequently)
 * const { data } = useOptimizedQuery({
 *   queryKey: ['jobs'],
 *   queryFn: fetchJobs,
 *   volatility: 'dynamic'
 * });
 */
export function useOptimizedQuery(options) {
  const { volatility = 'semi-static', ...queryOptions } = options;

  // Smart cache configuration based on data volatility
  const cacheConfig = {
    static: {
      staleTime: 30 * 60 * 1000, // 30 minutes
      gcTime: 60 * 60 * 1000, // 1 hour
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
    'semi-static': {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
    dynamic: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  };

  const config = cacheConfig[volatility] || cacheConfig['semi-static'];

  return useQuery({
    ...config,
    ...queryOptions,
    // Allow explicit overrides
    staleTime: queryOptions.staleTime ?? config.staleTime,
    gcTime: queryOptions.gcTime ?? config.gcTime,
    refetchOnMount: queryOptions.refetchOnMount ?? config.refetchOnMount,
    refetchOnWindowFocus: queryOptions.refetchOnWindowFocus ?? config.refetchOnWindowFocus,
  });
}

/**
 * Hook to prefetch queries in the background for better perceived performance
 * Useful for prefetching data that users are likely to navigate to
 *
 * @param {Array} prefetchConfigs - Array of prefetch configurations
 * @param {boolean} enabled - Whether prefetching is enabled (default: true)
 *
 * @example
 * // Prefetch property details when hovering over property card
 * usePrefetchQueries([
 *   {
 *     queryKey: ['property', propertyId],
 *     queryFn: () => fetchProperty(propertyId),
 *     staleTime: 5 * 60 * 1000
 *   }
 * ], isHovering);
 */
export function usePrefetchQueries(prefetchConfigs, enabled = true) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(new Set());

  useEffect(() => {
    if (!enabled || !prefetchConfigs?.length) return;

    prefetchConfigs.forEach(async (config) => {
      const key = JSON.stringify(config.queryKey);

      // Avoid prefetching the same query multiple times
      if (prefetchedRef.current.has(key)) return;

      prefetchedRef.current.add(key);

      await queryClient.prefetchQuery({
        ...config,
        staleTime: config.staleTime ?? 5 * 60 * 1000, // Default 5 minutes
      });
    });
  }, [enabled, prefetchConfigs, queryClient]);
}

/**
 * Smart query invalidation with pattern matching
 * Invalidates queries efficiently by pattern matching query keys
 *
 * @param {Object} queryClient - React Query client instance
 * @param {string} pattern - Pattern to match query keys ('properties.*', 'jobs.list', etc.)
 *
 * @example
 * import { invalidateQueriesByPattern } from './useOptimizedQuery';
 *
 * // Invalidate all property-related queries
 * invalidateQueriesByPattern(queryClient, 'properties');
 *
 * // Invalidate specific pattern
 * invalidateQueriesByPattern(queryClient, 'jobs.list');
 */
export function invalidateQueriesByPattern(queryClient, pattern) {
  const parts = pattern.split('.');

  queryClient.invalidateQueries({
    predicate: (query) => {
      const queryKey = Array.isArray(query.queryKey) ? query.queryKey : [query.queryKey];

      // Match pattern against query key
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '*') continue;
        if (queryKey[i] !== parts[i]) return false;
      }

      return true;
    },
  });
}

/**
 * Hook to automatically cleanup queries on unmount
 * Useful for preventing memory leaks in components with many queries
 *
 * @param {Array} queryKeys - Query keys to cleanup
 *
 * @example
 * useQueryCleanup([
 *   ['properties', propertyId],
 *   ['jobs', jobId]
 * ]);
 */
export function useQueryCleanup(queryKeys) {
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      queryKeys.forEach((key) => {
        queryClient.removeQueries({ queryKey: key });
      });
    };
  }, [queryClient]); // Don't include queryKeys to avoid cleanup on every render
}

/**
 * Hook for optimistic updates with automatic rollback on error
 *
 * @param {Object} options - Mutation options
 * @returns {Object} Mutation result with optimistic update helpers
 *
 * @example
 * const updateJob = useOptimisticMutation({
 *   mutationFn: (data) => apiClient.patch(`/jobs/${jobId}`, data),
 *   queryKey: ['jobs', jobId],
 *   updater: (oldData, newData) => ({ ...oldData, ...newData }),
 * });
 *
 * updateJob.mutate({ status: 'COMPLETED' });
 */
export function useOptimisticUpdate({ queryKey, updater }) {
  const queryClient = useQueryClient();

  const onMutate = async (variables) => {
    // Cancel outgoing refetches to avoid overwriting optimistic update
    await queryClient.cancelQueries({ queryKey });

    // Snapshot previous value
    const previousData = queryClient.getQueryData(queryKey);

    // Optimistically update
    queryClient.setQueryData(queryKey, (old) => updater(old, variables));

    return { previousData };
  };

  const onError = (_err, _variables, context) => {
    // Rollback on error
    if (context?.previousData) {
      queryClient.setQueryData(queryKey, context.previousData);
    }
  };

  const onSettled = () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey });
  };

  return { onMutate, onError, onSettled };
}

/**
 * Hook to track query performance metrics
 * Logs slow queries and helps identify performance bottlenecks
 *
 * @param {string} queryKey - Query key to monitor
 * @param {number} threshold - Threshold in ms (default: 1000)
 */
export function useQueryPerformance(queryKey, threshold = 1000) {
  const startTimeRef = useRef(Date.now());
  const queryKeyStr = JSON.stringify(queryKey);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [queryKeyStr]);

  return {
    logComplete: () => {
      const duration = Date.now() - startTimeRef.current;
      if (duration > threshold) {
        console.warn(`Slow query detected: ${queryKeyStr} took ${duration}ms`);
      }
    },
  };
}
