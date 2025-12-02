import React from 'react';
import { Box, Skeleton, Stack } from '@mui/material';

/**
 * Reusable loading skeleton component for list views
 * Provides consistent loading states across the application
 */
export function LoadingSkeleton({ 
  variant = 'list', 
  count = 3,
  height = 60,
  showAvatar = false,
  showActions = false 
}) {
  if (variant === 'list') {
    return (
      <Stack spacing={2}>
        {Array.from({ length: count }).map((_, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {showAvatar && (
              <Skeleton variant="circular" width={40} height={40} />
            )}
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="40%" height={20} sx={{ mt: 0.5 }} />
            </Box>
            {showActions && (
              <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
            )}
          </Box>
        ))}
      </Stack>
    );
  }

  if (variant === 'card') {
    return (
      <Stack spacing={2} direction="row" flexWrap="wrap">
        {Array.from({ length: count }).map((_, index) => (
          <Box key={index} sx={{ width: { xs: '100%', sm: '48%', md: '31%' } }}>
            <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 2, mb: 1 }} />
            <Skeleton variant="text" width="80%" height={24} />
            <Skeleton variant="text" width="60%" height={20} sx={{ mt: 0.5 }} />
          </Box>
        ))}
      </Stack>
    );
  }

  if (variant === 'table') {
    return (
      <Box>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} variant="text" width="20%" height={32} />
          ))}
        </Stack>
        {Array.from({ length: count }).map((_, index) => (
          <Stack key={index} direction="row" spacing={2} sx={{ mb: 1 }}>
            {Array.from({ length: 4 }).map((_, colIndex) => (
              <Skeleton key={colIndex} variant="text" width="20%" height={40} />
            ))}
          </Stack>
        ))}
      </Box>
    );
  }

  // Default: simple skeleton
  return (
    <Stack spacing={1}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} variant="rectangular" height={height} sx={{ borderRadius: 1 }} />
      ))}
    </Stack>
  );
}

/**
 * Loading skeleton for dashboard cards
 */
export function DashboardCardSkeleton() {
  return (
    <Box sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <Skeleton variant="text" width="40%" height={20} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="60%" height={32} />
      <Skeleton variant="text" width="30%" height={16} sx={{ mt: 2 }} />
    </Box>
  );
}

/**
 * Loading skeleton for detail pages
 */
export function DetailPageSkeleton() {
  return (
    <Box>
      <Skeleton variant="text" width="40%" height={40} sx={{ mb: 3 }} />
      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 2 }} />
      <Stack spacing={2}>
        <Skeleton variant="text" width="100%" height={24} />
        <Skeleton variant="text" width="80%" height={24} />
        <Skeleton variant="text" width="90%" height={24} />
      </Stack>
    </Box>
  );
}

export default LoadingSkeleton;


