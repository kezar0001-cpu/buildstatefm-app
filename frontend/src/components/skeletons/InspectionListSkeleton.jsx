import React from 'react';
import { Box, Card, Checkbox, Grid, Skeleton, Stack, Typography } from '@mui/material';

/**
 * InspectionListSkeleton Component
 *
 * Loading skeleton for list view of inspections
 * Matches the layout of InspectionListItem with checkbox, title, details grid, and actions
 *
 * @param {number} items - Number of skeleton list items to display (default: 5)
 */
export default function InspectionListSkeleton({ items = 5 }) {
  return (
    <Stack spacing={2}>
      {Array.from({ length: items }).map((_, index) => (
        <Card
          key={`inspection-list-skeleton-${index}`}
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            animation: `fadeIn 0.5s ease-out ${index * 0.1}s both`,
            '@keyframes fadeIn': {
              '0%': { opacity: 0, transform: 'translateY(10px)' },
              '100%': { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          {/* Checkbox */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 2,
              pr: 0,
            }}
          >
            <Checkbox disabled />
          </Box>

          {/* Content */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              p: 2,
            }}
          >
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                mb: 1.5,
              }}
            >
              <Box sx={{ flex: 1 }}>
                {/* Title */}
                <Skeleton
                  variant="text"
                  width="60%"
                  height={32}
                  sx={{
                    mb: 0.5,
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.4 },
                    }
                  }}
                />
                {/* Status and Type Chips */}
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  <Skeleton
                    variant="rounded"
                    width={100}
                    height={24}
                    sx={{ borderRadius: 4 }}
                  />
                  <Skeleton
                    variant="rounded"
                    width={120}
                    height={24}
                    sx={{ borderRadius: 4 }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Details Grid */}
            <Grid container spacing={2}>
              {/* Property */}
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Property
                </Typography>
                <Skeleton variant="text" width="90%" height={24} />
              </Grid>

              {/* Unit */}
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Unit
                </Typography>
                <Skeleton variant="text" width="70%" height={24} />
              </Grid>

              {/* Scheduled Date */}
              <Grid item xs={12} sm={6} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Scheduled Date
                </Typography>
                <Skeleton variant="text" width="100%" height={24} />
              </Grid>

              {/* Type */}
              <Grid item xs={12} sm={6} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Type
                </Typography>
                <Skeleton variant="text" width="80%" height={24} />
              </Grid>

              {/* Technician */}
              <Grid item xs={12} sm={6} md={2}>
                <Typography variant="caption" color="text.secondary">
                  Technician
                </Typography>
                <Skeleton variant="text" width="85%" height={24} />
              </Grid>
            </Grid>
          </Box>

          {/* Actions */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 2,
              pl: { xs: 2, md: 0 },
            }}
          >
            <Skeleton variant="circular" width={40} height={40} />
          </Box>
        </Card>
      ))}
    </Stack>
  );
}
