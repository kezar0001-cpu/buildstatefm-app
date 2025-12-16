import logger from '../utils/logger.js';

const MAX_TELEMETRY_SAMPLES = 1000;
const telemetrySamples = [];

function recordTelemetrySample(sample) {
  telemetrySamples.push(sample);
  if (telemetrySamples.length > MAX_TELEMETRY_SAMPLES) {
    telemetrySamples.splice(0, telemetrySamples.length - MAX_TELEMETRY_SAMPLES);
  }
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function getApiTelemetrySnapshot({ windowMs = 15 * 60 * 1000, now = Date.now() } = {}) {
  const windowStart = now - windowMs;
  const windowed = telemetrySamples.filter((s) => s && s.timestampMs >= windowStart && s.timestampMs <= now);

  const durations = windowed.map((s) => s.durationMs).filter((v) => Number.isFinite(v));
  const total = windowed.length;
  const errors = windowed.filter((s) => (s.statusCode || 0) >= 500).length;
  const warnings = windowed.filter((s) => (s.statusCode || 0) >= 400 && (s.statusCode || 0) < 500).length;

  const byRoute = new Map();
  windowed.forEach((s) => {
    const key = `${s.method} ${s.path}`;
    if (!byRoute.has(key)) {
      byRoute.set(key, { key, method: s.method, path: s.path, count: 0, errors: 0, durations: [] });
    }
    const entry = byRoute.get(key);
    entry.count += 1;
    if ((s.statusCode || 0) >= 500) entry.errors += 1;
    if (Number.isFinite(s.durationMs)) entry.durations.push(s.durationMs);
  });

  const topRoutes = Array.from(byRoute.values())
    .map((row) => {
      const d = row.durations;
      return {
        method: row.method,
        path: row.path,
        count: row.count,
        errors: row.errors,
        avgMs: d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null,
        p95Ms: percentile(d, 95),
        maxMs: d.length ? Math.max(...d) : null,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    windowMs,
    sampleSize: total,
    totals: {
      requests: total,
      errors,
      warnings,
      errorRate: total > 0 ? errors / total : 0,
    },
    latencyMs: {
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      max: durations.length ? Math.max(...durations) : null,
    },
    topRoutes,
    timestamp: new Date(now).toISOString(),
  };
}

/**
 * Request/Response logging middleware
 * Logs all API requests with detailed information including:
 * - Timestamp
 * - User ID (if authenticated)
 * - Endpoint
 * - HTTP method
 * - Status code
 * - Response time
 * - Error stack traces for 5xx errors
 */
const requestLogger = (req, res, next) => {
  // Capture the start time
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;
  const originalJson = res.json;

  // Track if response has been logged
  let logged = false;

  // Log function to avoid duplicate logs
  const logRequest = (statusCode) => {
    if (logged) return;
    logged = true;

    const duration = Date.now() - startTime;
    const userId = req.user?.id || req.session?.userId || 'anonymous';
    const endpoint = req.originalUrl || req.url;
    const pathOnly = String(endpoint).split('?')[0];

    recordTelemetrySample({
      timestampMs: Date.now(),
      method: req.method,
      path: pathOnly,
      statusCode,
      durationMs: duration,
    });

    // Build log data
    const logData = {
      timestamp: new Date().toISOString(),
      userId,
      method: req.method,
      endpoint,
      path: req.path,
      statusCode,
      responseTime: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    // Add query params if present
    if (req.query && Object.keys(req.query).length > 0) {
      logData.queryParams = req.query;
    }

    // Add request body for non-GET requests (sanitize sensitive data)
    if (
      req.method !== 'GET' &&
      req.body &&
      !Buffer.isBuffer(req.body) &&
      typeof req.body === 'object' &&
      Object.keys(req.body).length > 0
    ) {
      const sanitizedBody = { ...req.body };
      // Remove sensitive fields from logging
      const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
      sensitiveFields.forEach(field => {
        if (sanitizedBody[field]) {
          sanitizedBody[field] = '[REDACTED]';
        }
      });
      logData.requestBody = sanitizedBody;
    }

    // Determine log level based on status code
    if (statusCode >= 500) {
      // For 5xx errors, log with error level and include stack trace if available
      logData.level = 'error';

      // If there's an error object stored on the response, include the stack trace
      if (res.locals.error) {
        logData.error = {
          message: res.locals.error.message,
          stack: res.locals.error.stack,
          name: res.locals.error.name,
        };
      }

      logger.error('HTTP Request Error', logData);
    } else if (statusCode >= 400) {
      // For 4xx errors, log as warning
      logger.warn('HTTP Request Warning', logData);
    } else {
      // For successful requests, log at http level
      logger.http('HTTP Request', logData);
    }
  };

  // Override res.json to capture status code
  res.json = function(body) {
    const statusCode = res.statusCode || 200;
    logRequest(statusCode);
    return originalJson.call(this, body);
  };

  // Override res.end to capture final status code
  res.end = function(...args) {
    const statusCode = res.statusCode || 200;
    logRequest(statusCode);
    return originalEnd.apply(this, args);
  };

  // Handle errors by storing them on res.locals for logging
  res.on('error', (error) => {
    res.locals.error = error;
  });

  next();
};

/**
 * Error logging middleware
 * Should be added after all routes to catch unhandled errors
 * Captures detailed error information for 5xx errors
 */
export const errorLogger = (err, req, res, next) => {
  // Store error on res.locals so request logger can access it
  res.locals.error = err;

  // Log the error immediately
  const logData = {
    timestamp: new Date().toISOString(),
    userId: req.user?.id || req.session?.userId || 'anonymous',
    method: req.method,
    endpoint: req.originalUrl || req.url,
    path: req.path,
    ip: req.ip || req.connection?.remoteAddress,
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
      statusCode: err.statusCode || err.status || 500,
    },
  };

  logger.error('Unhandled Error', logData);

  // Pass to next error handler
  next(err);
};

export default requestLogger;
