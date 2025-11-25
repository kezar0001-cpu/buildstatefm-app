import React from 'react';
import { Box, Card, Skeleton, Stack } from '@mui/material';

/**
 * ListSkeleton Component
 *
 * Loading skeleton for list views
 *
 * @param {number} items - Number of skeleton list items to display (default: 5)
 */
export default function ListSkeleton({ items = 5 }) {
  return (
    <Stack spacing={2}>
      {Array.from({ length: items }).map((_, index) => (
        <Card
          key={`list-skeleton-${index}`}
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Avatar/Icon skeleton */}
            <Skeleton variant="circular" width={48} height={48} />

            {/* Content skeleton */}
            <Stack spacing={1} sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="40%" height={20} />
            </Stack>

            {/* Status/Badge skeleton */}
            <Skeleton
              variant="rounded"
              width={80}
              height={28}
              sx={{ borderRadius: 4 }}
            />

            {/* Actions skeleton */}
            <Skeleton variant="circular" width={32} height={32} />
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
