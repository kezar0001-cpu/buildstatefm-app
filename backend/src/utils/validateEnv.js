/**
 * Environment Variable Validation
 * Validates required environment variables on application startup
 * Provides clear error messages for missing or invalid configuration
 */

import logger from './logger.js';

const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'NODE_ENV',
];

const RECOMMENDED_VARS = [
  'FRONTEND_URL',
  'APP_URL',
  'SESSION_SECRET',
];

const PRODUCTION_REQUIRED_VARS = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
];

const OPTIONAL_VARS = {
  'RESEND_API_KEY': 'Email notifications',
  'ALERT_EMAIL': 'System alerts',
  'STRIPE_SECRET_KEY': 'Payment processing',
  'STRIPE_WEBHOOK_SECRET': 'Stripe webhooks',
  'GOOGLE_CLIENT_ID': 'Google OAuth',
  'GOOGLE_CLIENT_SECRET': 'Google OAuth',
  'ANTHROPIC_API_KEY': 'AI blog automation',
  'UNSPLASH_ACCESS_KEY': 'Blog images',
  'REDIS_URL': 'Redis caching',
};

/**
 * Validate environment variable configuration
 * @param {boolean} failFast - Exit process if critical vars are missing
 * @returns {object} Validation result with errors and warnings
 */
export function validateEnvironment(failFast = true) {
  const errors = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters for security');
    }
    if (process.env.JWT_SECRET === 'your-secret-key-here') {
      errors.push('JWT_SECRET must be changed from default value!');
    }
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
      warnings.push('DATABASE_URL should be a PostgreSQL connection string');
    }
  }

  // Check recommended variables
  for (const varName of RECOMMENDED_VARS) {
    if (!process.env[varName]) {
      warnings.push(`Recommended environment variable not set: ${varName}`);
    }
  }

  // Validate SESSION_SECRET strength and prevent insecure defaults
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      warnings.push('SESSION_SECRET should be at least 32 characters for security');
    }
    if (process.env.SESSION_SECRET === 'replace-this-session-secret') {
      errors.push('SESSION_SECRET must be changed from default value!');
    }
  }

  // Production-specific checks
  if (isProduction) {
    if (!process.env.SESSION_SECRET) {
      errors.push('Missing production-required variable: SESSION_SECRET');
    }

    for (const varName of PRODUCTION_REQUIRED_VARS) {
      if (!process.env[varName]) {
        errors.push(`Missing production-required variable: ${varName} (file uploads will fail)`);
      }
    }

    // Validate production URLs
    if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.includes('localhost')) {
      warnings.push('FRONTEND_URL contains localhost in production environment');
    }
  }

  // Check optional variables and log which features are enabled
  const enabledFeatures = [];
  const disabledFeatures = [];

  for (const [varName, feature] of Object.entries(OPTIONAL_VARS)) {
    if (process.env[varName]) {
      enabledFeatures.push(feature);
    } else {
      disabledFeatures.push(feature);
    }
  }

  // Log validation results
  if (errors.length > 0) {
    logger.error('❌ Environment validation failed:');
    errors.forEach(error => logger.error(`  - ${error}`));

    if (failFast) {
      logger.error('\n💡 Please check your .env file and ensure all required variables are set.');
      logger.error('   See backend/.env.example for reference.\n');
      process.exit(1);
    }
  }

  if (warnings.length > 0) {
    logger.warn('⚠️  Environment warnings:');
    warnings.forEach(warning => logger.warn(`  - ${warning}`));
  }

  if (errors.length === 0) {
    logger.info('✅ Environment validation passed');

    if (enabledFeatures.length > 0) {
      logger.info(`📦 Enabled features: ${enabledFeatures.join(', ')}`);
    }

    if (disabledFeatures.length > 0) {
      logger.info(`💤 Disabled features: ${disabledFeatures.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    enabledFeatures,
    disabledFeatures,
  };
}

/**
 * Check if a specific feature is enabled
 * @param {string} feature - Feature name from OPTIONAL_VARS
 * @returns {boolean}
 */
export function isFeatureEnabled(feature) {
  for (const [varName, featureName] of Object.entries(OPTIONAL_VARS)) {
    if (featureName === feature) {
      return !!process.env[varName];
    }
  }
  return false;
}

export default validateEnvironment;
