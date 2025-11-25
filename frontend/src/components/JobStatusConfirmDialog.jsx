import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import { formatStatusLabel, getStatusNotification } from '../constants/jobStatuses.js';

/**
 * Confirmation dialog for job status transitions that send notifications
 * @param {boolean} open - Whether the dialog is open
 * @param {function} onClose - Handler for closing the dialog
 * @param {function} onConfirm - Handler for confirming the status change
 * @param {string} currentStatus - Current job status
 * @param {string} newStatus - New job status
 * @param {string} jobTitle - Title of the job
 * @param {boolean} isLoading - Whether the status update is in progress
 */
const JobStatusConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  currentStatus,
  newStatus,
  jobTitle,
  isLoading = false
}) => {
  const notificationMessage = getStatusNotification(newStatus);

  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Confirm Status Change</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to change the status of <strong>"{jobTitle}"</strong> from{' '}
          <strong>{formatStatusLabel(currentStatus)}</strong> to{' '}
          <strong>{formatStatusLabel(newStatus)}</strong>?
        </DialogContentText>
        {notificationMessage && (
          <DialogContentText sx={{ mt: 2, fontWeight: 500, color: 'primary.main' }}>
            {notificationMessage}
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="primary"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {isLoading ? 'Updating...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default JobStatusConfirmDialog;
