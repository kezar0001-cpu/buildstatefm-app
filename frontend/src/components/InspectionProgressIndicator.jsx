import React from 'react';
import { Box, Typography, LinearProgress, Chip } from '@mui/material';
import { CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';

const InspectionProgressIndicator = ({ inspection, variant = 'full' }) => {
  const rooms = inspection?.rooms || [];
  const totalRooms = rooms.length;

  if (totalRooms === 0) {
    return null;
  }

  const completedRooms = rooms.filter((room) => {
    const items = room.checklistItems || [];
    if (items.length === 0) return false;
    return items.every((item) => item.status !== 'PENDING');
  }).length;

  const allChecklistItems = rooms.flatMap((room) => room.checklistItems || []);
  const totalChecklistItems = allChecklistItems.length;
  const completedChecklistItems = allChecklistItems.filter(
    (item) => item.status === 'PASSED' || item.status === 'FAILED' || item.status === 'NA'
  ).length;

  const checklistPercentage = totalChecklistItems > 0
    ? Math.round((completedChecklistItems / totalChecklistItems) * 100)
    : 0;

  if (variant === 'compact') {
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip
          icon={<RadioButtonUnchecked />}
          label={`${completedRooms}/${totalRooms} rooms`}
          size="small"
          variant="outlined"
          color={completedRooms === totalRooms ? 'success' : 'default'}
        />
        <Chip
          icon={<CheckCircle />}
          label={`${checklistPercentage}% complete`}
          size="small"
          variant="outlined"
          color={checklistPercentage === 100 ? 'success' : checklistPercentage >= 50 ? 'warning' : 'default'}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          Rooms: {completedRooms}/{totalRooms}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Checklist: {completedChecklistItems}/{totalChecklistItems} ({checklistPercentage}%)
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={checklistPercentage}
        sx={{
          height: 6,
          borderRadius: 1,
          backgroundColor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 1,
            backgroundColor:
              checklistPercentage === 100
                ? 'success.main'
                : checklistPercentage >= 50
                ? 'warning.main'
                : 'primary.main',
          },
        }}
      />
    </Box>
  );
};

export default InspectionProgressIndicator;
