/**
 * Performance Monitoring Utilities
 *
 * Provides tools for tracking and optimizing application performance:
 * - Component render tracking
 * - API call performance
 * - Memory usage monitoring
 * - Bundle size analysis helpers
 */

/**
 * Measure component render performance
 * Use in development to identify expensive renders
 *
 * @param {string} componentName - Name of the component
 * @param {Function} callback - Function to execute and measure
 * @returns {any} Result of the callback
 *
 * @example
 * const result = measureRender('PropertyList', () => {
 *   return properties.map(renderProperty);
 * });
 */
export function measureRender(componentName, callback) {
  if (process.env.NODE_ENV !== 'development') {
    return callback();
  }

  const start = performance.now();
  const result = callback();
  const end = performance.now();
  const duration = end - start;

  if (duration > 16) {
    // Warn if render takes longer than 1 frame (16ms at 60fps)
    console.warn(`[Performance] ${componentName} render took ${duration.toFixed(2)}ms`);
  }

  return result;
}

/**
 * Track API call performance
 * Automatically measures and logs slow API calls
 *
 * @param {string} endpoint - API endpoint being called
 * @param {Function} apiCall - Async function that makes the API call
 * @param {number} threshold - Warning threshold in ms (default: 1000)
 * @returns {Promise} Result of the API call
 *
 * @example
 * const data = await measureApiCall('/api/properties', () =>
 *   apiClient.get('/properties')
 * );
 */
export async function measureApiCall(endpoint, apiCall, threshold = 1000) {
  const start = performance.now();

  try {
    const result = await apiCall();
    const duration = performance.now() - start;

    if (duration > threshold) {
      console.warn(`[Performance] Slow API call: ${endpoint} took ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Performance] Failed API call: ${endpoint} after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * Memory usage monitor
 * Tracks memory usage and warns about potential leaks
 * Only works in browsers that support performance.memory (Chrome)
 *
 * @example
 * const monitor = createMemoryMonitor();
 * monitor.start();
 * // ... do work ...
 * monitor.stop();
 */
export function createMemoryMonitor() {
  let intervalId = null;
  let measurements = [];

  return {
    start: (intervalMs = 5000) => {
      if (!performance.memory) {
        console.warn('[Performance] Memory monitoring not supported in this browser');
        return;
      }

      intervalId = setInterval(() => {
        const used = performance.memory.usedJSHeapSize / 1048576; // Convert to MB
        measurements.push(used);

        // Keep only last 20 measurements
        if (measurements.length > 20) {
          measurements.shift();
        }

        // Warn if memory is consistently growing
        if (measurements.length >= 10) {
          const recent = measurements.slice(-5);
          const older = measurements.slice(-10, -5);
          const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b) / older.length;

          if (recentAvg > olderAvg * 1.5) {
            console.warn(`[Performance] Potential memory leak detected. Usage increased from ${olderAvg.toFixed(2)}MB to ${recentAvg.toFixed(2)}MB`);
          }
        }
      }, intervalMs);
    },

    stop: () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      measurements = [];
    },

    getStats: () => {
      if (!performance.memory) return null;

      return {
        current: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
        limit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
        measurements: measurements.map(m => m.toFixed(2) + ' MB'),
      };
    },
  };
}

/**
 * Debounce function to prevent excessive function calls
 * Useful for scroll, resize, input handlers
 *
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 *
 * @example
 * const handleSearch = debounce((value) => {
 *   fetchResults(value);
 * }, 300);
 */
export function debounce(func, wait) {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit function execution rate
 * Useful for scroll handlers, resize handlers
 *
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in ms
 * @returns {Function} Throttled function
 *
 * @example
 * const handleScroll = throttle(() => {
 *   checkScrollPosition();
 * }, 100);
 */
export function throttle(func, limit) {
  let inThrottle;

  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Track long tasks that block the main thread
 * Uses PerformanceObserver API if available
 *
 * @param {Function} callback - Called when long task is detected
 * @example
 * trackLongTasks((entry) => {
 *   console.warn('Long task detected:', entry.duration);
 * });
 */
export function trackLongTasks(callback) {
  if (!window.PerformanceObserver) {
    console.warn('[Performance] PerformanceObserver not supported');
    return () => {};
  }

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 50) {
          // Task longer than 50ms
          callback(entry);
        }
      });
    });

    observer.observe({ entryTypes: ['longtask'] });

    return () => observer.disconnect();
  } catch (e) {
    console.warn('[Performance] Long task tracking not supported:', e);
    return () => {};
  }
}

/**
 * Measure First Contentful Paint (FCP) and Largest Contentful Paint (LCP)
 * Key web vitals metrics
 *
 * @example
 * measureWebVitals((metrics) => {
 *   console.log('Web Vitals:', metrics);
 * });
 */
export function measureWebVitals(callback) {
  const vitals = {};

  // First Contentful Paint
  try {
    const fcpObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          vitals.fcp = entry.startTime;
          callback({ ...vitals });
        }
      });
    });
    fcpObserver.observe({ entryTypes: ['paint'] });
  } catch (e) {
    console.warn('[Performance] FCP measurement not supported');
  }

  // Largest Contentful Paint
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
      callback({ ...vitals });
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    console.warn('[Performance] LCP measurement not supported');
  }

  // First Input Delay
  try {
    const fidObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        vitals.fid = entry.processingStart - entry.startTime;
        callback({ ...vitals });
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });
  } catch (e) {
    console.warn('[Performance] FID measurement not supported');
  }
}

/**
 * Lazy load images with Intersection Observer
 * Improves initial page load performance
 *
 * @param {string} selector - CSS selector for images to lazy load
 *
 * @example
 * lazyLoadImages('img[data-src]');
 */
export function lazyLoadImages(selector) {
  if (!window.IntersectionObserver) {
    // Fallback: load all images immediately
    document.querySelectorAll(selector).forEach((img) => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
    });
    return;
  }

  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      }
    });
  });

  document.querySelectorAll(selector).forEach((img) => {
    imageObserver.observe(img);
  });
}

/**
 * Bundle size analyzer helper
 * Run this in production to identify large dependencies
 *
 * @example
 * analyzeBundleSize();
 */
export function analyzeBundleSize() {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[Performance] Bundle analysis should run in production build');
    return;
  }

  const resources = performance.getEntriesByType('resource');
  const scripts = resources.filter((r) => r.name.endsWith('.js'));

  const scriptSizes = scripts
    .map((script) => ({
      name: script.name.split('/').pop(),
      size: script.transferSize,
      duration: script.duration,
    }))
    .sort((a, b) => b.size - a.size);

  console.table(scriptSizes);
  console.log(`Total JS transferred: ${(scriptSizes.reduce((sum, s) => sum + s.size, 0) / 1024).toFixed(2)} KB`);
}

/**
 * Development-only performance logger
 * Automatically logs performance metrics in development
 */
export function enablePerformanceLogging() {
  if (process.env.NODE_ENV !== 'development') return;

  // Log web vitals
  measureWebVitals((vitals) => {
    console.log('[Performance] Web Vitals:', vitals);
  });

  // Track long tasks
  trackLongTasks((entry) => {
    console.warn(`[Performance] Long task detected: ${entry.duration.toFixed(2)}ms`);
  });

  // Memory monitoring (Chrome only)
  const memoryMonitor = createMemoryMonitor();
  memoryMonitor.start(10000); // Check every 10 seconds

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    memoryMonitor.stop();
    const stats = memoryMonitor.getStats();
    if (stats) {
      console.log('[Performance] Final memory stats:', stats);
    }
  });
}
