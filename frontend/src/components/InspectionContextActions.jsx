import React from 'react';
import { Box, Button, IconButton, Tooltip, Stack } from '@mui/material';
import {
  PlayArrow as StartIcon,
  CheckCircle as CompleteIcon,
  ThumbUp as ApproveIcon,
  ThumbDown as RejectIcon,
  Visibility as ViewIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { INSPECTION_STATUS } from '../constants/inspections';
import { useCurrentUser } from '../context/UserContext';

/**
 * Context-aware action buttons for inspection cards
 * Shows relevant actions based on inspection status and user role
 *
 * @param {Object} inspection - The inspection object
 * @param {Function} onStartInspection - Handler for starting inspection
 * @param {Function} onCompleteInspection - Handler for completing inspection
 * @param {Function} onApprove - Handler for approving inspection
 * @param {Function} onReject - Handler for rejecting inspection
 * @param {Function} onCancel - Handler for cancelling inspection
 * @param {Function} onView - Handler for viewing inspection
 * @param {Function} onEdit - Handler for editing inspection
 * @param {String} variant - 'button' or 'icon' (default: 'button')
 * @param {String} size - 'small', 'medium', or 'large' (default: 'small')
 */
export const InspectionContextActions = ({
  inspection,
  onStartInspection,
  onCompleteInspection,
  onApprove,
  onReject,
  onCancel,
  onView,
  onEdit,
  variant = 'button',
  size = 'small',
  showSecondaryActions = false,
}) => {
  const { user: currentUser } = useCurrentUser();
  const isManager = currentUser?.role === 'MANAGER';
  const isAssigned = inspection?.assignedToId === currentUser?.id;

  // Determine primary action based on status
  const getPrimaryAction = () => {
    const { status } = inspection;

    switch (status) {
      case INSPECTION_STATUS.SCHEDULED:
        return {
          label: 'Start Inspection',
          icon: <StartIcon />,
          onClick: () => onStartInspection?.(inspection),
          color: 'primary',
          variant: 'contained',
        };

      case INSPECTION_STATUS.IN_PROGRESS:
        return {
          label: 'Complete',
          icon: <CompleteIcon />,
          onClick: () => onCompleteInspection?.(inspection),
          color: 'success',
          variant: 'contained',
        };

      case INSPECTION_STATUS.PENDING_APPROVAL:
        if (isManager) {
          return {
            label: 'Approve',
            icon: <ApproveIcon />,
            onClick: () => onApprove?.(inspection),
            color: 'success',
            variant: 'contained',
          };
        }
        return {
          label: 'View',
          icon: <ViewIcon />,
          onClick: () => onView?.(inspection.id),
          color: 'primary',
          variant: 'outlined',
        };

      case INSPECTION_STATUS.COMPLETED:
        return {
          label: 'View Report',
          icon: <ViewIcon />,
          onClick: () => onView?.(inspection.id),
          color: 'primary',
          variant: 'outlined',
        };

      case INSPECTION_STATUS.CANCELLED:
        return null; // No primary action for cancelled

      default:
        return null;
    }
  };

  // Determine secondary actions
  const getSecondaryActions = () => {
    const { status } = inspection;
    const actions = [];

    // For pending approval, managers can reject
    if (status === INSPECTION_STATUS.PENDING_APPROVAL && isManager) {
      actions.push({
        label: 'Reject',
        icon: <RejectIcon />,
        onClick: () => onReject?.(inspection),
        color: 'error',
      });
    }

    // For scheduled or in-progress, can cancel
    if (
      (status === INSPECTION_STATUS.SCHEDULED || status === INSPECTION_STATUS.IN_PROGRESS) &&
      (isManager || isAssigned)
    ) {
      actions.push({
        label: 'Cancel',
        icon: <CancelIcon />,
        onClick: () => onCancel?.(inspection),
        color: 'error',
      });
    }

    // Edit action (except for completed/cancelled)
    if (
      status !== INSPECTION_STATUS.COMPLETED &&
      status !== INSPECTION_STATUS.CANCELLED &&
      (isManager || isAssigned)
    ) {
      actions.push({
        label: 'Edit',
        icon: <EditIcon />,
        onClick: () => onEdit?.(inspection),
        color: 'default',
      });
    }

    return actions;
  };

  const primaryAction = getPrimaryAction();
  const secondaryActions = getSecondaryActions();

  if (!primaryAction && secondaryActions.length === 0) {
    return null;
  }

  // Icon button variant
  if (variant === 'icon') {
    return (
      <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
        {primaryAction && (
          <Tooltip title={primaryAction.label}>
            <IconButton
              size={size}
              color={primaryAction.color}
              onClick={primaryAction.onClick}
              sx={{
                bgcolor: primaryAction.variant === 'contained' ? `${primaryAction.color}.main` : 'transparent',
                color: primaryAction.variant === 'contained' ? 'white' : `${primaryAction.color}.main`,
                '&:hover': {
                  bgcolor: primaryAction.variant === 'contained' ? `${primaryAction.color}.dark` : 'action.hover',
                },
              }}
            >
              {primaryAction.icon}
            </IconButton>
          </Tooltip>
        )}
        {showSecondaryActions && secondaryActions.map((action, idx) => (
          <Tooltip key={idx} title={action.label}>
            <IconButton
              size={size}
              color={action.color}
              onClick={action.onClick}
            >
              {action.icon}
            </IconButton>
          </Tooltip>
        ))}
      </Stack>
    );
  }

  // Button variant
  return (
    <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
      {primaryAction && (
        <Button
          size={size}
          variant={primaryAction.variant}
          color={primaryAction.color}
          startIcon={primaryAction.icon}
          onClick={primaryAction.onClick}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {primaryAction.label}
        </Button>
      )}
      {showSecondaryActions && secondaryActions.map((action, idx) => (
        <Button
          key={idx}
          size={size}
          variant="outlined"
          color={action.color}
          startIcon={action.icon}
          onClick={action.onClick}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {action.label}
        </Button>
      ))}
    </Stack>
  );
};
