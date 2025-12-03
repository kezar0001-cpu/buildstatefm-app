import { lazy } from 'react';

/**
 * Enhanced lazy loading with automatic retry on failure
 * Handles chunk load errors gracefully with exponential backoff
 *
 * Common causes of chunk load failures:
 * - Network issues
 * - Deployment during user session (old chunks deleted)
 * - Browser cache issues
 *
 * @param {Function} componentImport - Dynamic import function
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.retryDelay - Initial retry delay in ms (default: 1000)
 * @returns {React.Component} Lazy loaded component
 *
 * @example
 * const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
 */
export function lazyWithRetry(componentImport, options = {}) {
  const { maxRetries = 3, retryDelay = 1000 } = options;

  return lazy(() => {
    return new Promise((resolve, reject) => {
      let retries = 0;

      const attemptLoad = () => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            if (retries < maxRetries) {
              retries++;
              const delay = retryDelay * Math.pow(2, retries - 1); // Exponential backoff

              console.warn(
                `[LazyLoad] Chunk load failed, retrying (${retries}/${maxRetries}) in ${delay}ms...`,
                error
              );

              setTimeout(attemptLoad, delay);
            } else {
              console.error('[LazyLoad] Chunk load failed after all retries:', error);

              // Check if it's a chunk load error
              if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
                // Suggest page reload for chunk errors
                if (window.confirm('A new version is available. Reload to update?')) {
                  window.location.reload();
                } else {
                  reject(error);
                }
              } else {
                reject(error);
              }
            }
          });
      };

      attemptLoad();
    });
  });
}

/**
 * Preload a lazy component before it's needed
 * Useful for prefetching components on hover or route anticipation
 *
 * @param {Function} lazyComponent - Lazy component created with lazy() or lazyWithRetry()
 * @returns {Promise} Promise that resolves when component is loaded
 *
 * @example
 * const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
 *
 * // Preload on hover
 * <Link
 *   to="/dashboard"
 *   onMouseEnter={() => preloadComponent(Dashboard)}
 * >
 *   Dashboard
 * </Link>
 */
export function preloadComponent(lazyComponent) {
  // Access the _ctor property which holds the import function
  if (lazyComponent._payload && lazyComponent._payload._result === null) {
    // Component not loaded yet, trigger load
    return lazyComponent._init(lazyComponent._payload);
  }

  return Promise.resolve();
}

/**
 * Create a lazy component with prefetch capability
 * Returns both the lazy component and a prefetch function
 *
 * @param {Function} componentImport - Dynamic import function
 * @returns {Object} Object with component and prefetch function
 *
 * @example
 * const { component: Dashboard, prefetch: prefetchDashboard } =
 *   lazyWithPrefetch(() => import('./pages/Dashboard'));
 *
 * // Use component normally
 * <Route path="/dashboard" element={<Dashboard />} />
 *
 * // Prefetch on link hover
 * <Link onMouseEnter={prefetchDashboard}>Dashboard</Link>
 */
export function lazyWithPrefetch(componentImport) {
  let importPromise = null;

  const prefetch = () => {
    if (!importPromise) {
      importPromise = componentImport();
    }
    return importPromise;
  };

  const component = lazy(() => {
    if (!importPromise) {
      importPromise = componentImport();
    }
    return importPromise;
  });

  return { component, prefetch };
}

/**
 * Route-based code splitting helper
 * Creates lazy components for all routes with automatic retry
 *
 * @param {Object} routes - Object mapping route names to import functions
 * @returns {Object} Object mapping route names to lazy components
 *
 * @example
 * const pages = lazyRoutes({
 *   Dashboard: () => import('./pages/Dashboard'),
 *   Properties: () => import('./pages/Properties'),
 *   Jobs: () => import('./pages/Jobs'),
 * });
 *
 * <Route path="/dashboard" element={<pages.Dashboard />} />
 */
export function lazyRoutes(routes) {
  const lazyComponents = {};

  Object.keys(routes).forEach((name) => {
    lazyComponents[name] = lazyWithRetry(routes[name]);
  });

  return lazyComponents;
}

/**
 * Prefetch multiple components in parallel
 * Useful for prefetching related pages
 *
 * @param {Array<Function>} componentImports - Array of dynamic import functions
 * @returns {Promise} Promise that resolves when all components are loaded
 *
 * @example
 * // Prefetch related pages when user lands on dashboard
 * useEffect(() => {
 *   prefetchComponents([
 *     () => import('./pages/Properties'),
 *     () => import('./pages/Jobs'),
 *     () => import('./pages/Inspections'),
 *   ]);
 * }, []);
 */
export function prefetchComponents(componentImports) {
  return Promise.all(
    componentImports.map((importFn) =>
      importFn().catch((err) => {
        console.warn('[Prefetch] Failed to prefetch component:', err);
        return null;
      })
    )
  );
}

/**
 * Smart prefetching based on connection quality
 * Only prefetches on fast connections to avoid wasting bandwidth
 *
 * @param {Array<Function>} componentImports - Components to prefetch
 * @returns {Promise|null} Prefetch promise or null if connection is slow
 *
 * @example
 * prefetchOnGoodConnection([
 *   () => import('./pages/Dashboard'),
 *   () => import('./pages/Properties'),
 * ]);
 */
export function prefetchOnGoodConnection(componentImports) {
  // Check if Network Information API is available
  if ('connection' in navigator) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    // Only prefetch on good connections
    if (connection.effectiveType === '4g' || connection.effectiveType === '3g') {
      return prefetchComponents(componentImports);
    }

    console.log('[Prefetch] Skipping prefetch on slow connection:', connection.effectiveType);
    return null;
  }

  // If API not available, prefetch anyway (assume good connection)
  return prefetchComponents(componentImports);
}

/**
 * Component lazy loading with priority levels
 * High priority: load immediately
 * Medium priority: load on idle
 * Low priority: load on demand
 *
 * @param {Function} componentImport - Dynamic import function
 * @param {string} priority - 'high' | 'medium' | 'low'
 * @returns {React.Component} Lazy component
 *
 * @example
 * const Dashboard = lazyWithPriority(
 *   () => import('./pages/Dashboard'),
 *   'high'
 * );
 */
export function lazyWithPriority(componentImport, priority = 'medium') {
  if (priority === 'high') {
    // Load immediately
    return lazy(componentImport);
  }

  if (priority === 'medium') {
    // Load on idle if supported
    if ('requestIdleCallback' in window) {
      let importPromise = null;

      requestIdleCallback(() => {
        importPromise = componentImport();
      });

      return lazy(() => {
        if (!importPromise) {
          importPromise = componentImport();
        }
        return importPromise;
      });
    }
  }

  // Low priority or fallback: standard lazy loading
  return lazy(componentImport);
}

/**
 * Monitor lazy loading performance
 * Tracks chunk load times and warns about slow loads
 *
 * @param {string} componentName - Name for logging
 * @param {Function} componentImport - Dynamic import function
 * @param {number} threshold - Warning threshold in ms (default: 3000)
 * @returns {React.Component} Lazy component
 *
 * @example
 * const Dashboard = monitorLazyLoad(
 *   'Dashboard',
 *   () => import('./pages/Dashboard')
 * );
 */
export function monitorLazyLoad(componentName, componentImport, threshold = 3000) {
  return lazy(() => {
    const start = performance.now();

    return componentImport().then((module) => {
      const duration = performance.now() - start;

      if (duration > threshold) {
        console.warn(`[LazyLoad] Slow chunk load: ${componentName} took ${duration.toFixed(2)}ms`);
      } else {
        console.log(`[LazyLoad] ${componentName} loaded in ${duration.toFixed(2)}ms`);
      }

      return module;
    });
  });
}
