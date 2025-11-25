// frontend/src/utils/queryKeys.js
export const queryKeys = {
  properties: {
    all: () => ['properties'],
    detail: (id) => ['properties', id],
    list: (filters) => ['properties', 'list', filters],
    selectOptions: () => ['properties', 'selectOptions'],
    units: (propertyId) => ['properties', propertyId, 'units'],
    activity: (propertyId) => ['properties', propertyId, 'activity'],
  },
  jobs: {
    all: () => ['jobs'],
    detail: (id) => ['jobs', id],
    comments: (id) => ['jobs', id, 'comments'],
    list: (filters) => ['jobs', 'list', filters],
    filtered: (filters) => ['jobs', 'filtered', filters],
    technician: () => ['jobs', 'technician'],
    owner: () => ['jobs', 'owner'],
  },
  units: {
    all: () => ['units'],
    detail: (id) => ['units', id],
    list: (propertyId) => ['units', 'list', propertyId],
    listByProperty: (propertyId) => ['units', 'listByProperty', propertyId],
    tenants: (unitId) => ['units', unitId, 'tenants'],
    jobs: (unitId) => ['units', unitId, 'jobs'],
    inspections: (unitId) => ['units', unitId, 'inspections'],
  },
  tenants: {
    all: () => ['tenants'],
    detail: (id) => ['tenants', id],
    list: (unitId) => ['tenants', 'list', unitId],
  },
  serviceRequests: {
    all: () => ['serviceRequests'],
    detail: (id) => ['serviceRequests', id],
    list: (filters) => ['serviceRequests', 'list', filters],
    tenant: () => ['serviceRequests', 'tenant'],
  },
  inspections: {
    all: () => ['inspections'],
    detail: (id) => ['inspections', id],
    list: (filters) => ['inspections', 'list', filters],
    tags: () => ['inspections', 'tags'],
    audit: (inspectionId) => ['inspections', inspectionId, 'audit'],
    inspectors: () => ['inspections', 'inspectors'],
    owner: () => ['inspections', 'owner'],
    rooms: (inspectionId) => ['inspections', inspectionId, 'rooms'],
    issues: (inspectionId) => ['inspections', inspectionId, 'issues'],
    photos: (inspectionId) => ['inspections', inspectionId, 'photos'],
  },
  auth: {
    profile: (userId) => ['auth', 'profile', userId],
  },
  users: {
    all: () => ['users'],
    detail: (id) => ['users', id],
    list: (filters) => ['users', 'list', filters],
  },
  dashboard: {
    stats: () => ['dashboard', 'stats'],
    activity: () => ['dashboard', 'activity'],
    analytics: (params) => ['dashboard', 'analytics', params],
    technician: () => ['dashboard', 'technician'],
    owner: () => ['dashboard', 'owner'],
    ownerProperties: () => ['dashboard', 'ownerProperties'],
    tenant: () => ['dashboard', 'tenant'],
    tenantUnits: () => ['dashboard', 'tenantUnits'],
    alerts: () => ['dashboard', 'alerts'],
  },
  notifications: {
    all: () => ['notifications'],
    list: () => ['notifications', 'list'],
    count: () => ['notifications', 'count'],
    detail: (id) => ['notifications', id],
  },
  globalSearch: {
    results: (term) => ['globalSearch', 'results', term],
  },
  technicians: {
    all: () => ['technicians'],
  },
  reports: {
    all: () => ['reports'],
  },
  invites: {
    all: () => ['invites'],
  },
  teams: {
    invites: () => ['teams', 'invites'],
    users: () => ['teams', 'users'],
  },
  subscriptions: {
    all: () => ['subscriptions'],
  },
  plans: {
    all: () => ['plans'],
    detail: (planId) => ['plans', planId],
    list: (filters) => ['plans', 'list', filters],
  },
  recommendations: {
    all: () => ['recommendations'],
  },
};