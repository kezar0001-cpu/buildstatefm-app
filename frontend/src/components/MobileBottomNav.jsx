import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, BottomNavigation, BottomNavigationAction, Paper, useMediaQuery, useTheme } from '@mui/material';
import { useCurrentUser } from '../context/UserContext';
import { getDefaultRouteForRole, getNavigationForRole } from '../utils/navigationConfig';

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

  const role = user?.role;

  // Use the same navigation items as the main navbar, but make them accessible on mobile.
  // Normalize the generic /dashboard route to the role-specific default route.
  const rawNavItems = getNavigationForRole(role).map((item) => {
    if (item.href === '/dashboard') {
      return { ...item, href: getDefaultRouteForRole(role) };
    }
    return item;
  });

  // De-duplicate by href (prevents duplicate dashboard entries for some roles)
  const navItems = rawNavItems.filter((item, index, arr) => arr.findIndex((x) => x.href === item.href) === index);

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
      <Box
        sx={{
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': { height: 6 },
        }}
      >
        <BottomNavigation
          value={getActiveIndex()}
          onChange={handleChange}
          showLabels
          sx={{
            backgroundColor: 'background.paper',
            width: 'max-content',
            minWidth: '100%',
            '& .MuiBottomNavigationAction-root': {
              color: 'text.secondary',
              flex: '0 0 auto',
              minWidth: 76,
              px: 1,
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
          {navItems.map((item) => {
            const Icon = item.icon;
            return <BottomNavigationAction key={item.href} label={item.name} icon={<Icon />} />;
          })}
        </BottomNavigation>
      </Box>
    </Paper>
  );
}

