import { Box, Typography, Grid, Paper, Stack, LinearProgress } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from '@mui/icons-material';

/**
 * Metrics Summary Component
 * Displays key metrics with trends and visual indicators
 * 
 * @param {Object} props
 * @param {Array} props.metrics - Array of metric objects
 * @param {number} props.columns - Number of columns in grid (default: 4)
 */
export default function MetricsSummary({ metrics = [], columns = 4 }) {
  return (
    <Grid container spacing={2}>
      {metrics.map((metric, index) => (
        <Grid item xs={12} sm={6} md={12 / columns} key={index}>
          <MetricCard {...metric} />
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * Individual Metric Card
 * 
 * @param {Object} props
 * @param {string} props.label - Metric label
 * @param {number|string} props.value - Metric value
 * @param {string} props.unit - Optional unit (e.g., '%', '$')
 * @param {number} props.trend - Trend percentage (positive or negative)
 * @param {string} props.trendLabel - Trend description
 * @param {string} props.color - Color theme
 * @param {React.ReactNode} props.icon - Optional icon
 * @param {number} props.progress - Optional progress bar value (0-100)
 * @param {string} props.subtitle - Optional subtitle
 * @param {Function} props.onClick - Optional click handler
 */
function MetricCard({
  label,
  value,
  unit = '',
  trend,
  trendLabel,
  color = 'primary',
  icon,
  progress,
  subtitle,
  onClick,
}) {
  const getTrendIcon = () => {
    if (trend === undefined || trend === null) return null;
    if (trend > 0) return <TrendingUpIcon fontSize="small" />;
    if (trend < 0) return <TrendingDownIcon fontSize="small" />;
    return <TrendingFlatIcon fontSize="small" />;
  };

  const getTrendColor = () => {
    if (trend === undefined || trend === null) return 'text.secondary';
    if (trend > 0) return 'success.main';
    if (trend < 0) return 'error.main';
    return 'text.secondary';
  };

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2.5,
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease-in-out',
        '&:hover': onClick
          ? {
              boxShadow: 3,
              transform: 'translateY(-4px)',
              borderColor: `${color}.main`,
            }
          : {},
      }}
      onClick={onClick}
    >
      <Stack spacing={1.5}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontWeight: 600,
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {label}
          </Typography>
          {icon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: `${color}.50`,
                color: `${color}.main`,
              }}
            >
              {icon}
            </Box>
          )}
        </Box>

        {/* Value */}
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.75rem', sm: '2rem' },
              color: `${color}.main`,
              lineHeight: 1.2,
            }}
          >
            {unit && unit !== '%' && <span style={{ fontSize: '0.7em' }}>{unit}</span>}
            {value}
            {unit === '%' && <span style={{ fontSize: '0.6em' }}>{unit}</span>}
          </Typography>
          {subtitle && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mt: 0.5,
                fontSize: { xs: '0.7rem', sm: '0.75rem' },
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>

        {/* Trend */}
        {trend !== undefined && trend !== null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', color: getTrendColor() }}>
              {getTrendIcon()}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  ml: 0.5,
                }}
              >
                {Math.abs(trend)}%
              </Typography>
            </Box>
            {trendLabel && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
              >
                {trendLabel}
              </Typography>
            )}
          </Box>
        )}

        {/* Progress Bar */}
        {progress !== undefined && progress !== null && (
          <Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: `${color}.50`,
                '& .MuiLinearProgress-bar': {
                  bgcolor: `${color}.main`,
                  borderRadius: 3,
                },
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mt: 0.5,
                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                textAlign: 'right',
              }}
            >
              {progress}% complete
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
