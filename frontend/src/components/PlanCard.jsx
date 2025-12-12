import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  CalendarToday as CalendarTodayIcon,
  Place as PlaceIcon,
  Schedule as ScheduleIcon,
  Work as WorkIcon,
  AutoMode as AutoModeIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';

const PlanCard = ({ plan, onClick, onEdit, onArchive }) => {
  const nextDueDate = plan.nextDueDate ? new Date(plan.nextDueDate) : null;
  const isOverdue = nextDueDate && isPast(nextDueDate) && !isToday(nextDueDate);
  const isDueToday = nextDueDate && isToday(nextDueDate);
  const isDueTomorrow = nextDueDate && isTomorrow(nextDueDate);
  const isArchived = !!plan.archivedAt;

  const getFrequencyLabel = (frequency) => {
    const labels = {
      DAILY: 'Daily',
      WEEKLY: 'Weekly',
      BIWEEKLY: 'Bi-weekly',
      MONTHLY: 'Monthly',
      QUARTERLY: 'Quarterly',
      SEMIANNUALLY: 'Semi-annually',
      ANNUALLY: 'Annually',
    };
    return labels[frequency] || frequency;
  };

  const getDueDateColor = () => {
    if (isOverdue) return 'error.main';
    if (isDueToday) return 'warning.main';
    if (isDueTomorrow) return 'info.main';
    return 'text.secondary';
  };

  const getDueDateLabel = () => {
    if (!nextDueDate) return 'Not scheduled';
    if (isOverdue) return `Overdue (${formatDistanceToNow(nextDueDate, { addSuffix: true })})`;
    if (isDueToday) return 'Due today';
    if (isDueTomorrow) return 'Due tomorrow';
    return `Due ${formatDistanceToNow(nextDueDate, { addSuffix: true })}`;
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit?.(plan);
  };

  const handleArchive = (e) => {
    e.stopPropagation();
    onArchive?.(plan);
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.3s ease-in-out',
        position: 'relative',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        opacity: plan.isActive ? 1 : 0.7,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
          opacity: 0,
          transition: 'opacity 0.3s ease-in-out',
        },
        '@media (hover: hover)': {
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 6,
            borderColor: 'primary.main',
            '&::before': {
              opacity: 1,
            },
          },
        },
      }}
      onClick={onClick}
    >
      <CardContent sx={{ flex: 1, pt: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Typography
            variant="h6"
            component="h3"
            sx={{
              fontSize: '1.125rem',
              fontWeight: 600,
              flex: 1,
              pr: 1,
            }}
          >
            {plan.name}
          </Typography>
          <Chip
            label={isArchived ? 'Archived' : plan.isActive ? 'Active' : 'Inactive'}
            size="small"
            color={isArchived ? 'default' : plan.isActive ? 'success' : 'default'}
            sx={{ flexShrink: 0 }}
          />
        </Box>

        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlaceIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" noWrap>
              {plan.property?.name}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
            <Chip
              label={getFrequencyLabel(plan.frequency)}
              size="small"
              variant="outlined"
              color="primary"
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarTodayIcon sx={{ fontSize: '1rem', color: getDueDateColor() }} />
            <Typography
              variant="body2"
              sx={{
                color: getDueDateColor(),
                fontWeight: isOverdue || isDueToday ? 600 : 400,
              }}
            >
              {getDueDateLabel()}
            </Typography>
          </Box>

          {plan.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {plan.description}
            </Typography>
          )}
        </Stack>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {plan.autoCreateJobs && (
            <Tooltip title="Auto-creates jobs">
              <AutoModeIcon sx={{ fontSize: '1rem', color: 'success.main' }} />
            </Tooltip>
          )}
          {plan._count?.jobs > 0 && (
            <Tooltip title={`${plan._count.jobs} jobs created`}>
              <Chip
                icon={<WorkIcon />}
                label={plan._count.jobs}
                size="small"
                variant="outlined"
                sx={{ height: '24px' }}
              />
            </Tooltip>
          )}
        </Stack>

        <Stack direction="row" spacing={0.5}>
          <Tooltip title="View details">
            <IconButton size="small" onClick={onClick}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={isArchived ? 'Restore plan' : 'Archive plan'}>
            <IconButton size="small" onClick={handleArchive}>
              {isArchived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit plan">
            <IconButton size="small" onClick={handleEdit} disabled={isArchived}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </CardActions>
    </Card>
  );
};

export default PlanCard;
