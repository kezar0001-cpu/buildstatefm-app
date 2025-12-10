import { Link as RouterLink } from 'react-router-dom';
import { Link, Chip, Box, Typography, Stack, Tooltip } from '@mui/material';
import {
  Home as HomeIcon,
  Apartment as ApartmentIcon,
  Person as PersonIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  RequestPage as RequestIcon,
  Lightbulb as RecommendationIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

/**
 * Entity Link Component
 * Creates clickable links to related entities with consistent styling
 * 
 * @param {Object} props
 * @param {string} props.type - Entity type: 'property', 'unit', 'tenant', 'job', 'inspection', 'service-request', 'recommendation'
 * @param {string} props.id - Entity ID
 * @param {string} props.label - Display label
 * @param {string} props.variant - Display variant: 'link', 'chip', 'card'
 * @param {boolean} props.showIcon - Whether to show entity icon
 * @param {Object} props.metadata - Additional metadata to display
 * @param {Function} props.onClick - Optional click handler (overrides navigation)
 */
export default function EntityLink({
  type,
  id,
  label,
  variant = 'link',
  showIcon = true,
  metadata = {},
  onClick,
}) {
  const config = {
    property: {
      icon: HomeIcon,
      color: 'primary',
      path: `/properties/${id}`,
    },
    unit: {
      icon: ApartmentIcon,
      color: 'info',
      path: `/units/${id}`,
    },
    tenant: {
      icon: PersonIcon,
      color: 'secondary',
      path: `/tenants/${id}`,
    },
    job: {
      icon: BuildIcon,
      color: 'warning',
      path: `/jobs/${id}`,
    },
    inspection: {
      icon: AssignmentIcon,
      color: 'success',
      path: `/inspections/${id}`,
    },
    'service-request': {
      icon: RequestIcon,
      color: 'error',
      path: `/service-requests/${id}`,
    },
    recommendation: {
      icon: RecommendationIcon,
      color: 'info',
      path: `/recommendations/${id}`,
    },
  };

  const { icon: Icon, color, path } = config[type] || config.property;

  const handleClick = (e) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  // Link variant
  if (variant === 'link') {
    return (
      <Link
        component={RouterLink}
        to={path}
        onClick={handleClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          textDecoration: 'none',
          color: `${color}.main`,
          fontWeight: 600,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            textDecoration: 'underline',
            color: `${color}.dark`,
          },
        }}
      >
        {showIcon && <Icon fontSize="small" />}
        {label}
      </Link>
    );
  }

  // Chip variant
  if (variant === 'chip') {
    return (
      <Chip
        component={RouterLink}
        to={path}
        onClick={handleClick}
        icon={showIcon ? <Icon /> : undefined}
        label={label}
        color={color}
        size="small"
        clickable
        sx={{
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 2,
          },
        }}
      />
    );
  }

  // Card variant
  if (variant === 'card') {
    return (
      <Box
        component={RouterLink}
        to={path}
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          textDecoration: 'none',
          color: 'text.primary',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: `${color}.main`,
            bgcolor: `${color}.50`,
            transform: 'translateX(4px)',
            boxShadow: 2,
          },
        }}
      >
        {showIcon && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: `${color}.100`,
              color: `${color}.main`,
            }}
          >
            <Icon />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body1" fontWeight={600} noWrap>
            {label}
          </Typography>
          {metadata.subtitle && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {metadata.subtitle}
            </Typography>
          )}
        </Box>
        <ArrowForwardIcon color="action" />
      </Box>
    );
  }

  return null;
}

/**
 * Entity Breadcrumb Component
 * Shows navigation path through related entities
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of breadcrumb items
 */
export function EntityBreadcrumb({ items = [] }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      flexWrap="wrap"
      sx={{ mb: 2 }}
    >
      {items.map((item, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EntityLink
            type={item.type}
            id={item.id}
            label={item.label}
            variant="link"
            showIcon={true}
          />
          {index < items.length - 1 && (
            <ArrowForwardIcon fontSize="small" color="action" />
          )}
        </Box>
      ))}
    </Stack>
  );
}

/**
 * Related Entities Component
 * Shows a list of related entities with quick navigation
 * 
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {Array} props.entities - Array of entity objects
 * @param {string} props.emptyMessage - Message when no entities
 */
export function RelatedEntities({ title, entities = [], emptyMessage = 'No related items' }) {
  if (entities.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
          {title}
        </Typography>
      )}
      <Stack spacing={1.5}>
        {entities.map((entity, index) => (
          <EntityLink
            key={index}
            type={entity.type}
            id={entity.id}
            label={entity.label}
            variant="card"
            metadata={entity.metadata}
          />
        ))}
      </Stack>
    </Box>
  );
}

/**
 * Quick Links Component
 * Shows a horizontal list of quick navigation chips
 * 
 * @param {Object} props
 * @param {Array} props.links - Array of link objects
 */
export function QuickLinks({ links = [] }) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
      {links.map((link, index) => (
        <EntityLink
          key={index}
          type={link.type}
          id={link.id}
          label={link.label}
          variant="chip"
          showIcon={true}
        />
      ))}
    </Stack>
  );
}
