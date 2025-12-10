import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper, useMediaQuery, useTheme } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  RequestQuote as RequestQuoteIcon,
  Assessment as AssessmentIcon,
  Recommend as RecommendIcon,
} from '@mui/icons-material';
import { useCurrentUser } from '../context/UserContext';
import { getMobileNavForRole } from '../utils/navigationConfig';

/**
 * Mobile bottom navigation bar.
 * Provides quick access to main navigation items on mobile devices.
 * Only visible on screens smaller than md breakpoint.
 */
export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (!isMobile) {
    return null;
  }

  // Get role-aware mobile navigation items
  const navItems = getMobileNavForRole(user?.role);

  // Find current active item index
  const getActiveIndex = () => {
    const index = navItems.findIndex(
      (item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
    );
    return index >= 0 ? index : 0;
  };

  const handleChange = (event, newValue) => {
    const item = navItems[newValue];
    if (item) {
      navigate(item.href);
    }
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        display: { xs: 'block', md: 'none' },
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
      elevation={3}
    >
      <BottomNavigation
        value={getActiveIndex()}
        onChange={handleChange}
        showLabels
        sx={{
          backgroundColor: 'background.paper',
          '& .MuiBottomNavigationAction-root': {
            color: 'text.secondary',
            minWidth: 'auto',
            px: 0.5,
            '&.Mui-selected': {
              color: 'primary.main',
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.65rem',
              '&.Mui-selected': {
                fontSize: '0.7rem',
              },
            },
          },
        }}
      >
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <BottomNavigationAction
              key={index}
              label={item.name}
              icon={<Icon />}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}

