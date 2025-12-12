import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
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
  const [moreOpen, setMoreOpen] = useState(false);

  if (!isMobile) {
    return null;
  }

  const role = user?.role;

  const navItems = useMemo(() => {
    // Use the same navigation items as the main navbar, but make them accessible on mobile.
    // Normalize the generic /dashboard route to the role-specific default route.
    const rawNavItems = getNavigationForRole(role).map((item) => {
      if (item.href === '/dashboard') {
        return { ...item, href: getDefaultRouteForRole(role) };
      }
      return item;
    });

    // De-duplicate by href (prevents duplicate dashboard entries for some roles)
    return rawNavItems.filter((item, index, arr) => arr.findIndex((x) => x.href === item.href) === index);
  }, [role]);

  const primaryItems = useMemo(() => navItems.slice(0, 4), [navItems]);
  const overflowItems = useMemo(() => navItems.slice(4), [navItems]);

  // Find current active item index
  const getActiveIndex = () => {
    const index = primaryItems.findIndex(
      (item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
    );
    if (index >= 0) return index;
    return overflowItems.length > 0 ? primaryItems.length : 0;
  };

  const handleChange = (event, newValue) => {
    if (overflowItems.length > 0 && newValue === primaryItems.length) {
      setMoreOpen(true);
      return;
    }

    const item = primaryItems[newValue];
    if (item) navigate(item.href);
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
            minWidth: 0,
            flex: 1,
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
        {primaryItems.map((item) => {
          const Icon = item.icon;
          return <BottomNavigationAction key={item.href} label={item.name} icon={<Icon />} />;
        })}

        {overflowItems.length > 0 && <BottomNavigationAction label="More" icon={<MoreHorizIcon />} />}
      </BottomNavigation>
    </Paper>

    <Drawer anchor="bottom" open={moreOpen} onClose={() => setMoreOpen(false)}>
      <Paper sx={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        <Typography variant="subtitle1" sx={{ px: 2, py: 1.5, fontWeight: 600 }}>
          Menu
        </Typography>
        <Divider />
        <List dense disablePadding>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <ListItemButton
                key={item.href}
                selected={location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)}
                onClick={() => {
                  setMoreOpen(false);
                  navigate(item.href);
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={item.name} />
              </ListItemButton>
            );
          })}
        </List>
      </Paper>
    </Drawer>
  );
}

