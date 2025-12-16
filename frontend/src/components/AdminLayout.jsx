import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Chip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Article as ArticleIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { getCurrentUser, removeAuthToken } from '../lib/auth';
import { ThemeProvider } from '../context/ThemeContext';
import ThemeWrapper from './ThemeWrapper';

const DRAWER_WIDTH = 260;

const adminMenuItems = [
  {
    title: 'Dashboard',
    path: '/admin/dashboard',
    icon: <DashboardIcon />,
  },
  {
    title: 'Analytics',
    path: '/admin/analytics',
    icon: <AnalyticsIcon />,
  },
  {
    title: 'Users',
    path: '/admin/users',
    icon: <PeopleIcon />,
  },
  {
    divider: true,
    label: 'Blog Management'
  },
  {
    title: 'Blog Posts',
    path: '/admin/blog',
    icon: <ArticleIcon />,
  },
  {
    divider: true,
    label: 'System'
  },
  {
    title: 'Settings',
    path: '/admin/settings',
    icon: <SettingsIcon />,
  },
];

function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  
  const user = getCurrentUser();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    removeAuthToken();
    localStorage.removeItem('user');
    navigate('/admin/blog/login');
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Admin Header */}
      <Box
        sx={{
          p: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AdminIcon sx={{ fontSize: 32 }} />
          <Typography variant="h6" fontWeight="bold">
            Admin Panel
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          Buildstate FM
        </Typography>
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List sx={{ flex: 1, py: 2 }}>
        {adminMenuItems.map((item, index) => {
          if (item.divider) {
            return (
              <Box key={index}>
                <Divider sx={{ my: 1 }} />
                <Typography
                  variant="caption"
                  sx={{
                    px: 2,
                    py: 1,
                    display: 'block',
                    color: 'text.secondary',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontSize: '0.7rem',
                    letterSpacing: 1
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            );
          }

          const isActive = location.pathname === item.path || 
                          location.pathname.startsWith(item.path + '/');

          return (
            <ListItem key={item.path} disablePadding sx={{ px: 1 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={isActive}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? 'white' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* User Info */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'primary.main',
              fontSize: '0.9rem',
            }}
          >
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Chip
              label="Admin"
              size="small"
              color="primary"
              sx={{ height: 18, fontSize: '0.65rem', mt: 0.5 }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <ThemeProvider>
      <ThemeWrapper>
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          {/* App Bar */}
          <AppBar
            position="fixed"
            sx={{
              width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
              ml: { md: `${DRAWER_WIDTH}px` },
              bgcolor: 'background.paper',
              color: 'text.primary',
              boxShadow: 1,
            }}
          >
            <Toolbar>
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2, display: { md: 'none' } }}
              >
                <MenuIcon />
              </IconButton>

              <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                {adminMenuItems.find(item => item.path === location.pathname)?.title || 'Admin Panel'}
              </Typography>

              <IconButton onClick={handleMenuOpen} color="inherit">
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'primary.main',
                    fontSize: '0.85rem',
                  }}
                >
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Avatar>
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">
                    {user?.email}
                  </Typography>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Logout</ListItemText>
                </MenuItem>
              </Menu>
            </Toolbar>
          </AppBar>

          {/* Drawer */}
          <Box
            component="nav"
            sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
          >
            {/* Mobile drawer */}
            <Drawer
              variant="temporary"
              open={mobileOpen}
              onClose={handleDrawerToggle}
              ModalProps={{ keepMounted: true }}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiDrawer-paper': {
                  boxSizing: 'border-box',
                  width: DRAWER_WIDTH,
                },
              }}
            >
              {drawer}
            </Drawer>

            {/* Desktop drawer */}
            <Drawer
              variant="permanent"
              sx={{
                display: { xs: 'none', md: 'block' },
                '& .MuiDrawer-paper': {
                  boxSizing: 'border-box',
                  width: DRAWER_WIDTH,
                },
              }}
              open
            >
              {drawer}
            </Drawer>
          </Box>

          {/* Main Content */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 3,
              width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
              mt: 8,
              backgroundColor: 'background.default',
              minHeight: '100vh',
            }}
          >
            {children}
          </Box>
        </Box>
      </ThemeWrapper>
    </ThemeProvider>
  );
}

export default AdminLayout;
