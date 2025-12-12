/**
 * Subscription Enforcement Audit Utility
 * 
 * This file documents which routes require subscription checks and helps
 * ensure all protected routes have proper subscription enforcement.
 * 
 * Manual Review Required:
 * - Review all routes listed below and ensure they have subscription middleware
 * - Add requireActiveSubscription or requirePropertyManagerSubscription as needed
 * - Test subscription enforcement after deployment
 */

/**
 * Routes that should have requireActiveSubscription:
 * - Property Manager only routes that create/modify data
 * - Routes that access premium features
 */
export const ROUTES_REQUIRING_ACTIVE_SUBSCRIPTION = [
  // Properties
  'POST /api/properties',
  'PATCH /api/properties/:id',
  'DELETE /api/properties/:id',
  
  // Units
  'POST /api/units',
  'PATCH /api/units/:id',
  'DELETE /api/units/:id',
  
  // Jobs
  'POST /api/jobs',
  'PATCH /api/jobs/:id',
  'DELETE /api/jobs/:id',
  
  // Inspections
  'POST /api/inspections',
  'PATCH /api/inspections/:id',
  'DELETE /api/inspections/:id',
  
  // Service Requests
  'POST /api/service-requests',
  'PATCH /api/service-requests/:id',
  
  // Templates
  'POST /api/inspection-templates',
  'PATCH /api/inspection-templates/:id',
  'DELETE /api/inspection-templates/:id',
  
  // Recurring Inspections
  'POST /api/recurring-inspections',
  'PATCH /api/recurring-inspections/:id',
  'DELETE /api/recurring-inspections/:id',
];

/**
 * Routes that should have requirePropertyManagerSubscription:
 * - Routes that access property-specific data
 * - Routes where subscription is tied to the property manager
 */
export const ROUTES_REQUIRING_PROPERTY_MANAGER_SUBSCRIPTION = [
  // Property-specific routes
  'GET /api/properties/:id',
  'GET /api/properties/:id/units',
  'GET /api/properties/:id/activity',
  
  // Unit-specific routes
  'GET /api/units/:id',
  'GET /api/units/:id/tenants',
  'GET /api/units/:id/jobs',
  'GET /api/units/:id/inspections',
  
  // Dashboard (if property-specific)
  'GET /api/dashboard/summary',
  'GET /api/dashboard/activity',
];

/**
 * Routes that should NOT have subscription checks:
 * - Public routes (auth, health checks)
 * - Read-only routes for tenants/owners
 * - Routes that check subscription in their own logic
 */
export const ROUTES_EXEMPT_FROM_SUBSCRIPTION = [
  // Auth routes
  'POST /api/auth/login',
  'POST /api/auth/register',
  'POST /api/auth/refresh',
  'GET /api/auth/me',
  
  // Health checks
  'GET /health',
  'GET /',
  
  // Public read routes (if any)
  'GET /api/plans',
];

/**
 * Audit function to check if a route has subscription protection
 * This is a helper for manual review
 */
export function auditRoute(method, path, middleware) {
  const routeKey = `${method} ${path}`;
  const hasSubscriptionCheck = 
    middleware.includes('requireActiveSubscription') ||
    middleware.includes('requirePropertyManagerSubscription');
  
  const shouldHaveCheck = 
    ROUTES_REQUIRING_ACTIVE_SUBSCRIPTION.includes(routeKey) ||
    ROUTES_REQUIRING_PROPERTY_MANAGER_SUBSCRIPTION.includes(routeKey);
  
  return {
    route: routeKey,
    hasCheck: hasSubscriptionCheck,
    shouldHaveCheck,
    compliant: hasSubscriptionCheck === shouldHaveCheck,
  };
}

export default {
  ROUTES_REQUIRING_ACTIVE_SUBSCRIPTION,
  ROUTES_REQUIRING_PROPERTY_MANAGER_SUBSCRIPTION,
  ROUTES_EXEMPT_FROM_SUBSCRIPTION,
  auditRoute,
};

