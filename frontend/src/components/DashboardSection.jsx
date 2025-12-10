import { Box, Typography, Paper, Divider, IconButton, Collapse, Chip } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { useState } from 'react';

/**
 * Dashboard Section Component
 * Creates a collapsible section with consistent styling and hierarchy
 * 
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {string} props.subtitle - Optional subtitle/description
 * @param {React.ReactNode} props.children - Section content
 * @param {React.ReactNode} props.actions - Optional action buttons in header
 * @param {string} props.priority - Visual priority: 'critical', 'high', 'medium', 'low'
 * @param {boolean} props.collapsible - Whether section can be collapsed
 * @param {boolean} props.defaultExpanded - Default expanded state
 * @param {number} props.badge - Optional badge count
 * @param {string} props.badgeColor - Badge color
 * @param {React.ReactNode} props.icon - Optional icon
 */
export default function DashboardSection({
  title,
  subtitle,
  children,
  actions,
  priority = 'medium',
  collapsible = false,
  defaultExpanded = true,
  badge,
  badgeColor = 'primary',
  icon,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Priority-based styling
  const priorityStyles = {
    critical: {
      borderColor: 'error.main',
      borderWidth: 2,
      bgcolor: 'error.50',
      iconColor: 'error.main',
    },
    high: {
      borderColor: 'warning.main',
      borderWidth: 2,
      bgcolor: 'warning.50',
      iconColor: 'warning.main',
    },
    medium: {
      borderColor: 'divider',
      borderWidth: 1,
      bgcolor: 'background.paper',
      iconColor: 'primary.main',
    },
    low: {
      borderColor: 'divider',
      borderWidth: 1,
      bgcolor: 'background.paper',
      iconColor: 'text.secondary',
    },
  };

  const style = priorityStyles[priority] || priorityStyles.medium;

  return (
    <Paper
      elevation={priority === 'critical' || priority === 'high' ? 3 : 1}
      sx={{
        borderRadius: 2,
        border: `${style.borderWidth}px solid`,
        borderColor: style.borderColor,
        bgcolor: style.bgcolor,
        overflow: 'hidden',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          boxShadow: priority === 'critical' || priority === 'high' ? 6 : 3,
        },
      }}
    >
      {/* Section Header */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          bgcolor: priority === 'critical' || priority === 'high' ? 'rgba(0,0,0,0.02)' : 'transparent',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
          {/* Icon */}
          {icon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: style.iconColor,
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          )}

          {/* Title and Subtitle */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  color: priority === 'critical' ? 'error.main' : 'text.primary',
                }}
              >
                {title}
              </Typography>
              {badge !== undefined && badge > 0 && (
                <Chip
                  label={badge}
                  size="small"
                  color={badgeColor}
                  sx={{
                    height: 22,
                    minWidth: 22,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}
                />
              )}
            </Box>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.5,
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Actions and Collapse Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {actions}
          {collapsible && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                transition: 'transform 0.3s ease-in-out',
                transform: expanded ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Divider */}
      {expanded && <Divider />}

      {/* Section Content */}
      <Collapse in={expanded} timeout="auto">
        <Box
          sx={{
            p: { xs: 2, sm: 2.5 },
          }}
        >
          {children}
        </Box>
      </Collapse>
    </Paper>
  );
}
