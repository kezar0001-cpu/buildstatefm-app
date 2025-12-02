import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { queryKeys } from './queryKeys';
import { apiClient } from '../api/client';

/**
 * Prefetch Patterns for BuildState FM
 *
 * Common prefetching strategies to improve perceived performance:
 * 1. Hover prefetching - Load data when user hovers over links
 * 2. Route-based prefetching - Preload likely next pages
 * 3. Predictive prefetching - Load data based on user behavior
 * 4. Background prefetching - Load data during idle time
 */

/**
 * Prefetch property details on hover
 * Use this on property cards/links
 *
 * @example
 * const { prefetchProperty } = usePrefetchProperty();
 *
 * <Card onMouseEnter={() => prefetchProperty(propertyId)}>
 *   <Link to={`/properties/${propertyId}`}>View Property</Link>
 * </Card>
 */
export function usePrefetchProperty() {
  const queryClient = useQueryClient();

  const prefetchProperty = useCallback(
    (propertyId) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.properties.detail(propertyId),
        queryFn: async () => {
          const response = await apiClient.get(`/properties/${propertyId}`);
          return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
    },
    [queryClient]
  );

  return { prefetchProperty };
}

/**
 * Prefetch job details on hover
 *
 * @example
 * const { prefetchJob } = usePrefetchJob();
 *
 * <ListItem onMouseEnter={() => prefetchJob(jobId)}>
 *   <Link to={`/jobs/${jobId}`}>View Job</Link>
 * </ListItem>
 */
export function usePrefetchJob() {
  const queryClient = useQueryClient();

  const prefetchJob = useCallback(
    (jobId) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.jobs.detail(jobId),
        queryFn: async () => {
          const response = await apiClient.get(`/jobs/${jobId}`);
          return response.data;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes (jobs change more frequently)
      });
    },
    [queryClient]
  );

  return { prefetchJob };
}

/**
 * Prefetch inspection details on hover
 *
 * @example
 * const { prefetchInspection } = usePrefetchInspection();
 *
 * <TableRow onMouseEnter={() => prefetchInspection(inspectionId)}>
 *   ...
 * </TableRow>
 */
export function usePrefetchInspection() {
  const queryClient = useQueryClient();

  const prefetchInspection = useCallback(
    (inspectionId) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.inspections.detail(inspectionId),
        queryFn: async () => {
          const response = await apiClient.get(`/inspections/${inspectionId}`);
          return response.data;
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return { prefetchInspection };
}

/**
 * Prefetch related data for a property (units, jobs, inspections)
 * Use when user opens a property detail page
 *
 * @example
 * const { prefetchPropertyRelatedData } = usePrefetchPropertyRelated();
 *
 * useEffect(() => {
 *   if (propertyId) {
 *     prefetchPropertyRelatedData(propertyId);
 *   }
 * }, [propertyId]);
 */
export function usePrefetchPropertyRelated() {
  const queryClient = useQueryClient();

  const prefetchPropertyRelatedData = useCallback(
    (propertyId) => {
      // Prefetch units
      queryClient.prefetchQuery({
        queryKey: queryKeys.units.list({ propertyId }),
        queryFn: async () => {
          const response = await apiClient.get(`/properties/${propertyId}/units`);
          return response.data;
        },
        staleTime: 10 * 60 * 1000,
      });

      // Prefetch recent jobs
      queryClient.prefetchQuery({
        queryKey: queryKeys.jobs.list({ propertyId, limit: 10 }),
        queryFn: async () => {
          const response = await apiClient.get(`/jobs?propertyId=${propertyId}&limit=10`);
          return response.data;
        },
        staleTime: 5 * 60 * 1000,
      });

      // Prefetch recent inspections
      queryClient.prefetchQuery({
        queryKey: queryKeys.inspections.list({ propertyId, limit: 5 }),
        queryFn: async () => {
          const response = await apiClient.get(`/inspections?propertyId=${propertyId}&limit=5`);
          return response.data;
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return { prefetchPropertyRelatedData };
}

/**
 * Prefetch dashboard data during app initialization
 * Loads dashboard data in the background after login
 *
 * @example
 * // In App.jsx or after successful login
 * const { prefetchDashboard } = usePrefetchDashboard();
 *
 * useEffect(() => {
 *   if (isAuthenticated) {
 *     prefetchDashboard();
 *   }
 * }, [isAuthenticated]);
 */
export function usePrefetchDashboard() {
  const queryClient = useQueryClient();

  const prefetchDashboard = useCallback(() => {
    // Prefetch dashboard stats
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.stats(),
      queryFn: async () => {
        const response = await apiClient.get('/dashboard/stats');
        return response.data;
      },
      staleTime: 5 * 60 * 1000,
    });

    // Prefetch recent activity
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.recentActivity(),
      queryFn: async () => {
        const response = await apiClient.get('/dashboard/recent-activity');
        return response.data;
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient]);

  return { prefetchDashboard };
}

/**
 * Prefetch user's properties on app load
 * Useful for property managers who frequently access property list
 *
 * @example
 * const { prefetchProperties } = usePrefetchProperties();
 *
 * useEffect(() => {
 *   prefetchProperties();
 * }, []);
 */
export function usePrefetchProperties() {
  const queryClient = useQueryClient();

  const prefetchProperties = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.properties.list(),
      queryFn: async () => {
        const response = await apiClient.get('/properties');
        return response.data;
      },
      staleTime: 10 * 60 * 1000,
    });
  }, [queryClient]);

  return { prefetchProperties };
}

/**
 * Prefetch next page of paginated data
 * Use in infinite scroll or pagination scenarios
 *
 * @example
 * const { prefetchNextPage } = usePrefetchNextPage();
 *
 * // When user scrolls near bottom
 * useEffect(() => {
 *   if (isNearBottom && hasNextPage) {
 *     prefetchNextPage('jobs', currentPage + 1);
 *   }
 * }, [isNearBottom, hasNextPage, currentPage]);
 */
export function usePrefetchNextPage() {
  const queryClient = useQueryClient();

  const prefetchNextPage = useCallback(
    (resource, page, additionalParams = {}) => {
      const queryKeyMap = {
        jobs: queryKeys.jobs.list({ page, ...additionalParams }),
        properties: queryKeys.properties.list({ page, ...additionalParams }),
        inspections: queryKeys.inspections.list({ page, ...additionalParams }),
      };

      const endpointMap = {
        jobs: '/jobs',
        properties: '/properties',
        inspections: '/inspections',
      };

      const queryKey = queryKeyMap[resource];
      const endpoint = endpointMap[resource];

      if (!queryKey || !endpoint) {
        console.warn(`Unknown resource for prefetch: ${resource}`);
        return;
      }

      queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const params = new URLSearchParams({ page: page.toString(), ...additionalParams });
          const response = await apiClient.get(`${endpoint}?${params}`);
          return response.data;
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return { prefetchNextPage };
}

/**
 * Predictive prefetching based on user role
 * Preloads data that users are most likely to access based on their role
 *
 * @example
 * const { prefetchForRole } = usePrefetchForRole();
 *
 * useEffect(() => {
 *   if (user?.role) {
 *     prefetchForRole(user.role);
 *   }
 * }, [user]);
 */
export function usePrefetchForRole() {
  const queryClient = useQueryClient();

  const prefetchForRole = useCallback(
    (role) => {
      switch (role) {
        case 'PROPERTY_MANAGER':
          // Prefetch properties, jobs, inspections
          queryClient.prefetchQuery({
            queryKey: queryKeys.properties.list(),
            queryFn: async () => {
              const response = await apiClient.get('/properties');
              return response.data;
            },
            staleTime: 10 * 60 * 1000,
          });

          queryClient.prefetchQuery({
            queryKey: queryKeys.jobs.list({ limit: 20 }),
            queryFn: async () => {
              const response = await apiClient.get('/jobs?limit=20');
              return response.data;
            },
            staleTime: 5 * 60 * 1000,
          });
          break;

        case 'TECHNICIAN':
          // Prefetch assigned jobs
          queryClient.prefetchQuery({
            queryKey: queryKeys.jobs.list({ assigned: true }),
            queryFn: async () => {
              const response = await apiClient.get('/jobs?assigned=true');
              return response.data;
            },
            staleTime: 2 * 60 * 1000,
          });
          break;

        case 'OWNER':
          // Prefetch owned properties
          queryClient.prefetchQuery({
            queryKey: queryKeys.properties.list({ owned: true }),
            queryFn: async () => {
              const response = await apiClient.get('/properties?owned=true');
              return response.data;
            },
            staleTime: 15 * 60 * 1000,
          });
          break;

        case 'TENANT':
          // Prefetch tenant units and service requests
          queryClient.prefetchQuery({
            queryKey: queryKeys.serviceRequests.list(),
            queryFn: async () => {
              const response = await apiClient.get('/service-requests');
              return response.data;
            },
            staleTime: 5 * 60 * 1000,
          });
          break;

        default:
          break;
      }
    },
    [queryClient]
  );

  return { prefetchForRole };
}

/**
 * Background prefetching during idle time
 * Uses requestIdleCallback to prefetch data without blocking user interactions
 *
 * @example
 * const { startIdlePrefetch, stopIdlePrefetch } = useIdlePrefetch();
 *
 * useEffect(() => {
 *   const cleanup = startIdlePrefetch([
 *     () => prefetchProperties(),
 *     () => prefetchJobs(),
 *   ]);
 *
 *   return cleanup;
 * }, []);
 */
export function useIdlePrefetch() {
  const prefetchTasks = useCallback((tasks) => {
    if (!('requestIdleCallback' in window)) {
      // Fallback: run tasks sequentially with delay
      let timeoutId;
      const runTasks = (index = 0) => {
        if (index < tasks.length) {
          tasks[index]();
          timeoutId = setTimeout(() => runTasks(index + 1), 1000);
        }
      };
      runTasks();

      return () => clearTimeout(timeoutId);
    }

    const idleIds = [];

    tasks.forEach((task, index) => {
      const id = requestIdleCallback(
        () => {
          task();
        },
        { timeout: 3000 + index * 1000 } // Stagger tasks
      );

      idleIds.push(id);
    });

    return () => {
      idleIds.forEach((id) => cancelIdleCallback(id));
    };
  }, []);

  return {
    startIdlePrefetch: prefetchTasks,
    stopIdlePrefetch: (cleanup) => cleanup && cleanup(),
  };
}

/**
 * Smart prefetching on route navigation
 * Prefetches data for the next likely route
 *
 * @example
 * const { prefetchRoute } = usePrefetchRoute();
 *
 * <Link
 *   to="/properties/123"
 *   onMouseEnter={() => prefetchRoute('property-detail', { id: 123 })}
 * >
 *   View Property
 * </Link>
 */
export function usePrefetchRoute() {
  const queryClient = useQueryClient();

  const prefetchRoute = useCallback(
    (routeName, params = {}) => {
      const routePrefetchMap = {
        'property-detail': () => {
          if (params.id) {
            queryClient.prefetchQuery({
              queryKey: queryKeys.properties.detail(params.id),
              queryFn: async () => {
                const response = await apiClient.get(`/properties/${params.id}`);
                return response.data;
              },
              staleTime: 5 * 60 * 1000,
            });
          }
        },

        'job-detail': () => {
          if (params.id) {
            queryClient.prefetchQuery({
              queryKey: queryKeys.jobs.detail(params.id),
              queryFn: async () => {
                const response = await apiClient.get(`/jobs/${params.id}`);
                return response.data;
              },
              staleTime: 2 * 60 * 1000,
            });
          }
        },

        dashboard: () => {
          queryClient.prefetchQuery({
            queryKey: queryKeys.dashboard.stats(),
            queryFn: async () => {
              const response = await apiClient.get('/dashboard/stats');
              return response.data;
            },
            staleTime: 5 * 60 * 1000,
          });
        },
      };

      const prefetchFn = routePrefetchMap[routeName];
      if (prefetchFn) {
        prefetchFn();
      }
    },
    [queryClient]
  );

  return { prefetchRoute };
}
