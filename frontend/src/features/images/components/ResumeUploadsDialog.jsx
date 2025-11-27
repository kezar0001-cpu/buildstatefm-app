import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Dialog for resuming interrupted uploads
 *
 * Shows when interrupted uploads are detected from localStorage
 * and allows user to resume or dismiss them
 */
export function ResumeUploadsDialog({
  open = false,
  interruptedCount = 0,
  onResume,
  onDismiss,
}) {
  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Resume Interrupted Uploads?
      </DialogTitle>
      <DialogContent>
        <DialogContentText gutterBottom>
          We found {interruptedCount} upload{interruptedCount !== 1 ? 's' : ''} that{' '}
          {interruptedCount !== 1 ? 'were' : 'was'} interrupted.
        </DialogContentText>
        <Alert severity="info" sx={{ mt: 2 }}>
          Note: You'll need to re-add the files to continue uploading, as file data cannot be
          stored between sessions for security reasons.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onDismiss}
          startIcon={<CloseIcon />}
          color="inherit"
        >
          Dismiss
        </Button>
        <Button
          onClick={onResume}
          startIcon={<RestoreIcon />}
          variant="contained"
          autoFocus
        >
          Show Interrupted Uploads
        </Button>
      </DialogActions>
    </Dialog>
  );
}
