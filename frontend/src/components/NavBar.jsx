import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LogoutButton from './LogoutButton';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Avatar,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import SearchIcon from '@mui/icons-material/Search';
import ArticleIcon from '@mui/icons-material/Article';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import { useCurrentUser } from '../context/UserContext';

import { useTheme } from '../context/ThemeContext';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut for search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const jobsNavigation = user?.role === 'TECHNICIAN'
    ? { name: 'My Jobs', href: '/technician/dashboard' }
    : { name: 'Jobs', href: '/jobs' };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Properties', href: '/properties' },
    { name: 'Inspections', href: '/inspections' },
    jobsNavigation,
    { name: 'Reports', href: '/reports' },
    { name: 'Plans', href: '/plans' },
    { name: 'Service Requests', href: '/service-requests' },
    { name: 'Recommendations', href: '/recommendations' },
  ];

  const handleNavigation = (path) => {
    navigate(path);
    handleCloseMobileMenu();
  };

  const handleOpenMobileMenu = (event) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleCloseMobileMenu = () => {
    setMobileMenuAnchor(null);
  };

  const handleOpenUserMenu = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setUserMenuAnchor(null);
  };

  const handleUserMenuNavigation = (path) => {
    navigate(path);
    handleCloseUserMenu();
  };

  // Helper to mark active links (works with nested paths)
  const isActive = (href) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`);
  
  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return '?';
    const firstInitial = user.firstName?.[0] || '';
    const lastInitial = user.lastName?.[0] || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        top: 'var(--trial-banner-height, 0px)',
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 64, sm: 72 },
          maxWidth: 1280,
          width: '100%',
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            variant="h6"
            onClick={() => navigate('/dashboard')}
            sx={{
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.02)',
              },
            }}
          >
            BuildState FM
          </Typography>

          <Box
            sx={{
              flexGrow: 1,
              display: { xs: 'none', lg: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            {navigation.map((item) => (
              <Button
                key={item.name}
                color="inherit"
                onClick={() => handleNavigation(item.href)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  fontWeight: isActive(item.href) ? 600 : 500,
                  color: isActive(item.href) ? 'primary.main' : 'text.primary',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  position: 'relative',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: 4,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: isActive(item.href) ? '60%' : '0%',
                    height: '2px',
                    bgcolor: 'primary.main',
                    borderRadius: 1,
                    transition: 'width 0.3s ease-in-out',
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                    '&::after': {
                      width: '60%',
                    },
                  },
                }}
              >
                {item.name}
              </Button>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 1 }}>
            <Tooltip title="Search (Ctrl+K)">
              <IconButton
                color="inherit"
                onClick={() => setSearchOpen(true)}
                size="medium"
              >
                <SearchIcon />
              </IconButton>
            </Tooltip>

            <NotificationBell />

            <Tooltip title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              <IconButton onClick={toggleTheme} color="inherit">
                {theme === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
              </IconButton>
            </Tooltip>
          </Box>

          <Tooltip title="Account">
            <IconButton
              onClick={handleOpenUserMenu}
              size="small"
              sx={{ ml: 1 }}
              aria-label="account menu"
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px 0 rgb(185 28 28 / 0.3)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'scale(1.1)',
                    boxShadow: '0 4px 12px 0 rgb(185 28 28 / 0.4)',
                  },
                }}
              >
                {getUserInitials()}
              </Avatar>
            </IconButton>
          </Tooltip>
          
          <Box sx={{ display: { xs: 'flex', lg: 'none' } }}>
            <IconButton
              size="large"
              aria-label="open navigation menu"
              aria-controls="mobile-menu"
              aria-haspopup="true"
              onClick={handleOpenMobileMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
          </Box>

          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={handleCloseUserMenu}
            onClick={handleCloseUserMenu}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{
              elevation: 3,
              sx: {
                minWidth: 200,
                mt: 1.5,
                '& .MuiMenuItem-root': {
                  px: 2,
                  py: 1,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
            
            <MenuItem onClick={() => handleUserMenuNavigation('/profile')}>
              <PersonIcon fontSize="small" sx={{ mr: 1.5 }} />
              Profile
            </MenuItem>
            
            <MenuItem onClick={() => handleUserMenuNavigation('/subscriptions')}>
              <SubscriptionsIcon fontSize="small" sx={{ mr: 1.5 }} />
              Subscriptions
            </MenuItem>

            {user?.role === 'PROPERTY_MANAGER' && (
              <MenuItem onClick={() => handleUserMenuNavigation('/team')}>
                <GroupIcon fontSize="small" sx={{ mr: 1.5 }} />
                Team Management
              </MenuItem>
            )}

            {user?.role === 'ADMIN' && (
              <MenuItem onClick={() => handleUserMenuNavigation('/admin/blog')}>
                <ArticleIcon fontSize="small" sx={{ mr: 1.5 }} />
                Blog Admin
              </MenuItem>
            )}

            <Divider sx={{ my: 1 }} />
            
            <Box sx={{ px: 2, pb: 1 }}>
              <LogoutButton
                fullWidth
                variant="outlined"
                color="error"
                size="small"
                sx={{ textTransform: 'none' }}
              />
            </Box>
          </Menu>
        </Box>

        <Menu
          id="mobile-menu"
          anchorEl={mobileMenuAnchor}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          open={Boolean(mobileMenuAnchor)}
          onClose={handleCloseMobileMenu}
          keepMounted
          sx={{
            '& .MuiPaper-root': {
              minWidth: 240,
              borderRadius: 2,
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
          
          {navigation.map((item) => (
            <MenuItem
              key={item.name}
              onClick={() => handleNavigation(item.href)}
              selected={isActive(item.href)}
              sx={{ fontWeight: isActive(item.href) ? 600 : 500 }}
            >
              {item.name}
            </MenuItem>
          ))}
          
          <Divider sx={{ my: 1 }} />
          
          <MenuItem onClick={() => handleNavigation('/profile')}>
            <PersonIcon fontSize="small" sx={{ mr: 1.5 }} />
            Profile
          </MenuItem>
          
          <MenuItem onClick={() => handleNavigation('/subscriptions')}>
            <SubscriptionsIcon fontSize="small" sx={{ mr: 1.5 }} />
            Subscriptions
          </MenuItem>

          {user?.role === 'PROPERTY_MANAGER' && (
            <MenuItem onClick={() => handleNavigation('/team')}>
              <GroupIcon fontSize="small" sx={{ mr: 1.5 }} />
              Team Management
            </MenuItem>
          )}
          
          <Divider sx={{ my: 1 }} />
          
          <Box sx={{ px: 2, pb: 1 }}>
            <LogoutButton
              fullWidth
              variant="outlined"
              color="error"
              size="medium"
              sx={{ textTransform: 'none' }}
            />
          </Box>
        </Menu>
      </Toolbar>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </AppBar>
  );
}

export default NavBar;
