import React from 'react';
import { Card, CardContent, Box, Typography, Icon } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
  trend,
  alert,
  onClick,
}) {
  // Define gradient backgrounds based on color
  const gradients = {
    primary: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
    secondary: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
    success: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
    error: 'linear-gradient(135deg, #fca5a5 0%, #dc2626 100%)',
    warning: 'linear-gradient(135deg, #fdba74 0%, #ea580c 100%)',
    info: 'linear-gradient(135deg, #fecaca 0%, #ef4444 100%)',
  };

  return (
    <Card
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'visible',
        bgcolor: 'background.paper',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: gradients[color] || gradients.primary,
          borderRadius: '16px 16px 0 0',
        },
      }}
      onClick={onClick}
    >
      <CardContent sx={{ pt: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2.5}>
          <Box flex={1}>
            <Typography
              variant="body2"
              color="text.secondary"
              gutterBottom
              fontWeight={500}
              sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}
            >
              {title}
            </Typography>
            <Typography
              variant="h3"
              component="div"
              sx={(theme) => ({
                fontWeight: 700,
                color: theme.palette[color]?.main || theme.palette.primary.main,
                letterSpacing: '-0.02em',
              })}
            >
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              background: gradients[color] || gradients.primary,
              borderRadius: 3,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 14px 0 ${color === 'primary' ? 'rgb(185 28 28 / 0.25)' : color === 'secondary' ? 'rgb(249 115 22 / 0.25)' : 'rgb(0 0 0 / 0.1)'}`,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'rotate(10deg) scale(1.1)',
                boxShadow: `0 8px 20px 0 ${color === 'primary' ? 'rgb(185 28 28 / 0.35)' : color === 'secondary' ? 'rgb(249 115 22 / 0.35)' : 'rgb(0 0 0 / 0.15)'}`,
              },
            }}
          >
            <Icon sx={{ color: '#ffffff', fontSize: 28 }}>{icon}</Icon>
          </Box>
        </Box>

        {subtitle && (
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: trend === 'up' ? 'rgba(16, 185, 129, 0.08)' : trend === 'down' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              fontWeight={500}
              fontSize="0.875rem"
            >
              {subtitle}
            </Typography>
            {trend === 'up' && (
              <TrendingUpIcon
                fontSize="small"
                sx={{
                  color: 'success.main',
                  animation: 'bounce-subtle 1s ease-in-out infinite',
                }}
              />
            )}
            {trend === 'down' && (
              <TrendingDownIcon
                fontSize="small"
                sx={{
                  color: 'error.main',
                  animation: 'bounce-subtle 1s ease-in-out infinite',
                }}
              />
            )}
          </Box>
        )}

        {alert && (
          <Box
            mt={1.5}
            p={1}
            px={1.5}
            sx={{
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 2,
              borderLeft: '3px solid',
              borderColor: 'error.main',
            }}
          >
            <Typography variant="caption" color="error.main" fontWeight={600}>
              {alert}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
