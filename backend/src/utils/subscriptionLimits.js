/**
 * Subscription Limits - Usage-Based SaaS Model
 * 
 * All subscription tiers receive access to EVERY feature.
 * The only differentiator is USAGE LIMITS.
 */

const USAGE_LIMITS = {
  BASIC: {
    properties: 10,
    teamMembers: 1,
    inspectionsPerMonth: 25,
    recurringInspections: 5,
    customTemplates: 3,
    analyticsHistoryDays: 30,
    reportExportsPerMonth: 10,
    automationRules: 3,
    automationRunsPerMonth: 100,
    maintenancePlans: 5,
    jobsPerMonth: 50,
    storageGB: 5,
    documentUploadsPerMonth: 50,
    apiCallsPerDay: 100,
    webhooks: 2,
    integrations: 1,
  },
  PROFESSIONAL: {
    properties: 50,
    teamMembers: 5,
    inspectionsPerMonth: 100,
    recurringInspections: 25,
    customTemplates: 15,
    analyticsHistoryDays: 180,
    reportExportsPerMonth: 50,
    automationRules: 15,
    automationRunsPerMonth: 1000,
    maintenancePlans: 25,
    jobsPerMonth: 250,
    storageGB: 50,
    documentUploadsPerMonth: 250,
    apiCallsPerDay: 1000,
    webhooks: 10,
    integrations: 5,
  },
  ENTERPRISE: {
    properties: Infinity,
    teamMembers: Infinity,
    inspectionsPerMonth: Infinity,
    recurringInspections: Infinity,
    customTemplates: Infinity,
    analyticsHistoryDays: Infinity,
    reportExportsPerMonth: Infinity,
    automationRules: Infinity,
    automationRunsPerMonth: Infinity,
    maintenancePlans: Infinity,
    jobsPerMonth: Infinity,
    storageGB: Infinity,
    documentUploadsPerMonth: Infinity,
    apiCallsPerDay: Infinity,
    webhooks: Infinity,
    integrations: Infinity,
  },
  FREE_TRIAL: {
    // Trial users get Professional limits
    ...USAGE_LIMITS?.PROFESSIONAL || {
      properties: 50,
      teamMembers: 5,
      inspectionsPerMonth: 100,
      recurringInspections: 25,
      customTemplates: 15,
      analyticsHistoryDays: 180,
      reportExportsPerMonth: 50,
      automationRules: 15,
      automationRunsPerMonth: 1000,
      maintenancePlans: 25,
      jobsPerMonth: 250,
      storageGB: 50,
      documentUploadsPerMonth: 250,
      apiCallsPerDay: 1000,
      webhooks: 10,
      integrations: 5,
    },
  },
};

// Fix the circular reference
USAGE_LIMITS.FREE_TRIAL = {
  properties: 50,
  teamMembers: 5,
  inspectionsPerMonth: 100,
  recurringInspections: 25,
  customTemplates: 15,
  analyticsHistoryDays: 180,
  reportExportsPerMonth: 50,
  automationRules: 15,
  automationRunsPerMonth: 1000,
  maintenancePlans: 25,
  jobsPerMonth: 250,
  storageGB: 50,
  documentUploadsPerMonth: 250,
  apiCallsPerDay: 1000,
  webhooks: 10,
  integrations: 5,
};

/**
 * Get usage limits for a subscription plan
 * @param {string} plan - Subscription plan (BASIC, PROFESSIONAL, ENTERPRISE, FREE_TRIAL)
 * @param {object} customLimits - Optional custom limits (for enterprise)
 * @returns {object} Usage limits object
 */
export function getUsageLimits(plan, customLimits = null) {
  const planKey = plan?.toUpperCase() || 'FREE_TRIAL';
  const baseLimits = USAGE_LIMITS[planKey] || USAGE_LIMITS.FREE_TRIAL;

  // Merge custom limits if provided (enterprise feature)
  if (customLimits && typeof customLimits === 'object') {
    return { ...baseLimits, ...customLimits };
  }

  return baseLimits;
}

/**
 * Check if a feature is available (always returns true - all features available to all plans)
 * @param {string} plan - Subscription plan
 * @param {string} feature - Feature name (for future use)
 * @returns {boolean} Always true
 */
export function hasFeature(plan, feature) {
  // All features are available to all subscription tiers
  return true;
}

/**
 * Check if usage limit has been reached
 * @param {string} plan - Subscription plan
 * @param {string} limitType - Type of limit (e.g., 'properties', 'teamMembers')
 * @param {number} currentUsage - Current usage count
 * @param {object} customLimits - Optional custom limits
 * @returns {boolean} True if limit reached
 */
export function hasReachedLimit(plan, limitType, currentUsage, customLimits = null) {
  const limits = getUsageLimits(plan, customLimits);
  const limit = limits[limitType];

  // Infinity means unlimited
  if (limit === Infinity || limit === null || limit === undefined) {
    return false;
  }

  return currentUsage >= limit;
}

/**
 * Get remaining usage for a limit type
 * @param {string} plan - Subscription plan
 * @param {string} limitType - Type of limit
 * @param {number} currentUsage - Current usage count
 * @param {object} customLimits - Optional custom limits
 * @returns {number} Remaining usage (Infinity if unlimited)
 */
export function getRemainingUsage(plan, limitType, currentUsage, customLimits = null) {
  const limits = getUsageLimits(plan, customLimits);
  const limit = limits[limitType];

  if (limit === Infinity || limit === null || limit === undefined) {
    return Infinity;
  }

  const remaining = limit - currentUsage;
  return Math.max(0, remaining);
}

/**
 * Get usage as percentage
 * @param {string} plan - Subscription plan
 * @param {string} limitType - Type of limit
 * @param {number} currentUsage - Current usage count
 * @param {object} customLimits - Optional custom limits
 * @returns {number} Usage percentage (0-100, or null if unlimited)
 */
export function getUsagePercentage(plan, limitType, currentUsage, customLimits = null) {
  const limits = getUsageLimits(plan, customLimits);
  const limit = limits[limitType];

  if (limit === Infinity || limit === null || limit === undefined) {
    return null; // Unlimited
  }

  if (limit === 0) {
    return 100; // Already at limit
  }

  const percentage = (currentUsage / limit) * 100;
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Get limits that are approaching (>= 80% used)
 * @param {string} plan - Subscription plan
 * @param {object} currentUsage - Object with current usage for each limit type
 * @param {object} customLimits - Optional custom limits
 * @returns {array} Array of limit types that are approaching
 */
export function getApproachingLimits(plan, currentUsage, customLimits = null) {
  const limits = getUsageLimits(plan, customLimits);
  const approaching = [];

  for (const [limitType, current] of Object.entries(currentUsage)) {
    const percentage = getUsagePercentage(plan, limitType, current, customLimits);
    if (percentage !== null && percentage >= 80) {
      approaching.push({
        type: limitType,
        current,
        limit: limits[limitType],
        percentage: Math.round(percentage),
      });
    }
  }

  return approaching;
}

/**
 * Get all limits for a plan (for display purposes)
 * @param {string} plan - Subscription plan
 * @param {object} customLimits - Optional custom limits
 * @returns {object} All limits
 */
export function getAllLimits(plan, customLimits = null) {
  return getUsageLimits(plan, customLimits);
}

