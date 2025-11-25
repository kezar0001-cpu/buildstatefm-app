export const JOB_STATUS_LABELS = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const VALID_STATUS_TRANSITIONS = {
  OPEN: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'OPEN', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'ASSIGNED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const STATUS_NOTIFICATION_MESSAGES = {
  ASSIGNED: 'This will notify the assigned technician.',
  IN_PROGRESS: 'This will notify the property manager that work has started.',
  COMPLETED: 'This will notify the property manager that the job is complete.',
  CANCELLED: 'This will notify subscribers that the job was cancelled.',
};

const STATUS_CONFIRMATION_TRANSITIONS = [
  ['OPEN', 'ASSIGNED'],
  ['ASSIGNED', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'COMPLETED'],
  ['OPEN', 'CANCELLED'],
  ['ASSIGNED', 'CANCELLED'],
  ['IN_PROGRESS', 'CANCELLED'],
];

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

export const requiresStatusConfirmation = (currentStatus, targetStatus) => {
  if (!canTransition(currentStatus, targetStatus)) return false;
  return STATUS_CONFIRMATION_TRANSITIONS.some(
    ([from, to]) => from === currentStatus && to === targetStatus
  );
};

export const getStatusNotification = (status) => STATUS_NOTIFICATION_MESSAGES[status] || '';
