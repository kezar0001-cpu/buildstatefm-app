import { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { REFRESH_INTERVALS, getRefreshIntervalLabel } from '../hooks/useDashboardPreferences';

/**
 * Dashboard Controls Component
 * Provides refresh and auto-refresh controls for the dashboard
 * 
 * @param {Object} props
 * @param {Function} props.onRefresh - Manual refresh handler
 * @param {boolean} props.autoRefresh - Auto-refresh enabled state
 * @param {Function} props.onToggleAutoRefresh - Toggle auto-refresh
 * @param {number} props.refreshInterval - Current refresh interval in ms
 * @param {Function} props.onSetRefreshInterval - Set refresh interval handler
 */
export default function DashboardControls({
  onRefresh,
  autoRefresh,
  onToggleAutoRefresh,
  refreshInterval,
  onSetRefreshInterval,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleOpenMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleSetInterval = (interval) => {
    onSetRefreshInterval(interval);
    handleCloseMenu();
  };

  const intervalOptions = [
    { value: REFRESH_INTERVALS.ONE_MINUTE, label: '1 minute' },
    { value: REFRESH_INTERVALS.TWO_MINUTES, label: '2 minutes' },
    { value: REFRESH_INTERVALS.FIVE_MINUTES, label: '5 minutes' },
    { value: REFRESH_INTERVALS.TEN_MINUTES, label: '10 minutes' },
    { value: REFRESH_INTERVALS.THIRTY_MINUTES, label: '30 minutes' },
  ];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {/* Manual Refresh Button */}
      <Tooltip title="Refresh dashboard">
        <IconButton
          onClick={onRefresh}
          color="primary"
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'rgba(185, 28, 28, 0.08)',
              transform: 'rotate(180deg)',
            },
          }}
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>

      {/* Settings Menu */}
      <Tooltip title="Dashboard settings">
        <IconButton
          onClick={handleOpenMenu}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'rgba(185, 28, 28, 0.08)',
            },
          }}
        >
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            minWidth: 250,
            borderRadius: 2,
            mt: 1,
          },
        }}
      >
        {/* Auto-refresh Toggle */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={onToggleAutoRefresh}
                size="small"
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Auto-refresh
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {autoRefresh
                    ? `Updates every ${getRefreshIntervalLabel(refreshInterval)}`
                    : 'Disabled'}
                </Typography>
              </Box>
            }
          />
        </Box>

        <Divider />

        {/* Refresh Interval Options */}
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Refresh Interval
          </Typography>
        </Box>

        {intervalOptions.map((option) => (
          <MenuItem
            key={option.value}
            onClick={() => handleSetInterval(option.value)}
            disabled={!autoRefresh}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <ListItemText primary={option.label} />
            {refreshInterval === option.value && (
              <ListItemIcon sx={{ minWidth: 'auto', ml: 2 }}>
                <CheckIcon fontSize="small" color="primary" />
              </ListItemIcon>
            )}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
