import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

/**
 * Reusable confirmation dialog for destructive or important actions.
 * 
 * @param {boolean} open - Whether the dialog is open
 * @param {function} onClose - Callback when dialog is closed/cancelled
 * @param {function} onConfirm - Callback when action is confirmed
 * @param {string} title - Dialog title (default: "Confirm Action")
 * @param {string} message - Dialog message/description
 * @param {string} confirmLabel - Label for confirm button (default: "Confirm")
 * @param {string} cancelLabel - Label for cancel button (default: "Cancel")
 * @param {string} variant - Dialog variant: "danger", "warning", or "info" (default: "warning")
 * @param {boolean} isLoading - Whether the action is in progress
 * @param {string} error - Error message to display
 * @param {boolean} disableBackdropClick - Prevent closing on backdrop click when loading
 */
const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  isLoading = false,
  error = null,
  disableBackdropClick = false,
}) => {
  const handleClose = (event, reason) => {
    if (isLoading) return;
    if (disableBackdropClick && reason === 'backdropClick') return;
    onClose?.();
  };

  const getVariantConfig = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <DeleteIcon sx={{ color: 'error.main', fontSize: 28 }} />,
          confirmColor: 'error',
          titleColor: 'error.main',
        };
      case 'warning':
        return {
          icon: <WarningIcon sx={{ color: 'warning.main', fontSize: 28 }} />,
          confirmColor: 'warning',
          titleColor: 'warning.main',
        };
      case 'info':
      default:
        return {
          icon: <InfoIcon sx={{ color: 'info.main', fontSize: 28 }} />,
          confirmColor: 'primary',
          titleColor: 'info.main',
        };
    }
  };

  const config = getVariantConfig();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <DialogTitle
        id="confirm-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pb: 1,
        }}
      >
        {config.icon}
        <span style={{ color: 'inherit' }}>{title}</span>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText id="confirm-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={isLoading}
          color="inherit"
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={config.confirmColor}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {isLoading ? 'Processing...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
