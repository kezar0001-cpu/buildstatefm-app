import React from 'react';
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography, Box } from '@mui/material';
import { NavigateNext as NavigateNextIcon, Home as HomeIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Enhanced breadcrumb navigation component.
 * Provides consistent navigation context across the application.
 * 
 * @param {array} items - Array of breadcrumb items [{ label, path, icon? }]
 * @param {boolean} showHome - Whether to show home icon as first item
 * @param {function} onNavigate - Optional custom navigation handler
 */
export default function Breadcrumbs({ 
  items = [], 
  showHome = true,
  onNavigate,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleClick = (event, path) => {
    event.preventDefault();
    
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  };
  
  const breadcrumbItems = showHome 
    ? [
        {
          label: 'Home',
          path: '/',
          icon: <HomeIcon fontSize="small" />,
        },
        ...items,
      ]
    : items;
  
  if (breadcrumbItems.length === 0) {
    return null;
  }
  
  return (
    <MuiBreadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      aria-label="breadcrumb"
      sx={{ mb: 2 }}
    >
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        
        if (isLast) {
          return (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {item.icon}
              <Typography color="text.primary" fontWeight={500}>
                {item.label}
              </Typography>
            </Box>
          );
        }
        
        return (
          <Link
            key={index}
            component="button"
            variant="body1"
            onClick={(e) => handleClick(e, item.path)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
}

/**
 * Helper function to generate breadcrumbs from route path
 * @param {string} pathname - Current route pathname
 * @returns {array} Breadcrumb items
 */
export function generateBreadcrumbsFromPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const items = [];
  
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    
    // Convert segment to readable label
    const label = segment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    items.push({
      label,
      path: currentPath,
      isLast,
    });
  });
  
  return items;
}
