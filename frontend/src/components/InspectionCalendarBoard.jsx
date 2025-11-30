import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Collapse,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Badge,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarMonth as CalendarMonthIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Image as ImageIcon,
  Room as RoomIcon,
} from '@mui/icons-material';

const STATUS_COLOR = {
  SCHEDULED: 'default',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const DAY_LABEL = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const DATE_LABEL = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function toDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Enhanced Inspection Card Component
const EnhancedInspectionCard = ({ inspection, canDrag, onDragStart }) => {
  const [expanded, setExpanded] = useState(false);

  // Calculate room progress
  const rooms = inspection.rooms || [];
  const totalRooms = rooms.length;
  const completedRooms = rooms.filter(room => {
    const items = room.checklistItems || [];
    return items.length > 0 && items.every(item => item.isChecked);
  }).length;
  const roomProgress = totalRooms > 0 ? (completedRooms / totalRooms) * 100 : 0;

  // Calculate issue counts and severity
  const issues = inspection.issues || [];
  const criticalIssues = issues.filter(i => i.severity === 'CRITICAL').length;
  const highIssues = issues.filter(i => i.severity === 'HIGH').length;
  const mediumIssues = issues.filter(i => i.severity === 'MEDIUM').length;
  const lowIssues = issues.filter(i => i.severity === 'LOW').length;
  const totalIssues = issues.length;

  // Get highest severity for badge color
  const getSeverityColor = () => {
    if (criticalIssues > 0) return 'error';
    if (highIssues > 0) return 'error';
    if (mediumIssues > 0) return 'warning';
    if (lowIssues > 0) return 'info';
    return 'default';
  };

  // Get photos
  const photos = inspection.photos || [];
  const photoCount = photos.length;

  const handleExpand = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <Card
      variant="outlined"
      draggable={canDrag}
      onDragStart={(event) => onDragStart(event, inspection.id)}
      sx={{
        cursor: canDrag ? 'grab' : 'default',
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: 2,
        }
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flex: 1, pr: 1 }}>
            {inspection.title}
          </Typography>
          {totalRooms > 0 && (
            <IconButton
              size="small"
              onClick={handleExpand}
              sx={{ mt: -0.5, mr: -0.5 }}
            >
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          )}
        </Stack>

        {/* Status and Badges */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
          <Chip
            size="small"
            label={inspection.status?.replace('_', ' ') || 'Scheduled'}
            color={STATUS_COLOR[inspection.status] || 'default'}
          />

          {totalIssues > 0 && (
            <Tooltip title={`${criticalIssues} critical, ${highIssues} high, ${mediumIssues} medium, ${lowIssues} low`}>
              <Chip
                size="small"
                icon={<ErrorIcon />}
                label={totalIssues}
                color={getSeverityColor()}
              />
            </Tooltip>
          )}

          {photoCount > 0 && (
            <Tooltip title={`${photoCount} photo${photoCount > 1 ? 's' : ''}`}>
              <Chip
                size="small"
                icon={<ImageIcon />}
                label={photoCount}
                color="default"
              />
            </Tooltip>
          )}
        </Stack>

        {/* Property and Unit */}
        {inspection.property && (
          <Typography variant="caption" color="text.secondary" display="block">
            {inspection.property}
          </Typography>
        )}
        {inspection.unit && (
          <Typography variant="caption" color="text.secondary" display="block">
            Unit {inspection.unit}
          </Typography>
        )}

        {/* Room Progress Bar (always visible if rooms exist) */}
        {totalRooms > 0 && (
          <Box sx={{ mt: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Rooms: {completedRooms}/{totalRooms}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {Math.round(roomProgress)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={roomProgress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  bgcolor: roomProgress === 100 ? 'success.main' : 'primary.main',
                }
              }}
            />
          </Box>
        )}

        {/* Expandable Details */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            {/* Room Details */}
            {rooms.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <RoomIcon fontSize="small" color="action" />
                  <Typography variant="caption" fontWeight={600}>
                    Rooms ({rooms.length})
                  </Typography>
                </Stack>
                <Stack spacing={0.5}>
                  {rooms.slice(0, 3).map((room) => {
                    const items = room.checklistItems || [];
                    const checkedItems = items.filter(i => i.isChecked).length;
                    const isComplete = items.length > 0 && checkedItems === items.length;
                    return (
                      <Stack key={room.id} direction="row" spacing={0.5} alignItems="center">
                        {isComplete ? (
                          <CheckCircleIcon fontSize="small" color="success" />
                        ) : (
                          <Box sx={{ width: 20, height: 20 }} />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {room.name} {items.length > 0 && `(${checkedItems}/${items.length})`}
                        </Typography>
                      </Stack>
                    );
                  })}
                  {rooms.length > 3 && (
                    <Typography variant="caption" color="text.secondary" sx={{ pl: 3 }}>
                      +{rooms.length - 3} more
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}

            {/* Photo Previews */}
            {photos.length > 0 && (
              <Box>
                <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                  Photos ({photoCount})
                </Typography>
                <AvatarGroup max={4} sx={{ justifyContent: 'flex-start' }}>
                  {photos.slice(0, 4).map((photo, idx) => (
                    <Avatar
                      key={photo.id || idx}
                      src={photo.url}
                      variant="rounded"
                      sx={{
                        width: 32,
                        height: 32,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <ImageIcon fontSize="small" />
                    </Avatar>
                  ))}
                </AvatarGroup>
              </Box>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

const InspectionCalendarBoard = ({
  startDate,
  events = [],
  onChangeRange,
  onMove,
  canDrag = false,
  isLoading = false,
}) => {
  const days = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [startDate]);

  const grouped = useMemo(() => {
    const map = new Map();
    days.forEach((day) => map.set(toDateKey(day), []));
    events.forEach((event) => {
      const date = event.start ? new Date(event.start) : null;
      if (!date) return;
      date.setHours(0, 0, 0, 0);
      const key = toDateKey(date);
      if (!map.has(key)) return;
      map.get(key).push(event);
    });
    return map;
  }, [days, events]);

  const handleDragStart = (event, inspectionId) => {
    if (!canDrag) return;
    event.dataTransfer.setData('application/json', JSON.stringify({ inspectionId }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (event, date) => {
    if (!canDrag) return;
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData('application/json'));
      if (payload?.inspectionId) {
        onMove?.(payload.inspectionId, date);
      }
    } catch (error) {
      console.error('Failed to parse drag payload', error);
    }
  };

  const allowDrop = (event) => {
    if (!canDrag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden' }}>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarMonthIcon color="primary" />
            <Box>
              <Typography variant="h6">Inspection schedule</Typography>
              <Typography variant="body2" color="text.secondary">
                Drag inspections between days to reschedule
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Previous week">
              <span>
                <IconButton
                  onClick={() => onChangeRange(-7)}
                  disabled={isLoading}
                >
                  <ArrowBackIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next week">
              <span>
                <IconButton
                  onClick={() => onChangeRange(7)}
                  disabled={isLoading}
                >
                  <ArrowForwardIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))',
            gap: 2,
            overflowX: 'auto',
          }}
        >
          {days.map((day) => {
            const key = toDateKey(day);
            const dayEvents = grouped.get(key) || [];
            return (
              <Box
                key={key}
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  minHeight: 220,
                  bgcolor: 'background.paper',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onDragOver={allowDrop}
                onDrop={(event) => handleDrop(event, day)}
              >
                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2">{DAY_LABEL.format(day)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {DATE_LABEL.format(day)}
                  </Typography>
                </Box>
                <Stack spacing={1.5} sx={{ p: 1.5, flexGrow: 1, overflowY: 'auto' }}>
                  {!dayEvents.length && (
                    <Typography variant="caption" color="text.secondary">
                      {isLoading ? 'Loading…' : 'No inspections'}
                    </Typography>
                  )}
                  {dayEvents.map((inspection) => (
                    <EnhancedInspectionCard
                      key={inspection.id}
                      inspection={inspection}
                      canDrag={canDrag}
                      onDragStart={handleDragStart}
                    />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
};

export default InspectionCalendarBoard;
