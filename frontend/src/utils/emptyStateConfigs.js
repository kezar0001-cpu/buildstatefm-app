/**
 * Predefined empty state configurations for consistent messaging across the app.
 * Import these configs and spread them into EmptyState components.
 */

import {
  Home as HomeIcon,
  Apartment as ApartmentIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Notifications as NotificationsIcon,
  Assessment as AssessmentIcon,
  RequestQuote as RequestQuoteIcon,
  Schedule as ScheduleIcon,
  Comment as CommentIcon,
} from '@mui/icons-material';

export const emptyStateConfigs = {
  // Properties
  properties: {
    icon: HomeIcon,
    title: 'No properties yet',
    description: 'Get started by adding your first property. You can manage units, track maintenance, and monitor inspections all in one place.',
    actionLabel: 'Add Property',
  },
  propertiesSearch: {
    icon: SearchIcon,
    title: 'No properties found',
    description: 'Try adjusting your search terms or filters to find what you\'re looking for.',
  },

  // Units
  units: {
    icon: ApartmentIcon,
    title: 'No units yet',
    description: 'Add units to this property to start managing tenants, tracking maintenance, and scheduling inspections.',
    actionLabel: 'Add Unit',
  },
  unitsSearch: {
    icon: SearchIcon,
    title: 'No units found',
    description: 'Try adjusting your search or filters to find the units you\'re looking for.',
  },

  // Jobs
  jobs: {
    icon: BuildIcon,
    title: 'No jobs yet',
    description: 'Create maintenance jobs to track work orders, assign technicians, and monitor progress.',
    actionLabel: 'Create Job',
  },
  jobsSearch: {
    icon: SearchIcon,
    title: 'No jobs found',
    description: 'Try adjusting your filters or search terms. You can also create a new job if needed.',
  },

  // Service Requests
  serviceRequests: {
    icon: RequestQuoteIcon,
    title: 'No service requests',
    description: 'Service requests from tenants and owners will appear here. You can also create requests on their behalf.',
    actionLabel: 'Create Request',
  },
  serviceRequestsSearch: {
    icon: SearchIcon,
    title: 'No service requests found',
    description: 'No service requests match your current filters. Try adjusting your search criteria.',
  },

  // Inspections
  inspections: {
    icon: AssignmentIcon,
    title: 'No inspections scheduled',
    description: 'Schedule inspections to maintain property standards and document conditions.',
    actionLabel: 'Schedule Inspection',
  },
  inspectionsSearch: {
    icon: SearchIcon,
    title: 'No inspections found',
    description: 'No inspections match your current search. Try different filters or schedule a new inspection.',
  },

  // Tenants
  tenants: {
    icon: PersonIcon,
    title: 'No tenants',
    description: 'Tenants assigned to this property or unit will appear here.',
    actionLabel: 'Add Tenant',
  },
  tenantsSearch: {
    icon: SearchIcon,
    title: 'No tenants found',
    description: 'No tenants match your search criteria. Try adjusting your filters.',
  },

  // Documents
  documents: {
    icon: DescriptionIcon,
    title: 'No documents',
    description: 'Upload important documents like leases, contracts, and property records.',
    actionLabel: 'Upload Document',
  },

  // Notifications
  notifications: {
    icon: NotificationsIcon,
    title: 'No notifications',
    description: 'You\'re all caught up! New notifications will appear here.',
  },

  // Reports
  reports: {
    icon: AssessmentIcon,
    title: 'No reports available',
    description: 'Generate reports to analyze property performance, maintenance trends, and more.',
    actionLabel: 'Generate Report',
  },

  // Calendar/Schedule
  schedule: {
    icon: ScheduleIcon,
    title: 'Nothing scheduled',
    description: 'Your calendar is clear. Schedule inspections, maintenance, or other activities.',
    actionLabel: 'Schedule Activity',
  },

  // Comments
  comments: {
    icon: CommentIcon,
    title: 'No comments yet',
    description: 'Be the first to add a comment or update.',
    actionLabel: 'Add Comment',
  },

  // Generic search
  searchNoResults: {
    icon: SearchIcon,
    title: 'No results found',
    description: 'Try different search terms or adjust your filters to find what you\'re looking for.',
  },

  // Generic empty
  generic: {
    icon: null,
    title: 'Nothing here yet',
    description: 'Content will appear here once it\'s available.',
  },
};

/**
 * Helper to get empty state config by key
 * @param {string} key - The config key (e.g., 'properties', 'jobsSearch')
 * @returns {object} The empty state configuration
 */
export function getEmptyStateConfig(key) {
  return emptyStateConfigs[key] || emptyStateConfigs.generic;
}

export default emptyStateConfigs;

