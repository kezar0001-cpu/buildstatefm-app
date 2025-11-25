export const JOB_STATUS_LABELS = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const VALID_STATUS_TRANSITIONS = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'OPEN', 'CANCELLED', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED', 'ASSIGNED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const formatStatusLabel = (status) => JOB_STATUS_LABELS[status] || status?.replace('_', ' ') || '';

export const canTransition = (currentStatus, targetStatus) => {
  if (!currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true;
  return VALID_STATUS_TRANSITIONS[currentStatus]?.includes(targetStatus) || false;
};

export const getAllowedStatuses = (currentStatus) => {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return Array.from(new Set([currentStatus, ...allowedTransitions]));
};

export const getStatusHelperText = (currentStatus) => {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];

  if (allowedTransitions.length === 0) {
    return 'This status is terminal. No further transitions are available.';
  }

  const formattedTransitions = allowedTransitions.map((status) => formatStatusLabel(status)).join(', ');
  return `Allowed transitions: ${formattedTransitions}`;
};
