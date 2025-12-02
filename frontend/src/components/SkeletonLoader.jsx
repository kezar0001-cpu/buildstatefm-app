import React from 'react';
import { Box, Skeleton, Stack } from '@mui/material';

/**
 * Reusable skeleton loader components for consistent loading states.
 */

/**
 * Card skeleton loader - for property cards, job cards, etc.
 */
export function CardSkeleton({ count = 1, height = 200 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 2, mb: 1 }} />
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </Box>
      ))}
    </>
  );
}

/**
 * List skeleton loader - for table rows, list items
 */
export function ListSkeleton({ count = 5, rowHeight = 60 }) {
  return (
    <Stack spacing={1}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          variant="rectangular"
          height={rowHeight}
          sx={{ borderRadius: 1 }}
        />
      ))}
    </Stack>
  );
}

/**
 * Table skeleton loader - for data tables
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <Box>
      {/* Header skeleton */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} variant="text" width="100%" />
        ))}
      </Box>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box key={rowIndex} sx={{ display: 'flex', gap: 2, mb: 1 }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" width="100%" />
          ))}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Dashboard stats skeleton - for dashboard summary cards
 */
export function DashboardStatsSkeleton({ count = 4 }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: `repeat(${count}, 1fr)` }, gap: 2 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="40%" height={32} />
        </Box>
      ))}
    </Box>
  );
}

/**
 * Form skeleton loader - for form fields
 */
export function FormSkeleton({ fields = 5 }) {
  return (
    <Stack spacing={3}>
      {Array.from({ length: fields }).map((_, index) => (
        <Box key={index}>
          <Skeleton variant="text" width="30%" height={20} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
        </Box>
      ))}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
      </Box>
    </Stack>
  );
}

/**
 * Detail page skeleton - for detail pages with multiple sections
 */
export function DetailPageSkeleton() {
  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box>
        <Skeleton variant="text" width="40%" height={40} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="60%" height={24} />
      </Box>
      
      {/* Content sections */}
      <Box>
        <Skeleton variant="text" width="30%" height={28} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 2 }} />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="90%" />
      </Box>
      
      <Box>
        <Skeleton variant="text" width="30%" height={28} sx={{ mb: 2 }} />
        <Stack spacing={1}>
          <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
        </Stack>
      </Box>
    </Stack>
  );
}

/**
 * Generic page skeleton - for general page loading
 */
export function PageSkeleton({ showHeader = true }) {
  return (
    <Box sx={{ p: 3 }}>
      {showHeader && (
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="text" width="40%" height={32} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="60%" height={20} />
        </Box>
      )}
      <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
    </Box>
  );
}

export default {
  CardSkeleton,
  ListSkeleton,
  TableSkeleton,
  DashboardStatsSkeleton,
  FormSkeleton,
  DetailPageSkeleton,
  PageSkeleton,
};

