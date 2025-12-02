/**
 * Subscription Plan Limits and Entitlements
 * Defines the features, limits, and capabilities for each subscription tier
 */

export const PLAN_LIMITS = {
  FREE_TRIAL: {
    properties: 10,
    teamMembers: 1,
    features: {
      basicInspections: true,
      advancedInspections: false,
      jobManagement: true,
      serviceRequests: true,
      maintenancePlans: false,
      recurringInspections: false,
      analyticsBasic: false,
      analyticsAdvanced: false,
      customTemplates: false,
      auditTrails: false,
      apiAccess: false,
      customIntegrations: false,
      dedicatedSupport: false,
      technicianInvites: true,
      ownerInvites: true,
    },
  },
  BASIC: {
    properties: 10,
    teamMembers: 1,
    features: {
      basicInspections: true,
      advancedInspections: false,
      jobManagement: true,
      serviceRequests: true,
      maintenancePlans: false,
      recurringInspections: false,
      analyticsBasic: false,
      analyticsAdvanced: false,
      customTemplates: false,
      auditTrails: false,
      apiAccess: false,
      customIntegrations: false,
      dedicatedSupport: false,
      technicianInvites: true,
      ownerInvites: true,
    },
  },
  PROFESSIONAL: {
    properties: 50,
    teamMembers: 5,
    features: {
      basicInspections: true,
      advancedInspections: true,
      jobManagement: true,
      serviceRequests: true,
      maintenancePlans: true,
      recurringInspections: true,
      analyticsBasic: true,
      analyticsAdvanced: false,
      customTemplates: false,
      auditTrails: false,
      apiAccess: false,
      customIntegrations: false,
      dedicatedSupport: false,
      technicianInvites: true,
      ownerInvites: true,
    },
  },
  ENTERPRISE: {
    properties: Infinity, // Unlimited
    teamMembers: Infinity, // Unlimited
    features: {
      basicInspections: true,
      advancedInspections: true,
      jobManagement: true,
      serviceRequests: true,
      maintenancePlans: true,
      recurringInspections: true,
      analyticsBasic: true,
      analyticsAdvanced: true,
      customTemplates: true,
      auditTrails: true,
      apiAccess: true,
      customIntegrations: true,
      dedicatedSupport: true,
      technicianInvites: true,
      ownerInvites: true,
    },
  },
};

/**
 * Get plan limits for a given subscription plan
 * @param {string} plan - The subscription plan (BASIC, PROFESSIONAL, ENTERPRISE, FREE_TRIAL)
 * @returns {object} Plan limits and features
 */
export function getPlanLimits(plan) {
  const normalizedPlan = typeof plan === 'string' ? plan.toUpperCase() : 'FREE_TRIAL';
  return PLAN_LIMITS[normalizedPlan] || PLAN_LIMITS.FREE_TRIAL;
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
 * Check if a feature is available for a given plan
 * @param {string} plan - The subscription plan
 * @param {string} feature - The feature name
 * @returns {boolean} True if feature is available
 */
export function hasFeature(plan, feature) {
  const limits = getPlanLimits(plan);
  return limits.features[feature] === true;
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
 * Get a user-friendly message for a limit reached error
 * @param {string} limitType - Type of limit (properties, teamMembers, feature)
 * @param {string} plan - Current subscription plan
 * @returns {string} Error message
 */
export function getLimitReachedMessage(limitType, plan) {
  const limits = getPlanLimits(plan);

  switch (limitType) {
    case 'properties':
      if (limits.properties === Infinity) {
        return 'You have unlimited properties.';
      }
      return `You've reached your plan's limit of ${limits.properties} properties. Upgrade to add more.`;

    case 'teamMembers':
      if (limits.teamMembers === Infinity) {
        return 'You have unlimited team members.';
      }
      return `You've reached your plan's limit of ${limits.teamMembers} team member${limits.teamMembers === 1 ? '' : 's'}. Upgrade to add more.`;

    case 'customTemplates':
      return 'Custom inspection templates are available on the Enterprise plan. Upgrade to create custom templates.';

    case 'auditTrails':
      return 'Audit trails and compliance features are available on the Enterprise plan.';

    case 'apiAccess':
      return 'API access is available on the Enterprise plan.';

    case 'advancedAnalytics':
      return 'Advanced analytics and reporting are available on the Enterprise plan.';

    case 'maintenancePlans':
      return 'Maintenance plans and scheduling are available on the Professional plan and above.';

    case 'recurringInspections':
      return 'Recurring inspections are available on the Professional plan and above.';

    default:
      return 'This feature is not available on your current plan. Upgrade to access it.';
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
