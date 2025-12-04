/**
 * Subscription Plan Limits and Entitlements
 *
 * USAGE-BASED MODEL:
 * All subscription tiers receive access to EVERY feature in the application.
 * The only differentiator is USAGE LIMITS (properties, team size, analytics depth, automation capacity, etc.).
 *
 * Philosophy:
 * - Every feature is accessible to all customers
 * - Limits are based on usage/capacity, not feature access
 * - Team Management is available to all subscription levels
 * - All team members operate in the same shared workspace
 */

export const PLAN_LIMITS = {
  FREE_TRIAL: {
    // Basic Limits
    properties: 10,
    teamMembers: 5,

    // Inspection Limits
    inspectionsPerMonth: 25,
    recurringInspections: 5,
    customTemplates: 3,

    // Analytics & Reporting
    analyticsHistoryDays: 30,        // 30 days of historical data
    reportExportsPerMonth: 10,
    dashboardRefreshRate: 3600,      // 1 hour in seconds

    // Automation Limits
    automationRulesActive: 3,
    automationRunsPerMonth: 100,
    scheduledReportsPerMonth: 5,

    // Maintenance & Jobs
    maintenancePlansActive: 5,
    jobsPerMonth: 50,

    // Storage & Documents
    storageGB: 5,
    documentUploadsPerMonth: 50,

    // API & Integrations
    apiCallsPerDay: 100,
    webhooksActive: 2,
    integrations: 1,

    // Support
    supportResponseTime: '72 hours',
    supportChannels: ['email'],

    // All features are available
    features: {
      allFeaturesAvailable: true,
    },
  },

  BASIC: {
    // Basic Limits
    properties: 10,
    teamMembers: 30,

    // Inspection Limits
    inspectionsPerMonth: 25,
    recurringInspections: 5,
    customTemplates: 3,

    // Analytics & Reporting
    analyticsHistoryDays: 30,
    reportExportsPerMonth: 10,
    dashboardRefreshRate: 3600,

    // Automation Limits
    automationRulesActive: 3,
    automationRunsPerMonth: 100,
    scheduledReportsPerMonth: 5,

    // Maintenance & Jobs
    maintenancePlansActive: 5,
    jobsPerMonth: 50,

    // Storage & Documents
    storageGB: 5,
    documentUploadsPerMonth: 50,

    // API & Integrations
    apiCallsPerDay: 100,
    webhooksActive: 2,
    integrations: 1,

    // Support
    supportResponseTime: '72 hours',
    supportChannels: ['email'],

    // All features are available
    features: {
      allFeaturesAvailable: true,
    },
  },

  PROFESSIONAL: {
    // Basic Limits
    properties: 50,
    teamMembers: 100,

    // Inspection Limits
    inspectionsPerMonth: 100,
    recurringInspections: 25,
    customTemplates: 15,

    // Analytics & Reporting
    analyticsHistoryDays: 180,       // 6 months
    reportExportsPerMonth: 50,
    dashboardRefreshRate: 900,       // 15 minutes

    // Automation Limits
    automationRulesActive: 15,
    automationRunsPerMonth: 1000,
    scheduledReportsPerMonth: 25,

    // Maintenance & Jobs
    maintenancePlansActive: 25,
    jobsPerMonth: 250,

    // Storage & Documents
    storageGB: 50,
    documentUploadsPerMonth: 250,

    // API & Integrations
    apiCallsPerDay: 1000,
    webhooksActive: 10,
    integrations: 5,

    // Support
    supportResponseTime: '24 hours',
    supportChannels: ['email', 'chat'],

    // All features are available
    features: {
      allFeaturesAvailable: true,
    },
  },

  ENTERPRISE: {
    // Basic Limits - Unlimited
    properties: Infinity,
    teamMembers: Infinity,

    // Inspection Limits
    inspectionsPerMonth: Infinity,
    recurringInspections: Infinity,
    customTemplates: Infinity,

    // Analytics & Reporting
    analyticsHistoryDays: Infinity,  // Unlimited history
    reportExportsPerMonth: Infinity,
    dashboardRefreshRate: 300,       // 5 minutes

    // Automation Limits
    automationRulesActive: Infinity,
    automationRunsPerMonth: Infinity,
    scheduledReportsPerMonth: Infinity,

    // Maintenance & Jobs
    maintenancePlansActive: Infinity,
    jobsPerMonth: Infinity,

    // Storage & Documents
    storageGB: Infinity,
    documentUploadsPerMonth: Infinity,

    // API & Integrations
    apiCallsPerDay: Infinity,
    webhooksActive: Infinity,
    integrations: Infinity,

    // Support
    supportResponseTime: '4 hours',
    supportChannels: ['email', 'chat', 'phone', 'dedicated-slack'],
    dedicatedAccountManager: true,

    // All features are available
    features: {
      allFeaturesAvailable: true,
    },
  },
};

/**
 * Get plan limits for a given subscription plan
 * @param {string} plan - The subscription plan (BASIC, STARTER, PROFESSIONAL, ENTERPRISE, FREE_TRIAL)
 * @returns {object} Plan limits and features
 */
export function getPlanLimits(plan) {
  const normalizedPlan = typeof plan === 'string' ? plan.toUpperCase() : 'FREE_TRIAL';
  // Map STARTER to BASIC (they are the same plan)
  const mappedPlan = normalizedPlan === 'STARTER' ? 'BASIC' : normalizedPlan;
  return PLAN_LIMITS[mappedPlan] || PLAN_LIMITS.FREE_TRIAL;
}

/**
 * Get property limit for a given plan
 * @param {string} plan - The subscription plan
 * @returns {number} Maximum number of properties (Infinity for unlimited)
 */
export function getPropertyLimit(plan) {
  const limits = getPlanLimits(plan);
  return limits.properties;
}

/**
 * Get team member limit for a given plan
 * @param {string} plan - The subscription plan
 * @returns {number} Maximum number of team members (Infinity for unlimited)
 */
export function getTeamMemberLimit(plan) {
  const limits = getPlanLimits(plan);
  return limits.teamMembers;
}

/**
 * Get a specific limit value for a given plan
 * @param {string} plan - The subscription plan
 * @param {string} limitType - The limit to retrieve (e.g., 'inspectionsPerMonth', 'storageGB')
 * @returns {number|string} The limit value
 */
export function getLimit(plan, limitType) {
  const limits = getPlanLimits(plan);
  return limits[limitType];
}

/**
 * Check if a feature is available for a given plan
 * NOTE: In the new usage-based model, ALL features are available to ALL plans
 * @param {string} plan - The subscription plan
 * @param {string} feature - The feature name (kept for backward compatibility)
 * @returns {boolean} Always returns true in usage-based model
 */
export function hasFeature(plan, feature) {
  // All features are available in the usage-based model
  return true;
}

/**
 * Check if user can create more properties based on their plan
 * @param {string} plan - The subscription plan
 * @param {number} currentCount - Current number of properties
 * @returns {boolean} True if user can create more properties
 */
export function canCreateProperty(plan, currentCount) {
  const limit = getPropertyLimit(plan);
  return currentCount < limit;
}

/**
 * Check if user can add more team members based on their plan
 * @param {string} plan - The subscription plan
 * @param {number} currentCount - Current number of team members
 * @returns {boolean} True if user can add more team members
 */
export function canAddTeamMember(plan, currentCount) {
  const limit = getTeamMemberLimit(plan);
  return currentCount < limit;
}

/**
 * Check if user has reached a usage limit
 * @param {string} plan - The subscription plan
 * @param {string} limitType - The type of limit to check
 * @param {number} currentUsage - Current usage count
 * @returns {boolean} True if limit has been reached
 */
export function hasReachedLimit(plan, limitType, currentUsage) {
  const limit = getLimit(plan, limitType);
  if (limit === Infinity) return false;
  return currentUsage >= limit;
}

/**
 * Get remaining usage for a specific limit
 * @param {string} plan - The subscription plan
 * @param {string} limitType - The type of limit
 * @param {number} currentUsage - Current usage count
 * @returns {number} Remaining usage (Infinity if unlimited)
 */
export function getRemainingUsage(plan, limitType, currentUsage) {
  const limit = getLimit(plan, limitType);
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - currentUsage);
}

/**
 * Get usage percentage for a specific limit
 * @param {string} plan - The subscription plan
 * @param {string} limitType - The type of limit
 * @param {number} currentUsage - Current usage count
 * @returns {number} Usage percentage (0-100, or 0 if unlimited)
 */
export function getUsagePercentage(plan, limitType, currentUsage) {
  const limit = getLimit(plan, limitType);
  if (limit === Infinity) return 0;
  return Math.min(100, (currentUsage / limit) * 100);
}

/**
 * Get a user-friendly message for a limit reached error
 * @param {string} limitType - Type of limit (properties, teamMembers, inspectionsPerMonth, etc.)
 * @param {string} plan - Current subscription plan
 * @returns {string} Error message
 */
export function getLimitReachedMessage(limitType, plan) {
  const limits = getPlanLimits(plan);
  const limit = limits[limitType];

  if (limit === Infinity) {
    return `You have unlimited ${limitType}.`;
  }

  const limitName = limitType.replace(/([A-Z])/g, ' $1').toLowerCase();

  switch (limitType) {
    case 'properties':
      return `You've reached your plan's limit of ${limit} properties. Upgrade to manage more properties.`;

    case 'teamMembers':
      return `You've reached your plan's limit of ${limit} team member${limit === 1 ? '' : 's'}. Upgrade to add more team members.`;

    case 'inspectionsPerMonth':
      return `You've reached your monthly limit of ${limit} inspections. Upgrade for more inspection capacity.`;

    case 'recurringInspections':
      return `You've reached your limit of ${limit} active recurring inspections. Upgrade to schedule more.`;

    case 'customTemplates':
      return `You've reached your limit of ${limit} custom templates. Upgrade to create more templates.`;

    case 'analyticsHistoryDays':
      return `Your plan includes ${limit} days of analytics history. Upgrade for extended historical data.`;

    case 'reportExportsPerMonth':
      return `You've reached your monthly limit of ${limit} report exports. Upgrade for more exports.`;

    case 'automationRulesActive':
      return `You've reached your limit of ${limit} active automation rules. Upgrade for more automation capacity.`;

    case 'automationRunsPerMonth':
      return `You've reached your monthly limit of ${limit} automation runs. Upgrade for more automation capacity.`;

    case 'maintenancePlansActive':
      return `You've reached your limit of ${limit} active maintenance plans. Upgrade to create more plans.`;

    case 'jobsPerMonth':
      return `You've reached your monthly limit of ${limit} jobs. Upgrade for higher job capacity.`;

    case 'storageGB':
      return `You've reached your storage limit of ${limit}GB. Upgrade for more storage space.`;

    case 'documentUploadsPerMonth':
      return `You've reached your monthly limit of ${limit} document uploads. Upgrade for more capacity.`;

    case 'apiCallsPerDay':
      return `You've reached your daily API call limit of ${limit}. Upgrade for higher API quotas.`;

    case 'webhooksActive':
      return `You've reached your limit of ${limit} active webhooks. Upgrade to configure more webhooks.`;

    case 'integrations':
      return `You've reached your limit of ${limit} active integration${limit === 1 ? '' : 's'}. Upgrade to connect more integrations.`;

    default:
      return `You've reached your plan's ${limitName} limit of ${limit}. Upgrade to increase this limit.`;
  }
}

/**
 * Get recommended upgrade plan based on current plan
 * @param {string} currentPlan - Current subscription plan
 * @returns {string} Recommended upgrade plan
 */
export function getRecommendedUpgrade(currentPlan) {
  const normalized = typeof currentPlan === 'string' ? currentPlan.toUpperCase() : 'FREE_TRIAL';

  switch (normalized) {
    case 'FREE_TRIAL':
    case 'BASIC':
      return 'PROFESSIONAL';
    case 'PROFESSIONAL':
      return 'ENTERPRISE';
    case 'ENTERPRISE':
      return 'ENTERPRISE'; // Already at max
    default:
      return 'PROFESSIONAL';
  }
}

/**
 * Get all limit types that are approaching their limit (>= 80%)
 * @param {string} plan - The subscription plan
 * @param {object} currentUsage - Object with current usage for each limit type
 * @returns {Array} Array of limit types that are approaching their limit
 */
export function getApproachingLimits(plan, currentUsage) {
  const approaching = [];
  const limits = getPlanLimits(plan);

  for (const [limitType, limit] of Object.entries(limits)) {
    if (typeof limit === 'number' && limit !== Infinity && currentUsage[limitType]) {
      const usage = currentUsage[limitType];
      const percentage = (usage / limit) * 100;

      if (percentage >= 80) {
        approaching.push({
          limitType,
          limit,
          usage,
          percentage,
          remaining: limit - usage,
        });
      }
    }
  }

  return approaching;
}
