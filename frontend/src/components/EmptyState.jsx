import { cloneElement, isValidElement } from 'react';
import { Box, Button, Typography, Stack } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

/**
 * EmptyState Component
 *
 * A flexible, reusable component for displaying empty states across the application
 * Shows an icon, title, description, and optional action button
 *
 * @param {ReactNode} icon - Icon component or element to display (defaults to InboxIcon)
 * @param {string} title - Main heading text
 * @param {string} description - Supporting description text
 * @param {string} actionLabel - Label for the action button
 * @param {function} onAction - Callback function when action button is clicked
 * @param {string} helperText - Optional helper text displayed beneath the description
 * @param {object} sx - Additional styling overrides
 */
export default function EmptyState({
  icon = InboxIcon,
 title = 'No items yet',
  description = "There's nothing here yet. Start by adding your first item.",
  actionLabel,
  onAction,
  helperText,
  iconColor = 'primary.main', // Allow custom icon color, default to primary
  sx = {},
}) {
  const defaultIconSx = { fontSize: { xs: 48, md: 56 }, color: iconColor, opacity: 1 };

  const renderIcon = () => {
    if (!icon) {
      return null;
    }

    if (isValidElement(icon)) {
      return cloneElement(icon, {
        sx: {
          ...defaultIconSx,
          ...(icon.props?.sx || {}),
        },
      });
    }

    const IconComponent = icon;
    if (typeof IconComponent === 'function' || typeof IconComponent === 'object') {
      const ResolvedIcon = IconComponent;
      return <ResolvedIcon sx={defaultIconSx} />;
    }

    return null;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: { xs: 200, md: 300 },
        px: 2,
        py: 4,
        ...sx,
      }}
    >
      <Stack
        spacing={3}
        alignItems="center"
        sx={{
          maxWidth: 500,
          textAlign: 'center',
          animation: 'fade-in-up 0.5s ease-out',
        }}
      >
        {/* Icon Container */}
        <Box
          sx={{
            width: { xs: 80, md: 100 },
            height: { xs: 80, md: 100 },
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)',
            border: '1px solid',
            borderColor: 'rgba(59, 130, 246, 0.2)',
            boxShadow: '0 4px 14px 0 rgb(59 130 246 / 0.15)',
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
        >
          {renderIcon()}
        </Box>

        {/* Title */}
        <Typography
          variant="h5"
          fontWeight={600}
          color="text.primary"
          sx={{
            fontSize: { xs: '1.25rem', md: '1.5rem' },
          }}
        >
          {title}
        </Typography>

        {/* Description */}
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            maxWidth: 400,
            fontSize: { xs: '0.875rem', md: '1rem' },
            lineHeight: 1.6,
          }}
        >
          {description}
        </Typography>

        {helperText && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.85rem', md: '0.95rem' } }}
          >
            {helperText}
          </Typography>
        )}

        {/* Action Button */}
        {actionLabel && onAction && (
          <Button
            variant="contained"
            onClick={onAction}
            size="large"
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              boxShadow: '0 4px 14px 0 rgb(185 28 28 / 0.25)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px 0 rgb(185 28 28 / 0.35)',
                background: 'linear-gradient(135deg, #991b1b 0%, #ea580c 100%)',
              },
              '&:active': {
                transform: 'translateY(0)',
              },
            }}
          >
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
