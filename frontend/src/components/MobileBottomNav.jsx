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

  // Determine jobs navigation based on role
  const jobsNavigation = user?.role === 'TECHNICIAN'
    ? { label: 'My Jobs', path: '/technician/dashboard', icon: BuildIcon }
    : { label: 'Jobs', path: '/jobs', icon: BuildIcon };

  // Main navigation items for bottom nav - customize based on user role
  let navItems = [];

  if (user?.role === 'OWNER') {
    // Navigation for property owners
    navItems = [
      { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
      { label: 'Properties', path: '/properties', icon: HomeIcon },
      { label: 'Inspections', path: '/inspections', icon: AssignmentIcon },
      { label: 'Requests', path: '/service-requests', icon: RequestQuoteIcon },
      { label: 'Insights', path: '/recommendations', icon: RecommendIcon },
    ];
  } else if (user?.role === 'PROPERTY_MANAGER' || user?.role === 'ADMIN') {
    // Navigation for property managers
    navItems = [
      { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
      { label: 'Properties', path: '/properties', icon: HomeIcon },
      { label: 'Inspections', path: '/inspections', icon: AssignmentIcon },
      jobsNavigation,
      { label: 'Insights', path: '/recommendations', icon: RecommendIcon },
    ];
  } else {
    // Default navigation (includes all items)
    navItems = [
      { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
      { label: 'Properties', path: '/properties', icon: HomeIcon },
      { label: 'Inspections', path: '/inspections', icon: AssignmentIcon },
      jobsNavigation,
      { label: 'Insights', path: '/recommendations', icon: RecommendIcon },
    ];
  }

  // Find current active item index
  const getActiveIndex = () => {
    const index = navItems.findIndex(
      (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
    );
    return index >= 0 ? index : 0;
  };

  const handleChange = (event, newValue) => {
    const item = navItems[newValue];
    if (item) {
      navigate(item.path);
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
            '&.Mui-selected': {
              color: 'primary.main',
            },
          },
        }}
      >
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <BottomNavigationAction
              key={index}
              label={item.label}
              icon={<Icon />}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}

