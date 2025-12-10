import { Box, Typography, Paper, Stack, Chip, Button, IconButton } from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

/**
 * Priority Widget Component
 * Displays important information with visual priority indicators
 * 
 * @param {Object} props
 * @param {string} props.type - Widget type: 'error', 'warning', 'info', 'success'
 * @param {string} props.title - Widget title
 * @param {string} props.message - Widget message
 * @param {Array} props.items - Optional list of items to display
 * @param {Function} props.onAction - Optional action button callback
 * @param {string} props.actionLabel - Action button label
 * @param {Function} props.onDismiss - Optional dismiss callback
 * @param {number} props.count - Optional count badge
 */
export default function PriorityWidget({
  type = 'info',
  title,
  message,
  items = [],
  onAction,
  actionLabel = 'View All',
  onDismiss,
  count,
}) {
  const config = {
    error: {
      icon: ErrorIcon,
      color: 'error',
      bgcolor: 'error.50',
      borderColor: 'error.main',
      iconBg: 'error.main',
    },
    warning: {
      icon: WarningIcon,
      color: 'warning',
      bgcolor: 'warning.50',
      borderColor: 'warning.main',
      iconBg: 'warning.main',
    },
    info: {
      icon: InfoIcon,
      color: 'info',
      bgcolor: 'info.50',
      borderColor: 'info.main',
      iconBg: 'info.main',
    },
    success: {
      icon: CheckCircleIcon,
      color: 'success',
      bgcolor: 'success.50',
      borderColor: 'success.main',
      iconBg: 'success.main',
    },
  };

  const { icon: Icon, color, bgcolor, borderColor, iconBg } = config[type] || config.info;

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: '2px solid',
        borderColor,
        bgcolor,
        position: 'relative',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* Dismiss Button */}
      {onDismiss && (
        <IconButton
          size="small"
          onClick={onDismiss}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'rgba(0,0,0,0.05)',
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}

      <Stack spacing={2}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, pr: onDismiss ? 4 : 0 }}>
          {/* Icon */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: iconBg,
              color: 'white',
              flexShrink: 0,
            }}
          >
            <Icon />
          </Box>

          {/* Title and Count */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  color: `${color}.dark`,
                }}
              >
                {title}
              </Typography>
              {count !== undefined && count > 0 && (
                <Chip
                  label={count}
                  size="small"
                  color={color}
                  sx={{
                    height: 22,
                    minWidth: 22,
                    fontWeight: 700,
                  }}
                />
              )}
            </Box>
            {message && (
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  color: 'text.secondary',
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                }}
              >
                {message}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Items List */}
        {items.length > 0 && (
          <Stack spacing={1} sx={{ pl: 7 }}>
            {items.map((item, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  cursor: item.onClick ? 'pointer' : 'default',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': item.onClick
                    ? {
                        bgcolor: 'action.hover',
                        transform: 'translateX(4px)',
                      }
                    : {},
                }}
                onClick={item.onClick}
              >
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                  }}
                >
                  {item.label}
                </Typography>
                {item.badge && (
                  <Chip
                    label={item.badge}
                    size="small"
                    color={color}
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
                {item.onClick && <ArrowForwardIcon fontSize="small" color="action" />}
              </Box>
            ))}
          </Stack>
        )}

        {/* Action Button */}
        {onAction && (
          <Box sx={{ pl: 7 }}>
            <Button
              variant="contained"
              color={color}
              size="small"
              onClick={onAction}
              endIcon={<ArrowForwardIcon />}
              sx={{
                fontWeight: 600,
                textTransform: 'none',
              }}
            >
              {actionLabel}
            </Button>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
