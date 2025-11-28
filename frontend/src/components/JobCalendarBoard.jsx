import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarMonth as CalendarMonthIcon,
} from '@mui/icons-material';

const STATUS_COLOR = {
  OPEN: 'default',
  ASSIGNED: 'info',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const DAY_LABEL = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const DATE_LABEL = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function toDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const JobCalendarBoard = ({
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

  const handleDragStart = (event, jobId) => {
    if (!canDrag) return;
    event.dataTransfer.setData('application/json', JSON.stringify({ jobId }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (event, date) => {
    if (!canDrag) return;
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData('application/json'));
      if (payload?.jobId) {
        onMove?.(payload.jobId, date);
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
              <Typography variant="h6">Job schedule</Typography>
              <Typography variant="body2" color="text.secondary">
                Drag jobs between days to reschedule
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
                      {isLoading ? 'Loading…' : 'No jobs'}
                    </Typography>
                  )}
                  {dayEvents.map((job) => (
                    <Card
                      key={job.id}
                      variant="outlined"
                      draggable={canDrag}
                      onDragStart={(event) => handleDragStart(event, job.id)}
                      sx={{ cursor: canDrag ? 'grab' : 'default' }}
                    >
                      <CardContent sx={{ p: 1.5 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {job.title}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Chip
                            size="small"
                            label={job.status?.replace('_', ' ') || 'Open'}
                            color={STATUS_COLOR[job.status] || 'default'}
                          />
                          {job.priority && (
                            <Chip
                              size="small"
                              label={job.priority}
                              color={
                                job.priority === 'URGENT' ? 'error' :
                                job.priority === 'HIGH' ? 'warning' :
                                job.priority === 'MEDIUM' ? 'info' : 'default'
                              }
                              variant="outlined"
                            />
                          )}
                        </Stack>
                        {job.property && (
                          <Typography variant="caption" color="text.secondary">
                            {job.property}
                          </Typography>
                        )}
                        {job.assignedTo && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {job.assignedTo}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
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

export default JobCalendarBoard;
