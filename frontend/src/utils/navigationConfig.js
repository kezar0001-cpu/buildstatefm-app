/**
 * Role-based navigation configuration
 * Defines which navigation items are visible for each user role
 */

import {
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  Subscriptions as PlansIcon,
  RequestPage as ServiceRequestIcon,
  Lightbulb as RecommendationIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

/**
 * Navigation item structure:
 * - name: Display name
 * - href: Route path
 * - icon: MUI icon component
 * - roles: Array of roles that can see this item (empty = all roles)
 * - excludeRoles: Array of roles that cannot see this item
 * - badge: Optional badge configuration
 */

export const NAVIGATION_ITEMS = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: DashboardIcon,
    roles: [], // All roles can see dashboard
    excludeRoles: ['TENANT'],
  },
  {
    name: 'Properties',
    href: '/properties',
    icon: HomeIcon,
    roles: ['PROPERTY_MANAGER', 'OWNER', 'ADMIN'],
  },
  {
    name: 'My Properties',
    href: '/owner/dashboard',
    icon: HomeIcon,
    roles: ['OWNER'],
  },
  {
    name: 'My Home',
    href: '/tenant/home',
    icon: HomeIcon,
    roles: ['TENANT'],
  },
  {
    name: 'Inspections',
    href: '/inspections',
    icon: AssignmentIcon,
    roles: ['PROPERTY_MANAGER', 'OWNER', 'ADMIN'],
  },
  {
    name: 'Jobs',
    href: '/jobs',
    icon: BuildIcon,
    roles: ['PROPERTY_MANAGER'],
  },
  {
    name: 'My Jobs',
    href: '/technician/dashboard',
    icon: BuildIcon,
    roles: ['TECHNICIAN'],
  },
  {
    name: 'Service Requests',
    href: '/service-requests',
    icon: ServiceRequestIcon,
    roles: ['PROPERTY_MANAGER', 'TENANT', 'OWNER', 'ADMIN'],
  },
  {
    name: 'Recommendations',
    href: '/recommendations',
    icon: RecommendationIcon,
    roles: ['PROPERTY_MANAGER', 'ADMIN'],
  },
  {
    name: 'Plans',
    href: '/plans',
    icon: PlansIcon,
    roles: ['PROPERTY_MANAGER', 'ADMIN'],
  },
  {
    name: 'Users',
    href: '/users',
    icon: PeopleIcon,
    roles: ['ADMIN'],
  },
];

/**
 * User menu items (profile dropdown)
 */
export const USER_MENU_ITEMS = [
  {
    name: 'Profile',
    href: '/profile',
    icon: PersonIcon,
    roles: [], // All roles
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: SettingsIcon,
    roles: [], // All roles
  },
  {
    name: 'Admin Panel',
    href: '/admin',
    icon: SettingsIcon,
    roles: ['ADMIN'],
  },
];

/**
 * Mobile bottom navigation items (for mobile devices)
 * Limited to 4-5 most important items
 */
export const MOBILE_NAV_ITEMS = {
  PROPERTY_MANAGER: [
    { name: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
    { name: 'Properties', href: '/properties', icon: HomeIcon },
    { name: 'Jobs', href: '/jobs', icon: BuildIcon },
    { name: 'Requests', href: '/service-requests', icon: ServiceRequestIcon },
  ],
  OWNER: [
    { name: 'Dashboard', href: '/owner/dashboard', icon: DashboardIcon },
    { name: 'Properties', href: '/properties', icon: HomeIcon },
    { name: 'Inspections', href: '/inspections', icon: AssignmentIcon },
    { name: 'Requests', href: '/service-requests', icon: ServiceRequestIcon },
  ],
  TENANT: [
    { name: 'My Home', href: '/tenant/home', icon: HomeIcon },
    { name: 'Requests', href: '/service-requests', icon: ServiceRequestIcon },
    { name: 'Profile', href: '/profile', icon: PersonIcon },
  ],
  TECHNICIAN: [
    { name: 'My Jobs', href: '/technician/dashboard', icon: DashboardIcon },
    { name: 'Profile', href: '/profile', icon: PersonIcon },
  ],
  ADMIN: [
    { name: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
    { name: 'Properties', href: '/properties', icon: HomeIcon },
    { name: 'Users', href: '/users', icon: PeopleIcon },
    { name: 'Admin', href: '/admin', icon: SettingsIcon },
  ],
};

/**
 * Get navigation items for a specific role
 * @param {string} role - User role
 * @returns {Array} Filtered navigation items
 */
export function getNavigationForRole(role) {
  if (!role) return [];

  return NAVIGATION_ITEMS.filter((item) => {
    // If roles array is empty, item is visible to all
    if (!item.roles || item.roles.length === 0) {
      // Check if role is excluded
      if (item.excludeRoles && item.excludeRoles.includes(role)) {
        return false;
      }
      return true;
    }

    // Check if role is in the allowed roles
    return item.roles.includes(role);
  });
}

/**
 * Get user menu items for a specific role
 * @param {string} role - User role
 * @returns {Array} Filtered user menu items
 */
export function getUserMenuForRole(role) {
  if (!role) return [];

  return USER_MENU_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.includes(role);
  });
}

/**
 * Get mobile navigation items for a specific role
 * @param {string} role - User role
 * @returns {Array} Mobile navigation items
 */
export function getMobileNavForRole(role) {
  if (!role) return [];
  return MOBILE_NAV_ITEMS[role] || MOBILE_NAV_ITEMS.PROPERTY_MANAGER;
}

/**
 * Check if a user has access to a specific route
 * @param {string} role - User role
 * @param {string} path - Route path
 * @returns {boolean} Whether user has access
 */
export function hasAccessToRoute(role, path) {
  if (!role || !path) return false;

  const navigation = getNavigationForRole(role);
  return navigation.some((item) => path.startsWith(item.href));
}

/**
 * Get the default route for a user role
 * @param {string} role - User role
 * @returns {string} Default route path
 */
export function getDefaultRouteForRole(role) {
  const routes = {
    PROPERTY_MANAGER: '/dashboard',
    OWNER: '/owner/dashboard',
    TENANT: '/tenant/home',
    TECHNICIAN: '/technician/dashboard',
    ADMIN: '/dashboard',
  };

  return routes[role] || '/dashboard';
}

/**
 * Role display names
 */
export const ROLE_LABELS = {
  PROPERTY_MANAGER: 'Property Manager',
  OWNER: 'Owner',
  TENANT: 'Tenant',
  TECHNICIAN: 'Technician',
  ADMIN: 'Administrator',
};

/**
 * Get role display name
 * @param {string} role - User role
 * @returns {string} Display name
 */
export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}
