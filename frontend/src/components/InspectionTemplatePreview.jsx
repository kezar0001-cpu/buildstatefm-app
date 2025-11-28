import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Collapse,
} from '@mui/material';
import { CheckCircleOutline, RoomOutlined } from '@mui/icons-material';

const InspectionTemplatePreview = ({ template }) => {
  if (!template) {
    return null;
  }

  const totalChecklistItems = template.rooms?.reduce(
    (sum, room) => sum + (room.checklistItems?.length || 0),
    0
  );

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Template Preview: {template.name}
          </Typography>
          <Chip
            label={template.type}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>

        {template.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {template.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Chip
            icon={<RoomOutlined />}
            label={`${template.rooms?.length || 0} rooms`}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<CheckCircleOutline />}
            label={`${totalChecklistItems} checklist items`}
            size="small"
            variant="outlined"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Rooms & Checklist Items:
        </Typography>

        <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
          {template.rooms?.map((room, roomIndex) => (
            <Box key={room.id || roomIndex}>
              <ListItem
                sx={{
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RoomOutlined fontSize="small" />
                      <Typography variant="subtitle2">
                        {room.name}
                      </Typography>
                      <Chip
                        label={room.roomType}
                        size="small"
                        variant="outlined"
                        sx={{ ml: 'auto' }}
                      />
                    </Box>
                  }
                />
              </ListItem>
              {room.checklistItems && room.checklistItems.length > 0 && (
                <List dense sx={{ pl: 4, mb: 1 }}>
                  {room.checklistItems.map((item, itemIndex) => (
                    <ListItem key={item.id || itemIndex}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircleOutline fontSize="small" color="action" />
                            <Typography variant="body2">
                              {item.description}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export default InspectionTemplatePreview;
