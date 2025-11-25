import React from 'react';
import { Box, Card, CardContent, Grid, Skeleton, Stack } from '@mui/material';

/**
 * CardGridSkeleton Component
 *
 * Loading skeleton for grid/card views
 *
 * @param {number} cards - Number of skeleton cards to display (default: 6)
 */
export default function CardGridSkeleton({ cards = 6 }) {
  return (
    <Grid container spacing={3}>
      {Array.from({ length: cards }).map((_, index) => (
        <Grid item xs={12} sm={6} md={4} key={`card-skeleton-${index}`}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
            }}
          >
            <CardContent>
              <Stack spacing={2}>
                {/* Title skeleton */}
                <Skeleton variant="text" width="70%" height={32} />

                {/* Subtitle skeleton */}
                <Skeleton variant="text" width="50%" height={20} />

                {/* Content skeleton */}
                <Stack spacing={1}>
                  <Skeleton variant="text" width="100%" height={16} />
                  <Skeleton variant="text" width="90%" height={16} />
                  <Skeleton variant="text" width="80%" height={16} />
                </Stack>

                {/* Chips/badges skeleton */}
                <Stack direction="row" spacing={1}>
                  <Skeleton
                    variant="rounded"
                    width={80}
                    height={24}
                    sx={{ borderRadius: 4 }}
                  />
                  <Skeleton
                    variant="rounded"
                    width={60}
                    height={24}
                    sx={{ borderRadius: 4 }}
                  />
                </Stack>

                {/* Action buttons skeleton */}
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Skeleton
                    variant="rounded"
                    width={100}
                    height={36}
                    sx={{ borderRadius: 2 }}
                  />
                  <Skeleton
                    variant="rounded"
                    width={80}
                    height={36}
                    sx={{ borderRadius: 2 }}
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
