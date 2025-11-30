import React from 'react';
import { Box, Card, CardContent, Chip, Grid, Paper, Skeleton, Stack, Typography } from '@mui/material';

/**
 * InspectionKanbanSkeleton Component
 *
 * Loading skeleton for Kanban board view of inspections
 * Matches the layout of InspectionKanban with 4 status columns
 *
 * @param {number} cardsPerColumn - Number of skeleton cards per column (default: 3)
 */
export default function InspectionKanbanSkeleton({ cardsPerColumn = 3 }) {
  const columns = [
    { id: 'SCHEDULED', title: 'Scheduled', color: 'success' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'warning' },
    { id: 'COMPLETED', title: 'Completed', color: 'success' },
    { id: 'CANCELLED', title: 'Cancelled', color: 'error' },
  ];

  return (
    <Grid container spacing={2}>
      {columns.map((column, columnIndex) => (
        <Grid item xs={12} md={6} lg={3} key={column.id}>
          <Paper
            sx={{
              p: 2,
              height: '100%',
              minHeight: 400,
              bgcolor: 'background.default',
              borderRadius: 2,
              animation: `fadeIn 0.5s ease-out ${columnIndex * 0.1}s both`,
              '@keyframes fadeIn': {
                '0%': { opacity: 0, transform: 'translateY(10px)' },
                '100%': { opacity: 1, transform: 'translateY(0)' },
              },
            }}
          >
            {/* Column Header */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                {column.title}
              </Typography>
              <Skeleton
                variant="rounded"
                width={32}
                height={24}
                sx={{ borderRadius: 4 }}
              />
            </Box>

            {/* Column Cards */}
            <Stack spacing={2}>
              {Array.from({ length: cardsPerColumn }).map((_, cardIndex) => (
                <Card
                  key={`${column.id}-card-${cardIndex}`}
                  sx={{
                    animation: `slideIn 0.5s ease-out ${(columnIndex * 0.1) + (cardIndex * 0.15)}s both`,
                    '@keyframes slideIn': {
                      '0%': { opacity: 0, transform: 'translateX(-10px)' },
                      '100%': { opacity: 1, transform: 'translateX(0)' },
                    },
                  }}
                >
                  <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, '&:last-child': { pb: 2 } }}>
                    {/* Header - Title */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Skeleton
                        variant="text"
                        width="75%"
                        height={28}
                        sx={{
                          animation: 'pulse 1.5s ease-in-out infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.4 },
                          }
                        }}
                      />
                    </Box>

                    {/* Type Chip */}
                    <Skeleton
                      variant="rounded"
                      width={100}
                      height={24}
                      sx={{ borderRadius: 4 }}
                    />

                    {/* Details Box */}
                    <Box
                      sx={{
                        bgcolor: 'action.hover',
                        borderRadius: 1.5,
                        p: 1.5,
                      }}
                    >
                      <Stack spacing={1.5}>
                        {/* Property */}
                        <Box>
                          <Skeleton variant="text" width={60} height={16} sx={{ mb: 0.5 }} />
                          <Skeleton variant="text" width="90%" height={20} />
                        </Box>

                        {/* Unit */}
                        <Box>
                          <Skeleton variant="text" width={40} height={16} sx={{ mb: 0.5 }} />
                          <Skeleton variant="text" width="70%" height={20} />
                        </Box>

                        {/* Date/Time */}
                        <Box>
                          <Skeleton variant="text" width={80} height={16} sx={{ mb: 0.5 }} />
                          <Skeleton variant="text" width="85%" height={20} />
                        </Box>

                        {/* Technician */}
                        <Box>
                          <Skeleton variant="text" width={70} height={16} sx={{ mb: 0.5 }} />
                          <Skeleton variant="text" width="80%" height={20} />
                        </Box>
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
