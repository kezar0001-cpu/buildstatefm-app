import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  CheckCircleOutline as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  AccessTime as TimeIcon,
  MeetingRoom as RoomIcon,
  ListAlt as ItemsIcon,
} from '@mui/icons-material';

export default function InspectionChecklistPreview({ inspection }) {
  const rooms = inspection?.rooms || [];

  // Calculate total checklist items
  const totalItems = rooms.reduce((sum, room) => {
    return sum + (room.checklistItems?.length || 0);
  }, 0);

  // Estimate completion time (2 minutes per item on average)
  const estimatedMinutes = Math.max(totalItems * 2, 15); // Minimum 15 minutes
  const hours = Math.floor(estimatedMinutes / 60);
  const minutes = estimatedMinutes % 60;
  const estimatedTime = hours > 0
    ? `${hours}h ${minutes}m`
    : `${minutes} minutes`;

  if (rooms.length === 0) {
    return (
      <Alert severity="info">
        <Typography variant="body2">
          No checklist items configured for this inspection. You can add rooms
          and items as you conduct the inspection.
        </Typography>
      </Alert>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Inspection Checklist Preview
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review what needs to be inspected before you begin
            </Typography>
          </Box>

          {/* Summary Stats */}
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip
              icon={<RoomIcon />}
              label={`${rooms.length} Room${rooms.length !== 1 ? 's' : ''}`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<ItemsIcon />}
              label={`${totalItems} Item${totalItems !== 1 ? 's' : ''} to Check`}
              color="secondary"
              variant="outlined"
            />
            <Chip
              icon={<TimeIcon />}
              label={`~${estimatedTime}`}
              color="info"
              variant="outlined"
            />
          </Stack>

          <Divider />

          {/* Room Details */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Rooms & Items
            </Typography>
            {rooms.map((room, index) => (
              <Accordion
                key={room.id || index}
                defaultExpanded={index === 0}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ width: '100%' }}
                  >
                    <RoomIcon color="action" />
                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                      {room.name}
                    </Typography>
                    <Chip
                      label={`${room.checklistItems?.length || 0} items`}
                      size="small"
                      color="default"
                    />
                    {room.roomType && (
                      <Chip
                        label={room.roomType}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  {room.checklistItems && room.checklistItems.length > 0 ? (
                    <List dense>
                      {room.checklistItems
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((item, itemIndex) => (
                          <ListItem key={item.id || itemIndex}>
                            <ListItemIcon>
                              <CheckIcon fontSize="small" color="action" />
                            </ListItemIcon>
                            <ListItemText
                              primary={item.description}
                              primaryTypographyProps={{
                                variant: 'body2',
                              }}
                            />
                          </ListItem>
                        ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No checklist items for this room
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>

          {/* Tips */}
          <Alert severity="info" icon={<TimeIcon />}>
            <Typography variant="body2">
              <strong>Estimated time:</strong> {estimatedTime}
              <br />
              Take photos and add notes as you go through each item.
            </Typography>
          </Alert>
        </Stack>
      </CardContent>
    </Card>
  );
}
